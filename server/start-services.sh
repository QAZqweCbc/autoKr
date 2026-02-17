#!/bin/bash

# Kiro 用户管理系统 - 服务启动脚本
# 用于开发和测试环境

set -e

echo "=========================================="
echo "  Kiro 用户管理与Token分配系统"
echo "=========================================="
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    echo "请访问 https://nodejs.org/ 安装 Node.js"
    exit 1
fi

echo "✓ Node.js 版本: $(node --version)"

# 检查npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未安装 npm"
    exit 1
fi

echo "✓ npm 版本: $(npm --version)"
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    echo ""
fi

# 检查环境配置
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到 .env 文件"
    echo "使用默认配置启动..."
    echo ""
fi

# 检查管理员账户
echo "🔍 检查管理员账户..."
if [ ! -f "data/users.json" ] && [ ! -f ".admin-initialized" ]; then
    echo "📝 初始化管理员账户..."
    npm run init:admin
    touch .admin-initialized
    echo ""
fi

# 检查端口占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ 错误: 端口 $port 已被占用"
        echo "请使用以下命令查看占用进程:"
        echo "  lsof -i :$port"
        echo "或者杀死占用进程:"
        echo "  kill -9 \$(lsof -t -i:$port)"
        return 1
    fi
    return 0
}

echo "🔍 检查端口占用..."
if ! check_port 3000; then
    exit 1
fi

if ! check_port 2233; then
    exit 1
fi

echo "✓ 端口检查通过"
echo ""

# 启动服务
echo "=========================================="
echo "  启动服务"
echo "=========================================="
echo ""
echo "主服务端口: 3000"
echo "认证服务端口: 2233"
echo ""
echo "管理面板: http://localhost:3000"
echo "管理员登录: http://localhost:3000/admin-login"
echo ""
echo "默认管理员账户:"
echo "  邮箱: admin@user.com"
echo "  密码: cbc123123"
echo ""
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 启动服务
npm run dev:all
