const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.SQLITE_PATH || './data/carnote.db';
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Add role column to users (Keep for safety)
    db.run("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding role column:', err);
        }
    });

    // 2. Add purchase_date to vehicles
    db.run("ALTER TABLE vehicles ADD COLUMN purchase_date DATE", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column purchase_date already exists in vehicles');
            } else {
                console.error('Error adding purchase_date column:', err);
            }
        } else {
            console.log('Added purchase_date column to vehicles');
        }
    });

    // 3. Update vehicles table to remove global UNIQUE on plate_number
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='vehicles'", (err, row) => {
        if (err) {
            console.error('Error checking vehicles schema:', err);
            return;
        }
        if (row && row.sql.includes('plate_number VARCHAR(20) UNIQUE')) {
            console.log('Detected obsolete UNIQUE constraint on plate_number, migrating...');
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                db.run("ALTER TABLE vehicles RENAME TO vehicles_old");
                db.run(`CREATE TABLE vehicles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    plate_number VARCHAR(20) NOT NULL,
                    brand VARCHAR(50),
                    model VARCHAR(100),
                    year INTEGER,
                    power_type VARCHAR(20) NOT NULL,
                    current_mileage INTEGER DEFAULT 0,
                    purchase_date DATE,
                    photo_url VARCHAR(255),
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, plate_number)
                )`);
                db.run(`INSERT INTO vehicles (id, user_id, plate_number, brand, model, year, power_type, current_mileage, purchase_date, photo_url, description, created_at, updated_at)
                        SELECT id, user_id, plate_number, brand, model, year, power_type, current_mileage, purchase_date, photo_url, description, created_at, updated_at FROM vehicles_old`);
                db.run("DROP TABLE vehicles_old");
                db.run("COMMIT", (err) => {
                    if (err) console.error('Migration failed:', err);
                    else console.log('Successfully migrated vehicles table constraints');
                    db.close();
                });
            });
        } else {
            console.log('Vehicles table already has correct constraints.');
            db.close();
        }
    });
});
