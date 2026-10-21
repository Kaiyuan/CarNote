/**
 * 认证相关接口限流
 * 生产环境建议同时在反向代理层配置限流。
 */

const rateLimit = require('express-rate-limit');

const common = {
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: '请求过于频繁，请稍后再试' }
};

const loginLimiter = rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000,
    limit: 30
});

const registerLimiter = rateLimit({
    ...common,
    windowMs: 60 * 60 * 1000,
    limit: 5
});

const emailLimiter = rateLimit({
    ...common,
    windowMs: 60 * 60 * 1000,
    limit: 5
});

const resetPasswordLimiter = rateLimit({
    ...common,
    windowMs: 60 * 60 * 1000,
    limit: 20
});

const verificationLimiter = rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000,
    limit: 20
});

const captchaLimiter = rateLimit({
    ...common,
    windowMs: 60 * 1000,
    limit: 30
});

module.exports = {
    loginLimiter,
    registerLimiter,
    emailLimiter,
    resetPasswordLimiter,
    verificationLimiter,
    captchaLimiter
};
