/**
 * 数据备份与恢复路由
 * 处理全量数据的导出与导入
 */

const express = require('express');
const router = express.Router();
const { query, get, transaction } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 导出全量数据
 * GET /api/data/export
 */
router.get('/export', authenticateUser, asyncHandler(async (req, res) => {
    const userId = req.userId;

    // 获取所有相关数据
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

    const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
            vehicles,
            energyLogs,
            maintenanceRecords,
            parts,
            partReplacements
        }
    };

    res.json({
        success: true,
        data: exportData
    });
}));

/**
 * 导入全量数据
 * POST /api/data/import
 */
router.post('/import', authenticateUser, asyncHandler(async (req, res) => {
    const userId = req.userId;
    const { data, version } = req.body;

    if (!data || !data.vehicles) {
        return res.status(400).json({
            success: false,
            message: '无效的备份数据格式'
        });
    }

    try {
        // 使用事务确保数据一致性
        await transaction(async (db) => {
            // 记录旧 ID 到新 ID 的映射
            const vehicleIdMap = new Map();
            const partIdMap = new Map();

            // 1. 导入车辆
            for (const vehicle of data.vehicles) {
                const result = await query(
                    'INSERT INTO vehicles (user_id, plate_number, brand, model, year, color, vin, engine_number, current_mileage, power_type, purchase_date, purchase_price, insurance_expiry, inspection_expiry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [userId, vehicle.plate_number, vehicle.brand, vehicle.model, vehicle.year, vehicle.color, vehicle.vin, vehicle.engine_number, vehicle.current_mileage, vehicle.power_type, vehicle.purchase_date, vehicle.purchase_price, vehicle.insurance_expiry, vehicle.inspection_expiry]
                );
                vehicleIdMap.set(vehicle.id, result.lastID);
            }

            // 2. 导入能耗记录
            if (data.energyLogs) {
                for (const log of data.energyLogs) {
                    const newVehicleId = vehicleIdMap.get(log.vehicle_id);
                    if (!newVehicleId) continue;

                    await query(
                        'INSERT INTO energy_logs (vehicle_id, log_date, mileage, energy_type, amount, cost, unit_price, mileage_diff, consumption_per_100km, fuel_gauge_reading, is_full, location_name, location_lat, location_lng, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [newVehicleId, log.log_date, log.mileage, log.energy_type, log.amount, log.cost, log.unit_price, log.mileage_diff, log.consumption_per_100km, log.fuel_gauge_reading, log.is_full, log.location_name, log.location_lat, log.location_lng, log.notes]
                    );
                }
            }

            // 3. 导入保养记录
            if (data.maintenanceRecords) {
                for (const record of data.maintenanceRecords) {
                    const newVehicleId = vehicleIdMap.get(record.vehicle_id);
                    if (!newVehicleId) continue;

                    await query(
                        'INSERT INTO maintenance_records (vehicle_id, maintenance_date, mileage, type, description, cost, shop_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [newVehicleId, record.maintenance_date, record.mileage, record.type, record.description, record.cost, record.shop_name, record.notes]
                    );
                }
            }

            // 4. 导入配件
            if (data.parts) {
                for (const part of data.parts) {
                    const newVehicleId = vehicleIdMap.get(part.vehicle_id);
                    if (!newVehicleId) continue;

                    const result = await query(
                        'INSERT INTO parts (vehicle_id, name, brand, model, category, purchase_date, warranty_period, lifespan_mileage, lifespan_months, last_replacement_mileage, last_replacement_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [newVehicleId, part.name, part.brand, part.model, part.category, part.purchase_date, part.warranty_period, part.lifespan_mileage, part.lifespan_months, part.last_replacement_mileage, part.last_replacement_date, part.status, part.notes]
                    );
                    partIdMap.set(part.id, result.lastID);
                }
            }

            // 5. 导入配件更换记录
            if (data.partReplacements) {
                for (const replacement of data.partReplacements) {
                    const newPartId = partIdMap.get(replacement.part_id);
                    if (!newPartId) continue;

                    await query(
                        'INSERT INTO part_replacements (part_id, replacement_date, mileage, cost, shop_name, notes) VALUES (?, ?, ?, ?, ?, ?)',
                        [newPartId, replacement.replacement_date, replacement.mileage, replacement.cost, replacement.shop_name, replacement.notes]
                    );
                }
            }
        });

        res.json({
            success: true,
            message: '数据导入成功'
        });
    } catch (error) {
        console.error('数据导入失败:', error);
        res.status(500).json({
            success: false,
            message: '导入过程中发生错误: ' + error.message
        });
    }
}));

module.exports = router;
