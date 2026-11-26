#!/bin/sh
# CarNote 容器启动脚本
# 若以 root 运行：自动修复持久化卷目录权限，随后通过 su-exec 降权到 node 用户运行应用
set -e

if [ "$(id -u)" = "0" ]; then
    for dir in /app/uploads /app/data /app/backend/uploads /app/backend/data /app/mod; do
        mkdir -p "$dir" 2>/dev/null || true
        chown -R node:node "$dir" 2>/dev/null || true
    done
    exec su-exec node:node "$@"
else
    # 若容器已被外部指定非 root 用户运行，直接启动
    exec "$@"
fi
