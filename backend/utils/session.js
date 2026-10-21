/**
 * 数据库会话管理
 * 会话令牌只保存在 HttpOnly Cookie 中，数据库仅保存其 SHA-256 哈希。
 */

const crypto = require('crypto');
const { query, get } = require('../config/database');

const SESSION_COOKIE_NAME = 'carnote_session';
const DEFAULT_TTL_DAYS = 7;

function getTtlMs() {
    const days = Number(process.env.SESSION_TTL_DAYS);
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 30) : DEFAULT_TTL_DAYS;
    return safeDays * 24 * 60 * 60 * 1000;
}

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function parseCookies(header) {
    const cookies = {};
    if (!header) return cookies;

    for (const part of String(header).split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0) continue;
        const name = part.slice(0, separator).trim();
        let value = part.slice(separator + 1).trim();
        try {
            value = decodeURIComponent(value);
        } catch (e) {
            // 保持原值
        }
        if (name) cookies[name] = value;
    }

    return cookies;
}

function getRequestToken(req) {
    const authorization = req.headers.authorization;
    if (authorization && /^Bearer\s+/i.test(authorization)) {
        return authorization.replace(/^Bearer\s+/i, '').trim();
    }

    const cookies = parseCookies(req.headers.cookie);
    return cookies[SESSION_COOKIE_NAME] || null;
}

function isSecureRequest(req) {
    if (process.env.COOKIE_SECURE === 'true') return true;
    if (process.env.COOKIE_SECURE === 'false') return false;
    return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
}

function cookieOptions(req) {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        path: '/',
        maxAge: getTtlMs()
    };
}

async function cleanupExpiredSessions() {
    await query('DELETE FROM user_sessions WHERE expires_at < ?', [new Date().toISOString()]);
}

async function createSession(userId) {
    await cleanupExpiredSessions();

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + getTtlMs()).toISOString();

    await query(
        'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [userId, tokenHash, expiresAt]
    );

    return token;
}

async function getSession(token) {
    if (!token) return null;

    const session = await get(
        `SELECT s.id, s.user_id, s.expires_at, u.role, u.is_disabled
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token_hash = ?`,
        [hashToken(token)]
    );

    if (!session) return null;

    const expiresAt = new Date(session.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        await query('DELETE FROM user_sessions WHERE id = ?', [session.id]);
        return null;
    }

    return session;
}

async function invalidateSession(token) {
    if (!token) return;
    await query('DELETE FROM user_sessions WHERE token_hash = ?', [hashToken(token)]);
}

async function invalidateUserSessions(userId, exceptSessionId = null) {
    if (exceptSessionId) {
        await query('DELETE FROM user_sessions WHERE user_id = ? AND id != ?', [userId, exceptSessionId]);
    } else {
        await query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
    }
}

function setSessionCookie(req, res, token) {
    res.cookie(SESSION_COOKIE_NAME, token, cookieOptions(req));
}

function clearSessionCookie(req, res) {
    const options = cookieOptions(req);
    delete options.maxAge;
    res.clearCookie(SESSION_COOKIE_NAME, options);
}

module.exports = {
    SESSION_COOKIE_NAME,
    createSession,
    getSession,
    invalidateSession,
    invalidateUserSessions,
    getRequestToken,
    setSessionCookie,
    clearSessionCookie,
    hashToken
};
