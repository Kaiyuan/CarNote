# CarNote 快速开始指南

## 🚀 5分钟快速部署

### 方式一：使用 Docker Compose（推荐）

```bash
# 1. 进入项目目录
cd CarNote

# 2. 启动所有服务
docker-compose up -d

# 3. 查看服务状态
docker-compose ps

# 4. 访问应用
# 后端 API: http://localhost:53300
# 健康检查: http://localhost:53300/health
```

### 方式二：本地开发

**启动后端：**

```bash
cd backend
npm install
npm run dev
```

后端将在 http://localhost:53300 启动

**启动前端：**

```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:53301 启动

## 快速启动

1.  克隆项目
2.  运行 `docker-compose up -d --build`
3.  访问 `http://localhost:53300`

或者本地运行：

1.  `npm run build` (in frontend)
2.  `node server.js` (in backend)
    - 访问 `http://localhost:53300`

## 📝 快速使用流程

### 1. 注册账号

访问登录页面，点击"注册"按钮：
- 输入用户名和密码
- 可选填写昵称和邮箱

### 2. 添加车辆

登录后点击"添加新车辆"：
- **车牌号**：必填
- **动力类型**：燃油/纯电/混动
- 品牌、型号、年份等信息

### 3. 记录能耗

使用快速 API 添加能耗记录：

```bash
# 先生成 API Key
# 登录后端 -> 用户设置 -> 生成 API Key

# 使用 API Key 快速添加（密钥放在请求头）
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:53300/api/energy/quick?mileage=12345&amount=45.5&cost=350"
```

参数说明：
- `X-API-Key`: 你的 API 密钥（请求头）
- `mileage`: 当前里程
- `amount`: 加油量（L）或充电量（kWh）
- `cost`: 费用（可选）

系统会自动计算百公里消耗！

### 4. 查看统计

访问首页查看：
- 所有车辆总览
- 平均能耗
- 保养提醒

## 🔑 获取 API Key

1. 登录系统
2. 访问 `http://localhost:53300/api/users/api-keys`（需要登录 Cookie）
3. 或通过前端界面生成

使用 curl 生成：

```bash
curl -X POST http://localhost:53300/api/users/api-keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"key_name": "我的API密钥", "vehicle_id": 1}'
```

## 📊 API 快速参考

### 用户相关

```bash
# 注册
POST /api/users/register
Body: { "username": "user1", "password": "your-password" }

# 登录（成功后服务端设置 HttpOnly Cookie）
POST /api/users/login
Body: { "username": "user1", "password": "your-password" }
```

命令行登录并保存 Cookie：

```bash
curl -c cookies.txt -X POST http://localhost:53300/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","password":"your-password"}'
```

### 车辆管理

```bash
# 获取车辆列表
GET /api/vehicles
Cookie: carnote_session=<登录后 Cookie>

# 添加车辆
POST /api/vehicles
Cookie: carnote_session=<登录后 Cookie>
Body: {
  "plate_number": "京A12345",
  "brand": "比亚迪",
  "model": "汉EV",
  "power_type": "electric",
  "current_mileage": 5000
}
```

### 能耗记录

```bash
# 快速添加（推荐）
GET /api/energy/quick?mileage=5100&amount=50&cost=400
X-API-Key: YOUR_KEY

# 完整添加
POST /api/energy
Cookie: carnote_session=<登录后 Cookie>
Body: {
  "vehicle_id": 1,
  "log_date": "2026-01-12T10:00:00",
  "mileage": 5100,
  "energy_type": "electric",
  "amount": 50,
  "cost": 400,
  "location_name": "家附近充电站"
}
```

## 🐳 Docker 命令参考

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f backend

# 重启服务
docker-compose restart

# 清理所有数据（危险！）
docker-compose down -v
```

## 📂 数据存储位置

- **SQLite 数据库**: `backend/data/carnote.db`
- **上传文件**: `backend/uploads/`
- **Docker volumes**: 
  - `carnote_data`: 数据库文件
  - `carnote_uploads`: 上传文件

## 🔧 常见问题

### 1. 端口冲突

如果 3000 或 53301 端口被占用，修改：
- 后端：`backend/.env` 中的 `PORT`
- 前端：`frontend/vite.config.js` 中的 `server.port`

### 2. 数据库切换到 PostgreSQL

编辑 `backend/.env`：

```env
DB_TYPE=postgresql
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=carnote
PG_USER=postgres
PG_PASSWORD=your_password
```

取消 `docker-compose.yml` 中 PostgreSQL 的注释。

### 3. 前端无法连接后端

检查 `frontend/vite.config.js` 中的代理配置是否正确：

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:53300',
    changeOrigin: true
  }
}
```

## 📱 开发建议

### 推荐开发流程

1. **后端优先**：先确保后端 API 正常工作
2. **API 测试**：使用 Postman 或 curl 测试接口
3. **前端集成**：逐步实现前端页面
4. **Docker 验证**：最后测试 Docker 部署

### 推荐工具

- **API 测试**: Postman / Insomnia
- **数据库管理**: DB Browser for SQLite / pgAdmin
- **代码编辑**: VS Code

## 🎯 下一步

1. ✅ 完善前端其他页面（能耗记录、保养、配件）
2. ✅ 添加数据可视化图表
3. ✅ 集成地图组件显示补能位置
4. ✅ 实现图片上传功能
5. ✅ 移动端适配

## 📚 相关文档

- [README.md](../README.md) - 完整项目文档
- [实施计划](./implementation_plan.md) - 技术实施细节
- [项目总结](./walkthrough.md) - 开发总结

---

**快速体验建议**：使用 Docker Compose 一键启动，注册账号后添加一辆车，然后使用快速 API 记录几次加油，即可在首页看到自动计算的百公里消耗！
