#!/bin/bash

# Kiro Account Manager - 启动所有服务
# 同时启动主服务和认证服务

echo "=========================================="
echo "🚀 启动 Kiro Account Manager"
echo "=========================================="

# 检查是否在 server 目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在 server 目录下运行此脚本"
    exit 1
fi

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 构建项目
echo "🔨 构建项目..."
npm run build

# 启动认证服务（后台运行）
echo "🔐 启动认证服务 (端口 2233)..."
npm run start:auth &
AUTH_PID=$!
echo "认证服务 PID: $AUTH_PID"

# 等待认证服务启动
sleep 3

# 启动主服务（前台运行）
echo "🌐 启动主服务 (端口 1455)..."
npm run start

# 清理函数
cleanup() {
    echo ""
    echo "=========================================="
    echo "🛑 停止所有服务..."
    echo "=========================================="
    kill $AUTH_PID 2>/dev/null
    echo "✅ 服务已停止"
    exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

# 等待
wait
