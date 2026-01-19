# CarNote - 车记录

![CarNote Logo](https://raw.githubusercontent.com/Kaiyuan/CarNote/refs/heads/main/frontend/src/assets/pwa-192.png)

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
- 📁 **数据导出导入** - 支持全量 JSON 备份与恢复，及分类 CSV 导出
- 📝 **程序日志** - 系统日志自动持久化至数据文件夹，方便排查问题

## 技术栈

### 后端
- **框架**: Node.js + Express.js
- **数据库**: SQLite (默认) / PostgreSQL
- **图像处理**: Sharp
- **认证**: API Key + 简单会话认证

### 前端
- **框架**: Vue 3 + Vite
- **UI 组件**: PrimeVue
- **地图**: Leaflet (OpenStreetMap)

### 部署
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx

## 快速开始

### 使用 Docker Compose (推荐)

1. **配置环境变量**
```bash
# 后端环境变量已包含默认配置
# 如需修改，编辑 backend/.env
```

2. **启动服务**
```bash
docker-compose up -d --build
```

3. **访问应用**
- 访问地址: http://localhost:53300

### 本地开发

#### 方式一：一键启动 (Linux/WSL)

```bash
./run.sh
```

#### 方式二：手动启动

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

访问 http://localhost:53300 即可使用完整功能。

## API 文档

### 认证

大部分 API 需要在请求头中包含用户 ID：
```
X-User-Id: <user_id>
```

某些 API 支持 API Key 认证：
```
X-API-Key: <api_key>
```

### 主要端点

#### 用户管理
- `POST /api/users/register` - 用户注册
- `POST /api/users/login` - 用户登录
- `GET /api/users/profile` - 获取用户信息
- `POST /api/users/api-keys` - 生成 API Key

#### 车辆管理
- `GET /api/vehicles` - 获取车辆列表
- `POST /api/vehicles` - 添加车辆
- `GET /api/vehicles/:id` - 获取车辆详情
- `PUT /api/vehicles/:id` - 更新车辆信息
- `DELETE /api/vehicles/:id` - 删除车辆

#### 能耗记录
- `GET /api/energy` - 获取能耗记录列表
- `POST /api/energy` - 添加能耗记录
- `GET /api/energy/quick` - 快速添加记录 (API Key)
- `PUT /api/energy/:id` - 更新记录
- `DELETE /api/energy/:id` - 删除记录

#### 保养维修
- `GET /api/maintenance` - 获取保养记录
- `POST /api/maintenance` - 添加保养记录
- `GET /api/maintenance/reminders/:vehicleId` - 获取保养提醒

#### 配件管理
- `GET /api/parts` - 获取配件列表
- `POST /api/parts` - 添加配件
- `POST /api/parts/replacements` - 记录配件更换

#### 数据分析
- `GET /api/analytics/consumption/:vehicleId` - 能耗趋势
- `GET /api/analytics/expenses/:vehicleId` - 费用统计
- `GET /api/analytics/locations/:vehicleId` - 位置热力图数据
- `GET /api/analytics/overview/:vehicleId` - 车辆总览

### 快速添加 API 示例

使用 API Key 一键添加能耗记录：

```bash
curl "http://localhost:53300/api/energy/quick?apiKey=YOUR_API_KEY&mileage=12345&amount=45.5&cost=350"
```

查询参数：
- `apiKey` (必需) - API密钥
- `mileage` (必需) - 当前里程
- `amount` (必需) - 加油量/充电量
- `cost` (可选) - 费用
- `location_name` (可选) - 位置名称
- `location_lat` (可选) - 纬度
- `location_lng` (可选) - 经度
- `is_full` (可选) - 是否加满 (1/0)

## 数据库

### SQLite (默认)

数据库文件位置: `backend/data/carnote.db`

### PostgreSQL

在 `backend/.env` 中配置：

```env
DB_TYPE=postgresql
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=carnote
PG_USER=postgres
PG_PASSWORD=your_password
```

### 数据库架构

主要表：
- `users` - 用户表
- `user_settings` - 用户设置
- `api_keys` - API 密钥
- `vehicles` - 车辆信息
- `energy_logs` - 能耗记录
- `maintenance_records` - 保养记录
- `parts` - 配件信息
- `part_replacements` - 配件更换记录

- `part_replacements` - 配件更换记录

## 数据管理

项目提供了完善的数据导出与导入功能，方便用户备份或迁移数据：

### 数据导出
- **全量备份**：支持导出为 JSON 格式，包含所有车辆、能耗、保养及配件记录。
- **分类导出**：支持将车辆、能耗、保养记录分别导出为 CSV 格式，方便在 Excel 中查看。

### 数据导入
- **安全恢复**：支持从 JSON 备份文件恢复完整数据。
- **预览验证**：导入前会解析文件并显示统计信息（如识别到的车辆数、记录数），由用户确认后再执行。
- **事务处理**：导入过程支持数据库事务，确保数据一致性，防止部分导入失败导致的脏数据。

操作路径：`侧边栏 -> 设置 -> 数据管理`。

## 系统配置

管理员可通过侧边栏的 **系统设置** (Admin) 菜单进行以下配置：

### 站点设置
- **站点名称与描述**：自定义用于浏览器标题栏及 PWA 启动画面的文字。
- **站点图标**：上传一张图片（建议 512x512），系统会自动生成 Favicon、192x192 及 512x512 的 PWA 图标，并自动更新 Web Manifest。
- **注册开关**：可随时开启或关闭新用户注册功能。

### SMTP 设置
配置邮件服务以启用“忘记密码”邮件发送功能：
- 支持标准 SMTP 服务（如 QQ 邮箱、Gmail、Outlook 等）。
- 需填写服务器地址、端口（通常 SSL 为 465）、账号及授权码。

## Docker Compose 配置

项目包含完整的 Docker Compose 配置，包括：
- **app** - 统一的前后端服务
- **postgres** (可选) - PostgreSQL 数据库

### 环境变量

在 `docker-compose.yml` 中可以配置：
- `PORT` - 服务端口 (默认 53300)
- `DB_TYPE` - 数据库类型 (sqlite/postgresql)
- `CORS_ORIGIN` - 允许的前端地址

### 数据持久化

使用 Docker volumes 持久化数据，建议定期备份：
- `carnote_data` - 存储 SQLite 数据库文件 (`carnote.db`) 以及系统运行日志 (`app.log`)
- `carnote_uploads` - 存储上传的图片文件（车辆照片、发票截图等）
- `postgres_data` - PostgreSQL 数据 (如使用外部数据库)

**NAS 权限提示**：
容器内默认使用 `node` 用户 (UID: 1000) 运行。如果您在群晖/威联通等 NAS 上挂载本地目录作为卷，请确保对应的宿主机目录对 UID 1000 有读写权限（可通过 `chown -R 1000:1000 /your/path` 设置）。如果您遇到 `EACCES` 错误，请检查挂载路径的权限设置。

## 开发说明

### 后端开发

- 使用 `npm run dev` 启动开发服务器 (使用 nodemon 自动重启)
- 代码包含详细的中文注释
- 所有 API 使用统一的响应格式：
  ```json
  {
    "success": true/false,
    "message": "消息",
    "data": {}
  }
  ```

### 前端开发

- 使用 Vue 3 Composition API
- PrimeVue 组件库提供丰富的 UI 组件
- 响应式设计，支持移动端

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请创建 Issue 或联系项目维护者。
