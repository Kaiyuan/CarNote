const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/carnote.db');

db.all("SELECT name FROM sqlite_master WHERE type='table'", async (err, tables) => {
    for (const t of tables) {
        const count = await new Promise(resolve => {
            db.get(`SELECT COUNT(*) as count FROM ${t.name}`, (err, row) => resolve(row ? row.count : "error"));
        });
        console.log(`${t.name}: ${count}`);
    }
    db.close();
});
