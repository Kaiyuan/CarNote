const { query, get, transaction } = require('./database');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 创建数据库备份
 */
async function createBackup() {
    const DB_TYPE = process.env.DB_TYPE || 'sqlite';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // 默认备份目录
    let backupDir;

    if (process.env.BACKUP_PATH) {
        backupDir = path.resolve(process.cwd(), process.env.BACKUP_PATH);
    } else if (DB_TYPE === 'sqlite') {
        // 如果是 SQLite 且未指定备份路径，则使用数据库文件所在目录
        const dbPath = process.env.SQLITE_PATH || './data/carnote.db';
        backupDir = path.dirname(path.resolve(process.cwd(), dbPath));
    } else {
        // 默认 fallback
        backupDir = path.resolve(process.cwd(), './data/backups');
    }

    try {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        if (DB_TYPE === 'sqlite') {
            const dbPath = process.env.SQLITE_PATH || './data/carnote.db';
            const sourcePath = path.resolve(process.cwd(), dbPath);
            const backupPath = path.join(backupDir, `carnote_backup_${timestamp}.db`);

            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, backupPath);
                console.log(`[备份] SQLite 数据库已备份至: ${backupPath}`);
            }
        } else if (DB_TYPE === 'postgresql') {
            const host = process.env.PG_HOST || 'localhost';
            const port = process.env.PG_PORT || 5432;
            const database = process.env.PG_DATABASE || 'carnote';
            const user = process.env.PG_USER || 'postgres';
            const password = process.env.PG_PASSWORD;

            const backupPath = path.join(backupDir, `carnote_backup_${timestamp}.sql`);

            // 构建 pg_dump 命令
            // 注意：这要求运行环境安装了 postgresql-client
            const env = { ...process.env, PGPASSWORD: password };
            try {
                execSync(`pg_dump -h ${host} -p ${port} -U ${user} -f "${backupPath}" ${database}`, { env });
                console.log(`[备份] PostgreSQL 数据库已备份至: ${backupPath}`);
            } catch (err) {
                console.warn(`[备份] PostgreSQL 自动备份失败 (可能未安装 pg_dump): ${err.message}`);
                // 仅警告，不中断启动
            }
        }
    } catch (error) {
        console.error(`[备份] 数据库备份过程中出错:`, error);
    }
}

async function autoMigrate() {
    console.log('开始检测数据库迁移...');

    // 迁移前强制执行备份
    await createBackup();

    const DB_TYPE = process.env.DB_TYPE || 'sqlite';

    try {
        if (DB_TYPE === 'sqlite') {
            await migrateSQLite();
        } else if (DB_TYPE === 'postgresql') {
            await migratePostgreSQL();
        }
        console.log('数据库迁移检测完成');
    } catch (error) {
        console.error('数据库迁移过程中出现错误:', error);
    }
}

async function migrateSQLite() {
    // 锁定外键检查，防止级联删除
    await query("PRAGMA foreign_keys = OFF");

    try {
        // 1. 定义期望的架构模板
        const tablesTemplates = [
            {
                name: 'users', template: `CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(100),
                nickname VARCHAR(50),
                avatar_url VARCHAR(255),
                role VARCHAR(20) DEFAULT 'user',
                is_disabled BOOLEAN DEFAULT 0,
                failed_login_attempts INTEGER DEFAULT 0,
                reset_password_token VARCHAR(100),
                reset_password_expires TIMESTAMP,
                verification_code VARCHAR(20),
                verification_code_expires TIMESTAMP,
                is_verified BOOLEAN DEFAULT 0,
                email_last_sent_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`},
            {
                name: 'vehicles', template: `CREATE TABLE vehicles (
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
            )`},
            {
                name: 'energy_logs', template: `CREATE TABLE energy_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL,
                log_date TIMESTAMP NOT NULL,
                mileage INTEGER NOT NULL,
                energy_type VARCHAR(20) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                cost DECIMAL(10, 2),
                unit_price DECIMAL(10, 2),
                mileage_diff INTEGER,
                consumption_per_100km DECIMAL(10, 2),
                fuel_gauge_reading DECIMAL(5, 2),
                is_full BOOLEAN DEFAULT 0,
                location_name VARCHAR(255),
                location_lat DECIMAL(10, 7),
                location_lng DECIMAL(10, 7),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
            )`},
            {
                name: 'maintenance_records', template: `CREATE TABLE maintenance_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL,
                maintenance_date TIMESTAMP NOT NULL,
                mileage INTEGER NOT NULL,
                type VARCHAR(50) NOT NULL,
                service_provider VARCHAR(100),
                cost DECIMAL(10, 2),
                description TEXT,
                invoice_url VARCHAR(255),
                next_maintenance_mileage INTEGER,
                next_maintenance_date DATE,
                status VARCHAR(20) DEFAULT 'completed',
                location_name VARCHAR(255),
                location_lat DECIMAL(10, 7),
                location_lng DECIMAL(10, 7),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
            )`},
            {
                name: 'parts', template: `CREATE TABLE parts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL,
                part_number VARCHAR(50),
                installed_date DATE,
                installed_mileage INTEGER,
                recommended_replacement_mileage INTEGER,
                recommended_replacement_months INTEGER,
                status VARCHAR(20) DEFAULT 'normal',
                photo_url VARCHAR(255),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
            )`}
            // 更多表可以继续在这里添加
        ];

        let needsRepair = false;

        // 2. 深度健康分析
        for (const table of tablesTemplates) {
            const tableInfo = await get(`SELECT name, sql FROM sqlite_master WHERE type='table' AND name='${table.name}'`);

            if (!tableInfo) {
                console.log(`[健康检查] 缺失数据表: ${table.name}`);
                needsRepair = true;
                break;
            }

            // 检查外键是否断链（SQLite 特性：重命名 parent 表时，child 表会自动修改 FK 指向，这在迁移中是致命的）
            const fkList = await query(`PRAGMA foreign_key_list(${table.name})`);
            if (fkList.some(fk => fk.table.toLowerCase().endsWith('_old'))) {
                console.log(`[健康检查] 表 ${table.name} 存在断裂的外键引用`);
                needsRepair = true;
                break;
            }

            // 检查列是否对齐（检测是否需要添加新字段）
            const dbCols = await query(`PRAGMA table_info(${table.name})`);
            const expectedColsMatch = table.template.match(/(\w+)\s+(INTEGER|VARCHAR|TIMESTAMP|DATE|DECIMAL|TEXT|BOOLEAN)/gi);
            if (expectedColsMatch) {
                const expectedColNames = expectedColsMatch.map(m => m.split(/\s+/)[0].toLowerCase());
                const missingCols = expectedColNames.filter(name => !dbCols.some(c => c.name.toLowerCase() === name));
                if (missingCols.length > 0) {
                    console.log(`[健康检查] 表 ${table.name} 缺失列: ${missingCols.join(', ')}`);
                    needsRepair = true;
                    break;
                }
            }
        }

        // 3. 安全修复流程
        if (needsRepair) {
            console.log('检测到数据库异常或版本变更，正在执行安全修复流程...');

            await transaction(async (db) => {
                // a. 获取所有待迁移表的当前行数，用于迁移后核对
                const counts = {};
                for (const table of tablesTemplates) {
                    const res = await get(`SELECT COUNT(*) as cnt FROM ${table.name}`).catch(() => ({ cnt: 0 }));
                    counts[table.name] = res.cnt;
                }

                // b. 重命名旧表
                for (const table of tablesTemplates) {
                    const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table.name}'`);
                    if (exists) {
                        // 如果 _old 已存在，先删除它（这通常是之前失败修复留下的残余）
                        await query(`DROP TABLE IF EXISTS ${table.name}_old`);
                        await query(`ALTER TABLE ${table.name} RENAME TO ${table.name}_old`);
                    }
                }

                // c. 创建新表
                for (const table of tablesTemplates) {
                    await query(table.template);
                }

                // d. 迁移数据并核对
                for (const table of tablesTemplates) {
                    const oldExists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table.name}_old'`);
                    if (oldExists) {
                        const oldCols = await query(`PRAGMA table_info(${table.name}_old)`);
                        const newCols = await query(`PRAGMA table_info(${table.name})`);
                        const commonCols = oldCols
                            .map(c => c.name)
                            .filter(name => newCols.some(nc => nc.name === name))
                            .join(', ');

                        if (commonCols) {
                            await query(`INSERT INTO ${table.name} (${commonCols}) SELECT ${commonCols} FROM ${table.name}_old`);
                        }

                        // 核对数据行数
                        const newCountRes = await get(`SELECT COUNT(*) as cnt FROM ${table.name}`);
                        if (newCountRes.cnt < counts[table.name]) {
                            throw new Error(`数据迁移校验失败: 表 ${table.name} 行数减少 (${counts[table.name]} -> ${newCountRes.cnt})。修复已回滚。`);
                        }
                    }
                }

                // e. 安全删除旧表 (统一在所有数据迁移完成后删除，防止外键引用错误)
                for (const table of tablesTemplates) {
                    await query(`DROP TABLE IF EXISTS ${table.name}_old`);
                }

                // f. 重建索引
                await query("CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id)");
                await query("CREATE INDEX IF NOT EXISTS idx_energy_logs_vehicle_id ON energy_logs(vehicle_id)");
            });
            // 确保旧账户都标记为已验证
            await query("UPDATE users SET is_verified = 1 WHERE is_verified IS NULL OR is_verified = 0");
            console.log('数据库结构修复完成，数据完整性已验证');
        }

        // 4. 初始化默认配置
        const allowReg = await get("SELECT value FROM system_settings WHERE key = 'allow_registration'");
        if (!allowReg) {
            await query("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('allow_registration', 'true')");
        }

        // 5. 将 SMTP 环境变量同步回数据库 (确保 UI 显示一致)
        await syncSmtpEnvToDb();

    } finally {
        await query("PRAGMA foreign_keys = ON");
    }
}

/**
 * 将 SMTP 环境变量同步至数据库
 */
async function syncSmtpEnvToDb() {
    const smtpMap = {
        'SMTP_HOST': 'smtp_host',
        'SMTP_PORT': 'smtp_port',
        'SMTP_USER': 'smtp_user',
        'SMTP_PASS': 'smtp_pass',
        'SMTP_SECURE': 'smtp_secure',
        'SMTP_FROM': 'smtp_from'
    };

    for (const [env, key] of Object.entries(smtpMap)) {
        if (process.env[env]) {
            await query(
                "INSERT INTO system_settings (key, value) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
                [key, process.env[env]]
            ).catch(async () => {
                // SQLite 兼容性处理 (如果 ON CONFLICT 不支持)
                await query("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)", [key, process.env[env]]);
            });
        }
    }
}

async function migratePostgreSQL() {
    // PostgreSQL 维持原有的基础迁移逻辑 (PG 架构变更建议配合 Flyway/Liquibase, 此处仅做基础补偿)
    const roleExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'");
    if (roleExists.length === 0) {
        await query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'");
    }

    const dateExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'purchase_date'");
    if (dateExists.length === 0) {
        await query("ALTER TABLE vehicles ADD COLUMN purchase_date DATE");
    }

    const verifyExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_verified'");
    if (verifyExists.length === 0) {
        await query("ALTER TABLE users ADD COLUMN verification_code VARCHAR(20)");
        await query("ALTER TABLE users ADD COLUMN verification_code_expires TIMESTAMP");
        await query("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE");
        // Update existing users to verified
        await query("UPDATE users SET is_verified = TRUE");
    }

    const failedAttemptsExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'failed_login_attempts'");
    if (failedAttemptsExists.length === 0) {
        await query("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0");
    }

    const emailSentExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_last_sent_at'");
    if (emailSentExists.length === 0) {
        await query("ALTER TABLE users ADD COLUMN email_last_sent_at TIMESTAMP");
    }

    const disabledExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_disabled'");
    if (disabledExists.length === 0) {
        await query("ALTER TABLE users ADD COLUMN is_disabled BOOLEAN DEFAULT FALSE");
    }

    // maintenance_records location and next maintenance columns
    const maintenanceLocExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'location_name'");
    if (maintenanceLocExists.length === 0) {
        await query("ALTER TABLE maintenance_records ADD COLUMN location_name VARCHAR(255)");
        await query("ALTER TABLE maintenance_records ADD COLUMN location_lat DECIMAL(10, 7)");
        await query("ALTER TABLE maintenance_records ADD COLUMN location_lng DECIMAL(10, 7)");
    }

    const maintenanceNextExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'next_maintenance_mileage'");
    if (maintenanceNextExists.length === 0) {
        await query("ALTER TABLE maintenance_records ADD COLUMN next_maintenance_mileage INTEGER");
        await query("ALTER TABLE maintenance_records ADD COLUMN next_maintenance_date DATE");
        await query("ALTER TABLE maintenance_records ADD COLUMN status VARCHAR(20) DEFAULT 'completed'");
    }

    // energy_logs location columns
    const energyLocExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'energy_logs' AND column_name = 'location_name'");
    if (energyLocExists.length === 0) {
        await query("ALTER TABLE energy_logs ADD COLUMN location_name VARCHAR(255)");
        await query("ALTER TABLE energy_logs ADD COLUMN location_lat DECIMAL(10, 7)");
        await query("ALTER TABLE energy_logs ADD COLUMN location_lng DECIMAL(10, 7)");
    }

    // api_keys vehicle_id column
    const apiKeyVehicleExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'vehicle_id'");
    if (apiKeyVehicleExists.length === 0) {
        await query("ALTER TABLE api_keys ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL");
    }

    const allowReg = await query("SELECT value FROM system_settings WHERE key = 'allow_registration'");
    if (allowReg.length === 0) {
        await query("INSERT INTO system_settings (key, value) VALUES ('allow_registration', 'true')");
    }

    // 将 SMTP 环境变量同步回数据库
    await syncSmtpEnvToDb();
}

module.exports = { autoMigrate };
