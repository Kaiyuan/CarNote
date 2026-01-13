const path = require('path');
process.env.SQLITE_PATH = path.join(__dirname, 'backend', 'data', 'carnote.db');
const dbConfigPath = path.join(__dirname, 'backend', 'config', 'database');
const { initDatabase, query } = require(dbConfigPath);

async function migrate() {
    try {
        await initDatabase();

        console.log("Updating users table...");
        try { await query("ALTER TABLE users ADD COLUMN is_disabled BOOLEAN DEFAULT 0"); } catch (e) { }
        try { await query("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"); } catch (e) { }
        try { await query("ALTER TABLE users ADD COLUMN reset_password_token VARCHAR(100)"); } catch (e) { }
        try { await query("ALTER TABLE users ADD COLUMN reset_password_expires TIMESTAMP"); } catch (e) { }

        console.log("Creating login_logs table...");
        await query(`CREATE TABLE IF NOT EXISTS login_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50),
            ip_address VARCHAR(50),
            success BOOLEAN,
            attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        console.log("Creating audit_logs table...");
        await query(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action VARCHAR(100),
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        console.log("Adding SMTP settings placeholders...");
        const settings = [
            ['smtp_host', ''],
            ['smtp_port', '465'],
            ['smtp_user', ''],
            ['smtp_pass', ''],
            ['smtp_from', ''],
            ['smtp_secure', 'true']
        ];

        for (const [key, val] of settings) {
            await query("INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)", [key, val]);
        }

        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

migrate();
