const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, get } = require('../config/database');
const { authenticateUser, isAdmin, createAuditLog } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// All routes here require admin
router.use(authenticateUser, isAdmin);

/**
 * 获取所有用户列表
 */
router.get('/users', asyncHandler(async (req, res) => {
    const users = await query('SELECT id, username, email, nickname, role, is_disabled, failed_login_attempts, created_at FROM users');
    res.json({ success: true, data: users });
}));

/**
 * 更新用户状态/权限
 */
router.put('/users/:id', asyncHandler(async (req, res) => {
    const { role, is_disabled, nickname, email } = req.body;
    const targetId = req.params.id;

    if (targetId == req.userId && is_disabled) {
        return res.status(400).json({ success: false, message: '不能禁用自己' });
    }

    await query(
        `UPDATE users 
         SET role = COALESCE(?, role), 
             is_disabled = COALESCE(?, is_disabled),
             nickname = COALESCE(?, nickname),
             email = COALESCE(?, email),
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [role, is_disabled, nickname, email, targetId]
    );

    await createAuditLog(req.userId, 'update_user', { targetId, role, is_disabled });
    res.json({ success: true, message: '用户信息已更新' });
}));

/**
 * 管理员重置用户密码
 */
router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    const user = await get('SELECT username FROM users WHERE id = ?', [targetId]);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    const newPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await query('UPDATE users SET password_hash = ?, failed_login_attempts = 0 WHERE id = ?', [passwordHash, targetId]);

    await createAuditLog(req.userId, 'admin_reset_password', { targetId, targetUsername: user.username });

    res.json({
        success: true,
        message: '密码已重置',
        data: { password: newPassword }
    });
}));

/**
 * 获取系统设置 (SMTP)
 */
router.get('/settings/smtp', asyncHandler(async (req, res) => {
    const settings = await query("SELECT key, value FROM system_settings WHERE key LIKE 'smtp_%'");
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    res.json({ success: true, data: config });
}));

/**
 * 更新系统设置 (SMTP)
 */
router.put('/settings/smtp', asyncHandler(async (req, res) => {
    const config = req.body;
    for (const key in config) {
        if (key.startsWith('smtp_')) {
            await query("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)", [key, String(config[key])]);
        }
    }
    await createAuditLog(req.userId, 'update_smtp_settings', 'SMTP config updated');
    res.json({ success: true, message: 'SMTP 设置已更新' });
}));

/**
 * 获取登录日志
 */
router.get('/logs/login', asyncHandler(async (req, res) => {
    const logs = await query('SELECT * FROM login_logs ORDER BY attempt_time DESC LIMIT 500');
    res.json({ success: true, data: logs });
}));

/**
 * 全局数据管理 - 车辆
 * 支持筛选: user_id
 */
router.get('/vehicles', asyncHandler(async (req, res) => {
    const { user_id } = req.query;
    let sql = `SELECT v.*, u.username as owner_name 
               FROM vehicles v 
               JOIN users u ON v.user_id = u.id`;
    const params = [];
    if (user_id) {
        sql += ' WHERE v.user_id = ?';
        params.push(user_id);
    }
    const vehicles = await query(sql, params);
    res.json({ success: true, data: vehicles });
}));

router.put('/vehicles/:id', asyncHandler(async (req, res) => {
    const { plate_number, brand, model, year, power_type, current_mileage, description } = req.body;
    await query(
        `UPDATE vehicles SET plate_number=?, brand=?, model=?, year=?, power_type=?, current_mileage=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [plate_number, brand, model, year, power_type, current_mileage, description, req.params.id]
    );
    res.json({ success: true, message: '车辆信息已更新' });
}));

router.delete('/vehicles/:id', asyncHandler(async (req, res) => {
    await query('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '车辆已删除' });
}));

/**
 * 全局数据管理 - 能耗记录
 * 支持筛选: user_id, vehicle_id
 */
router.get('/energy', asyncHandler(async (req, res) => {
    const { user_id, vehicle_id } = req.query;
    let sql = `
        SELECT e.*, v.plate_number, u.username as owner_name 
        FROM energy_logs e 
        JOIN vehicles v ON e.vehicle_id = v.id
        JOIN users u ON v.user_id = u.id
        WHERE 1=1 `;
    const params = [];
    if (user_id) {
        sql += ' AND u.id = ?';
        params.push(user_id);
    }
    if (vehicle_id) {
        sql += ' AND v.id = ?';
        params.push(vehicle_id);
    }
    sql += ' ORDER BY e.log_date DESC LIMIT 1000';
    const logs = await query(sql, params);
    res.json({ success: true, data: logs });
}));

router.put('/energy/:id', asyncHandler(async (req, res) => {
    const { log_date, mileage, amount, cost, energy_type, location_name, unit_price, is_full, notes } = req.body;
    await query(
        `UPDATE energy_logs SET log_date=?, mileage=?, amount=?, cost=?, energy_type=?, location_name=?, unit_price=?, is_full=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [log_date, mileage, amount, cost, energy_type, location_name, unit_price, is_full, notes, req.params.id]
    );
    res.json({ success: true, message: '能耗记录已更新' });
}));

router.delete('/energy/:id', asyncHandler(async (req, res) => {
    await query('DELETE FROM energy_logs WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '能耗记录已删除' });
}));

/**
 * 全局数据管理 - 保养记录
 * 支持筛选: user_id, vehicle_id
 */
router.get('/maintenance', asyncHandler(async (req, res) => {
    const { user_id, vehicle_id } = req.query;
    let sql = `
        SELECT m.*, v.plate_number, u.username as owner_name 
        FROM maintenance_records m 
        JOIN vehicles v ON m.vehicle_id = v.id
        JOIN users u ON v.user_id = u.id
        WHERE 1=1 `;
    const params = [];
    if (user_id) {
        sql += ' AND u.id = ?';
        params.push(user_id);
    }
    if (vehicle_id) {
        sql += ' AND v.id = ?';
        params.push(vehicle_id);
    }
    sql += ' ORDER BY m.maintenance_date DESC LIMIT 1000';
    const logs = await query(sql, params);
    res.json({ success: true, data: logs });
}));

router.put('/maintenance/:id', asyncHandler(async (req, res) => {
    const { maintenance_date, mileage, type, service_provider, cost, description } = req.body;
    await query(
        `UPDATE maintenance_records SET maintenance_date=?, mileage=?, type=?, service_provider=?, cost=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [maintenance_date, mileage, type, service_provider, cost, description, req.params.id]
    );
    res.json({ success: true, message: '保养记录已更新' });
}));

router.delete('/maintenance/:id', asyncHandler(async (req, res) => {
    await query('DELETE FROM maintenance_records WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '保养记录已删除' });
}));

/**
 * 全局数据管理 - 配件管理
 */
router.get('/parts', asyncHandler(async (req, res) => {
    const { user_id, vehicle_id } = req.query;
    let sql = `
        SELECT p.*, v.plate_number, u.username as owner_name 
        FROM parts p 
        JOIN vehicles v ON p.vehicle_id = v.id
        JOIN users u ON v.user_id = u.id
        WHERE 1=1 `;
    const params = [];
    if (user_id) {
        sql += ' AND u.id = ?';
        params.push(user_id);
    }
    if (vehicle_id) {
        sql += ' AND v.id = ?';
        params.push(vehicle_id);
    }
    sql += ' ORDER BY p.created_at DESC';
    const parts = await query(sql, params);
    res.json({ success: true, data: parts });
}));

router.put('/parts/:id', asyncHandler(async (req, res) => {
    const { name, part_number, installed_date, installed_mileage, status } = req.body;
    await query(
        `UPDATE parts SET name=?, part_number=?, installed_date=?, installed_mileage=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [name, part_number, installed_date, installed_mileage, status, req.params.id]
    );
    res.json({ success: true, message: '配件信息已更新' });
}));

router.delete('/parts/:id', asyncHandler(async (req, res) => {
    await query('DELETE FROM parts WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '配件已删除' });
}));

/**
 * 获取共享站点列表
 */
router.get('/locations', asyncHandler(async (req, res) => {
    const locations = await query('SELECT * FROM shared_locations ORDER BY usage_count DESC');
    res.json({ success: true, data: locations });
}));

/**
 * 更新站点信息
 */
router.put('/locations/:id', asyncHandler(async (req, res) => {
    const { name, type, address, latitude, longitude } = req.body;
    await query(
        `UPDATE shared_locations 
         SET name = ?, type = ?, address = ?, latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [name, type, address, latitude, longitude, req.params.id]
    );
    res.json({ success: true, message: '站点信息已更新' });
}));

/**
 * 删除站点
 */
router.delete('/locations/:id', asyncHandler(async (req, res) => {
    await query('DELETE FROM shared_locations WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '站点已删除' });
}));

module.exports = router;
