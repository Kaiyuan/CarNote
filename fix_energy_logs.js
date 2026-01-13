const path = require('path');
process.env.SQLITE_PATH = path.join(__dirname, 'backend', 'data', 'carnote.db');
const dbConfigPath = path.join(__dirname, 'backend', 'config', 'database');
const { initDatabase, get, query } = require(dbConfigPath);

// From backend/routes/energy.js (replicated for standalone run)
async function recalculateVehicleLogs(vehicleId) {
    if (!vehicleId) return;
    const logs = await query(`SELECT * FROM energy_logs WHERE vehicle_id = ? ORDER BY log_date ASC, mileage ASC, id ASC`, [vehicleId]);
    if (logs.length === 0) return;
    let prevLog = null;
    const trackers = { fuel: { lastFull: null, sum: 0 }, electric: { lastFull: null, sum: 0 } };
    for (const log of logs) {
        let mileage_diff = null;
        let consumption = null;
        if (prevLog) {
            mileage_diff = log.mileage - prevLog.mileage;
            if (mileage_diff < 0) mileage_diff = 0;
        }
        const type = log.energy_type || 'fuel';
        const tracker = trackers[type] || trackers.fuel;
        if (log.is_full) {
            if (tracker.lastFull) {
                const cycleMileage = log.mileage - tracker.lastFull.mileage;
                if (cycleMileage > 0) {
                    const totalAmount = parseFloat(tracker.sum) + parseFloat(log.amount);
                    consumption = (totalAmount / cycleMileage) * 100;
                    consumption = Math.round(consumption * 100) / 100;
                } else if (cycleMileage === 0) {
                    consumption = 0;
                }
            }
            tracker.lastFull = log;
            tracker.sum = 0;
        } else {
            tracker.sum += parseFloat(log.amount);
            consumption = null;
        }
        await query(`UPDATE energy_logs SET mileage_diff = ?, consumption_per_100km = ? WHERE id = ?`, [mileage_diff, consumption, log.id]);
        prevLog = log;
    }
}

async function fixData() {
    try {
        await initDatabase();
        const vs = await query("SELECT id, plate_number FROM vehicles");
        for (const v of vs) {
            console.log(`Recalculating for ${v.plate_number} (ID: ${v.id})...`);
            await recalculateVehicleLogs(v.id);
        }
        console.log("Done!");
    } catch (e) {
        console.error(e);
    }
}

fixData();
