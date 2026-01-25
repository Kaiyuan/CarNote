const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/carnote.db');

db.serialize(() => {
    console.log("=== 完整数据库对象探测 ===");
    db.all("SELECT type, name, sql FROM sqlite_master", (err, rows) => {
        if (err) {
            console.error("无法读取 sqlite_master:", err);
            return;
        }
        rows.forEach(row => {
            console.log(`[${row.type}] ${row.name}`);
            if (row.type === 'table') {
                db.get(`SELECT COUNT(*) as count FROM ${row.name}`, (err, countRow) => {
                    console.log(`    - 行数: ${countRow ? countRow.count : 'Error'}`);
                });
            }
        });
    });
});

setTimeout(() => {
    db.close();
}, 2000);
