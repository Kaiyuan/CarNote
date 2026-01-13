const nodemailer = require('nodemailer');
const { get } = require('../config/database');

/**
 * 获取 SMTP 配置并创建 Transporter
 */
async function createTransporter() {
    const host = await get("SELECT value FROM system_settings WHERE key = 'smtp_host'");
    const port = await get("SELECT value FROM system_settings WHERE key = 'smtp_port'");
    const user = await get("SELECT value FROM system_settings WHERE key = 'smtp_user'");
    const pass = await get("SELECT value FROM system_settings WHERE key = 'smtp_pass'");
    const secure = await get("SELECT value FROM system_settings WHERE key = 'smtp_secure'");

    if (!host?.value || !user?.value || !pass?.value) {
        throw new Error('SMTP config is incomplete');
    }

    return nodemailer.createTransport({
        host: host.value,
        port: parseInt(port.value) || 465,
        secure: secure.value === 'true',
        auth: {
            user: user.value,
            pass: pass.value
        }
    });
}

/**
 * 发送邮件
 */
async function sendMail({ to, subject, html }) {
    try {
        const from = await get("SELECT value FROM system_settings WHERE key = 'smtp_from'");
        const transporter = await createTransporter();

        const info = await transporter.sendMail({
            from: from?.value || 'CarNote <noreply@carnote.com>',
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

module.exports = { sendMail };
