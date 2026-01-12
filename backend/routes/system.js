/**
 * 系统配置路由
 */
const express = require('express');
const router = express.Router();
const { query, get } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 获取系统公开配置 (前端使用)
 * GET /api/system/config
 */
router.get('/config', asyncHandler(async (req, res) => {
    // 获取允许注册配置
    const regSetting = await get("SELECT value FROM system_settings WHERE key = 'allow_registration'");

    // 如果没有设置，默认为 true
    const allowRegistration = regSetting ? regSetting.value === 'true' : true;

    // 检查是否已初始化（是否有用户）
    const userCount = await get("SELECT COUNT(*) as count FROM users");
    const isFirstUser = userCount.count === 0;

    res.json({
        success: true,
        data: {
            allowRegistration: allowRegistration || isFirstUser, // 如果是第一个用户，强制允许注册
            isFirstUser
        }
    });
}));

/**
 * 更新系统配置 (仅管理员)
 * PUT /api/system/config
 */
router.put('/config', authenticateUser, asyncHandler(async (req, res) => {
    // 检查是否是管理员
    const user = await get("SELECT role FROM users WHERE id = ?", [req.userId]);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: '无权操作'
        });
    }

    const { allow_registration } = req.body;

    if (allow_registration !== undefined) {
        await query(
            "INSERT INTO system_settings (key, value) VALUES ('allow_registration', ?) ON CONFLICT(key) DO UPDATE SET value = ?",
            [String(allow_registration), String(allow_registration)]
        );
        // SQLite: INSERT OR REPLACE INTO system_settings ...
        // PostgreSQL: ON CONFLICT ...
        // Using generic UPSERT logic or DELETE+INSERT if needed, but 'replace' is simplest for key-value
        // Let's use INSERT OR REPLACE for SQLite compatibility primarily.
        /* 
           For broad compatibility, let's try UPDATE then INSERT if 0 changes. 
           But given setup is SQLite/PG, let's just do:
        */
        const key = 'allow_registration';
        const val = String(allow_registration);
        const exists = await get("SELECT key FROM system_settings WHERE key = ?", [key]);
        if (exists) {
            await query("UPDATE system_settings SET value = ? WHERE key = ?", [val, key]);
        } else {
            await query("INSERT INTO system_settings (key, value) VALUES (?, ?)", [key, val]);
        }
    }

    res.json({
        success: true,
        message: '系统设置已更新'
    });
}));

module.exports = router;
