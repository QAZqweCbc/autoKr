#!/bin/bash

# 快速修复脚本 - 检查和修复package.json

echo "🔍 检查当前目录..."
pwd

echo ""
echo "📋 检查package.json是否存在..."
if [ ! -f package.json ]; then
    echo "❌ 错误：当前目录没有package.json文件"
    echo "请确保你在项目根目录"
    exit 1
fi

echo "✅ package.json 存在"
echo ""

echo "📝 检查package.json中的scripts..."
if grep -q '"dev:all"' package.json; then
    echo "✅ dev:all 脚本存在"
else
    echo "❌ dev:all 脚本不存在"
fi

if grep -q '"start"' package.json; then
    echo "✅ start 脚本存在"
else
    echo "❌ start 脚本不存在"
fi

echo ""
echo "📦 检查node_modules..."
if [ -d node_modules ]; then
    echo "✅ node_modules 存在"
    
    # 检查关键依赖
    if [ -d node_modules/concurrently ]; then
        echo "✅ concurrently 已安装"
    else
        echo "⚠️  concurrently 未安装"
        echo "正在安装..."
        npm install concurrently --save-dev
    fi
    
    if [ -d node_modules/ts-node ]; then
        echo "✅ ts-node 已安装"
    else
        echo "⚠️  ts-node 未安装"
        echo "正在安装..."
        npm install ts-node --save-dev
    fi
else
    echo "❌ node_modules 不存在"
    echo "正在安装依赖..."
    npm install
fi

echo ""
echo "🔧 可用的npm scripts:"
npm run

echo ""
echo "✅ 检查完成！"
echo ""
echo "现在你可以运行："
echo "  npm run dev        # 启动主服务"
echo "  npm run dev:auth   # 启动认证服务"
echo "  npm run dev:all    # 启动所有服务"
echo "  npm run build      # 编译项目"
echo "  npm start          # 启动编译后的服务"
