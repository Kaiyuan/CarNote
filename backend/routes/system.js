/**
 * 系统配置路由
 */
const express = require('express');
const router = express.Router();
const { query, get } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置 Multer 用于图标上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_PATH || './uploads';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        cb(null, `site_icon_${Date.now()}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('只允许上传图片文件'));
    }
});

/**
 * 上传站点图标
 * POST /api/system/upload-icon
 */
router.post('/upload-icon', authenticateUser, upload.single('icon'), asyncHandler(async (req, res) => {
    // 检查管理员
    const user = await get("SELECT role FROM users WHERE id = ?", [req.userId]);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, message: '无权操作' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: '未选择文件' });
    }

    const iconUrl = `/uploads/${req.file.filename}`;

    // 更新设置
    const key = 'site_icon';
    const exists = await get("SELECT key FROM system_settings WHERE key = ?", [key]);
    if (exists) {
        await query("UPDATE system_settings SET value = ? WHERE key = ?", [iconUrl, key]);
    } else {
        await query("INSERT INTO system_settings (key, value) VALUES (?, ?)", [iconUrl, key]);
    }

    res.json({ success: true, message: '图标上传成功', data: { url: iconUrl } });
}));

/**
 * 获取系统公开配置 (前端使用)
 * GET /api/system/config
 */
router.get('/config', asyncHandler(async (req, res) => {
    // 获取配置项
    const settings = await query("SELECT key, value FROM system_settings WHERE key IN ('allow_registration', 'site_name', 'site_icon', 'site_description')");
    const config = {};
    settings.forEach(s => config[s.key] = s.value);

    // 默认值
    const allowRegistration = config['allow_registration'] !== undefined ? config['allow_registration'] === 'true' : true;
    const siteName = config['site_name'] || 'CarNote';
    const siteIcon = config['site_icon'] || null;
    const siteDescription = config['site_description'] || '';

    // 检查是否已初始化（是否有用户）
    const userCount = await get("SELECT COUNT(*) as count FROM users");
    const isFirstUser = userCount.count === 0;

    res.json({
        success: true,
        data: {
            allowRegistration: allowRegistration || isFirstUser,
            isFirstUser,
            siteName,
            siteIcon,
            siteDescription
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
        return res.status(403).json({ success: false, message: '无权操作' });
    }

    const updates = req.body;
    const allowedKeys = ['allow_registration', 'site_name', 'site_icon', 'site_description'];

    for (const key of allowedKeys) {
        if (updates[key] !== undefined) {
            const val = String(updates[key]);
            const exists = await get("SELECT key FROM system_settings WHERE key = ?", [key]);
            if (exists) {
                await query("UPDATE system_settings SET value = ? WHERE key = ?", [val, key]);
            } else {
                await query("INSERT INTO system_settings (key, value) VALUES (?, ?)", [key, val]);
            }
        }
    }

    res.json({ success: true, message: '系统设置已更新' });
}));

module.exports = router;
