/**
 * 全局错误处理中间件
 */

/**
 * 404 错误处理
 */
function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        message: '请求的资源不存在',
        path: req.path
    });
}

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
    console.error('错误:', err);

    // 数据库错误
    if (err.code === 'SQLITE_CONSTRAINT' || err.code === '23505') {
        return res.status(400).json({
            success: false,
            message: '数据约束冲突，可能是重复的记录',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    // 验证错误
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: '数据验证失败',
            errors: err.errors
        });
    }

    // 默认服务器错误
    res.status(err.status || 500).json({
        success: false,
        message: err.message || '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
}

/**
 * 异步路由错误包装器
 * 自动捕获异步路由中的错误
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    notFoundHandler,
    errorHandler,
    asyncHandler
};
