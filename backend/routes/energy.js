/**
 * 能耗记录路由
 * 处理油耗、电耗记录的增删改查
 */

const express = require('express');
const router = express.Router();
const { query, get } = require('../config/database');
const { authenticateUser, authenticateApiKey, checkVehicleOwnership } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 重新计算指定车辆的所有能耗记录 (里程差和百公里油耗)
 * 解决乱序录入、补录或历史编辑导致的计算不准问题
 */
async function recalculateVehicleLogs(vehicleId) {
    if (!vehicleId) return;

    // 1. 获取该车辆的所有记录，严格按时间线排序
    const logs = await query(
        `SELECT * FROM energy_logs 
         WHERE vehicle_id = ? 
         ORDER BY log_date ASC, mileage ASC, id ASC`,
        [vehicleId]
    );

    if (logs.length === 0) return;

    let prevLog = null;
    // 分别追踪油耗和电耗的计算周期 (防止插混车混合计算)
    const trackers = {
        fuel: { lastFull: null, sum: 0 },
        electric: { lastFull: null, sum: 0 }
    };

    for (const log of logs) {
        let mileage_diff = null;
        let consumption = null;

        // 计算里程差 (对比时间线上的一条记录)
        if (prevLog) {
            mileage_diff = log.mileage - prevLog.mileage;
            if (mileage_diff < 0) mileage_diff = 0; // 容错处理：里程回退
        }

        const type = log.energy_type || 'fuel';
        const tracker = trackers[type] || trackers.fuel;

        if (log.is_full) {
            // “加满到加满”计算逻辑
            if (tracker.lastFull) {
                const cycleMileage = log.mileage - tracker.lastFull.mileage;
                if (cycleMileage > 0) {
                    // 总油量 = 本次加油量 + 周期内中间记录的加油量之和
                    const totalAmount = parseFloat(tracker.sum) + parseFloat(log.amount);
                    consumption = (totalAmount / cycleMileage) * 100;
                    consumption = Math.round(consumption * 100) / 100;
                } else if (cycleMileage === 0) {
                    // 同一里程多次加油
                    consumption = 0;
                }
            }
            // 开启新一轮周期
            tracker.lastFull = log;
            tracker.sum = 0;
        } else {
            // 未加满：不计算能耗，将油量累加到下一次加满
            tracker.sum += parseFloat(log.amount);
            consumption = null;
        }

        // 批量回写结果 (保持 ID 不变)
        await query(
            `UPDATE energy_logs 
             SET mileage_diff = ?, consumption_per_100km = ? 
             WHERE id = ?`,
            [mileage_diff, consumption, log.id]
        );

        prevLog = log;
    }
}

/**
 * 添加能耗记录
 * POST /api/energy
 */
router.post('/', authenticateUser, asyncHandler(async (req, res) => {
    const {
        vehicle_id,
        log_date,
        mileage,
        energy_type,
        amount,
        cost,
        unit_price,
        fuel_gauge_reading,
        is_full,
        location_name,
        location_lat,
        location_lng,
        notes
    } = req.body;

    // 验证必填字段
    if (!vehicle_id || !log_date || !mileage || !energy_type || !amount) {
        return res.status(400).json({
            success: false,
            message: '车辆ID、日期、里程、能耗类型和加油量/充电量不能为空'
        });
    }

    // 验证能耗类型
    if (!['fuel', 'electric'].includes(energy_type)) {
        return res.status(400).json({
            success: false,
            message: '能耗类型必须是 fuel(油) 或 electric(电)'
        });
    }

    // 验证车辆所有权
    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [vehicle_id, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    // 插入记录
    const result = await query(
        `INSERT INTO energy_logs 
         (vehicle_id, log_date, mileage, energy_type, amount, cost, unit_price, 
          fuel_gauge_reading, is_full,
          location_name, location_lat, location_lng, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vehicle_id, log_date, mileage, energy_type, amount, cost, unit_price,
            fuel_gauge_reading, is_full ? 1 : 0,
            location_name, location_lat, location_lng, notes]
    );

    // 触发全局重算 (确保链条准确)
    await recalculateVehicleLogs(vehicle_id);

    // 更新车辆当前里程
    const currentVehicle = await get('SELECT current_mileage FROM vehicles WHERE id = ?', [vehicle_id]);
    if (currentVehicle && parseInt(mileage) > currentVehicle.current_mileage) {
        await query(
            'UPDATE vehicles SET current_mileage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [mileage, vehicle_id]
        );
    }

    // 获取计算后的记录返回
    const updatedLog = await get('SELECT * FROM energy_logs WHERE id = ?', [result.lastID]);

    res.status(201).json({
        success: true,
        message: '能耗记录添加成功',
        data: updatedLog
    });
}));

/**
 * 快速添加能耗记录 (通过 API Key)
 * GET /api/energy/quick
 * 查询参数: apiKey, mileage, amount, [cost], [location_name], [location_lat], [location_lng]
 */
router.get('/quick', authenticateApiKey, asyncHandler(async (req, res) => {
    const {
        mileage,
        amount,
        cost,
        location_name,
        location_lat,
        location_lng,
        is_full
    } = req.query;

    if (!mileage || !amount) {
        return res.status(400).json({
            success: false,
            message: '里程和加油量/充电量不能为空'
        });
    }

    // API Key 应该关联到特定车辆
    const vehicle_id = req.apiKey.vehicle_id;

    if (!vehicle_id) {
        return res.status(400).json({
            success: false,
            message: '该 API Key 未关联到任何车辆'
        });
    }

    // 获取车辆信息以判断能耗类型
    const vehicle = await get('SELECT power_type FROM vehicles WHERE id = ?', [vehicle_id]);
    const energy_type = vehicle.power_type === 'electric' ? 'electric' : 'fuel';

    // 插入记录
    const log_date = new Date().toISOString();
    const unit_price = cost && amount ? parseFloat(cost) / parseFloat(amount) : null;

    const result = await query(
        `INSERT INTO energy_logs 
         (vehicle_id, log_date, mileage, energy_type, amount, cost, unit_price, is_full,
          location_name, location_lat, location_lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vehicle_id, log_date, mileage, energy_type, amount, cost, unit_price, isFullVal,
            location_name, location_lat, location_lng]
    );

    // 触发全局重算
    await recalculateVehicleLogs(vehicle_id);

    // 更新车辆里程
    if (parseInt(mileage) > vehicle.current_mileage) {
        await query(
            'UPDATE vehicles SET current_mileage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [mileage, vehicle_id]
        );
    }

    const updatedLog = await get('SELECT * FROM energy_logs WHERE id = ?', [result.lastID]);

    res.json({
        success: true,
        message: '记录添加成功',
        data: updatedLog
    });
}));

/**
 * 获取能耗记录列表
 * GET /api/energy
 * 查询参数: vehicle_id, energy_type, start_date, end_date, limit, offset
 */
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicle_id, energy_type, start_date, end_date, limit = 50, offset = 0 } = req.query;

    let sql = `SELECT e.*, v.plate_number, v.brand, v.model 
               FROM energy_logs e 
               JOIN vehicles v ON e.vehicle_id = v.id 
               WHERE v.user_id = ?`;
    const params = [req.userId];

    // 车辆过滤
    if (vehicle_id) {
        sql += ' AND e.vehicle_id = ?';
        params.push(vehicle_id);
    }

    // 能耗类型过滤
    if (energy_type) {
        sql += ' AND e.energy_type = ?';
        params.push(energy_type);
    }

    // 日期范围过滤
    if (start_date) {
        sql += ' AND e.log_date >= ?';
        params.push(start_date);
    }
    if (end_date) {
        sql += ' AND e.log_date <= ?';
        params.push(end_date);
    }

    sql += ' ORDER BY e.log_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const logs = await query(sql, params);

    // 获取总数
    let countSql = `SELECT COUNT(*) as total 
                    FROM energy_logs e 
                    JOIN vehicles v ON e.vehicle_id = v.id 
                    WHERE v.user_id = ?`;
    const countParams = [req.userId];

    if (vehicle_id) {
        countSql += ' AND e.vehicle_id = ?';
        countParams.push(vehicle_id);
    }
    if (energy_type) {
        countSql += ' AND e.energy_type = ?';
        countParams.push(energy_type);
    }
    if (start_date) {
        countSql += ' AND e.log_date >= ?';
        countParams.push(start_date);
    }
    if (end_date) {
        countSql += ' AND e.log_date <= ?';
        countParams.push(end_date);
    }

    const countResult = await get(countSql, countParams);

    res.json({
        success: true,
        data: {
            logs,
            pagination: {
                total: countResult.total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        }
    });
}));

/**
 * 获取单条能耗记录
 * GET /api/energy/:id
 */
router.get('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const log = await get(
        `SELECT e.*, v.plate_number, v.brand, v.model, v.user_id 
         FROM energy_logs e 
         JOIN vehicles v ON e.vehicle_id = v.id 
         WHERE e.id = ?`,
        [req.params.id]
    );

    if (!log) {
        return res.status(404).json({
            success: false,
            message: '记录不存在'
        });
    }

    // 验证所有权
    if (log.user_id !== req.userId) {
        return res.status(403).json({
            success: false,
            message: '无权访问此记录'
        });
    }

    res.json({
        success: true,
        data: log
    });
}));

/**
 * 更新能耗记录
 * PUT /api/energy/:id
 */
router.put('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const {
        log_date,
        mileage,
        energy_type,
        amount,
        cost,
        unit_price,
        fuel_gauge_reading,
        is_full,
        location_name,
        location_lat,
        location_lng,
        notes
    } = req.body;

    // 验证记录存在且属于该用户
    const log = await get(
        `SELECT e.*, v.user_id 
         FROM energy_logs e 
         JOIN vehicles v ON e.vehicle_id = v.id 
         WHERE e.id = ?`,
        [req.params.id]
    );

    if (!log || log.user_id !== req.userId) {
        return res.status(404).json({
            success: false,
            message: '记录不存在'
        });
    }

    // 更新记录
    await query(
        `UPDATE energy_logs 
         SET log_date = ?, mileage = ?, energy_type = ?, amount = ?, cost = ?,
             unit_price = ?, fuel_gauge_reading = ?, is_full = ?,
             location_name = ?, location_lat = ?, location_lng = ?, notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [log_date, mileage, energy_type, amount, cost, unit_price, fuel_gauge_reading,
            is_full ? 1 : 0, location_name, location_lat, location_lng, notes, req.params.id]
    );

    // 触发全局重算
    await recalculateVehicleLogs(log.vehicle_id);

    const updatedLog = await get('SELECT * FROM energy_logs WHERE id = ?', [req.params.id]);

    res.json({
        success: true,
        message: '记录更新成功',
        data: updatedLog
    });
}));

/**
 * 删除能耗记录
 * DELETE /api/energy/:id
 */
router.delete('/:id', authenticateUser, asyncHandler(async (req, res) => {
    // 验证记录存在且属于该用户
    const log = await get(
        `SELECT e.*, v.user_id 
         FROM energy_logs e 
         JOIN vehicles v ON e.vehicle_id = v.id 
         WHERE e.id = ?`,
        [req.params.id]
    );

    if (!log || log.user_id !== req.userId) {
        return res.status(404).json({
            success: false,
            message: '记录不存在'
        });
    }

    await query('DELETE FROM energy_logs WHERE id = ?', [req.params.id]);

    // 删除后重算
    await recalculateVehicleLogs(log.vehicle_id);

    res.json({
        success: true,
        message: '记录已删除'
    });
}));

/**
 * 触发指定车辆的能耗重算
 * POST /api/energy/recalculate/:vehicleId
 */
router.post('/recalculate/:vehicleId', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;

    // 验证所有权
    const vehicle = await get('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [vehicleId, req.userId]);
    if (!vehicle) {
        return res.status(404).json({ success: false, message: '车辆不存在' });
    }

    await recalculateVehicleLogs(vehicleId);

    res.json({
        success: true,
        message: '能耗数据已全量重算完成'
    });
}));

module.exports = router;
