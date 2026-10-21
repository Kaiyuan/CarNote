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

        // 启动时检测所有数据表完整性并自动修复/创建缺失数据表
        await checkAndEnsureAllTablesExist();

        console.log('数据库迁移检测完成');
    } catch (error) {
        console.error('数据库迁移过程中出现错误:', error);
    }
}

/**
 * 修复旧版 SQLite 重建流程中，子表外键被改写成 users_old 等失效表名的问题。
 * 只更新 sqlite_master 中的外键目标表名，不修改业务数据。
 */
async function repairBrokenSqliteForeignKeys() {
    const tables = await query(
        "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    );
    if (!tables.length) return;

    const tableNames = new Set(tables.map(table => table.name));
    const updates = [];

    for (const table of tables) {
        if (!table.sql) continue;

        const foreignKeys = await query(`PRAGMA foreign_key_list(${quoteSqliteIdentifier(table.name)})`);
        let fixedSql = table.sql;
        let changed = false;

        for (const foreignKey of foreignKeys) {
            const target = String(foreignKey.table || '');
            if (!target.endsWith('_old')) continue;

            const base = target.slice(0, -4);
            if (!tableNames.has(base)) continue;

            const quotedTarget = `"${target}"`;
            const quotedBase = `"${base}"`;
            fixedSql = fixedSql.split(quotedTarget).join(quotedBase);
            fixedSql = fixedSql.split(target).join(base);
            changed = true;
        }

        if (changed && fixedSql !== table.sql) {
            updates.push({ name: table.name, sql: fixedSql });
        }
    }

    if (!updates.length) return;

    console.log(`[数据库修复] 检测到 ${updates.length} 张表的外键指向已删除的 _old 表，正在修复...`);

    await query('PRAGMA writable_schema = ON');
    try {
        for (const update of updates) {
            await query(
                "UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = ?",
                [update.sql, update.name]
            );
        }

        const version = await get('PRAGMA schema_version');
        const nextVersion = Number(version?.schema_version || 0) + 1;
        await query(`PRAGMA schema_version = ${nextVersion}`);
    } finally {
        await query('PRAGMA writable_schema = OFF');
    }

    console.log(`[数据库修复] 外键引用修复完成，共 ${updates.length} 张表`);
}

/**
 * 为旧版 SQLite 用户表增量添加新列，避免触发整表重建。
 */
async function ensureSqliteUserColumns() {
    const columns = await query('PRAGMA table_info(users)');
    if (!columns.length) return;

    const existing = new Set(columns.map(column => column.name));
    const additions = [
        ['verification_attempts', 'INTEGER DEFAULT 0'],
        ['reset_password_attempts', 'INTEGER DEFAULT 0']
    ];

    for (const [name, definition] of additions) {
        if (!existing.has(name)) {
            await query(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
            console.log(`[数据库迁移] users 表已添加列: ${name}`);
        }
    }
}

/**
 * SQLite 标识符引用。表名来自 sqlite_master，仍做转义以防特殊字符。
 */
function quoteSqliteIdentifier(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function migrateSQLite() {
    // 锁定外键检查，防止级联删除
    await query("PRAGMA foreign_keys = OFF");

    try {
        // 修复历史迁移遗留的 _old 外键引用（例如 users_old）
        await repairBrokenSqliteForeignKeys();

        // 新列优先使用 ALTER TABLE 增量添加，避免整表重建影响其他表的外键
        await ensureSqliteUserColumns();

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
                verification_attempts INTEGER DEFAULT 0,
                reset_password_attempts INTEGER DEFAULT 0,
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
                is_reset_step BOOLEAN DEFAULT 0,
                is_lent BOOLEAN DEFAULT 0,
                lent_to VARCHAR(50),
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
            )`},
            {
                name: 'shared_locations', template: `CREATE TABLE shared_locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100),
                address VARCHAR(255),
                latitude DECIMAL(10, 7),
                longitude DECIMAL(10, 7),
                type VARCHAR(20),
                usage_count INTEGER DEFAULT 0,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            )`},
            {
                name: 'part_replacements', template: `CREATE TABLE part_replacements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL,
                part_id INTEGER,
                replacement_date DATE NOT NULL,
                mileage INTEGER NOT NULL,
                old_part_name VARCHAR(100),
                new_part_name VARCHAR(100),
                part_number VARCHAR(50),
                cost DECIMAL(10, 2),
                service_provider VARCHAR(100),
                location_name VARCHAR(255),
                location_lat DECIMAL(10, 7),
                location_lng DECIMAL(10, 7),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
                FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE SET NULL
            )`},
            {
                name: 'insurances', template: `CREATE TABLE insurances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                vehicle_id INTEGER,
                policy_number VARCHAR(100),
                insurance_company VARCHAR(100),
                start_date DATE,
                end_date DATE,
                premium DECIMAL(10, 2),
                type VARCHAR(50),
                policy_image_url VARCHAR(255),
                ocr_content TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
            )`},
            {
                name: 'insurance_claims', template: `CREATE TABLE insurance_claims (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                insurance_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                claim_date DATE NOT NULL,
                description TEXT,
                claim_amount DECIMAL(10, 2),
                status VARCHAR(50) DEFAULT 'processing',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (insurance_id) REFERENCES insurances(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`},
            {
                name: 'attachments', template: `CREATE TABLE attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                original_name VARCHAR(255),
                stored_name VARCHAR(255),
                mime_type VARCHAR(100),
                size INTEGER,
                url VARCHAR(255),
                project_type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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

            // 防止 SQLite 在重命名父表时自动改写其他表的外键目标
            await query('PRAGMA legacy_alter_table = ON');

            try {
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
            } finally {
                await query("PRAGMA legacy_alter_table = OFF");
            }
            // 确保旧账户都标记为已验证
            await query("UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL OR is_verified = FALSE");
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

    const verificationAttemptsExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verification_attempts'");
    if (verificationAttemptsExists.length === 0) {
        await query("ALTER TABLE users ADD COLUMN verification_attempts INTEGER DEFAULT 0");
    }

    const resetAttemptsExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_password_attempts'");
    if (resetAttemptsExists.length === 0) {
        await query("ALTER TABLE users ADD COLUMN reset_password_attempts INTEGER DEFAULT 0");
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

    // energy_logs lent & reset columns
    const energyLentExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'energy_logs' AND column_name = 'is_reset_step'");
    if (energyLentExists.length === 0) {
        await query("ALTER TABLE energy_logs ADD COLUMN is_reset_step BOOLEAN DEFAULT FALSE");
        await query("ALTER TABLE energy_logs ADD COLUMN is_lent BOOLEAN DEFAULT FALSE");
        await query("ALTER TABLE energy_logs ADD COLUMN lent_to VARCHAR(50)");
    }

    // api_keys vehicle_id column
    const apiKeyVehicleExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'vehicle_id'");
    if (apiKeyVehicleExists.length === 0) {
        await query("ALTER TABLE api_keys ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL");
    }

    // shared_locations created_by column
    const sharedLocCreatedByExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'shared_locations' AND column_name = 'created_by'");
    if (sharedLocCreatedByExists.length === 0) {
        await query("ALTER TABLE shared_locations ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
    }

    // part_replacements location columns
    const partReplacementsLocExists = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'part_replacements' AND column_name = 'location_name'");
    if (partReplacementsLocExists.length === 0) {
        await query("ALTER TABLE part_replacements ADD COLUMN location_name VARCHAR(255)");
        await query("ALTER TABLE part_replacements ADD COLUMN location_lat DECIMAL(10, 7)");
        await query("ALTER TABLE part_replacements ADD COLUMN location_lng DECIMAL(10, 7)");
    }

    const allowReg = await query("SELECT value FROM system_settings WHERE key = 'allow_registration'");
    if (allowReg.length === 0) {
        await query("INSERT INTO system_settings (key, value) VALUES ('allow_registration', 'true')");
    }

    // 将 SMTP 环境变量同步回数据库
    await syncSmtpEnvToDb();
}

/**
 * 完整数据表结构定义列表 (共 22 张核心与扩展数据表)
 */
const allExpectedTables = [
    {
        name: 'users',
        sql: `CREATE TABLE IF NOT EXISTS users (
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
            verification_attempts INTEGER DEFAULT 0,
            reset_password_attempts INTEGER DEFAULT 0,
            is_verified BOOLEAN DEFAULT 0,
            email_last_sent_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    },
    {
        name: 'system_settings',
        sql: `CREATE TABLE IF NOT EXISTS system_settings (
            key VARCHAR(50) PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    },
    {
        name: 'user_settings',
        sql: `CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            consumption_unit VARCHAR(20) DEFAULT 'L/100km',
            currency VARCHAR(10) DEFAULT 'CNY',
            maintenance_reminder_threshold INTEGER DEFAULT 5000,
            language VARCHAR(10) DEFAULT 'zh-CN',
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'vehicles',
        sql: `CREATE TABLE IF NOT EXISTS vehicles (
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
        )`
    },
    {
        name: 'api_keys',
        sql: `CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key_value VARCHAR(64) UNIQUE NOT NULL,
            key_name VARCHAR(50),
            vehicle_id INTEGER,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
        )`
    },
    {
        name: 'energy_logs',
        sql: `CREATE TABLE IF NOT EXISTS energy_logs (
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
            is_reset_step BOOLEAN DEFAULT 0,
            is_lent BOOLEAN DEFAULT 0,
            lent_to VARCHAR(50),
            location_name VARCHAR(255),
            location_lat DECIMAL(10, 7),
            location_lng DECIMAL(10, 7),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'maintenance_records',
        sql: `CREATE TABLE IF NOT EXISTS maintenance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER NOT NULL,
            maintenance_date TIMESTAMP NOT NULL,
            mileage INTEGER NOT NULL,
            type VARCHAR(50) NOT NULL,
            service_provider VARCHAR(100),
            location_name VARCHAR(255),
            location_lat DECIMAL(10, 7),
            location_lng DECIMAL(10, 7),
            cost DECIMAL(10, 2),
            description TEXT,
            invoice_url VARCHAR(255),
            next_maintenance_mileage INTEGER,
            next_maintenance_date DATE,
            status VARCHAR(20) DEFAULT 'completed',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'parts',
        sql: `CREATE TABLE IF NOT EXISTS parts (
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
        )`
    },
    {
        name: 'part_replacements',
        sql: `CREATE TABLE IF NOT EXISTS part_replacements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER NOT NULL,
            part_id INTEGER,
            replacement_date DATE NOT NULL,
            mileage INTEGER NOT NULL,
            old_part_name VARCHAR(100),
            new_part_name VARCHAR(100),
            part_number VARCHAR(50),
            cost DECIMAL(10, 2),
            service_provider VARCHAR(100),
            location_name VARCHAR(255),
            location_lat DECIMAL(10, 7),
            location_lng DECIMAL(10, 7),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
            FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE SET NULL
        )`
    },
    {
        name: 'login_logs',
        sql: `CREATE TABLE IF NOT EXISTS login_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50),
            ip_address VARCHAR(50),
            success BOOLEAN DEFAULT 0,
            attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    },
    {
        name: 'audit_logs',
        sql: `CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action VARCHAR(50) NOT NULL,
            ip_address VARCHAR(45),
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )`
    },
    {
        name: 'shared_locations',
        sql: `CREATE TABLE IF NOT EXISTS shared_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100),
            address VARCHAR(255),
            latitude DECIMAL(10, 7),
            longitude DECIMAL(10, 7),
            type VARCHAR(20),
            usage_count INTEGER DEFAULT 0,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )`
    },
    {
        name: 'announcements',
        sql: `CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            type VARCHAR(20) DEFAULT 'info',
            created_by INTEGER NOT NULL,
            is_pinned BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'tickets',
        sql: `CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'open',
            priority VARCHAR(20) DEFAULT 'normal',
            category VARCHAR(50),
            admin_response TEXT,
            responded_by INTEGER,
            responded_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
        )`
    },
    {
        name: 'insurances',
        sql: `CREATE TABLE IF NOT EXISTS insurances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            vehicle_id INTEGER,
            policy_number VARCHAR(100),
            insurance_company VARCHAR(100),
            start_date DATE,
            end_date DATE,
            premium DECIMAL(10, 2),
            type VARCHAR(50),
            policy_image_url VARCHAR(255),
            ocr_content TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'insurance_claims',
        sql: `CREATE TABLE IF NOT EXISTS insurance_claims (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            insurance_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            claim_date DATE NOT NULL,
            description TEXT,
            claim_amount DECIMAL(10, 2),
            status VARCHAR(50) DEFAULT 'processing',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (insurance_id) REFERENCES insurances(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'attachments',
        sql: `CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            original_name VARCHAR(255),
            stored_name VARCHAR(255),
            mime_type VARCHAR(100),
            size INTEGER,
            url VARCHAR(255),
            project_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )`
    },
    {
        name: 'memberships',
        sql: `CREATE TABLE IF NOT EXISTS memberships (
            user_id INTEGER PRIMARY KEY,
            tier VARCHAR(20) DEFAULT 'ordinary',
            expiry_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'membership_orders',
        sql: `CREATE TABLE IF NOT EXISTS membership_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            order_id VARCHAR(100) NOT NULL,
            tier VARCHAR(20) NOT NULL,
            months INTEGER DEFAULT 12,
            status VARCHAR(20) DEFAULT 'pending',
            admin_note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'redemption_codes',
        sql: `CREATE TABLE IF NOT EXISTS redemption_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code VARCHAR(32) UNIQUE NOT NULL,
            tier VARCHAR(20) NOT NULL,
            months INTEGER NOT NULL,
            max_uses INTEGER DEFAULT 1,
            current_uses INTEGER DEFAULT 0,
            valid_until TIMESTAMP,
            notes TEXT,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`
    },
    {
        name: 'redemption_logs',
        sql: `CREATE TABLE IF NOT EXISTS redemption_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (code_id) REFERENCES redemption_codes(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(code_id, user_id)
        )`
    },
    {
        name: 'membership_history',
        sql: `CREATE TABLE IF NOT EXISTS membership_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action_type VARCHAR(20) NOT NULL,
            tier VARCHAR(20) NOT NULL,
            months INTEGER,
            source_id VARCHAR(100),
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'user_sessions',
        sql: `CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash VARCHAR(64) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
    }
];

function formatSqlForDb(sql, dbType) {
    if (dbType === 'postgresql') {
        return sql
            .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
            .replace(/BOOLEAN DEFAULT 0/gi, 'BOOLEAN DEFAULT FALSE')
            .replace(/BOOLEAN DEFAULT 1/gi, 'BOOLEAN DEFAULT TRUE');
    }
    return sql;
}

/**
 * 启动时检测所有数据表是否完整，缺失时自动补齐创建并详细记录日志
 */
async function checkAndEnsureAllTablesExist() {
    const DB_TYPE = process.env.DB_TYPE || 'sqlite';
    console.log('[数据表检测] 正在检查数据库表结构完整性...');

    let healthyCount = 0;
    let createdCount = 0;
    let failedCount = 0;

    for (const table of allExpectedTables) {
        try {
            let exists = false;
            if (DB_TYPE === 'sqlite') {
                const res = await get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [table.name]);
                exists = !!res;
            } else {
                const res = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?", [table.name]);
                exists = res && res.length > 0;
            }

            if (exists) {
                healthyCount++;
                console.log(`[数据表检测] 数据表 [${table.name}] 状态正常 ✓`);
            } else {
                console.warn(`[数据表检测] ⚠️ 检测到缺失数据表: [${table.name}]，正在自动创建...`);
                const formattedSql = formatSqlForDb(table.sql, DB_TYPE);
                await query(formattedSql);
                createdCount++;
                console.log(`[数据表检测] ✅ 数据表 [${table.name}] 已成功自动创建`);
            }
        } catch (err) {
            failedCount++;
            console.error(`[数据表检测] ❌ 检查或创建数据表 [${table.name}] 失败:`, err.message);
        }
    }

    // 检查并确保必要的索引存在
    try {
        const indexes = [
            "CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_energy_logs_vehicle_id ON energy_logs(vehicle_id)",
            "CREATE INDEX IF NOT EXISTS idx_energy_logs_date ON energy_logs(log_date)",
            "CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id ON maintenance_records(vehicle_id)",
            "CREATE INDEX IF NOT EXISTS idx_parts_vehicle_id ON parts(vehicle_id)",
            "CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON api_keys(key_value)",
            "CREATE INDEX IF NOT EXISTS idx_insurances_user_id ON insurances(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_insurances_vehicle_id ON insurances(vehicle_id)",
            "CREATE INDEX IF NOT EXISTS idx_insurance_claims_insurance_id ON insurance_claims(insurance_id)",
            "CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_membership_orders_user_id ON membership_orders(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_redemption_codes_code ON redemption_codes(code)",
            "CREATE INDEX IF NOT EXISTS idx_redemption_logs_user_id ON redemption_logs(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_membership_history_user_id ON membership_history(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash)"
        ];
        for (const idxSql of indexes) {
            await query(idxSql).catch(() => {});
        }
    } catch (e) {
        // 忽略索引创建可能产生的非致命提示
    }

    console.log(`[数据表检测] 数据库表结构完整性检测完毕：共检测 ${allExpectedTables.length} 张表，正常 ${healthyCount} 张，自动补齐创建 ${createdCount} 张${failedCount > 0 ? `，失败 ${failedCount} 张` : ''}。`);
}

const ensureOptionalTablesExist = checkAndEnsureAllTablesExist;

module.exports = { autoMigrate, checkAndEnsureAllTablesExist, ensureOptionalTablesExist };
