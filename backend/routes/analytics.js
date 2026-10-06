/**
 * 数据分析路由
 * 提供各种统计和分析数据
 */

const express = require('express');
const router = express.Router();
const { query, get } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 助手函数：根据 range 参数获取起始日期
 */
function resolveRange(range) {
    if (!range || range === 'all') return null;

    const now = new Date();
    if (range === '6months') {
        now.setMonth(now.getMonth() - 6);
    } else if (range === 'year') {
        now.setFullYear(now.getFullYear() - 1);
    } else {
        return null;
    }
    return now.toISOString().split('T')[0];
}

/**
 * 获取能耗趋势数据
 * GET /api/analytics/consumption/:vehicleId
 */
router.get('/consumption/:vehicleId', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    const { period = 'month', start_date, end_date } = req.query;

    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [vehicleId, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    const isPostgres = process.env.DB_TYPE === 'postgresql';
    let periodSql;
    let groupBy;

    if (isPostgres) {
        const pgFormats = {
            'day': 'YYYY-MM-DD',
            'month': 'YYYY-MM',
            'year': 'YYYY'
        };
        const fmt = pgFormats[period] || 'YYYY-MM';
        periodSql = `TO_CHAR(log_date, '${fmt}')`;
        groupBy = periodSql;
    } else {
        const sqliteFormats = {
            'day': '%Y-%m-%d',
            'month': '%Y-%m',
            'year': '%Y'
        };
        const fmt = sqliteFormats[period] || '%Y-%m';
        periodSql = `strftime('${fmt}', log_date)`;
        groupBy = periodSql;
    }

    let sql = `
        SELECT 
            ${periodSql} as period,
            energy_type,
            COUNT(*) as record_count,
            SUM(amount) as total_amount,
            AVG(consumption_per_100km) as avg_consumption,
            SUM(cost) as total_cost
        FROM energy_logs
        WHERE vehicle_id = ?
    `;

    const params = [vehicleId];

    if (start_date) {
        sql += ' AND log_date >= ?';
        params.push(start_date);
    }
    if (end_date) {
        sql += ' AND log_date <= ?';
        params.push(end_date);
    }

    sql += ` GROUP BY ${groupBy}, energy_type ORDER BY period`;

    const data = await query(sql, params);

    res.json({
        success: true,
        data
    });
}));

/**
 * 获取费用统计
 * GET /api/analytics/expenses/:vehicleId
 */
router.get('/expenses/:vehicleId', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    const { start_date: query_start, end_date, range } = req.query;

    const start_date = query_start || resolveRange(range);
    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [vehicleId, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    let energySql = `
        SELECT SUM(cost) as total_cost, energy_type
        FROM energy_logs
        WHERE vehicle_id = ?
    `;
    const energyParams = [vehicleId];

    if (start_date) {
        energySql += ' AND log_date >= ?';
        energyParams.push(start_date);
    }
    if (end_date) {
        energySql += ' AND log_date <= ?';
        energyParams.push(end_date);
    }

    energySql += ' GROUP BY energy_type';

    const energyCosts = await query(energySql, energyParams);

    let maintenanceSql = `
        SELECT SUM(cost) as total_cost, type
        FROM maintenance_records
        WHERE vehicle_id = ?
    `;
    const maintenanceParams = [vehicleId];

    if (start_date) {
        maintenanceSql += ' AND maintenance_date >= ?';
        maintenanceParams.push(start_date);
    }
    if (end_date) {
        maintenanceSql += ' AND maintenance_date <= ?';
        maintenanceParams.push(end_date);
    }

    maintenanceSql += ' GROUP BY type';

    const maintenanceCosts = await query(maintenanceSql, maintenanceParams);

    let partsSql = `
        SELECT SUM(cost) as total_cost
        FROM part_replacements
        WHERE vehicle_id = ?
    `;
    const partsParams = [vehicleId];

    if (start_date) {
        partsSql += ' AND replacement_date >= ?';
        partsParams.push(start_date);
    }
    if (end_date) {
        partsSql += ' AND replacement_date <= ?';
        partsParams.push(end_date);
    }

    const partsCostResult = await get(partsSql, partsParams);

    let insuranceSql = `SELECT COALESCE(SUM(premium), 0) as total_cost FROM insurances WHERE vehicle_id = ?`;
    const insuranceParams = [vehicleId];
    if (start_date) {
        insuranceSql += ' AND start_date >= ?';
        insuranceParams.push(start_date);
    }
    if (end_date) {
        insuranceSql += ' AND start_date <= ?';
        insuranceParams.push(end_date);
    }
    const insuranceCostResult = await get(insuranceSql, insuranceParams);

    const totalEnergyCost = energyCosts.reduce((sum, item) => sum + (parseFloat(item.total_cost) || 0), 0);
    const totalMaintenanceCost = maintenanceCosts.reduce((sum, item) => sum + (parseFloat(item.total_cost) || 0), 0);
    const totalPartsCost = parseFloat(partsCostResult?.total_cost) || 0;
    const totalInsuranceCost = parseFloat(insuranceCostResult?.total_cost) || 0;

    res.json({
        success: true,
        data: {
            summary: {
                energy: totalEnergyCost,
                maintenance: totalMaintenanceCost,
                parts: totalPartsCost,
                insurance: totalInsuranceCost,
                total: totalEnergyCost + totalMaintenanceCost + totalPartsCost + totalInsuranceCost
            },
            breakdown: {
                energy: energyCosts,
                maintenance: maintenanceCosts,
                parts: totalPartsCost,
                insurance: totalInsuranceCost
            }
        }
    });
}));

/**
 * 获取补能位置数据（用于热力图）
 * GET /api/analytics/locations/:vehicleId
 */
router.get('/locations/:vehicleId', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;

    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [vehicleId, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    const locations = await query(
        `SELECT 
            location_name,
            location_lat,
            location_lng,
            COUNT(*) as visit_count,
            SUM(amount) as total_amount,
            SUM(cost) as total_cost
         FROM energy_logs
         WHERE vehicle_id = ? AND location_lat IS NOT NULL AND location_lng IS NOT NULL
         GROUP BY location_name, location_lat, location_lng
         ORDER BY visit_count DESC`,
        [vehicleId]
    );

    res.json({
        success: true,
        data: locations
    });
}));

/**
 * 获取车辆总览统计
 * GET /api/analytics/overview/:vehicleId
 */
router.get('/overview/:vehicleId', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    const { range } = req.query;
    const start_date = resolveRange(range);

    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [vehicleId, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    const dateFilter = start_date ? ` AND log_date >= '${start_date}'` : '';
    const maintDateFilter = start_date ? ` AND maintenance_date >= '${start_date}'` : '';
    const partDateFilter = start_date ? ` AND replacement_date >= '${start_date}'` : '';
    const insuranceDateFilter = start_date ? ` AND start_date >= '${start_date}'` : '';

    // 能耗统计
    const energyStats = await get(
        `SELECT 
            COUNT(*) as total_records,
            SUM(amount) as total_amount,
            AVG(consumption_per_100km) as avg_consumption,
            SUM(cost) as total_cost,
            MIN(log_date) as first_record_date,
            MAX(log_date) as last_record_date,
            SUM(COALESCE(mileage_diff, 0)) as period_mileage
         FROM energy_logs
         WHERE vehicle_id = ?${dateFilter}`,
        [vehicleId]
    );

    const displayMileage = start_date ? (energyStats?.period_mileage || 0) : vehicle.current_mileage;

    const maintenanceStats = await get(
        `SELECT 
            COUNT(*) as total_records,
            SUM(cost) as total_cost,
            MAX(maintenance_date) as last_maintenance_date
         FROM maintenance_records
         WHERE vehicle_id = ?${maintDateFilter}`,
        [vehicleId]
    );

    let lastMaintDays = null;
    if (maintenanceStats?.last_maintenance_date) {
        const lastDate = new Date(maintenanceStats.last_maintenance_date);
        const now = new Date();
        lastMaintDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
    }

    const partsStats = await get(
        `SELECT 
            COUNT(*) as total_parts,
            SUM(CASE WHEN status = 'normal' THEN 1 ELSE 0 END) as normal_count,
            SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_count,
            SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count
         FROM parts
         WHERE vehicle_id = ?`,
        [vehicleId]
    );

    const partReplacementStats = await get(
        `SELECT 
            COUNT(*) as total_replacements,
            SUM(cost) as total_cost
         FROM part_replacements
         WHERE vehicle_id = ?${partDateFilter}`,
        [vehicleId]
    );

    const insuranceStats = await get(
        `SELECT COUNT(*) as total_records, COALESCE(SUM(premium), 0) as total_cost
         FROM insurances
         WHERE vehicle_id = ?${insuranceDateFilter}`,
        [vehicleId]
    );

    const insuranceCost = insuranceStats?.total_cost || 0;

    res.json({
        success: true,
        data: {
            vehicle,
            total_mileage: displayMileage,
            total_cost: (energyStats?.total_cost || 0) + (maintenanceStats?.total_cost || 0) + (partReplacementStats?.total_cost || 0) + insuranceCost,
            avg_consumption: energyStats?.avg_consumption || 0,
            avg_cost_per_km: displayMileage > 0 ? ((energyStats?.total_cost || 0) + (maintenanceStats?.total_cost || 0) + (partReplacementStats?.total_cost || 0) + insuranceCost) / displayMileage : 0,
            last_maintenance_date: maintenanceStats?.last_maintenance_date || null,
            last_maintenance_days: lastMaintDays,
            energy: energyStats,
            maintenance: maintenanceStats,
            parts: {
                ...partsStats,
                replacement_cost: partReplacementStats?.total_cost || 0
            },
            insurance: {
                total_records: insuranceStats?.total_records || 0,
                total_cost: insuranceCost
            }
        }
    });
}));

/**
 * 获取月度趋势对比
 * GET /api/analytics/monthly-trend/:vehicleId
 */
router.get('/monthly-trend/:vehicleId', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    const { range, months: queryMonths } = req.query;

    let months = parseInt(queryMonths) || 12;
    if (range === '6months') months = 6;
    else if (range === 'year') months = 12;
    else if (range === 'all') months = 120;

    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [vehicleId, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    const isPostgres = process.env.DB_TYPE === 'postgresql';

    let sql;
    if (isPostgres) {
        sql = `SELECT 
            TO_CHAR(log_date, 'YYYY-MM') as month,
            AVG(consumption_per_100km) as avg_consumption,
            SUM(amount) as total_amount,
            SUM(cost) as total_cost,
            SUM(COALESCE(mileage_diff, 0)) as total_mileage,
            COUNT(*) as record_count
         FROM energy_logs
         WHERE vehicle_id = ? AND log_date >= NOW() - INTERVAL '${months} months'
         GROUP BY month
         ORDER BY month ASC`;
    } else {
        sql = `SELECT 
            strftime('%Y-%m', log_date) as month,
            AVG(consumption_per_100km) as avg_consumption,
            SUM(amount) as total_amount,
            SUM(cost) as total_cost,
            SUM(COALESCE(mileage_diff, 0)) as total_mileage,
            COUNT(*) as record_count
         FROM energy_logs
         WHERE vehicle_id = ? AND log_date >= date('now', '-${months} months')
         GROUP BY strftime('%Y-%m', log_date)
         ORDER BY month ASC`;
    }

    const monthlyData = await query(sql, [vehicleId]);

    res.json({
        success: true,
        data: monthlyData
    });
}));

module.exports = router;
