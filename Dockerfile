# CarNote Dockerfile
# 多阶段构建：前端构建 -> 后端运行

# 1. 前端构建阶段
FROM node:18-alpine AS frontend-builder
WORKDIR /app
# 复制所有 package.json
COPY frontend/package*.json ./frontend/
# 尝试复制可选扩展前端模块
# 若构建上下文中存在外部前端模块目录则一同编译；若无则跳过
COPY README.md vip* ./vip/
RUN rm -f ./vip/README.md

WORKDIR /app/frontend
RUN npm ci --unsafe-perm && chmod -R 755 node_modules/.bin && npm install -g vite --unsafe-perm && chmod +x node_modules/.bin/vite && chmod +x /usr/local/bin/vite
COPY frontend/ .
RUN echo "Listing node_modules/.bin" && ls -l node_modules/.bin && ./node_modules/.bin/vite --version || true
RUN vite --version
RUN npm run build

# 2. 后端运行阶段
FROM node:18-alpine

# 安装 PostgreSQL 客户端工具用于备份 (从 edge 仓库获取最新版本以匹配服务器)
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main postgresql-client

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

# 创建持久化目录和模块挂载目录
# /app/mod     —— 外部扩展模块挂载点，将模块目录放入 /app/mod/<模块名>/ 即可自动加载
# /app/data    —— 数据库/日志持久化
# /app/uploads —— 上传文件持久化
# 使用 alpine 自带的 node 用户 (uid: 1000) 以提高 NAS 兼容性
RUN mkdir -p /app/mod /app/backend/data /app/backend/uploads && \
    chown -R node:node /app && \
    chmod -R 755 /app

# 安装 su-exec 用于启动脚本内降权运行
RUN apk add --no-cache su-exec

# 启动脚本：以 root 运行，自修复持久化卷所有权后降权为 node 用户启动应用
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 环境变量
ENV PORT=53300
ENV NODE_ENV=production
ENV OCR_LANG_PATH=/app/backend/language
# MOD_PATH 指定外部扩展模块目录，后端启动时会从此目录自动扫描并加载模块
ENV MOD_PATH=/app/mod

# 暴露端口
EXPOSE 53300

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:53300/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

WORKDIR /app/backend

# 入口与启动命令：由 entrypoint 脚本自修复持久化卷权限后降权为 node 用户启动应用
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]

