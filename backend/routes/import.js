const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 验证导入数据
 * POST /api/import/validate
 */
router.post('/validate', authenticateUser, asyncHandler(async (req, res) => {
    const { data } = req.body;

    if (!data) {
        return res.status(400).json({ success: false, message: '请提供导入数据' });
    }

    const summary = {
        vehicles: Array.isArray(data.vehicles) ? data.vehicles.length : 0,
        energyLogs: Array.isArray(data.energyLogs) ? data.energyLogs.length : 0,
        maintenanceRecords: Array.isArray(data.maintenanceRecords) ? data.maintenanceRecords.length : 0,
        parts: Array.isArray(data.parts) ? data.parts.length : 0,
        partReplacements: Array.isArray(data.partReplacements) ? data.partReplacements.length : 0
    };

    res.json({
        success: true,
        data: {
            summary,
            isValid: summary.vehicles > 0 || summary.energyLogs > 0 // 至少需要车辆或记录
        }
    });
}));

/**
 * 执行导入
 * POST /api/import/execute
 */
router.post('/execute', authenticateUser, asyncHandler(async (req, res) => {
    const userId = req.userId;
    const { data } = req.body;

    if (!data || !data.vehicles) {
        return res.status(400).json({ success: false, message: '无效的数据格式' });
    }

    try {
        await transaction(async (db) => {
            const vehicleIdMap = new Map();
            const partIdMap = new Map();

            // 1. 导入车辆
            for (const vehicle of data.vehicles) {
                // 检查是否已存在同车牌车辆
                let targetId;
                const existing = await query('SELECT id FROM vehicles WHERE plate_number = ? AND user_id = ?', [vehicle.plate_number, userId]);

                if (existing && existing.length > 0) {
                    targetId = existing[0].id;
                } else {
                    const result = await query(
                        'INSERT INTO vehicles (user_id, plate_number, brand, model, year, color, vin, engine_number, current_mileage, power_type, purchase_date, purchase_price, insurance_expiry, inspection_expiry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [userId, vehicle.plate_number, vehicle.brand, vehicle.model, vehicle.year, vehicle.color, vehicle.vin, vehicle.engine_number, vehicle.current_mileage, vehicle.power_type, vehicle.purchase_date, vehicle.purchase_price, vehicle.insurance_expiry, vehicle.inspection_expiry]
                    );
                    targetId = result.lastID;
                }
                vehicleIdMap.set(vehicle.id, targetId);
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
                        'INSERT INTO maintenance_records (vehicle_id, maintenance_date, mileage, type, service_provider, description, cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [newVehicleId, record.maintenance_date, record.mileage, record.type, record.service_provider || record.shop_name, record.description, record.cost, record.notes]
                    );
                }
            }

            // 4. 导入配件
            if (data.parts) {
                for (const part of data.parts) {
                    const newVehicleId = vehicleIdMap.get(part.vehicle_id);
                    if (!newVehicleId) continue;

                    const result = await query(
                        'INSERT INTO parts (vehicle_id, name, part_number, installed_date, installed_mileage, recommended_replacement_mileage, recommended_replacement_months, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [newVehicleId, part.name, part.part_number, part.installed_date, part.installed_mileage, part.recommended_replacement_mileage, part.recommended_replacement_months, part.status, part.notes]
                    );
                    partIdMap.set(part.id, { newId: result.lastID, vehicleId: newVehicleId });
                }
            }

            // 5. 导入配件更换记录
            if (data.partReplacements) {
                for (const replacement of data.partReplacements) {
                    const partInfo = partIdMap.get(replacement.part_id);
                    const newVehicleId = partInfo ? partInfo.vehicleId : vehicleIdMap.get(replacement.vehicle_id);
                    if (!newVehicleId) continue;

                    await query(
                        'INSERT INTO part_replacements (vehicle_id, part_id, replacement_date, mileage, cost, service_provider, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [newVehicleId, partInfo ? partInfo.newId : null, replacement.replacement_date, replacement.mileage, replacement.cost, replacement.service_provider || replacement.shop_name, replacement.notes]
                    );
                }
            }
        });

        res.json({ success: true, message: '数据导入成功' });
    } catch (error) {
        console.error('导入失败:', error);
        res.status(500).json({ success: false, message: '导入过程中发生错误: ' + error.message });
    }
}));

module.exports = router;
