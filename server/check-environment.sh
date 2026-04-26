#!/bin/bash

# Kiro Account Manager - 环境检查脚本
# 在部署前运行此脚本，检查系统环境是否满足要求

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# 检查计数器
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

# 检查操作系统
check_os() {
    print_header "检查操作系统"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        print_success "操作系统: $NAME $VERSION"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_error "无法检测操作系统"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# 检查 Node.js
check_nodejs() {
    print_header "检查 Node.js"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            print_success "Node.js 版本: $NODE_VERSION ✓"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_warning "Node.js 版本过低: $NODE_VERSION (需要 18.0+)"
            WARN_COUNT=$((WARN_COUNT + 1))
        fi
    else
        print_error "Node.js 未安装"
        print_info "安装方法: https://nodejs.org/"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# 检查 npm
check_npm() {
    print_header "检查 npm"
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm 版本: $NPM_VERSION ✓"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_error "npm 未安装"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# 检查 Git
check_git() {
    print_header "检查 Git"
    
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        print_success "$GIT_VERSION ✓"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_warning "Git 未安装（可选）"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
}

# 检查 MySQL
check_mysql() {
    print_header "检查 MySQL"
    
    if command -v mysql &> /dev/null; then
        MYSQL_VERSION=$(mysql --version)
        print_success "$MYSQL_VERSION ✓"
        PASS_COUNT=$((PASS_COUNT + 1))
        
        # 检查 MySQL 服务状态
        if systemctl is-active --quiet mysql || systemctl is-active --quiet mysqld; then
            print_success "MySQL 服务运行中 ✓"
        else
            print_warning "MySQL 服务未运行"
            WARN_COUNT=$((WARN_COUNT + 1))
        fi
    else
        print_warning "MySQL 未安装（可选，可使用JSON存储）"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
}

# 检查 Redis
check_redis() {
    print_header "检查 Redis"
    
    if command -v redis-cli &> /dev/null; then
        REDIS_VERSION=$(redis-cli --version)
        print_success "$REDIS_VERSION ✓"
        PASS_COUNT=$((PASS_COUNT + 1))
        
        # 检查 Redis 服务状态
        if systemctl is-active --quiet redis || systemctl is-active --quiet redis-server; then
            print_success "Redis 服务运行中 ✓"
        else
            print_warning "Redis 服务未运行"
            WARN_COUNT=$((WARN_COUNT + 1))
        fi
    else
        print_warning "Redis 未安装（可选）"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
}

# 检查 PM2
check_pm2() {
    print_header "检查 PM2"
    
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 --version)
        print_success "PM2 版本: $PM2_VERSION ✓"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_warning "PM2 未安装（部署时会自动安装）"
        print_info "手动安装: npm install -g pm2"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
}

# 检查 Nginx
check_nginx() {
    print_header "检查 Nginx"
    
    if command -v nginx &> /dev/null; then
        NGINX_VERSION=$(nginx -v 2>&1)
        print_success "$NGINX_VERSION ✓"
        PASS_COUNT=$((PASS_COUNT + 1))
        
        # 检查 Nginx 服务状态
        if systemctl is-active --quiet nginx; then
            print_success "Nginx 服务运行中 ✓"
        else
            print_warning "Nginx 服务未运行"
            WARN_COUNT=$((WARN_COUNT + 1))
        fi
    else
        print_warning "Nginx 未安装（可选，用于反向代理）"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
}

# 检查端口占用
check_ports() {
    print_header "检查端口占用"
    
    # 检查 1455 端口
    if command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":1455 "; then
            print_warning "端口 1455 已被占用"
            WARN_COUNT=$((WARN_COUNT + 1))
        else
            print_success "端口 1455 可用 ✓"
            PASS_COUNT=$((PASS_COUNT + 1))
        fi
        
        # 检查 2233 端口
        if netstat -tuln | grep -q ":2233 "; then
            print_warning "端口 2233 已被占用"
            WARN_COUNT=$((WARN_COUNT + 1))
        else
            print_success "端口 2233 可用 ✓"
            PASS_COUNT=$((PASS_COUNT + 1))
        fi
    else
        print_warning "netstat 未安装，无法检查端口"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
}

# 检查磁盘空间
check_disk_space() {
    print_header "检查磁盘空间"
    
    AVAILABLE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    
    if [ "$AVAILABLE" -ge 10 ]; then
        print_success "可用磁盘空间: ${AVAILABLE}GB ✓"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_warning "可用磁盘空间不足: ${AVAILABLE}GB (建议至少10GB)"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
}

# 检查内存
check_memory() {
    print_header "检查内存"
    
    if command -v free &> /dev/null; then
        TOTAL_MEM=$(free -g | grep Mem | awk '{print $2}')
        
        if [ "$TOTAL_MEM" -ge 2 ]; then
            print_success "总内存: ${TOTAL_MEM}GB ✓"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_warning "内存不足: ${TOTAL_MEM}GB (建议至少2GB)"
            WARN_COUNT=$((WARN_COUNT + 1))
        fi
    else
        print_warning "无法检查内存"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
}

# 检查系统依赖
check_system_deps() {
    print_header "检查系统依赖"
    
    # 检查 Playwright 所需的系统库
    MISSING_DEPS=()
    
    if command -v dpkg &> /dev/null; then
        # Debian/Ubuntu
        DEPS=("libnss3" "libatk1.0-0" "libatk-bridge2.0-0" "libcups2" "libdrm2" "libxkbcommon0" "libxcomposite1" "libxdamage1" "libxfixes3" "libxrandr2" "libgbm1" "libasound2")
        
        for dep in "${DEPS[@]}"; do
            if ! dpkg -l | grep -q "^ii  $dep"; then
                MISSING_DEPS+=("$dep")
            fi
        done
    elif command -v rpm &> /dev/null; then
        # CentOS/RHEL
        DEPS=("nss" "atk" "at-spi2-atk" "cups-libs" "libdrm" "libxkbcommon" "libXcomposite" "libXdamage" "libXfixes" "libXrandr" "mesa-libgbm" "alsa-lib")
        
        for dep in "${DEPS[@]}"; do
            if ! rpm -q "$dep" &> /dev/null; then
                MISSING_DEPS+=("$dep")
            fi
        done
    fi
    
    if [ ${#MISSING_DEPS[@]} -eq 0 ]; then
        print_success "系统依赖完整 ✓"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_warning "缺少系统依赖: ${MISSING_DEPS[*]}"
        print_info "部署时会自动安装: npx playwright install-deps chromium"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
}

# 显示总结
show_summary() {
    print_header "检查总结"
    
    echo "通过: $PASS_COUNT"
    echo "警告: $WARN_COUNT"
    echo "失败: $FAIL_COUNT"
    echo ""
    
    if [ $FAIL_COUNT -eq 0 ]; then
        if [ $WARN_COUNT -eq 0 ]; then
            print_success "✅ 环境检查完全通过！可以开始部署。"
            echo ""
            print_info "运行部署脚本: ./deploy.sh"
        else
            print_warning "⚠️  环境检查通过，但有 $WARN_COUNT 个警告。"
            echo ""
            print_info "可以继续部署，但建议先解决警告项。"
            print_info "运行部署脚本: ./deploy.sh"
        fi
        return 0
    else
        print_error "❌ 环境检查失败！请先解决以下问题："
        echo ""
        print_info "1. 安装 Node.js 18+: https://nodejs.org/"
        print_info "2. 查看完整部署指南: LINUX_DEPLOYMENT.md"
        return 1
    fi
}

# 主函数
main() {
    print_header "Kiro Account Manager - 环境检查"
    
    # 执行所有检查
    check_os
    check_nodejs
    check_npm
    check_git
    check_mysql
    check_redis
    check_pm2
    check_nginx
    check_ports
    check_disk_space
    check_memory
    check_system_deps
    
    # 显示总结
    show_summary
}

# 运行主函数
main
