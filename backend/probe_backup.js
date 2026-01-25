const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/carnote_.db');

db.serialize(() => {
    console.log("=== 备份数据库探测 (carnote_.db) ===");
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) {
            console.error("无法读取 carnote_.db:", err);
            return;
        }
        rows.forEach(row => {
            db.get(`SELECT COUNT(*) as count FROM ${row.name}`, (err, countRow) => {
                console.log(`${row.name}: ${countRow ? countRow.count : 'Error'}`);
            });
        });
    });
});

setTimeout(() => {
    db.close();
}, 2000);
