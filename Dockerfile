# CarNote Dockerfile
# 多阶段构建：前端构建 -> 后端运行

# 1. 前端构建阶段
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# 2. 后端运行阶段
FROM node:18-alpine
WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制后端依赖配置
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# 复制后端代码
COPY backend/ .

# 复制前端构建产物到正确位置 (backend/server.js 预期在 ../frontend/dist)
# 我们需要调整目录结构以匹配 server.js 的 path.join(__dirname, '../frontend/dist')
# 由于 WORKDIR 是 /app/backend，__dirname 是 /app/backend
# 所以 ../frontend/dist 应该是 /app/frontend/dist
WORKDIR /app
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 设置权限
RUN mkdir -p /app/backend/data /app/backend/uploads && \
    chown -R nodejs:nodejs /app

# 切换用户
USER nodejs
WORKDIR /app/backend

# 环境变量
ENV PORT=53300
ENV NODE_ENV=production

# 暴露端口
EXPOSE 53300

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:53300/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动
CMD ["node", "server.js"]
