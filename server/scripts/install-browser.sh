#!/bin/bash
# 浏览器和依赖自动安装脚本

set -e

echo "============================================================"
echo "🚀 Kiro Account Manager - 浏览器环境安装"
echo "============================================================"

# 检测操作系统
if [ -f /etc/debian_version ]; then
    OS="debian"
    echo "📋 检测到 Debian/Ubuntu 系统"
elif [ -f /etc/redhat-release ]; then
    OS="redhat"
    echo "📋 检测到 RedHat/CentOS 系统"
else
    echo "❌ 不支持的操作系统"
    exit 1
fi

# 更新包列表
echo ""
echo "📦 更新包列表..."
if [ "$OS" = "debian" ]; then
    sudo apt update
else
    sudo yum update -y
fi

# 安装 Chromium
echo ""
echo "🌐 安装 Chromium 浏览器..."
if [ "$OS" = "debian" ]; then
    sudo apt install -y chromium chromium-driver
else
    sudo yum install -y chromium chromium-headless
fi

# 安装系统依赖
echo ""
echo "📚 安装系统依赖..."
if [ "$OS" = "debian" ]; then
    sudo apt install -y \
        libnss3 \
        libnspr4 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libdbus-1-3 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libpango-1.0-0 \
        libcairo2 \
        libasound2 \
        libatspi2.0-0 \
        fonts-liberation \
        libappindicator3-1 \
        xdg-utils
else
    sudo yum install -y \
        nss \
        nspr \
        atk \
        at-spi2-atk \
        cups-libs \
        libdrm \
        dbus-libs \
        libxkbcommon \
        libXcomposite \
        libXdamage \
        libXfixes \
        libXrandr \
        mesa-libgbm \
        pango \
        cairo \
        alsa-lib
fi

# 检查 Chromium 安装
echo ""
echo "🔍 验证安装..."
if command -v chromium &> /dev/null; then
    CHROMIUM_PATH=$(which chromium)
    echo "✅ Chromium 已安装: $CHROMIUM_PATH"
elif command -v chromium-browser &> /dev/null; then
    CHROMIUM_PATH=$(which chromium-browser)
    echo "✅ Chromium 已安装: $CHROMIUM_PATH"
else
    echo "❌ Chromium 安装失败"
    exit 1
fi

# 显示版本
CHROMIUM_VERSION=$($CHROMIUM_PATH --version 2>/dev/null || echo "未知")
echo "📌 版本: $CHROMIUM_VERSION"

echo ""
echo "============================================================"
echo "✅ 安装完成！"
echo "============================================================"
echo ""
echo "📝 配置说明："
echo "   1. 在浏览器配置页面选择 'Chrome/Chromium'"
echo "   2. 自定义浏览器路径填写: $CHROMIUM_PATH"
echo "   3. 启用无头模式"
echo "   4. 添加启动参数:"
echo "      --no-sandbox"
echo "      --disable-setuid-sandbox"
echo ""
echo "🚀 现在可以启动服务器: npm run start"
echo ""
