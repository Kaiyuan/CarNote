/**
 * 用户管理路由
 * 处理用户注册、登录、设置等
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, get } = require('../config/database');
const { authenticateUser, generateApiKey } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 用户注册
 * POST /api/users/register
 */
router.post('/register', asyncHandler(async (req, res) => {
    const { username, password, email, nickname } = req.body;

    // 验证必填字段
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: '用户名和密码不能为空'
        });
    }

    // 检查是否是第一个用户 以及 系统注册开关
    const userCount = await get('SELECT COUNT(*) as count FROM users');
    const isFirstUser = userCount.count === 0;

    if (!isFirstUser) {
        const regSetting = await get("SELECT value FROM system_settings WHERE key = 'allow_registration'");
        const allowRegistration = regSetting ? regSetting.value === 'true' : true;

        if (!allowRegistration) {
            return res.status(403).json({
                success: false,
                message: '管理员已关闭注册功能'
            });
        }
    }

    // 检查用户名是否已存在
    const existingUser = await get(
        'SELECT id FROM users WHERE username = ?',
        [username]
    );

    if (existingUser) {
        return res.status(400).json({
            success: false,
            message: '用户名已存在'
        });
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 10);

    // 分配角色
    const role = isFirstUser ? 'admin' : 'user';

    // 创建用户
    const result = await query(
        'INSERT INTO users (username, password_hash, email, nickname, role) VALUES (?, ?, ?, ?, ?)',
        [username, passwordHash, email, nickname || username, role]
    );

    // 创建默认设置
    await query(
        'INSERT INTO user_settings (user_id) VALUES (?)',
        [result.lastID]
    );

    res.status(201).json({
        success: true,
        message: isFirstUser ? '注册成功，您是首位用户，已自动设为管理员' : '注册成功',
        data: {
            userId: result.lastID,
            username,
            role
        }
    });
}));

/**
 * 用户登录 (简化版本)
 * POST /api/users/login
 */
router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: '用户名和密码不能为空'
        });
    }

    // 查询用户
    const user = await get(
        'SELECT * FROM users WHERE username = ?',
        [username]
    );

    if (!user) {
        return res.status(401).json({
            success: false,
            message: '用户名或密码错误'
        });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
        return res.status(401).json({
            success: false,
            message: '用户名或密码错误'
        });
    }

    // 返回用户信息 (生产环境应该返回 JWT token)
    res.json({
        success: true,
        message: '登录成功',
        data: {
            userId: user.id,
            username: user.username,
            nickname: user.nickname,
            email: user.email
        }
    });
}));

/**
 * 获取用户信息
 * GET /api/users/profile
 */
router.get('/profile', authenticateUser, asyncHandler(async (req, res) => {
    const user = await get(
        'SELECT id, username, email, nickname, avatar_url, role, created_at FROM users WHERE id = ?',
        [req.userId]
    );

    if (!user) {
        return res.status(404).json({
            success: false,
            message: '用户不存在'
        });
    }

    res.json({
        success: true,
        data: user
    });
}));

/**
 * 更新用户信息
 * PUT /api/users/profile
 */
router.put('/profile', authenticateUser, asyncHandler(async (req, res) => {
    const { email, nickname, avatar_url } = req.body;

    await query(
        'UPDATE users SET email = ?, nickname = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [email, nickname, avatar_url, req.userId]
    );

    res.json({
        success: true,
        message: '用户信息更新成功'
    });
}));

/**
 * 修改密码
 * PUT /api/users/password
 */
router.put('/password', authenticateUser, asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            message: '旧密码和新密码不能为空'
        });
    }

    // 验证旧密码
    const user = await get(
        'SELECT password_hash FROM users WHERE id = ?',
        [req.userId]
    );

    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);

    if (!isValidPassword) {
        return res.status(401).json({
            success: false,
            message: '旧密码错误'
        });
    }

    // 更新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await query(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPasswordHash, req.userId]
    );

    res.json({
        success: true,
        message: '密码修改成功'
    });
}));

/**
 * 获取用户设置
 * GET /api/users/settings
 */
router.get('/settings', authenticateUser, asyncHandler(async (req, res) => {
    const settings = await get(
        'SELECT * FROM user_settings WHERE user_id = ?',
        [req.userId]
    );

    res.json({
        success: true,
        data: settings || {}
    });
}));

/**
 * 更新用户设置
 * PUT /api/users/settings
 */
router.put('/settings', authenticateUser, asyncHandler(async (req, res) => {
    const { consumption_unit, currency, maintenance_reminder_threshold, language } = req.body;

    await query(
        `UPDATE user_settings 
         SET consumption_unit = ?, currency = ?, maintenance_reminder_threshold = ?, language = ?
         WHERE user_id = ?`,
        [consumption_unit, currency, maintenance_reminder_threshold, language, req.userId]
    );

    res.json({
        success: true,
        message: '设置更新成功'
    });
}));

/**
 * 生成 API Key
 * POST /api/users/api-keys
 */
router.post('/api-keys', authenticateUser, asyncHandler(async (req, res) => {
    const { key_name, vehicle_id } = req.body;
    const apiKey = generateApiKey();

    const result = await query(
        'INSERT INTO api_keys (user_id, key_value, key_name, vehicle_id) VALUES (?, ?, ?, ?)',
        [req.userId, apiKey, key_name, vehicle_id || null]
    );

    res.status(201).json({
        success: true,
        message: 'API Key 创建成功',
        data: {
            id: result.lastID,
            key: apiKey,
            name: key_name
        }
    });
}));

/**
 * 获取用户的 API Keys 列表
 * GET /api/users/api-keys
 */
router.get('/api-keys', authenticateUser, asyncHandler(async (req, res) => {
    const keys = await query(
        `SELECT id, key_name, key_value, vehicle_id, is_active, created_at, last_used_at 
         FROM api_keys 
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [req.userId]
    );

    res.json({
        success: true,
        data: keys
    });
}));

/**
 * 删除 API Key
 * DELETE /api/users/api-keys/:id
 */
router.delete('/api-keys/:id', authenticateUser, asyncHandler(async (req, res) => {
    await query(
        'DELETE FROM api_keys WHERE id = ? AND user_id = ?',
        [req.params.id, req.userId]
    );

    res.json({
        success: true,
        message: 'API Key 已删除'
    });
}));

module.exports = router;
