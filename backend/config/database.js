/**
 * 数据库连接管理模块
 * 支持 SQLite 和 PostgreSQL 两种数据库
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_TYPE = process.env.DB_TYPE || 'sqlite';
let db = null;

/**
 * 初始化 SQLite 数据库连接
 */
function initSQLite() {
    let dbPath = process.env.SQLITE_PATH || './data/carnote.db';
    // 转换为绝对路径以避免 CWD 差异
    dbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
    const dbDir = path.dirname(dbPath);

    console.log(`准备连接 SQLite 数据库: ${dbPath}`);

    // 检查并创建目录
    try {
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log(`已创建数据目录: ${dbDir}`);
        }

        // 测试目录是否真的可写
        const testFile = path.join(dbDir, '.write_test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
    } catch (err) {
        console.error(`数据目录权限检查失败: ${dbDir}`, err.message);
    }

    // 创建或打开数据库
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.error(`SQLite 无法打开数据库文件 (${dbPath}):`, err);
            // 这里可以添加更详细的指引
            if (err.code === 'SQLITE_CANTOPEN') {
                console.error('提示: 请确保目录存在且运行用户(UID 1000)拥有该目录及其父目录的读写权限。');
            }
        } else {
            console.log(`已成功连接到 SQLite 数据库`);
        }
    });

    // 启用外键约束
    db.run('PRAGMA foreign_keys = ON');

    return db;
}

/**
 * 初始化 PostgreSQL 数据库连接池
 */
function initPostgreSQL() {
    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: process.env.PG_PORT || 5432,
        database: process.env.PG_DATABASE || 'carnote',
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD
    });

    pool.on('connect', () => {
        console.log('已连接到 PostgreSQL 数据库');
    });

    pool.on('error', (err) => {
        console.error('PostgreSQL 连接错误:', err);
    });

    return pool;
}

/**
 * 初始化数据库表结构
 */
async function initSchema() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    if (DB_TYPE === 'sqlite') {
        return new Promise((resolve, reject) => {
            db.exec(schema, (err) => {
                if (err) {
                    console.error('创建 SQLite 表结构失败:', err);
                    reject(err);
                } else {
                    console.log('SQLite 表结构创建成功');
                    resolve();
                }
            });
        });
    } else {
        // PostgreSQL 需要调整 schema (AUTOINCREMENT -> SERIAL)
        const pgSchema = schema
            .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
            .replace(/BOOLEAN/g, 'BOOLEAN')
            .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMP DEFAULT NOW()')
            .replace(/BOOLEAN\s+DEFAULT\s+1/gi, "BOOLEAN DEFAULT TRUE") // Fix boolean default 1
            .replace(/BOOLEAN\s+DEFAULT\s+0/gi, "BOOLEAN DEFAULT FALSE") // Fix boolean default 0
            .replace(/IF NOT EXISTS/g, 'IF NOT EXISTS');

        try {
            await db.query(pgSchema);
            // console.log('PostgreSQL 表结构创建成功');
        } catch (err) {
            console.error('创建 PostgreSQL 表结构失败:', err);
            throw err;
        }
    }
}

/**
 * 执行查询 - 统一接口
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数
 * @returns {Promise} 查询结果
 */
function query(sql, params = []) {
    if (DB_TYPE === 'sqlite') {
        return new Promise((resolve, reject) => {
            // 判断是 SELECT/PRAGMA 还是其他操作
            const upperSql = sql.trim().toUpperCase();
            if (upperSql.startsWith('SELECT') || upperSql.startsWith('PRAGMA')) {
                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            } else {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve({
                        lastID: this.lastID,
                        changes: this.changes
                    });
                });
            }
        });
    } else {
        // PostgreSQL 使用 $1, $2 占位符而不是 ?
        let pgSql = sql.replace(/\?/g, (match, offset) => {
            const index = sql.substring(0, offset).split('?').length;
            return `$${index}`;
        });

        const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
        if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
            if (!pgSql.includes('system_settings')) {
                pgSql += ' RETURNING id';
            }
        }

        return db.query(pgSql, params).then(result => {
            // 如果是查询语句，直接返回 rows
            if (pgSql.trim().toUpperCase().startsWith('SELECT')) {
                return result.rows;
            }

            // 兼容 SQLite 的非查询返回值
            const resObj = {
                changes: result.rowCount,
                lastID: null
            };

            if (isInsert && result.rows && result.rows.length > 0) {
                resObj.lastID = result.rows[0].id;
            }

            return resObj;
        });
    }
}

/**
 * 获取单行数据
 */
function get(sql, params = []) {
    if (DB_TYPE === 'sqlite') {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    } else {
        return query(sql, params).then(rows => rows[0] || null);
    }
}

/**
 * 初始化数据库连接
 */
async function initDatabase() {
    try {
        if (DB_TYPE === 'sqlite') {
            db = initSQLite();
        } else if (DB_TYPE === 'postgresql') {
            db = initPostgreSQL();
        } else {
            throw new Error(`不支持的数据库类型: ${DB_TYPE}`);
        }

        // 初始化表结构
        await initSchema();

        // 执行自动迁移
        const { autoMigrate } = require('./migrate');
        await autoMigrate();

        return db;
    } catch (error) {
        console.error('数据库初始化失败:', error);
        throw error;
    }
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
    if (db) {
        if (DB_TYPE === 'sqlite') {
            db.close((err) => {
                if (err) console.error('关闭 SQLite 连接失败:', err);
                else console.log('SQLite 连接已关闭');
            });
        } else {
            db.end();
            console.log('PostgreSQL 连接已关闭');
        }
    }
}

/**
 * 数据库事务处理
 * @param {Function} callback - 事务回调函数，接收 db 实例
 */
async function transaction(callback) {
    if (DB_TYPE === 'sqlite') {
        return new Promise((resolve, reject) => {
            db.serialize(async () => {
                db.run('BEGIN TRANSACTION');
                try {
                    await callback(db);
                    db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                } catch (error) {
                    db.run('ROLLBACK', () => {
                        reject(error);
                    });
                }
            });
        });
    } else {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            await callback(client);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = {
    initDatabase,
    closeDatabase,
    query,
    get,
    transaction,
    getDb: () => db
};
