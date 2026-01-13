const path = require('path');
process.env.SQLITE_PATH = path.join(__dirname, 'backend', 'data', 'carnote.db');
const dbConfigPath = path.join(__dirname, 'backend', 'config', 'database');
const { initDatabase, get, query } = require(dbConfigPath);

async function dumpLogs() {
    try {
        await initDatabase();
        const vehicle = await get("SELECT id FROM vehicles WHERE plate_number = '粤W1B910'");
        if (!vehicle) {
            console.log("Vehicle not found at " + process.env.SQLITE_PATH);
            const vs = await query("SELECT plate_number FROM vehicles");
            console.log("Available vehicles:", vs);
            return;
        }
        console.log("Vehicle ID:", vehicle.id);
        const logs = await query("SELECT id, log_date, mileage, amount, cost, mileage_diff, consumption_per_100km, is_full FROM energy_logs WHERE vehicle_id = ? ORDER BY log_date ASC", [vehicle.id]);

        // Print header
        console.log("ID".padEnd(5), "Date".padEnd(25), "Mileage".padEnd(10), "Amt".padEnd(8), "Cost".padEnd(8), "Diff".padEnd(6), "Cons".padEnd(6), "Full");
        console.log("-".repeat(80));

        logs.forEach(l => {
            console.log(
                l.id.toString().padEnd(5),
                l.log_date.padEnd(25),
                l.mileage.toString().padEnd(10),
                l.amount.toString().padEnd(8),
                l.cost.toString().padEnd(8),
                (l.mileage_diff || "--").toString().padEnd(6),
                (l.consumption_per_100km || "--").toString().padEnd(6),
                l.is_full ? "Y" : "N"
            );
        });
    } catch (e) {
        console.error(e);
    }
}

dumpLogs();
