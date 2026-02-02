# CarNote - 车记录

![CarNote banner](https://kaiyuan.github.io/CarNote/assets/carnote-web-banner.png)

一个功能完整的车辆记录管理系统，支持油耗、电耗追踪、保养管理、配件跟踪和数据分析。

## 功能特性

- 🚗 **多车辆管理** - 支持管理多辆不同动力类型的车辆（燃油、纯电、混动）
- ⛽ **能耗记录** - 详细记录油耗/电耗，自动计算百公里消耗、行驶里程差及平均能耗
- 📍 **地理位置与智能发现** - 记录补能位置，支持从地图拾取。**智能发现**功能可自动推荐周边已收录的补能站及维修点
- 🛠 **保养追踪** - 管理保养和维修记录，支持店面一键拾取，并提供智能到期提醒
- 🔧 **配件管理** - 跟踪全车配件状态、更换历史，记录详细的供应商位置
- 📊 **数据分析** - 提供能耗趋势、月度费用统计、位置热力图及车辆全生命周期总览
- 👑 **全局数据管理** - 完善的管理员面板，支持对所有用户、车辆及记录进行交叉筛选、修改与删除
- 🎨 **品牌定制** - 支持上传站点图标（自动生成全套 PWA 图标）、自定义站点名称及描述
- 📧 **邮件通知** - 支持配置 SMTP 服务，用于发送密码重置邮件
- 📱 **全功能 PWA** - 支持添加到手机主屏幕，提供类原生 App 的体验（支持 iOS/Android）
- 🔒 **安全管控** - 支持关闭新用户注册、禁用违规账户、查看登录日志
- 🔑 **API 接口** - 支持 API Key 认证的一键数据提交（通过 GET/POST 快速记账）
- 📁 **数据导出导入** - 支持全量 JSON 备份与无损恢复（自动处理兼容性），及按分类导出 CSV 报表
- 📝 **程序日志** - 系统日志自动持久化至数据文件夹，方便排查问题

## 技术栈

### 后端
- **框架**: Node.js + Express.js
- **数据库**: 
  - **SQLite** (默认，零配置，适合个人/家庭)
  - **PostgreSQL** (推荐，适合多用户/高并发/群晖部署)
- **图像处理**: Sharp
- **认证**: API Key + 简单会话认证

### 前端
- **框架**: Vue 3 + Vite
- **UI 组件**: PrimeVue
- **地图**: Leaflet (OpenStreetMap)

### 部署
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx (可选，内置 HTTP 服务)

## 部署指南

### 方式一：Docker Compose (SQLite - 默认/最简)

适合大多数个人用户，无需配置数据库，开箱即用。

1. **获取 docker-compose.yml**
   将项目根目录下的 `docker-compose.yml` 保存到本地。
   新建 `.env` 文件并填写相应的目录
   ```
   carnote_data=/volume1/docker/carnote/data
   carnote_uploads=/volume1/docker/carnote/uploads
   ```

2. **启动服务**
   ```bash
   docker-compose up -d
   ```

3. **访问应用**
   - 访问地址: `http://localhost:53300`

### 方式二：Docker Compose (PostgreSQL - 进阶)

适合对性能有要求、需要部署在 NAS (如群晖 Synology) 或进行多用户管理的场景。

1. **准备 PostgreSQL 数据库**
   你可以使用现有的 PostgreSQL 实例，或者在 `docker-compose.yml` 中添加一个 db 服务。

2. **修改环境变量**
   编辑 `docker-compose.yml`，修改 `environment` 部分：

   ```yaml
   environment:
     - NODE_ENV=production
     - PORT=53300
     - DB_TYPE=postgresql           # 切换为 postgresql
     - PG_HOST=your_pg_host         # 数据库地址 (如宿主机IP或db容器名)
     - PG_PORT=5432
     - PG_DATABASE=carnote
     - PG_USER=your_username
     - PG_PASSWORD=your_password
     # 其他配置保持不变...
   ```

3. **启动服务**
   ```bash
   docker-compose up -d --build
   ```

> **注意**：CarNote 会自动检测数据库类型并在 PostgreSQL 中创建相应的表结构。如果从 SQLite 迁移到 PostgreSQL，目前需要手动迁移数据，建议使用系统的导入导出功能。

---

### 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_TYPE` | 数据库类型 (`sqlite` / `postgresql`) | `sqlite` |
| `SQLITE_PATH` | SQLite 文件路径 | `/app/data/carnote.db` |
| `PG_*` | PostgreSQL 连接参数 | (空) |
| `UPLOAD_PATH` | 图片上传存储路径 | `/app/uploads` |
| `JWT_SECRET` | JWT 签名密钥 (建议修改) | `carnote-production-secret...` |
| `CORS_ORIGIN` | 允许跨域的前端地址 | `http://localhost` |

## 本地开发

### 方式一：一键启动 (Linux/WSL)

```bash
./run.sh
```

### 方式二：手动启动

1. **构建前端**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

2. **启动后端**
   ```bash
   cd backend
   npm install
   node server.js
   ```

访问 `http://localhost:53300` 即可使用完整功能。

## API 文档

### 认证

大部分 API 需要在请求头中包含用户 ID：
```
X-User-Id: <user_id>
```

快速记账 API 支持 API Key 认证：
```
X-API-Key: <api_key>
```

### 快速记账 API 示例

使用 API Key 一键添加能耗记录：

```bash
curl "http://localhost:53300/api/energy/quick?apiKey=YOUR_API_KEY&mileage=12345&amount=45.5&cost=350"
```

查询参数：
- `apiKey` (必需) - 后台生成的 API 密钥
- `mileage` (必需) - 当前里程
- `amount` (必需) - 加油量/充电量
- `cost` (可选) - 费用
- `is_full` (可选) - 是否加满 (1/0)

## 数据管理

项目提供了完善的数据导出与导入功能，方便用户备份或迁移数据：

### 数据导出
- **全量备份**：支持导出为 JSON 格式，包含所有车辆、能耗、保养及配件记录，内置 BOM 头修复，确保跨平台兼容。
- **分类导出**：支持将车辆、能耗、保养记录分别导出为 CSV 格式，方便在 Excel 中查看。

### 数据导入
- **安全恢复**：支持从 JSON 备份文件恢复完整数据。
- **预览验证**：导入前会解析文件并显示统计信息（如识别到的车辆数、记录数），由用户确认后再执行。
- **智能兼容**：自动兼容旧版本备份文件及不同数据库架构下的字段映射。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
