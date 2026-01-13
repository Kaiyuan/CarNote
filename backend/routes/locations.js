const express = require('express');
const router = express.Router();
const { query, get } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 搜索附近站点
 * GET /api/locations/nearby?lat=xxx&lng=yyy&radius=1 -- 默认 1km
 */
router.get('/nearby', authenticateUser, asyncHandler(async (req, res) => {
    const { lat, lng, radius = 1 } = req.query;
    if (!lat || !lng) {
        return res.status(400).json({ success: false, message: '需要经纬度参数' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const r = parseFloat(radius) / 111; // 粗略转换：111km per degree

    // 直接从 shared_locations 和既存记录中查询 (优先从 shared_locations)
    // 这里使用简单的矩形范围过滤（SQLite 环境下计算 Haversine 比较复杂）
    const sql = `
        SELECT name, latitude, longitude, type, 'shared' as source
        FROM shared_locations
        WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
        UNION
        SELECT DISTINCT location_name as name, location_lat as latitude, location_lng as longitude, 'energy' as type, 'energy_logs' as source
        FROM energy_logs
        WHERE location_lat BETWEEN ? AND ? AND location_lng BETWEEN ? AND ? AND location_name IS NOT NULL
        UNION
        SELECT DISTINCT location_name as name, location_lat as latitude, location_lng as longitude, 'maintenance' as type, 'maintenance_records' as source
        FROM maintenance_records
        WHERE location_lat BETWEEN ? AND ? AND location_lng BETWEEN ? AND ? AND location_name IS NOT NULL
    `;

    const bounds = [latitude - r, latitude + r, longitude - r, longitude + r];
    const params = [...bounds, ...bounds, ...bounds];

    const results = await query(sql, params);

    // 去重逻辑（按名称）
    const uniqueResults = [];
    const names = new Set();
    results.forEach(item => {
        if (!names.has(item.name)) {
            uniqueResults.push(item);
            names.add(item.name);
        }
    });

    res.json({ success: true, data: uniqueResults });
}));

/**
 * 记录一个新位置（或更新计数）
 * 这个函数将在业务路由中调用，不一定要公开 API
 */
async function syncToSharedLocation(name, lat, lng, type, userId) {
    if (!name || !lat || !lng) return;

    // 检查是否存在极其相近的点
    const existing = await get(
        "SELECT id FROM shared_locations WHERE name = ? OR (ABS(latitude - ?) < 0.0001 AND ABS(longitude - ?) < 0.0001)",
        [name, lat, lng]
    );

    if (existing) {
        await query("UPDATE shared_locations SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [existing.id]);
    } else {
        await query(
            "INSERT INTO shared_locations (name, latitude, longitude, type, created_by) VALUES (?, ?, ?, ?, ?)",
            [name, lat, lng, type, userId]
        );
    }
}

module.exports = { router, syncToSharedLocation };
