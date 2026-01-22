/**
 * 数据库自动迁移模块
 * 负责在系统启动时检测并更新数据库结构
 * 支持 SQLite 和 PostgreSQL
 */

const { query, get, transaction } = require('./database');

async function autoMigrate() {
    console.log('开始检测数据库迁移...');
    const DB_TYPE = process.env.DB_TYPE || 'sqlite';

    try {
        if (DB_TYPE === 'sqlite') {
            await migrateSQLite();
        } else if (DB_TYPE === 'postgresql') {
            await migratePostgreSQL();
        }
        console.log('数据库迁移检测完成');
    } catch (error) {
        console.error('数据库迁移失败:', error);
    }
}

async function migrateSQLite() {
    // 1. 检测 users 表的 role 字段
    const userColumns = await query("PRAGMA table_info(users)");
    if (!userColumns.some(c => c.name === 'role')) {
        console.log('正在为 SQLite users 表添加 role 字段...');
        await query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'");
    }

    // 2. 检测 vehicles 表的 purchase_date 字段
    const vehicleColumns = await query("PRAGMA table_info(vehicles)");
    if (!vehicleColumns.some(c => c.name === 'purchase_date')) {
        console.log('正在为 SQLite vehicles 表添加 purchase_date 字段...');
        await query("ALTER TABLE vehicles ADD COLUMN purchase_date DATE");
    }

    // 3. 检测并修复 vehicles 表的唯一约束
    const vehiclesSchema = await get("SELECT sql FROM sqlite_master WHERE type='table' AND name='vehicles'");
    if (vehiclesSchema && vehiclesSchema.sql.includes('plate_number VARCHAR(20) UNIQUE')) {
        console.log('检测到旧版车牌唯一约束，正在执行 SQLite 数据迁移...');
        await transaction(async (db) => {
            await query("ALTER TABLE vehicles RENAME TO vehicles_old");
            await query(`CREATE TABLE vehicles (
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
            )`);
            const oldCols = await query("PRAGMA table_info(vehicles_old)");
            const colNames = oldCols.map(c => c.name).join(', ');
            await query(`INSERT INTO vehicles (${colNames}) SELECT ${colNames} FROM vehicles_old`);
            await query("DROP TABLE vehicles_old");
            await query("CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id)");
        });
        console.log('SQLite 车牌唯一约束迁移完成');
    }

    // 4. 初始化默认系统设置
    const allowReg = await get("SELECT value FROM system_settings WHERE key = 'allow_registration'");
    if (!allowReg) {
        await query("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('allow_registration', 'true')");
    }
}

async function migratePostgreSQL() {
    // 1. 检测并添加 role 字段
    const roleExists = await query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'"
    );
    if (roleExists.length === 0) {
        console.log('正在为 PostgreSQL users 表添加 role 字段...');
        await query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'");
    }

    // 2. 检测并添加 purchase_date 字段
    const dateExists = await query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'purchase_date'"
    );
    if (dateExists.length === 0) {
        console.log('正在为 PostgreSQL vehicles 表添加 purchase_date 字段...');
        await query("ALTER TABLE vehicles ADD COLUMN purchase_date DATE");
    }

    // 3. 修复唯一约束
    // 检查是否存在 plate_number 的单独唯一约束
    const constraints = await query(`
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'vehicles'::regclass 
        AND contype = 'u' 
        AND array_length(conkey, 1) = 1
        AND (SELECT attname FROM pg_attribute WHERE attrelid = 'vehicles'::regclass AND attnum = conkey[1]) = 'plate_number'
    `);

    if (constraints.length > 0) {
        console.log('检测到 PostgreSQL 旧版车牌唯一约束，正在迁移...');
        await transaction(async (client) => {
            for (const row of constraints) {
                await query(`ALTER TABLE vehicles DROP CONSTRAINT ${row.conname}`);
            }
            // 添加新约束 (如果不存在)
            await query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'vehicles'::regclass AND conname = 'vehicles_user_id_plate_number_key') THEN
                        ALTER TABLE vehicles ADD CONSTRAINT vehicles_user_id_plate_number_key UNIQUE(user_id, plate_number);
                    END IF;
                END $$;
            `);
        });
        console.log('PostgreSQL 约束迁移完成');
    }

    // 4. 初始化默认设置
    const allowReg = await query("SELECT value FROM system_settings WHERE key = 'allow_registration'");
    if (allowReg.length === 0) {
        await query("INSERT INTO system_settings (key, value) VALUES ('allow_registration', 'true')");
    }
}

module.exports = { autoMigrate };
