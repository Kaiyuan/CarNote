# CarNote 扩展模块（Mod）开发指南

CarNote 支持通过外部模块（Mod）目录对系统进行功能扩展。你可以在不修改主项目核心代码的情况下，为 CarNote 添加自定义 API 路由、中间件、数据库表、定时任务等能力。

---

## 1. 目录结构

Docker 容器内默认模块挂载目录为 `/app/mod`（可通过环境变量 `MOD_PATH` 自定义）。

CarNote 支持两种放置方式：

### 方式一：多模块目录（推荐）

将每个模块放在 `<MOD_PATH>/<模块名>/` 下，系统启动时会自动扫描并加载所有模块：

```text
/app/mod/
├── my-plugin/
│   ├── backend/
│   │   ├── index.js        # 【必需】后端模块入口
│   │   ├── routes/         # 可选：路由文件
│   │   ├── middleware/     # 可选：中间件
│   │   └── database/       # 可选：SQL 建表脚本
│   └── README.md           # 可选：模块说明
└── another-plugin/
    └── backend/
        └── index.js
```

### 方式二：单模块直接挂载

如果仅挂载单个模块，也可以直接将模块内容放到 `/app/mod/` 下：

```text
/app/mod/
└── backend/
    └── index.js            # 【必需】后端模块入口
```

---

## 2. 后端模块入口规范

每个模块必须在 `backend/index.js` 中导出 `init` 函数（支持 `async`）：

```js
/**
 * @param {import('express').Application} app     Express 应用实例
 * @param {import('express')} express             Express 模块（用于创建 Router）
 * @param {object} context                        主项目注入的上下文对象
 */
async function init(app, express, context) {
    // 模块初始化逻辑
}

module.exports = {
    name: 'my-plugin',      // 可选：模块名称
    version: '1.0.0',       // 可选：版本号
    init                    // 必需：初始化函数
};
```

### `context` 上下文对象说明

主项目会在调用 `init` 时传入 `context`，避免模块内部使用脆弱的相对路径引用主项目文件：

| 属性 | 说明 | 常见导出 |
|---|---|---|
| `context.db` | 统一数据库操作模块（自动兼容 SQLite 与 PostgreSQL） | `query(sql, params)`, `get(sql, params)`, `transaction(cb)`, `getDb()` |
| `context.auth` | 认证与权限中间件 | `authenticateUser`, `authenticateApiKey`, `optionalApiKey`, `isAdmin`, `checkVehicleOwnership` |
| `context.uploadDir` | 上传文件根目录绝对路径 | — |
| `context.modPath` | 当前生效的模块根目录路径（如 `/app/mod`） | — |
| `context.appRoot` | 主项目根目录路径（如 `/app`） | — |

> **依赖解析说明**：主项目启动时已自动将 `/app/backend/node_modules` 注入模块解析路径，因此模块代码可以直接 `require('express')` 等主项目已安装的依赖包；若模块有额外的独立第三方依赖，可在模块目录内自行 `npm install`。

---

## 3. 完整示例：车辆加油提醒扩展模块

下面是一个可直接运行的最小示例，实现「自动建表 + 鉴权路由 + 读取主项目车辆数据」。

### 目录准备

```text
/app/mod/fuel-alert/
└── backend/
    └── index.js
```

### `backend/index.js`

```js
async function init(app, express, context) {
    const { db, auth } = context;
    const { query, get, getDb } = db;
    const { authenticateUser, isAdmin } = auth;
    const DB_TYPE = process.env.DB_TYPE || 'sqlite';

    // 1. 初始化模块专属数据库表（同时兼容 SQLite 与 PostgreSQL）
    const createTableSql = DB_TYPE === 'postgresql'
        ? `CREATE TABLE IF NOT EXISTS mod_fuel_alerts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                threshold REAL NOT NULL DEFAULT 10.0,
                created_at TIMESTAMP DEFAULT NOW()
           )`
        : `CREATE TABLE IF NOT EXISTS mod_fuel_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                threshold REAL NOT NULL DEFAULT 10.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
           )`;

    if (DB_TYPE === 'postgresql') {
        await getDb().query(createTableSql);
    } else {
        await new Promise((resolve, reject) => {
            getDb().exec(createTableSql, (err) => (err ? reject(err) : resolve()));
        });
    }

    // 2. 注册模块 API 路由
    const router = express.Router();

    // 获取当前用户的油耗预警阈值（需登录）
    router.get('/threshold', authenticateUser, async (req, res, next) => {
        try {
            const row = await get(
                'SELECT threshold FROM mod_fuel_alerts WHERE user_id = ?',
                [req.userId]
            );
            res.json({
                success: true,
                data: { threshold: row ? row.threshold : 10.0 }
            });
        } catch (err) {
            next(err);
        }
    });

    // 设置预警阈值（需登录）
    router.post('/threshold', authenticateUser, async (req, res, next) => {
        try {
            const threshold = Number(req.body.threshold);
            if (!Number.isFinite(threshold) || threshold <= 0) {
                return res.status(400).json({ success: false, message: '阈值必须大于 0' });
            }

            const existing = await get(
                'SELECT id FROM mod_fuel_alerts WHERE user_id = ?',
                [req.userId]
            );
            if (existing) {
                await query(
                    'UPDATE mod_fuel_alerts SET threshold = ? WHERE user_id = ?',
                    [threshold, req.userId]
                );
            } else {
                await query(
                    'INSERT INTO mod_fuel_alerts (user_id, threshold) VALUES (?, ?)',
                    [req.userId, threshold]
                );
            }

            res.json({ success: true, message: '保存成功' });
        } catch (err) {
            next(err);
        }
    });

    // 管理员统计接口示例
    router.get('/admin/stats', authenticateUser, isAdmin, async (req, res, next) => {
        try {
            const rows = await query('SELECT COUNT(*) AS total FROM mod_fuel_alerts');
            res.json({ success: true, data: { total: rows[0]?.total || 0 } });
        } catch (err) {
            next(err);
        }
    });

    // 挂载路由（注意：主项目会在所有模块加载完毕后统一挂载 404 与 errorHandler）
    app.use('/api/mod/fuel-alert', router);
}

module.exports = {
    name: 'fuel-alert',
    version: '1.0.0',
    init
};
```

---

## 4. Docker 中挂载并启用模块

在 `docker-compose.yml` 中，已默认配置 `/app/mod` 挂载点：

```yaml
volumes:
  - ${carnote_data}:/app/data
  - ${carnote_uploads}:/app/uploads
  - ${carnote_mod:-carnote_mod}:/app/mod
```

在 `.env` 中指定宿主机模块目录，例如：

```env
carnote_mod=/volume1/docker/carnote/mod
```

将开发好的模块目录放入 `/volume1/docker/carnote/mod/fuel-alert/`，重启容器后即可生效：

```bash
docker-compose restart app
docker-compose logs -f app
```

在启动日志中可以看到类似输出：

```text
[MOD] 正在加载模块 (fuel-alert): /app/mod/fuel-alert/backend/index.js
[MOD] 模块加载成功: fuel-alert
```

---

## 5. 数据库兼容开发注意事项

CarNote 同时支持 **SQLite** 和 **PostgreSQL**，建议在模块中使用 `context.db.query(sql, params)` 和 `context.db.get(sql, params)`：

1. **占位符统一用 `?`**：`query()` 在 PostgreSQL 模式下会自动将 `?` 转换为 `$1, $2, ...`。
2. **表名建议加前缀**：例如 `mod_<模块名>_<表名>`，避免与主项目表名冲突。
3. **布尔字段比较**：PostgreSQL 中请使用 `TRUE / FALSE` 而不是 `1 / 0`，插入参数在 JS 中传 `Boolean(...)`。
4. **聚合结果类型**：`COUNT(*)`、`SUM(...)` 等若别名包含 `count`、`sum`、`avg`、`total` 等关键字，`query()` 会自动将其转换为 JS `Number`。

---

## 6. 调试与故障排查

- **模块未加载**：检查路径是否为 `/app/mod/<模块名>/backend/index.js`（或 `/app/mod/backend/index.js`），以及文件权限是否对容器内 `node` 用户（UID `1000`）可读（容器启动脚本会自动尝试修正 `/app/mod` 权限）。
- **模块报错不影响主服务**：单个模块初始化异常会被捕获并记录到日志，不会阻断其他模块或主服务启动。
- **路由 404**：建议模块路由统一挂载在 `/api/mod/<模块名>/...` 下，避免与主项目 `/api/*` 路由及前端 SPA 历史模式回退冲突。
