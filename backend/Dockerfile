# CarNote 后端 Dockerfile
# 多阶段构建，优化镜像大小

# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production

# 生产阶段
FROM node:18-alpine

# 安装 PostgreSQL 客户端工具用于备份
RUN apk add --no-color --no-cache postgresql-client

WORKDIR /app

# 从构建阶段复制依赖
COPY --from=builder /app/node_modules ./node_modules

# 复制应用代码
COPY . .

# 创建数据和上传目录
RUN mkdir -p data uploads && \
  chown -R node:node /app && \
  chmod -R 755 /app

# 切换到非 root 用户
USER node

# 暴露端口
EXPOSE 53300

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:53300/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "server.js"]
