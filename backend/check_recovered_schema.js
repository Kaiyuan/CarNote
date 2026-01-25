const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/carnote.db');

db.serialize(() => {
    console.log("=== 检查恢复后的数据库字段 (carnote.db) ===");
    const tables = ['vehicles', 'energy_logs', 'maintenance_records', 'parts'];
    tables.forEach(table => {
        db.all(`PRAGMA table_info(${table})`, (err, rows) => {
            console.log(`\n表: ${table}`);
            if (rows) {
                console.log(rows.map(r => r.name).join(', '));
            } else {
                console.log("无法获取字段信息");
            }
        });
        db.all(`PRAGMA foreign_key_list(${table})`, (err, rows) => {
            if (rows && rows.length > 0) {
                console.log(`外键引用:`, rows.map(r => `${r.from} -> ${r.table}(${r.to})`));
            }
        });
    });
});

setTimeout(() => {
    db.close();
}, 2000);
