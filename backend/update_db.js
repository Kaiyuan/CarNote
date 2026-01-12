const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.SQLITE_PATH || './data/carnote.db';
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Add role column to users
    db.run("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column role already exists in users');
            } else {
                console.error('Error adding role column:', err);
            }
        } else {
            console.log('Added role column to users');
        }
    });

    // 2. Create system_settings table
    db.run(`CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT
    )`, (err) => {
        if (err) console.error(err);
        else console.log('Created system_settings table');
    });

    // 3. Insert default allow_registration
    db.run(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('allow_registration', 'true')`, (err) => {
        if (err) console.error(err);
        else console.log('Inserted default allow_registration setting');
    });
});

db.close(() => {
    console.log('Database update complete');
});
