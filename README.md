# CarNote - 车记录

一个功能完整的车辆记录管理系统，支持油耗、电耗追踪、保养管理、配件跟踪和数据分析。

## 功能特性

- 🚗 **多车辆管理** - 支持管理多辆车辆信息
- ⛽ **能耗记录** - 详细记录油耗/电耗，自动计算百公里消耗
- 📍 **地理位置** - 记录补能位置，支持地图展示
- 🛠 **保养追踪** - 管理保养和维修记录，智能提醒
- 🔧 **配件管理** - 跟踪配件状态和更换历史
- 📊 **数据分析** - 丰富的图表和统计分析
- 🔑 **API 接口** - 支持 API Key 认证的一键数据提交

## 技术栈

### 后端
- **框架**: Node.js + Express.js
- **数据库**: SQLite (默认) / PostgreSQL
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

使用 Docker volumes 持久化数据：
- `carnote_data` - SQLite 数据库文件
- `carnote_uploads` - 上传的图片文件
- `postgres_data` - PostgreSQL 数据 (如使用)

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
