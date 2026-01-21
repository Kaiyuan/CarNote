/**
 * 车辆管理路由
 * 处理车辆的增删改查
 */

const express = require('express');
const router = express.Router();
const { query, get } = require('../config/database');
const { authenticateUser, optionalApiKey } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 添加新车辆
 * POST /api/vehicles
 */
router.post('/', authenticateUser, asyncHandler(async (req, res) => {
    const {
        plate_number,
        brand,
        model,
        year,
        power_type,
        current_mileage,
        purchase_date,
        photo_url,
        description
    } = req.body;

    // 验证必填字段
    if (!plate_number || !power_type) {
        return res.status(400).json({
            success: false,
            message: '车牌号和动力类型不能为空'
        });
    }

    // 验证动力类型
    const validPowerTypes = ['fuel', 'electric', 'hybrid'];
    if (!validPowerTypes.includes(power_type)) {
        return res.status(400).json({
            success: false,
            message: '动力类型必须是 fuel(燃油)、electric(纯电) 或 hybrid(混动)'
        });
    }

    // 验证车牌格式 (简单验证)
    const plateRegex = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]$/;
    if (!plateRegex.test(plate_number)) {
        console.warn('车牌号格式可能不正确:', plate_number);
    }

    // 检查车牌是否已存在
    const existing = await get(
        'SELECT id FROM vehicles WHERE plate_number = ? AND user_id = ?',
        [plate_number, req.userId]
    );

    if (existing) {
        return res.status(400).json({
            success: false,
            message: '该车牌号已存在'
        });
    }

    // 插入车辆数据
    const result = await query(
        `INSERT INTO vehicles 
         (user_id, plate_number, brand, model, year, power_type, current_mileage, purchase_date, photo_url, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.userId, plate_number, brand, model, year, power_type, current_mileage || 0, purchase_date, photo_url, description]
    );

    res.status(201).json({
        success: true,
        message: '车辆添加成功',
        data: {
            id: result.lastID,
            plate_number
        }
    });
}));

/**
 * 获取车辆列表
 * GET /api/vehicles
 * 支持查询参数: search (车牌/品牌), power_type
 */
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const { search, power_type } = req.query;

    let sql = 'SELECT * FROM vehicles WHERE user_id = ?';
    const params = [req.userId];

    // 搜索过滤
    if (search) {
        sql += ' AND (plate_number LIKE ? OR brand LIKE ? OR model LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    // 动力类型过滤
    if (power_type) {
        sql += ' AND power_type = ?';
        params.push(power_type);
    }

    sql += ' ORDER BY created_at DESC';

    const vehicles = await query(sql, params);

    // 为每个车辆查询统计信息
    const vehiclesWithStats = await Promise.all(vehicles.map(async (vehicle) => {
        // 获取最新能耗记录
        const latestEnergy = await get(
            `SELECT consumption_per_100km, log_date 
             FROM energy_logs 
             WHERE vehicle_id = ? AND consumption_per_100km IS NOT NULL 
             ORDER BY log_date DESC 
             LIMIT 1`,
            [vehicle.id]
        );

        // 获取平均能耗
        const avgConsumption = await get(
            `SELECT AVG(consumption_per_100km) as avg_consumption 
             FROM energy_logs 
             WHERE vehicle_id = ? AND consumption_per_100km IS NOT NULL`,
            [vehicle.id]
        );

        // 获取下次保养提醒
        const nextMaintenance = await get(
            `SELECT type, next_maintenance_date, next_maintenance_mileage 
             FROM maintenance_records 
             WHERE vehicle_id = ? AND status = 'pending'
             ORDER BY next_maintenance_date 
             LIMIT 1`,
            [vehicle.id]
        );

        return {
            ...vehicle,
            latest_consumption: latestEnergy?.consumption_per_100km,
            avg_consumption: avgConsumption?.avg_consumption,
            next_maintenance: nextMaintenance
        };
    }));

    res.json({
        success: true,
        data: vehiclesWithStats
    });
}));

/**
 * 获取单个车辆详情
 * GET /api/vehicles/:id
 */
router.get('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [req.params.id, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    // 获取能耗统计
    const energyStats = await get(
        `SELECT 
            COUNT(*) as total_records,
            AVG(consumption_per_100km) as avg_consumption,
            SUM(cost) as total_cost
         FROM energy_logs 
         WHERE vehicle_id = ?`,
        [vehicle.id]
    );

    // 获取保养统计
    const maintenanceStats = await get(
        `SELECT 
            COUNT(*) as total_records,
            SUM(cost) as total_cost
         FROM maintenance_records 
         WHERE vehicle_id = ?`,
        [vehicle.id]
    );

    res.json({
        success: true,
        data: {
            ...vehicle,
            stats: {
                energy: energyStats,
                maintenance: maintenanceStats
            }
        }
    });
}));

/**
 * 更新车辆信息
 * PUT /api/vehicles/:id
 */
router.put('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const {
        plate_number,
        brand,
        model,
        year,
        power_type,
        current_mileage,
        purchase_date,
        photo_url,
        description
    } = req.body;

    // 检查车辆是否存在且属于该用户
    const vehicle = await get(
        'SELECT id FROM vehicles WHERE id = ? AND user_id = ?',
        [req.params.id, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    // 如果修改了车牌，检查新车牌是否已存在
    if (plate_number) {
        const existing = await get(
            'SELECT id FROM vehicles WHERE plate_number = ? AND user_id = ? AND id != ?',
            [plate_number, req.userId, req.params.id]
        );

        if (existing) {
            return res.status(400).json({
                success: false,
                message: '该车牌号已存在'
            });
        }
    }

    // 更新车辆信息
    await query(
        `UPDATE vehicles 
         SET plate_number = ?, brand = ?, model = ?, year = ?, 
             power_type = ?, current_mileage = ?, purchase_date = ?, photo_url = ?, 
             description = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [plate_number, brand, model, year, power_type, current_mileage, purchase_date, photo_url, description, req.params.id]
    );

    res.json({
        success: true,
        message: '车辆信息更新成功'
    });
}));

/**
 * 删除车辆
 * DELETE /api/vehicles/:id
 */
router.delete('/:id', authenticateUser, asyncHandler(async (req, res) => {
    // 检查车辆是否存在且属于该用户
    const vehicle = await get(
        'SELECT id FROM vehicles WHERE id = ? AND user_id = ?',
        [req.params.id, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    // 删除车辆 (会级联删除相关记录)
    await query('DELETE FROM vehicles WHERE id = ?', [req.params.id]);

    res.json({
        success: true,
        message: '车辆已删除'
    });
}));

module.exports = router;
