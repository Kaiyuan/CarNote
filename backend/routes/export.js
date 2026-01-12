const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 导出全量数据
 * GET /api/export/all
 */
router.get('/all', authenticateUser, asyncHandler(async (req, res) => {
    const userId = req.userId;

    const vehicles = await query('SELECT * FROM vehicles WHERE user_id = ?', [userId]);
    const vehicleIds = vehicles.map(v => v.id);

    let energyLogs = [];
    let maintenanceRecords = [];
    let parts = [];
    let partReplacements = [];

    if (vehicleIds.length > 0) {
        const placeholders = vehicleIds.map(() => '?').join(',');
        energyLogs = await query(`SELECT * FROM energy_logs WHERE vehicle_id IN (${placeholders})`, vehicleIds);
        maintenanceRecords = await query(`SELECT * FROM maintenance_records WHERE vehicle_id IN (${placeholders})`, vehicleIds);
        parts = await query(`SELECT * FROM parts WHERE vehicle_id IN (${placeholders})`, vehicleIds);

        const partIds = parts.map(p => p.id);
        if (partIds.length > 0) {
            const partPlaceholders = partIds.map(() => '?').join(',');
            partReplacements = await query(`SELECT * FROM part_replacements WHERE part_id IN (${partPlaceholders})`, partIds);
        }
    }

    res.json({
        success: true,
        data: {
            vehicles,
            energyLogs,
            maintenanceRecords,
            parts,
            partReplacements,
            export_date: new Date().toISOString()
        }
    });
}));

/**
 * 导出车辆数据
 * GET /api/export/vehicles
 */
router.get('/vehicles', authenticateUser, asyncHandler(async (req, res) => {
    const data = await query('SELECT * FROM vehicles WHERE user_id = ?', [req.userId]);
    res.json({ success: true, data });
}));

/**
 * 导出能耗数据
 * GET /api/export/energy
 */
router.get('/energy', authenticateUser, asyncHandler(async (req, res) => {
    const data = await query(`
        SELECT e.*, v.plate_number 
        FROM energy_logs e 
        JOIN vehicles v ON e.vehicle_id = v.id 
        WHERE v.user_id = ?
    `, [req.userId]);
    res.json({ success: true, data });
}));

/**
 * 导出保养数据
 * GET /api/export/maintenance
 */
router.get('/maintenance', authenticateUser, asyncHandler(async (req, res) => {
    const data = await query(`
        SELECT m.*, v.plate_number 
        FROM maintenance_records m 
        JOIN vehicles v ON m.vehicle_id = v.id 
        WHERE v.user_id = ?
    `, [req.userId]);
    res.json({ success: true, data });
}));

module.exports = router;
