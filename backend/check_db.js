/**
 * CarNote 数据库健康检查脚本
 * 验证结构完整性、外键关联以及数据统计
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = './data/carnote.db';
const db = new sqlite3.Database(dbPath);

console.log(`\n=== CarNote 数据库健康检查 [${new Date().toLocaleString()}] ===`);

db.serialize(() => {
    // 1. 验证基础表
    const tables = ['users', 'vehicles', 'energy_logs', 'maintenance_records', 'parts', 'api_keys', 'system_settings'];
    console.log('\n[1/4] 检查基础表是否存在...');
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        const existingTables = rows.map(r => r.name);
        tables.forEach(t => {
            const status = existingTables.includes(t) ? '✓' : '✗';
            console.log(`${status} 表: ${t}`);
        });
    });

    // 2. 检查数据量
    console.log('\n[2/4] 数据统计...');
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => console.log(`- 用户数: ${row.count}`));
    db.get("SELECT COUNT(*) as count FROM vehicles", (err, row) => console.log(`- 车辆数: ${row.count}`));
    db.get("SELECT COUNT(*) as count FROM energy_logs", (err, row) => console.log(`- 能耗记录: ${row.count}`));
    db.get("SELECT COUNT(*) as count FROM maintenance_records", (err, row) => console.log(`- 保养记录: ${row.count}`));

    // 3. 核心一致性检查（外键引用）
    console.log('\n[3/4] 外键一致性校验 (指向 vehicles)...');
    const childTables = ['energy_logs', 'maintenance_records', 'parts', 'api_keys'];
    childTables.forEach(table => {
        db.all(`PRAGMA foreign_key_list(${table})`, (err, rows) => {
            const broken = rows.filter(r => r.table.toLowerCase().endsWith('_old'));
            if (broken.length > 0) {
                console.log(`✗ ${table}: 警告! 仍然指向历史备份表 ${broken[0].table}`);
            } else {
                const vehicleRef = rows.find(r => r.table.toLowerCase() === 'vehicles');
                console.log(`✓ ${table}: 正确引用 -> ${vehicleRef ? 'vehicles' : '未知'}`);
            }
        });
    });

    // 4. 字段对齐检查
    console.log('\n[4/4] 关键字段对齐...');
    db.all("PRAGMA table_info(vehicles)", (err, rows) => {
        const hasDate = rows.some(r => r.name === 'purchase_date');
        console.log(`${hasDate ? '✓' : '✗'} vehicles.purchase_date (购车时间)`);
    });
    db.all("PRAGMA table_info(users)", (err, rows) => {
        const hasRole = rows.some(r => r.name === 'role');
        console.log(`${hasRole ? '✓' : '✗'} users.role (用户角色)`);
    });
    db.all("PRAGMA table_info(maintenance_records)", (err, rows) => {
        const hasLoc = rows.some(r => r.name === 'location_name');
        console.log(`${hasLoc ? '✓' : '✗'} maintenance_records.location_name (维修位置)`);
    });
});

setTimeout(() => {
    console.log('\n=== 指标检测完成 ===\n');
    db.close();
}, 1000);
