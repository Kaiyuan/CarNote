/**
 * 认证中间件
 * 用于验证 API Key 和用户会话
 */

const { query, get } = require('../config/database');
const crypto = require('crypto');

/**
 * API Key 认证中间件
 * 用于验证请求中的 API Key
 */
async function authenticateApiKey(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                message: '缺少 API Key'
            });
        }

        // 查询 API Key
        const keyRecord = await get(
            'SELECT * FROM api_keys WHERE key_value = ? AND is_active = 1',
            [apiKey]
        );

        if (!keyRecord) {
            return res.status(401).json({
                success: false,
                message: '无效的 API Key'
            });
        }

        // 更新最后使用时间
        await query(
            'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
            [keyRecord.id]
        );

        // 将 API Key 信息附加到请求对象
        req.apiKey = keyRecord;
        req.userId = keyRecord.user_id;

        next();
    } catch (error) {
        console.error('API Key 认证错误:', error);
        res.status(500).json({
            success: false,
            message: '认证失败'
        });
    }
}

/**
 * 可选的 API Key 认证
 * 如果提供了 API Key 则验证，否则跳过
 */
async function optionalApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
        return next();
    }

    return authenticateApiKey(req, res, next);
}

/**
 * 简单的用户认证中间件（基于会话）
 */
async function authenticateUser(req, res, next) {
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: '未登录'
        });
    }

    const user = await get('SELECT role, is_disabled FROM users WHERE id = ?', [userId]);

    if (!user) {
        return res.status(401).json({ success: false, message: '用户不存在' });
    }

    if (user.is_disabled) {
        return res.status(403).json({ success: false, message: '您的账号已被禁用，请联系管理员' });
    }

    req.userId = parseInt(userId);
    req.userRole = user.role;
    next();
}

/**
 * 管理员权限校验
 */
function isAdmin(req, res, next) {
    if (req.userRole !== 'admin') {
        return res.status(403).json({
            success: false,
            message: '权限不足，仅限管理员操作'
        });
    }
    next();
}

/**
 * 记录审计日志
 */
async function createAuditLog(userId, action, details) {
    try {
        await query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
            [userId, action, typeof details === 'object' ? JSON.stringify(details) : String(details)]
        );
    } catch (e) {
        console.error('Audit log failed:', e);
    }
}

/**
 * 生成随机 API Key
 */
function generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * 验证车辆所有权
 * 确保用户只能操作自己的车辆数据
 */
async function checkVehicleOwnership(req, res, next) {
    try {
        const vehicleId = req.params.vehicleId || req.params.id || req.body.vehicle_id;
        const userId = req.userId;

        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                message: '缺少车辆 ID'
            });
        }

        const vehicle = await get(
            'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
            [vehicleId, userId]
        );

        if (!vehicle) {
            return res.status(403).json({
                success: false,
                message: '无权访问此车辆'
            });
        }

        req.vehicle = vehicle;
        next();
    } catch (error) {
        console.error('车辆所有权验证错误:', error);
        res.status(500).json({
            success: false,
            message: '验证失败'
        });
    }
}

module.exports = {
    authenticateApiKey,
    optionalApiKey,
    authenticateUser,
    isAdmin,
    createAuditLog,
    generateApiKey,
    checkVehicleOwnership
};
