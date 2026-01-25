const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/carnote.db');

db.serialize(() => {
    console.log("=== 字段详细核查 (carnote.db) ===");
    ['vehicles', 'energy_logs', 'maintenance_records'].forEach(table => {
        db.all(`PRAGMA table_info(${table})`, (err, rows) => {
            if (rows) {
                const cols = rows.map(r => r.name);
                console.log(`表 ${table} 字段:`, cols.join(', '));
            }
        });
    });
});

setTimeout(() => {
    db.close();
}, 1000);
