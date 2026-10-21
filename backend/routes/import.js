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
        partReplacements: Array.isArray(data.partReplacements) ? data.partReplacements.length : 0,
        insurances: Array.isArray(data.insurances) ? data.insurances.length : 0,
        insuranceClaims: Array.isArray(data.insuranceClaims) ? data.insuranceClaims.length : 0
    };

    res.json({
        success: true,
        data: {
            summary,
            isValid: Object.values(summary).some(count => count > 0)
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

    const dataKeys = [
        'vehicles', 'energyLogs', 'maintenanceRecords', 'parts', 'partReplacements',
        'insurances', 'insuranceClaims'
    ];
    if (!data || !dataKeys.some(key => Array.isArray(data[key]))) {
        return res.status(400).json({ success: false, message: '无效的数据格式' });
    }

    try {
        await transaction(async (db) => {
            const vehicleIdMap = new Map();
            const partIdMap = new Map();
            const insuranceIdMap = new Map();

            // 1. 导入车辆
            for (const vehicle of (data.vehicles || [])) {
                // 检查是否已存在同车牌车辆
                let targetId;
                const existing = await query('SELECT id FROM vehicles WHERE plate_number = ? AND user_id = ?', [vehicle.plate_number, userId]);

                if (existing && existing.length > 0) {
                    targetId = existing[0].id;
                } else {
                    const result = await query(
                        'INSERT INTO vehicles (user_id, plate_number, brand, model, year, power_type, current_mileage, purchase_date, photo_url, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [userId, vehicle.plate_number, vehicle.brand, vehicle.model, vehicle.year, vehicle.power_type, vehicle.current_mileage, vehicle.purchase_date, vehicle.photo_url, vehicle.description]
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
                        'INSERT INTO energy_logs (vehicle_id, log_date, mileage, energy_type, amount, cost, unit_price, mileage_diff, consumption_per_100km, fuel_gauge_reading, is_full, is_reset_step, is_lent, lent_to, location_name, location_lat, location_lng, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [newVehicleId, log.log_date, log.mileage, log.energy_type, log.amount, log.cost, log.unit_price, log.mileage_diff, log.consumption_per_100km, log.fuel_gauge_reading, log.is_full ? 1 : 0, log.is_reset_step ? 1 : 0, log.is_lent ? 1 : 0, log.lent_to || null, log.location_name, log.location_lat, log.location_lng, log.notes]
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

            // 6. 导入保险
            if (data.insurances) {
                for (const insurance of data.insurances) {
                    const newVehicleId = insurance.vehicle_id ? (vehicleIdMap.get(insurance.vehicle_id) || null) : null;

                    const result = await query(
                        `INSERT INTO insurances
                         (user_id, vehicle_id, policy_number, insurance_company, start_date, end_date,
                          premium, type, policy_image_url, ocr_content, notes)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [userId, newVehicleId, insurance.policy_number, insurance.insurance_company,
                            insurance.start_date, insurance.end_date, insurance.premium, insurance.type,
                            insurance.policy_image_url, insurance.ocr_content, insurance.notes]
                    );
                    insuranceIdMap.set(insurance.id, result.lastID);
                }
            }

            // 7. 导入保险理赔记录
            if (data.insuranceClaims) {
                for (const claim of data.insuranceClaims) {
                    const newInsuranceId = insuranceIdMap.get(claim.insurance_id);
                    if (!newInsuranceId) continue;

                    await query(
                        `INSERT INTO insurance_claims
                         (insurance_id, user_id, claim_date, description, claim_amount, status, notes)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [newInsuranceId, userId, claim.claim_date, claim.description,
                            claim.claim_amount, claim.status, claim.notes]
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
