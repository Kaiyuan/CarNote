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
const sharp = require('sharp');

// 配置 Multer 用于图标上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = process.env.UPLOAD_PATH || './uploads';
        const absPath = path.isAbsolute(uploadPath) ? uploadPath : path.resolve(__dirname, '..', uploadPath);
        if (!fs.existsSync(absPath)) fs.mkdirSync(absPath, { recursive: true });
        cb(null, absPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        cb(null, `site_icon_original${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for PWA source
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('只允许上传图片文件'));
    }
});

/**
 * 上传站点图标并生成 PWA 图标
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

    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    const uploadDir = path.isAbsolute(uploadPath) ? uploadPath : path.resolve(__dirname, '..', uploadPath);
    const originalPath = req.file.path;

    // 生成 PWA 所需的各种尺寸
    try {
        const timestamp = Date.now();
        const icon192Name = `icon-192.png`;
        const icon512Name = `icon-512.png`;
        const faviconName = `favicon.png`;
        const mainIconName = `site_icon_${timestamp}.png`; // 最终显示用的主体图标

        // 生成 192x192
        await sharp(originalPath)
            .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toFile(path.join(uploadDir, icon192Name));

        // 生成 512x512
        await sharp(originalPath)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toFile(path.join(uploadDir, icon512Name));

        // 生成 favicon (32x32)
        await sharp(originalPath)
            .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toFile(path.join(uploadDir, faviconName));

        // 生成主显示图标 (比如 256x256)
        await sharp(originalPath)
            .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toFile(path.join(uploadDir, mainIconName));

        const iconUrl = `/uploads/${mainIconName}`;

        // 更新数据库设置
        const key = 'site_icon';
        const exists = await get("SELECT key FROM system_settings WHERE key = ?", [key]);
        if (exists) {
            await query("UPDATE system_settings SET value = ? WHERE key = ?", [iconUrl, key]);
        } else {
            await query("INSERT INTO system_settings (key, value) VALUES (?, ?)", [key, iconUrl]);
        }

        res.json({
            success: true,
            message: '图标上传及 PWA 适配成功',
            data: {
                url: iconUrl,
                pwaIcons: [
                    { size: '192x192', url: `/uploads/${icon192Name}` },
                    { size: '512x512', url: `/uploads/${icon512Name}` },
                    { size: 'favicon', url: `/uploads/${faviconName}` }
                ]
            }
        });

    } catch (error) {
        console.error('Sharp processing error:', error);
        res.status(500).json({ success: false, message: '图片处理失败: ' + error.message });
    }
}));

/**
 * 获取系统公开配置 (前端使用)
 * GET /api/system/config
 */
router.get('/config', asyncHandler(async (req, res) => {
    // 获取配置项
    const settings = await query("SELECT key, value FROM system_settings WHERE key IN ('allow_registration', 'site_name', 'site_icon', 'site_description', 'afdian_webhook_token', 'afdian_webhook_key', 'debug_mode', 'afdian_advanced_url', 'afdian_premium_url')");
    const config = {};
    settings.forEach(s => config[s.key] = s.value);

    // 默认值
    const allowRegistration = config['allow_registration'] !== undefined ? config['allow_registration'] === 'true' : true;
    const siteName = config['site_name'] || 'CarNote';
    const siteIcon = config['site_icon'] || null;
    const siteDescription = config['site_description'] || '';
    const afdianWebhookToken = config['afdian_webhook_token'] || '';

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
            siteDescription,
            afdianWebhookToken,
            afdianWebhookKey: config['afdian_webhook_key'] || '',
            debugMode: config['debug_mode'] === 'true',
            afdianAdvancedUrl: config['afdian_advanced_url'] || 'https://afdian.com/a/kaiyuan',
            afdianPremiumUrl: config['afdian_premium_url'] || 'https://afdian.com/a/kaiyuan'
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
    const allowedKeys = ['allow_registration', 'site_name', 'site_icon', 'site_description', 'afdian_webhook_token', 'afdian_webhook_key', 'debug_mode', 'afdian_advanced_url', 'afdian_premium_url'];

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
