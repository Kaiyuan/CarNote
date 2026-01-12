#!/bin/bash

# 能耗记录 API 测试脚本
# 用于诊断前后端数据交互问题

echo "========================================="
echo "CarNote 能耗记录 API 诊断工具"
echo "========================================="
echo ""

# 检查服务器是否运行
echo "1. 检查服务器状态..."
if curl -s http://localhost:53300/health > /dev/null 2>&1; then
    echo "✓ 服务器运行正常 (端口 53300)"
else
    echo "✗ 服务器未运行，请先启动: cd backend && node server.js"
    exit 1
fi

echo ""
echo "2. 测试能耗记录 API..."
echo "请输入您的 User ID (可在浏览器 localStorage 中找到):"
read USER_ID

if [ -z "$USER_ID" ]; then
    echo "✗ User ID 不能为空"
    exit 1
fi

echo ""
echo "发送请求到 /api/energy..."
RESPONSE=$(curl -s -H "X-User-Id: $USER_ID" http://localhost:53300/api/energy)

echo ""
echo "========================================="
echo "API 响应:"
echo "========================================="
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "========================================="
echo "响应结构分析:"
echo "========================================="
echo "$RESPONSE" | jq 'keys' 2>/dev/null

echo ""
echo "数据字段:"
echo "$RESPONSE" | jq '.data | type' 2>/dev/null

echo ""
echo "如果 data 是对象，显示其键:"
echo "$RESPONSE" | jq '.data | keys' 2>/dev/null

echo ""
echo "========================================="
echo "诊断完成"
echo "========================================="
