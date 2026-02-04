const nodemailer = require('nodemailer');
const { get } = require('../config/database');

/**
 * 检查 SMTP 是否已配置
 */
async function isSmtpConfigured() {
    // 优先检查环境变量
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return true;
    }

    // 检查数据库
    try {
        const host = await get("SELECT value FROM system_settings WHERE key = 'smtp_host'");
        const user = await get("SELECT value FROM system_settings WHERE key = 'smtp_user'");
        const pass = await get("SELECT value FROM system_settings WHERE key = 'smtp_pass'");
        return !!(host?.value && user?.value && pass?.value);
    } catch (e) {
        return false;
    }
}

/**
 * 获取 SMTP 配置并创建 Transporter
 */
async function createTransporter() {
    // 优先使用环境变量
    const envPort = parseInt(process.env.SMTP_PORT);
    const config = {
        host: process.env.SMTP_HOST,
        port: envPort,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            // 默认允许自签名证书，提高兼容性
            rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED === 'true'
        }
    };

    // 智能处理 secure 标志：如果用户指定了端口但没没指定 secure，则根据端口判断
    if (!isNaN(envPort) && process.env.SMTP_SECURE === undefined) {
        config.secure = envPort === 465;
    }

    // 如果环境变量缺失，则从数据库获取
    if (!config.host || !config.auth.user || !config.auth.pass) {
        const host = await get("SELECT value FROM system_settings WHERE key = 'smtp_host'");
        const port = await get("SELECT value FROM system_settings WHERE key = 'smtp_port'");
        const user = await get("SELECT value FROM system_settings WHERE key = 'smtp_user'");
        const pass = await get("SELECT value FROM system_settings WHERE key = 'smtp_pass'");
        const secure = await get("SELECT value FROM system_settings WHERE key = 'smtp_secure'");

        if (!host?.value || !user?.value || !pass?.value) {
            throw new Error('SMTP config is incomplete (Env and DB)');
        }

        config.host = host.value;
        const dbPort = parseInt(port?.value);
        config.port = dbPort || 465;
        // 如果数据库里没有显式设置 secure，则根据端口判断
        config.secure = secure?.value === 'true' || (secure?.value === undefined && config.port === 465);
        config.auth.user = user.value;
        config.auth.pass = pass.value;
    }

    // 处理默认端口
    if (isNaN(config.port)) {
        config.port = config.secure ? 465 : 587;
    }

    return nodemailer.createTransport(config);
}

/**
 * 发送邮件
 */
async function sendMail({ to, subject, html }) {
    if (!to) {
        throw new Error('未定义收件人 (No recipients defined)');
    }
    try {
        const fromEnv = process.env.SMTP_FROM;
        const fromDb = await get("SELECT value FROM system_settings WHERE key = 'smtp_from'");
        const from = fromEnv || fromDb?.value || 'CarNote <noreply@carnote.com>';

        const transporter = await createTransporter();

        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html
        });

        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Send mail error:', error);
        throw error;
    }
}

module.exports = { sendMail, isSmtpConfigured };
