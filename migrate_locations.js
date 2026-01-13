const path = require('path');
process.env.SQLITE_PATH = path.join(__dirname, 'backend', 'data', 'carnote.db');
const dbConfigPath = path.join(__dirname, 'backend', 'config', 'database');
const { initDatabase, query } = require(dbConfigPath);

async function migrate() {
    try {
        await initDatabase();

        console.log("Updating maintenance_records table...");
        try { await query("ALTER TABLE maintenance_records ADD COLUMN location_name VARCHAR(255)"); } catch (e) { }
        try { await query("ALTER TABLE maintenance_records ADD COLUMN location_lat DECIMAL(10, 7)"); } catch (e) { }
        try { await query("ALTER TABLE maintenance_records ADD COLUMN location_lng DECIMAL(10, 7)"); } catch (e) { }

        console.log("Updating part_replacements table...");
        try { await query("ALTER TABLE part_replacements ADD COLUMN location_name VARCHAR(255)"); } catch (e) { }
        try { await query("ALTER TABLE part_replacements ADD COLUMN location_lat DECIMAL(10, 7)"); } catch (e) { }
        try { await query("ALTER TABLE part_replacements ADD COLUMN location_lng DECIMAL(10, 7)"); } catch (e) { }

        console.log("Creating shared_locations table for management...");
        // This table will serve as a master list for admin management and fast lookup
        await query(`CREATE TABLE IF NOT EXISTS shared_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50), -- 'energy', 'maintenance', 'repair', etc.
            address VARCHAR(255),
            latitude DECIMAL(10, 7) NOT NULL,
            longitude DECIMAL(10, 7) NOT NULL,
            created_by INTEGER,
            usage_count INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

migrate();
