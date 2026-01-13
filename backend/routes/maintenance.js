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
        notes,
        location_name,
        location_lat,
        location_lng
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
          description, invoice_url, next_maintenance_mileage, next_maintenance_date, status, notes,
          location_name, location_lat, location_lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vehicle_id, maintenance_date, mileage, type, service_provider, cost,
            description, invoice_url, next_maintenance_mileage, next_maintenance_date,
            status || 'completed', notes, location_name, location_lat, location_lng]
    );

    // 同步到共享位置库
    const { syncToSharedLocation } = require('./locations');
    await syncToSharedLocation(location_name || service_provider, location_lat, location_lng, 'maintenance', req.userId);

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
 */
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicle_id, type, status, start_date, end_date } = req.query;

    let sql = `SELECT m.*, v.plate_number, v.brand, v.model 
               FROM maintenance_records m 
               JOIN vehicles v ON m.vehicle_id = v.id 
               WHERE v.user_id = ?`;
    const params = [req.userId];

    if (vehicle_id) {
        sql += ' AND m.vehicle_id = ?';
        params.push(vehicle_id);
    }
    if (type) {
        sql += ' AND m.type = ?';
        params.push(type);
    }
    if (status) {
        sql += ' AND m.status = ?';
        params.push(status);
    }
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
    res.json({ success: true, data: records });
}));

/**
 * 获取保养提醒
 */
router.get('/reminders/:vehicleId', authenticateUser, asyncHandler(async (req, res) => {
    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [req.params.vehicleId, req.userId]
    );

    if (!vehicle) return res.status(404).json({ success: false, message: '车辆不存在' });

    const currentDate = new Date().toISOString().split('T')[0];
    const reminders = await query(
        `SELECT * FROM maintenance_records 
         WHERE vehicle_id = ? AND status = 'pending'
         AND (
            (next_maintenance_date IS NOT NULL AND next_maintenance_date >= ?)
            OR (next_maintenance_mileage IS NOT NULL AND next_maintenance_mileage <= ?)
         )
         ORDER BY next_maintenance_date, next_maintenance_mileage`,
        [req.params.vehicleId, currentDate, vehicle.current_mileage + 5000]
    );

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

    res.json({ success: true, data: { upcoming: reminders, overdue: overdueReminders } });
}));

/**
 * 更新保养记录
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
        notes,
        location_name,
        location_lat,
        location_lng
    } = req.body;

    // 验证记录所有权
    const record = await get(
        `SELECT m.id FROM maintenance_records m 
         JOIN vehicles v ON m.vehicle_id = v.id 
         WHERE m.id = ? AND v.user_id = ?`,
        [req.params.id, req.userId]
    );

    if (!record) return res.status(404).json({ success: false, message: '记录不存在' });

    await query(
        `UPDATE maintenance_records 
         SET maintenance_date = ?, mileage = ?, type = ?, service_provider = ?, cost = ?,
             description = ?, invoice_url = ?, next_maintenance_mileage = ?, 
             next_maintenance_date = ?, status = ?, notes = ?, 
             location_name = ?, location_lat = ?, location_lng = ?,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [maintenance_date, mileage, type, service_provider, cost, description, invoice_url,
            next_maintenance_mileage, next_maintenance_date, status, notes,
            location_name, location_lat, location_lng, req.params.id]
    );

    const { syncToSharedLocation } = require('./locations');
    await syncToSharedLocation(location_name || service_provider, location_lat, location_lng, 'maintenance', req.userId);

    res.json({ success: true, message: '保养记录更新成功' });
}));

/**
 * 删除保养记录
 */
router.delete('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const record = await get(
        `SELECT m.id FROM maintenance_records m 
         JOIN vehicles v ON m.vehicle_id = v.id 
         WHERE m.id = ? AND v.user_id = ?`,
        [req.params.id, req.userId]
    );

    if (!record) return res.status(404).json({ success: false, message: '记录不存在' });

    await query('DELETE FROM maintenance_records WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '保养记录已删除' });
}));

router.get('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const record = await get(
        `SELECT m.*, v.plate_number, v.brand, v.model, v.user_id 
         FROM maintenance_records m 
         JOIN vehicles v ON m.vehicle_id = v.id 
         WHERE m.id = ? AND v.user_id = ?`,
        [req.params.id, req.userId]
    );
    if (!record) return res.status(404).json({ success: false, message: '记录不存在' });
    res.json({ success: true, data: record });
}));

module.exports = router;
