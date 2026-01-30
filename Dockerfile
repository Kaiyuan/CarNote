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

# 安装 PostgreSQL 客户端工具用于备份
RUN apk add --no-color --no-cache postgresql-client

WORKDIR /app

# 复制后端依赖配置
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# 复制后端代码
COPY backend/ .

# 复制前端构建产物
WORKDIR /app
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 准备持久化目录并设置权限
# 使用 alpine 自带的 node 用户 (uid: 1000) 以提高 NAS 兼容性
RUN mkdir -p /app/backend/data /app/backend/uploads && \
    chown -R node:node /app && \
    chmod -R 755 /app

# 切换用户
USER node
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
