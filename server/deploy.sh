#!/bin/bash

# Kiro Account Manager - 自动部署脚本
# 适用于 Ubuntu/Debian/CentOS/RHEL

set -e

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

# 检查是否为 root 用户
check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_warning "不建议使用 root 用户运行此脚本"
        read -p "是否继续？(y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        print_error "无法检测操作系统"
        exit 1
    fi
    
    print_info "检测到操作系统: $OS $VER"
}

# 检查 Node.js
check_nodejs() {
    print_header "检查 Node.js"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js 已安装: $NODE_VERSION"
        
        # 检查版本是否 >= 18
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -lt 18 ]; then
            print_warning "Node.js 版本过低，需要 18.0+，当前: $NODE_VERSION"
            print_info "请手动升级 Node.js"
            exit 1
        fi
    else
        print_error "Node.js 未安装"
        print_info "请先安装 Node.js 18+: https://nodejs.org/"
        exit 1
    fi
}

# 检查 MySQL
check_mysql() {
    print_header "检查 MySQL"
    
    if command -v mysql &> /dev/null; then
        MYSQL_VERSION=$(mysql --version)
        print_success "MySQL 已安装: $MYSQL_VERSION"
    else
        print_warning "MySQL 未安装（可选）"
        print_info "如果使用 JSON 存储，可以跳过"
    fi
}

# 安装依赖
install_dependencies() {
    print_header "安装项目依赖"
    
    # 安装后端依赖
    print_info "安装后端依赖..."
    npm install
    
    # 安装前端依赖
    print_info "安装前端依赖..."
    npm run frontend:install
    
    # 安装 Playwright
    print_info "安装 Playwright 浏览器..."
    npx playwright install chromium
    
    print_info "安装 Playwright 系统依赖..."
    npx playwright install-deps chromium || print_warning "Playwright 系统依赖安装失败，可能需要 sudo 权限"
    
    print_success "依赖安装完成"
}

# 配置环境变量
configure_env() {
    print_header "配置环境变量"
    
    if [ -f .env ]; then
        print_warning ".env 文件已存在"
        read -p "是否覆盖？(y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "跳过环境变量配置"
            return
        fi
    fi
    
    # 复制模板
    cp .env.example .env
    
    # 生成密钥
    print_info "生成安全密钥..."
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    MAIN_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    # 替换密钥
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-jwt-secret-here-generate-with-command-above/$JWT_SECRET/" .env
        sed -i '' "s/your-main-api-key-here-generate-with-command-above/$MAIN_API_KEY/" .env
    else
        # Linux
        sed -i "s/your-jwt-secret-here-generate-with-command-above/$JWT_SECRET/" .env
        sed -i "s/your-main-api-key-here-generate-with-command-above/$MAIN_API_KEY/" .env
    fi
    
    print_success "环境变量配置完成"
    print_warning "请编辑 .env 文件，配置以下信息："
    print_info "  - 数据库配置 (MYSQL_*)"
    print_info "  - 邮箱配置 (QQ_EMAIL, QQ_AUTH_CODE)"
    print_info "  - 管理员密码 (ADMIN_PASSWORD)"
    echo ""
    read -p "按 Enter 继续编辑 .env 文件..."
    ${EDITOR:-nano} .env
}

# 编译项目
build_project() {
    print_header "编译项目"
    
    # 编译后端
    print_info "编译后端..."
    npm run build
    
    # 编译前端
    print_info "编译前端..."
    npm run frontend:build
    
    print_success "项目编译完成"
}

# 初始化数据库
init_database() {
    print_header "初始化数据库"
    
    print_info "创建管理员账号..."
    npm run init:admin
    
    print_success "数据库初始化完成"
}

# 安装 PM2
install_pm2() {
    print_header "安装 PM2"
    
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 --version)
        print_success "PM2 已安装: $PM2_VERSION"
    else
        print_info "安装 PM2..."
        npm install -g pm2
        print_success "PM2 安装完成"
    fi
}

# 启动服务
start_services() {
    print_header "启动服务"
    
    # 检查是否已有运行的服务
    if pm2 list | grep -q "kiro-main\|kiro-auth"; then
        print_warning "检测到已运行的服务"
        read -p "是否重启服务？(y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "重启服务..."
            pm2 restart ecosystem.config.js
        else
            print_info "跳过启动服务"
            return
        fi
    else
        print_info "启动服务..."
        pm2 start ecosystem.config.js
    fi
    
    # 保存 PM2 配置
    pm2 save
    
    # 设置开机自启
    print_info "配置开机自启..."
    pm2 startup | grep "sudo" | bash || print_warning "需要手动执行 PM2 startup 命令"
    
    print_success "服务启动完成"
}

# 显示状态
show_status() {
    print_header "部署状态"
    
    # PM2 状态
    pm2 status
    
    echo ""
    print_success "部署完成！"
    echo ""
    print_info "访问地址:"
    print_info "  - 前端: http://localhost:1455"
    print_info "  - API: http://localhost:1455/api"
    print_info "  - 健康检查: http://localhost:1455/health"
    echo ""
    print_info "常用命令:"
    print_info "  - 查看状态: pm2 status"
    print_info "  - 查看日志: pm2 logs"
    print_info "  - 重启服务: pm2 restart all"
    print_info "  - 停止服务: pm2 stop all"
    echo ""
}

# 主函数
main() {
    print_header "Kiro Account Manager - 自动部署"
    
    # 检查
    check_root
    detect_os
    check_nodejs
    check_mysql
    
    # 安装
    install_dependencies
    configure_env
    build_project
    init_database
    install_pm2
    start_services
    
    # 完成
    show_status
}

# 运行主函数
main
