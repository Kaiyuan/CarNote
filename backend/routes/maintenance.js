/**
 * 保养维修记录路由
 * 处理保养和维修记录的管理
 */

const express = require('express');
const router = express.Router();
const { query, get } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 添加保养/维修记录
 * POST /api/maintenance
 */
router.post('/', authenticateUser, asyncHandler(async (req, res) => {
    const {
        vehicle_id,
        maintenance_date,
        mileage,
        type,
        service_provider,
        cost,
        description,
        invoice_url,
        next_maintenance_mileage,
        next_maintenance_date,
        status,
        notes
    } = req.body;

    // 验证必填字段
    if (!vehicle_id || !maintenance_date || !mileage || !type) {
        return res.status(400).json({
            success: false,
            message: '车辆ID、日期、里程和项目类型不能为空'
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
        `INSERT INTO maintenance_records 
         (vehicle_id, maintenance_date, mileage, type, service_provider, cost,
          description, invoice_url, next_maintenance_mileage, next_maintenance_date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vehicle_id, maintenance_date, mileage, type, service_provider, cost,
            description, invoice_url, next_maintenance_mileage, next_maintenance_date,
            status || 'completed', notes]
    );

    res.status(201).json({
        success: true,
        message: '保养记录添加成功',
        data: {
            id: result.lastID
        }
    });
}));

/**
 * 获取保养记录列表
 * GET /api/maintenance
 * 查询参数: vehicle_id, type, status, start_date, end_date
 */
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicle_id, type, status, start_date, end_date } = req.query;

    let sql = `SELECT m.*, v.plate_number, v.brand, v.model 
               FROM maintenance_records m 
               JOIN vehicles v ON m.vehicle_id = v.id 
               WHERE v.user_id = ?`;
    const params = [req.userId];

    // 车辆过滤
    if (vehicle_id) {
        sql += ' AND m.vehicle_id = ?';
        params.push(vehicle_id);
    }

    // 类型过滤
    if (type) {
        sql += ' AND m.type = ?';
        params.push(type);
    }

    // 状态过滤
    if (status) {
        sql += ' AND m.status = ?';
        params.push(status);
    }

    // 日期范围
    if (start_date) {
        sql += ' AND m.maintenance_date >= ?';
        params.push(start_date);
    }
    if (end_date) {
        sql += ' AND m.maintenance_date <= ?';
        params.push(end_date);
    }

    sql += ' ORDER BY m.maintenance_date DESC';

    const records = await query(sql, params);

    res.json({
        success: true,
        data: records
    });
}));

/**
 * 获取保养提醒
 * GET /api/maintenance/reminders/:vehicleId
 */
router.get('/reminders/:vehicleId', authenticateUser, asyncHandler(async (req, res) => {
    // 验证车辆所有权
    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [req.params.vehicleId, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    // 获取即将到期的保养项目
    const currentDate = new Date().toISOString().split('T')[0];

    const reminders = await query(
        `SELECT * FROM maintenance_records 
         WHERE vehicle_id = ? AND status = 'pending'
         AND (
            (next_maintenance_date IS NOT NULL AND next_maintenance_date >= ?)
            OR (next_maintenance_mileage IS NOT NULL AND next_maintenance_mileage <= ?)
         )
         ORDER BY next_maintenance_date, next_maintenance_mileage`,
        [req.params.vehicleId, currentDate, vehicle.current_mileage + 5000] // 提前5000公里提醒
    );

    // 获取过期的保养项目
    const overdueReminders = await query(
        `SELECT * FROM maintenance_records 
         WHERE vehicle_id = ? AND status = 'pending'
         AND (
            (next_maintenance_date IS NOT NULL AND next_maintenance_date < ?)
            OR (next_maintenance_mileage IS NOT NULL AND next_maintenance_mileage < ?)
         )
         ORDER BY next_maintenance_date, next_maintenance_mileage`,
        [req.params.vehicleId, currentDate, vehicle.current_mileage]
    );

    res.json({
        success: true,
        data: {
            upcoming: reminders,
            overdue: overdueReminders
        }
    });
}));

/**
 * 获取单条保养记录
 * GET /api/maintenance/:id
 */
router.get('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const record = await get(
        `SELECT m.*, v.plate_number, v.brand, v.model, v.user_id 
         FROM maintenance_records m 
         JOIN vehicles v ON m.vehicle_id = v.id 
         WHERE m.id = ?`,
        [req.params.id]
    );

    if (!record) {
        return res.status(404).json({
            success: false,
            message: '记录不存在'
        });
    }

    if (record.user_id !== req.userId) {
        return res.status(403).json({
            success: false,
            message: '无权访问此记录'
        });
    }

    res.json({
        success: true,
        data: record
    });
}));

/**
 * 更新保养记录
 * PUT /api/maintenance/:id
 */
router.put('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const {
        maintenance_date,
        mileage,
        type,
        service_provider,
        cost,
        description,
        invoice_url,
        next_maintenance_mileage,
        next_maintenance_date,
        status,
        notes
    } = req.body;

    // 验证记录存在且属于该用户
    const record = await get(
        `SELECT m.*, v.user_id 
         FROM maintenance_records m 
         JOIN vehicles v ON m.vehicle_id = v.id 
         WHERE m.id = ?`,
        [req.params.id]
    );

    if (!record || record.user_id !== req.userId) {
        return res.status(404).json({
            success: false,
            message: '记录不存在'
        });
    }

    // 更新记录
    await query(
        `UPDATE maintenance_records 
         SET maintenance_date = ?, mileage = ?, type = ?, service_provider = ?,
             cost = ?, description = ?, invoice_url = ?,
             next_maintenance_mileage = ?, next_maintenance_date = ?, status = ?,
             notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [maintenance_date, mileage, type, service_provider, cost, description,
            invoice_url, next_maintenance_mileage, next_maintenance_date, status, notes,
            req.params.id]
    );

    res.json({
        success: true,
        message: '保养记录更新成功'
    });
}));

/**
 * 删除保养记录
 * DELETE /api/maintenance/:id
 */
router.delete('/:id', authenticateUser, asyncHandler(async (req, res) => {
    // 验证记录存在且属于该用户
    const record = await get(
        `SELECT m.*, v.user_id 
         FROM maintenance_records m 
         JOIN vehicles v ON m.vehicle_id = v.id 
         WHERE m.id = ?`,
        [req.params.id]
    );

    if (!record || record.user_id !== req.userId) {
        return res.status(404).json({
            success: false,
            message: '记录不存在'
        });
    }

    await query('DELETE FROM maintenance_records WHERE id = ?', [req.params.id]);

    res.json({
        success: true,
        message: '保养记录已删除'
    });
}));

module.exports = router;
