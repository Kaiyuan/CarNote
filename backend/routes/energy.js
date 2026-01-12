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
 * 油耗计算助手 (支持非加满情况)
 * 逻辑：从本次“加满”追溯到最近一次“加满”，统计期间总里程和总油量
 */
async function calculateFullToFullConsumption(vehicleId, currentMileage, currentAmount, isFull, currentId = null) {
    if (!isFull) return { mileage_diff: null, consumption: null };

    // 1. 寻找最近一次加满的记录
    let lastFullQuery = `SELECT id, mileage, log_date FROM energy_logs 
                         WHERE vehicle_id = ? AND is_full = 1`;
    const params = [vehicleId];
    if (currentId) {
        lastFullQuery += ` AND id != ? AND (mileage < ? OR (mileage = ? AND id < ?))`;
        params.push(currentId, currentMileage, currentMileage, currentId);
    }
    lastFullQuery += ` ORDER BY mileage DESC, log_date DESC LIMIT 1`;

    const lastFullLog = await get(lastFullQuery, params);
    if (!lastFullLog) return { mileage_diff: null, consumption: null };

    const mileageDiff = currentMileage - lastFullLog.mileage;
    if (mileageDiff <= 0) return { mileage_diff: 0, consumption: 0 };

    // 2. 统计这两次加满之间的所有中间油量
    let midAmountQuery = `SELECT SUM(amount) as total_amount FROM energy_logs 
                          WHERE vehicle_id = ? AND mileage > ? AND mileage < ?`;
    const midResult = await get(midAmountQuery, [vehicleId, lastFullLog.mileage, currentMileage]);

    const totalAmount = (parseFloat(midResult?.total_amount) || 0) + parseFloat(currentAmount);
    const consumption = (totalAmount / mileageDiff) * 100;

    return {
        mileage_diff: mileageDiff,
        consumption: Math.round(consumption * 100) / 100
    };
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

    // 重新计算里程差和百公里消耗 (Full-to-Full 算法)
    const { mileage_diff, consumption: consumption_per_100km } = await calculateFullToFullConsumption(
        vehicle_id,
        parseInt(mileage),
        parseFloat(amount),
        is_full == 1 || is_full === true
    );

    // 插入记录
    const result = await query(
        `INSERT INTO energy_logs 
         (vehicle_id, log_date, mileage, energy_type, amount, cost, unit_price, 
          mileage_diff, consumption_per_100km, fuel_gauge_reading, is_full,
          location_name, location_lat, location_lng, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vehicle_id, log_date, mileage, energy_type, amount, cost, unit_price,
            mileage_diff, consumption_per_100km, fuel_gauge_reading, is_full ? 1 : 0,
            location_name, location_lat, location_lng, notes]
    );

    // 更新车辆当前里程 (仅当新里程大于当前里程时)
    if (parseInt(mileage) > vehicle.current_mileage) {
        await query(
            'UPDATE vehicles SET current_mileage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [mileage, vehicle_id]
        );
    }

    res.status(201).json({
        success: true,
        message: '能耗记录添加成功',
        data: {
            id: result.lastID,
            mileage_diff,
            consumption_per_100km
        }
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

    // 处理 is_full 参数，支持 1, true, yes 等值
    let isFullVal = 0;
    if (is_full === '1' || is_full === 'true' || is_full === 'yes' || is_full === true || is_full === 1) {
        isFullVal = 1;
    }

    // 重新计算里程差和百公里消耗 (Full-to-Full 算法)
    const { mileage_diff, consumption: consumption_per_100km } = await calculateFullToFullConsumption(
        vehicle_id,
        parseInt(mileage),
        parseFloat(amount),
        isFullVal === 1
    );

    // 插入记录
    const log_date = new Date().toISOString();
    const unit_price = cost && amount ? parseFloat(cost) / parseFloat(amount) : null;

    const result = await query(
        `INSERT INTO energy_logs 
         (vehicle_id, log_date, mileage, energy_type, amount, cost, unit_price,
          mileage_diff, consumption_per_100km, is_full,
          location_name, location_lat, location_lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vehicle_id, log_date, mileage, energy_type, amount, cost, unit_price,
            mileage_diff, consumption_per_100km, isFullVal,
            location_name, location_lat, location_lng]
    );

    // 更新车辆里程 (仅当新里程大于当前里程时)
    const currentVehicle = await get('SELECT current_mileage FROM vehicles WHERE id = ?', [vehicle_id]);
    if (currentVehicle && parseInt(mileage) > currentVehicle.current_mileage) {
        await query(
            'UPDATE vehicles SET current_mileage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [mileage, vehicle_id]
        );
    }

    res.json({
        success: true,
        message: '记录添加成功',
        data: {
            id: result.lastID,
            mileage_diff,
            consumption_per_100km: consumption_per_100km ? `${consumption_per_100km} ${energy_type === 'fuel' ? 'L' : 'kWh'}/100km` : null
        }
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

    // 重新计算里程差和百公里消耗 (Full-to-Full 算法)
    const { mileage_diff, consumption: consumption_per_100km } = await calculateFullToFullConsumption(
        log.vehicle_id,
        parseInt(mileage),
        parseFloat(amount),
        is_full == 1 || is_full === true,
        req.params.id
    );

    // 更新记录（包含重新计算的值）
    await query(
        `UPDATE energy_logs 
         SET log_date = ?, mileage = ?, energy_type = ?, amount = ?, cost = ?,
             unit_price = ?, fuel_gauge_reading = ?, is_full = ?,
             location_name = ?, location_lat = ?, location_lng = ?, notes = ?,
             mileage_diff = ?, consumption_per_100km = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [log_date, mileage, energy_type, amount, cost, unit_price, fuel_gauge_reading,
            is_full ? 1 : 0, location_name, location_lat, location_lng, notes,
            mileage_diff, consumption_per_100km, req.params.id]
    );

    res.json({
        success: true,
        message: '记录更新成功',
        data: {
            mileage_diff,
            consumption_per_100km
        }
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

    res.json({
        success: true,
        message: '记录已删除'
    });
}));

module.exports = router;
