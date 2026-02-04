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
const crypto = require('crypto');

// 用于 Captcha 签名的密钥
const CAPTCHA_SECRET = process.env.JWT_SECRET || 'carnote-captcha-secret';

/**
 * 用户注册
 * POST /api/users/register
 */
router.post('/register', asyncHandler(async (req, res) => {
    const { username, password, email, nickname } = req.body;

    // 验证必填字段
    if (!username || !password || !email) {
        return res.status(400).json({
            success: false,
            message: '用户名、密码和邮箱不能为空'
        });
    }

    // 检查是否是第一个用户 以及 系统注册开关
    const userCount = await get('SELECT COUNT(*) as count FROM users');
    const isFirstUser = parseInt(userCount.count) === 0;

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

    // 检查用户名或邮箱是否已存在
    const existingUser = await get(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
    );

    if (existingUser) {
        return res.status(400).json({
            success: false,
            message: '用户名或邮箱已存在'
        });
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 10);

    // 分配角色
    const role = isFirstUser ? 'admin' : 'user';

    // 检查是否需要验证：首个用户或未配置 SMTP 时自动验证
    const { isSmtpConfigured } = require('../utils/mailer');
    const smtpReady = await isSmtpConfigured();

    // 获取后台设置：是否强制开启邮箱验证 (默认不开启)
    const verificationSetting = await get("SELECT value FROM system_settings WHERE key = 'email_verification_enabled'");
    const isVerificationRequired = verificationSetting?.value === 'true';

    // 只有在满足三个条件时才进行验证：1. 不是第一个用户 2. SMTP 已配置 3. 后台开启了验证
    const isVerified = (isFirstUser || !smtpReady || !isVerificationRequired) ? 1 : 0;
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24小时

    // 创建用户
    const result = await query(
        'INSERT INTO users (username, password_hash, email, nickname, role, is_verified, verification_code, verification_code_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [username, passwordHash, email, nickname || username, role, isVerified, verificationCode, verificationExpires]
    );

    // 创建默认设置
    await query(
        'INSERT INTO user_settings (user_id) VALUES (?)',
        [result.lastID]
    );

    // 发送验证邮件
    if (!isVerified) {
        const { sendMail } = require('../utils/mailer');
        try {
            await sendMail({
                to: email,
                subject: 'CarNote 账号验证',
                html: `<p>感谢注册 CarNote！您的验证码是：</p>
                       <h2>${verificationCode}</h2>
                       <p>该验证码24小时内有效。</p>`
            });
        } catch (e) {
            console.error('发送验证邮件失败:', e);
            // 不中断流程，返回成功但提示
        }
    }

    res.status(201).json({
        success: true,
        message: isVerified ? '注册成功' : '注册成功，请查收邮件并验证您的邮箱',
        data: {
            userId: result.lastID,
            username,
            role,
            isVerified: !!isVerified
        }
    });
}));

/**
 * 验证邮箱
 * POST /api/users/verify-email
 */
router.post('/verify-email', asyncHandler(async (req, res) => {
    const { username, code } = req.body;
    if (!username || !code) return res.status(400).json({ success: false, message: '参数缺失' });

    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    if (user.is_verified) return res.json({ success: true, message: '已验证' });

    if (user.verification_code !== code) {
        return res.status(400).json({ success: false, message: '验证码错误' });
    }

    if (new Date(user.verification_code_expires) < new Date()) {
        return res.status(400).json({ success: false, message: '验证码已过期，请重新注册或联系管理员' });
    }

    await query('UPDATE users SET is_verified = 1, verification_code = NULL, verification_code_expires = NULL WHERE id = ?', [user.id]);
    res.json({ success: true, message: '验证成功，请登录' });
}));

/**
 * 重新发送验证邮件 (带 Captcha)
 * POST /api/users/verify-email/resend
 */
router.post('/verify-email/resend', asyncHandler(async (req, res) => {
    const { username, captchaAnswer, captchaKey } = req.body;
    if (!username) return res.status(400).json({ success: false, message: '用户名不能为空' });

    // 验证 Captcha
    if (!captchaAnswer || !captchaKey) {
        return res.status(400).json({ success: false, message: '请先完成人机验证' });
    }
    const expectedKey = crypto.createHmac('sha256', CAPTCHA_SECRET)
        .update(captchaAnswer.toString())
        .digest('hex');
    if (expectedKey !== captchaKey) {
        return res.status(400).json({ success: false, message: '人机验证码错误' });
    }

    const { isSmtpConfigured, sendMail } = require('../utils/mailer');
    const smtpReady = await isSmtpConfigured();
    if (!smtpReady) {
        return res.status(400).json({ success: false, message: '系统未配置邮件服务，请联系管理员' });
    }

    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    if (!user.email) return res.status(400).json({ success: false, message: '该账户未绑定邮箱，请联系管理员手动验证' });
    if (user.is_verified) return res.status(400).json({ success: false, message: '账户已通过验证' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await query('UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?',
        [code, expires, user.id]);

    await sendMail({
        to: user.email,
        subject: '邮箱验证码',
        html: `您的验证码是: <b>${code}</b>，有效期 24 小时。`
    });

    res.json({ success: true, message: '验证邮件已重新发送' });
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

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!user) {
        await query('INSERT INTO login_logs (username, ip_address, success) VALUES (?, ?, ?)', [username, clientIp, 0]);
        return res.status(401).json({
            success: false,
            message: '用户名或密码错误'
        });
    }

    if (user.is_disabled) {
        return res.status(403).json({ success: false, message: '您的账号已被禁用，请联系管理员' });
    }

    // 检查是否验证 (管理员免验证)
    if (user.is_verified === 0 && user.role !== 'admin') {
        return res.status(401).json({
            success: false,
            message: '账号未验证，请完成邮箱验证',
            needVerify: true,
            username: user.username
        });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
        // 增加失败次数
        const newAttempts = (user.failed_login_attempts || 0) + 1;
        await query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [newAttempts, user.id]);
        await query('INSERT INTO login_logs (username, ip_address, success) VALUES (?, ?, ?)', [username, clientIp, 0]);

        let message = '用户名或密码错误';
        let showReset = false;
        if (newAttempts >= 5) {
            message = '连续登录失败次数过多。您可以尝试重置密码。';
            showReset = true;
        }

        return res.status(401).json({
            success: false,
            message,
            showReset
        });
    }

    // 登录成功，重置失败计数
    await query('UPDATE users SET failed_login_attempts = 0 WHERE id = ?', [user.id]);
    await query('INSERT INTO login_logs (username, ip_address, success) VALUES (?, ?, ?)', [username, clientIp, 1]);

    // 返回用户信息
    res.json({
        success: true,
        message: '登录成功',
        data: {
            userId: user.id,
            username: user.username,
            nickname: user.nickname,
            email: user.email,
            role: user.role
        }
    });
}));

/**
 * 获取通用的算术验证码 (Captcha)
 * GET /api/users/captcha
 */
router.get('/captcha', (req, res) => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-'];
    const operator = operators[Math.floor(Math.random() * operators.length)];

    let question, answer;
    if (operator === '+') {
        question = `${num1} + ${num2} = ?`;
        answer = num1 + num2;
    } else {
        const a = Math.max(num1, num2);
        const b = Math.min(num1, num2);
        question = `${a} - ${b} = ?`;
        answer = a - b;
    }

    const key = crypto.createHmac('sha256', CAPTCHA_SECRET)
        .update(answer.toString())
        .digest('hex');

    res.json({ success: true, data: { question, key } });
});

/**
 * 获取找回密码的验证码 (Captcha) - 兼容旧路由
 */
router.get('/forgot-password/captcha', (req, res) => {
    // 转发到通用接口
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-'];
    const operator = operators[Math.floor(Math.random() * operators.length)];

    let question, answer;
    if (operator === '+') {
        question = `${num1} + ${num2} = ?`;
        answer = num1 + num2;
    } else {
        const a = Math.max(num1, num2);
        const b = Math.min(num1, num2);
        question = `${a} - ${b} = ?`;
        answer = a - b;
    }

    const key = crypto.createHmac('sha256', CAPTCHA_SECRET)
        .update(answer.toString())
        .digest('hex');

    res.json({ success: true, data: { question, key } });
});

/**
 * 忘记密码 - 发送重置邮件
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
    const { email, captchaAnswer, captchaKey } = req.body;

    if (!email) return res.status(400).json({ success: false, message: '邮箱不能为空' });

    // 验证 Captcha
    if (!captchaAnswer || !captchaKey) {
        return res.status(400).json({ success: false, message: '请先完成人机验证' });
    }

    const expectedKey = crypto.createHmac('sha256', CAPTCHA_SECRET)
        .update(captchaAnswer.toString())
        .digest('hex');

    if (expectedKey !== captchaKey) {
        return res.status(400).json({ success: false, message: '验证码错误，请重试' });
    }

    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
        // 安全起见，即使用户不存在也返回成功感，或者提示检查邮箱
        return res.json({ success: true, message: '如果邮箱存在，重置链接已发送' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    // 使用 reset_password_token 存储 6位数字验证码
    await query('UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
        [code, expires, user.id]);

    const { sendMail } = require('../utils/mailer');

    try {
        await sendMail({
            to: user.email,
            subject: 'CarNote 密码重置验证码',
            html: `<p>您收到此邮件是因为您（或他人）请求重置密码。</p>
                   <p>您的验证码是：</p>
                   <h2>${code}</h2>
                   <p>有效期1小时。如果您没有请求重置，请忽略此邮件。</p>`
        });
        res.json({ success: true, message: '验证码已发送至您的邮箱' });
    } catch (e) {
        console.error('Mail failed:', e);
        res.status(500).json({ success: false, message: '邮件发送失败，请联系管理员或稍后再试' });
    }
}));

/**
 * 重置密码 - 执行修改
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
    const { email, code, password } = req.body;
    if (!email || !code || !password) return res.status(400).json({ success: false, message: '参数不全' });

    const user = await get('SELECT * FROM users WHERE email = ? AND reset_password_token = ? AND reset_password_expires > ?',
        [email, code, new Date().toISOString()]);

    if (!user) {
        return res.status(400).json({ success: false, message: '令牌无效或已过期' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await query(`UPDATE users 
                 SET password_hash = ?, 
                     reset_password_token = NULL, 
                     reset_password_expires = NULL, 
                     failed_login_attempts = 0 
                 WHERE id = ?`,
        [passwordHash, user.id]);

    res.json({ success: true, message: '密码重置成功，请重新登录' });
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
