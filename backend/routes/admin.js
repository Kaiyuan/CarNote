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
 */
router.get('/vehicles', asyncHandler(async (req, res) => {
    const vehicles = await query(`
        SELECT v.*, u.username as owner_name 
        FROM vehicles v 
        JOIN users u ON v.user_id = u.id
    `);
    res.json({ success: true, data: vehicles });
}));

/**
 * 全局数据管理 - 能耗记录
 */
router.get('/energy', asyncHandler(async (req, res) => {
    const logs = await query(`
        SELECT e.*, v.plate_number, u.username as owner_name 
        FROM energy_logs e 
        JOIN vehicles v ON e.vehicle_id = v.id
        JOIN users u ON v.user_id = u.id
        ORDER BY e.log_date DESC LIMIT 1000
    `);
    res.json({ success: true, data: logs });
}));

/**
 * 全局数据管理 - 保养记录
 */
router.get('/maintenance', asyncHandler(async (req, res) => {
    const logs = await query(`
        SELECT m.*, v.plate_number, u.username as owner_name 
        FROM maintenance_records m 
        JOIN vehicles v ON m.vehicle_id = v.id
        JOIN users u ON v.user_id = u.id
        ORDER BY m.maintenance_date DESC LIMIT 1000
    `);
    res.json({ success: true, data: logs });
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
