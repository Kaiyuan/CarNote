/**
 * CarNote 后端服务器
 * 主入口文件
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDatabase } = require('./config/database');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// 日志配置 - 将日志存放在数据库相同目录
try {
    const dbPath = process.env.SQLITE_PATH || './data/carnote.db';
    const dbDir = path.isAbsolute(dbPath) ? path.dirname(dbPath) : path.join(__dirname, path.dirname(dbPath));
    const logPath = path.join(dbDir, 'app.log');

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const originalLog = console.log;
    const originalError = console.error;

    const formatLog = (level, args) => {
        const timestamp = new Date().toISOString();
        const message = args.map(arg => {
            if (arg instanceof Error) {
                return arg.stack || arg.message;
            }
            return typeof arg === 'object' ? JSON.stringify(arg) : (arg === undefined ? 'undefined' : arg);
        }).join(' ');
        return `[${timestamp}] [${level}] ${message}\n`;
    };

    console.log = (...args) => {
        try { logStream.write(formatLog('INFO', args)); } catch (e) { }
        originalLog.apply(console, args);
    };

    console.error = (...args) => {
        try { logStream.write(formatLog('ERROR', args)); } catch (e) { }
        originalError.apply(console, args);
    };

    console.log('日志系统已启动，日志文件:', logPath);
} catch (logErr) {
    console.warn('日志文件初始化失败 (可能是权限问题)，将仅输出到控制台:', logErr.message);
}

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 53300;
const FRONTEND_PATH = path.join(__dirname, '../frontend/dist');

// 中间件配置
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 上传的图片等
const uploadDir = path.isAbsolute(process.env.UPLOAD_PATH || './uploads')
    ? (process.env.UPLOAD_PATH || './uploads')
    : path.resolve(__dirname, process.env.UPLOAD_PATH || './uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// 健康检查接口
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'CarNote API 服务运行中',
        timestamp: new Date().toISOString()
    });
});

// API 路由
// API 路由
app.use('/api/users', require('./routes/users'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/energy', require('./routes/energy'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/parts', require('./routes/parts'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/system', require('./routes/system'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/locations', require('./routes/locations').router);
app.use('/api/messages', require('./routes/messages'));
app.use('/api/export', require('./routes/export'));
app.use('/api/import', require('./routes/import'));

// PWA 动态支持
const { get, query } = require('./config/database');

app.get('/manifest.json', async (req, res) => {
    const settings = await query("SELECT key, value FROM system_settings WHERE key IN ('site_name', 'site_description')");
    const config = {};
    settings.forEach(s => config[s.key] = s.value);

    const siteName = config['site_name'] || 'CarNote';
    const siteDescription = config['site_description'] || '车辆管理系统';

    res.json({
        "name": siteName,
        "short_name": siteName,
        "description": siteDescription,
        "start_url": "/",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#3B82F6",
        "icons": [
            { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
            { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
        ]
    });
});

// 默认静态资源路径 (Fallback)
const DEFAULT_ASSETS_PATH = path.join(__dirname, '../frontend/src/assets');

app.get(['/favicon.ico', '/favicon.png'], (req, res) => {
    const favPath = path.join(uploadDir, 'favicon.png');
    if (fs.existsSync(favPath)) return res.sendFile(favPath);

    // Fallback to default asset
    const defaultPath = path.join(DEFAULT_ASSETS_PATH, 'favicon.png');
    if (fs.existsSync(defaultPath)) return res.sendFile(defaultPath);

    res.status(404).end();
});

app.get(['/icon-192.png', '/pwa-192x192.png'], (req, res) => {
    const iconPath = path.join(uploadDir, 'icon-192.png');
    if (fs.existsSync(iconPath)) return res.sendFile(iconPath);

    // Fallback to default asset
    const defaultPath = path.join(DEFAULT_ASSETS_PATH, 'icon-192.png');
    if (fs.existsSync(defaultPath)) return res.sendFile(defaultPath);

    res.status(404).end();
});

app.get('/icon-512.png', (req, res) => {
    const iconPath = path.join(uploadDir, 'icon-512.png');
    if (fs.existsSync(iconPath)) return res.sendFile(iconPath);

    // Fallback to default asset
    const defaultPath = path.join(DEFAULT_ASSETS_PATH, 'icon-512.png');
    if (fs.existsSync(defaultPath)) return res.sendFile(defaultPath);

    res.status(404).end();
});

// 静态文件服务 - 前端构建产物
if (fs.existsSync(FRONTEND_PATH)) {
    console.log('Serving frontend from:', FRONTEND_PATH);
    app.use(express.static(FRONTEND_PATH));

    // SPA 回退处理 (放在 API 路由之后)
    app.get('*', (req, res, next) => {
        // 如果请求的是 API、上传文件、静态资源或包含文件扩展名，不要返回 index.html
        if (req.path.startsWith('/api') ||
            req.path.startsWith('/uploads') ||
            req.path.startsWith('/assets') ||
            req.path.match(/\.\w+$/)) {  // 匹配包含文件扩展名的路径
            return next();
        }
        res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
    });
} else {
    console.warn('Frontend build not found at:', FRONTEND_PATH);
}


// 启动服务器
async function startServer() {
    try {
        // 初始化数据库
        console.log('正在初始化数据库...');
        await initDatabase();
        console.log('数据库初始化完成');

        // --- VIP 模块加载钩子 (必须在数据库初始化后) ---
        const vipModulePath = path.join(__dirname, '../vip/backend/index.js');
        if (fs.existsSync(vipModulePath)) {
            try {
                const vipModule = require(vipModulePath);
                if (typeof vipModule.init === 'function') {
                    // 传入 express 实例，解决模块找不到 express 的问题
                    await vipModule.init(app, express);
                }
            } catch (err) {
                console.error('[VIP] 加载 VIP 模块失败:', err);
            }
        }
        // ----------------------------------------------

        // 404 和错误处理 (必须在所有路由之后)
        app.use(notFoundHandler);
        app.use(errorHandler);

        // 启动服务器
        app.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(`  CarNote API 服务已启动`);
            console.log(`  端口: ${PORT}`);
            console.log(`  环境: ${process.env.NODE_ENV || 'development'}`);
            console.log(`  数据库: ${process.env.DB_TYPE || 'sqlite'}`);
            console.log(`========================================\n`);
        });
    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
});

// 启动
startServer();

module.exports = app;
