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
const uploadDir = process.env.UPLOAD_PATH || './uploads';
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
app.use('/api/export', require('./routes/export'));
app.use('/api/import', require('./routes/import'));

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

// 404 和错误处理
app.use(notFoundHandler);
app.use(errorHandler);

// 启动服务器
async function startServer() {
    try {
        // 初始化数据库
        console.log('正在初始化数据库...');
        await initDatabase();
        console.log('数据库初始化完成');

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
