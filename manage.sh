#!/bin/bash

# Kiro Account Manager - 统一管理脚本
# 集成部署、更新、启动、检查等所有功能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m# No Color

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

# ============================================
# 环境检查功能
# ============================================

check_environment() {
    print_header "环境检查"

    local PASS_COUNT=0
    local WARN_COUNT=0
    local FAIL_COUNT=0

    # 检查 Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')

      R_VERSION" -ge 18 ]; then
            print_success "Node.js: $NODE_VERSION"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_warning "Node.js 版本过低: $NODE_VERSION (需要 18+)"
            WARN_COUNT=$((WARN_COUNT + 1))
        ull; then
        print_success "npm: $(npm --version)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_error "npm 未安装"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    # 检查 PM2
    if command -v pm2 &> /dev/null; then
        print_success "PM2: $(pm2 --version)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_warning "PM2 未安装（部署时会自动安装）"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi

    # 检查 MySQL
    if command -v mysql &> /dev/null; then
      ccess "MySQL: 已安装"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
      rning "MySQL 未安装（可WARN_COUNT=$((WARN_COUNT + 1))
    fi

    # 检查端口
    if command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":1455 "; then
            print_warning "端口 1455 已被占用"
            WARN_COUNT=$((WARN_COUNT + 1))
        else
           n            PASS_COUNT=$((PASS_COUNT + 1))
        fi

        if netstat -tuln 2>/dev/null | grep -q ":2233 "; then
            print_warning "端口 2233 已被占用"
            WARN_COUNT=$((WARN_COUNT + 1))
        else
            print_success "端口 2233 可用"
            PASS_COUNT=$((PASS_COUNT + 1))
        fi
    fi

    # 显示总结
    echo ""
    print_info "检查结果: 通过 $PASS_COUNT | 警告 $WARN_COUNT | 失败 $FAIL_COUNT"

    if [ $FAIL_COUNT -gt 0 ]; then
    环境检查失败，请先解决问题"
        return 1
    elif [ $WARN_COUNT -gt 0 ]; then
        print_warning "有 $WARN_COUNT 个警告，建议先解决"
        return 0
    else
        print_success "环境检查完全通过"
        return 0
    fi
}

# ============================================
# 部署功能
# ============================================

deploy() {
    print_header "开始部署"

    # 环境检查
    check_environment || exit 1

    # 安装依赖
    print_header "安装依赖"
    print_info "安装后端依赖..."
    npm install

    print_info "安装前端依赖..."
    npm run frontend:install

    print_info "安装 Playwright..."
    npx playwright install chromium
    npx playwright install-deps chromium || print_warning "Playwright 系统依赖安装失败"

    # 配置环境变量
    if [ ! -f .env ]; then
        print_header "配置环境变量"
        cp .env.example .env

        # 生成密钥
        JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        MAIN_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

        # 替换密钥
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/your-jwt-secret-here-generate-with-command-above/$JWT_SECRET/" .env
            sed -i '' "s/your-main-api-key-here-generate-with-command-above/$MAIN_API_KEY/" .env
        else
            sed -i "s/your-jwt-secret-here-generate-with-command-above/$JWT_SECRET/" .env
            sed -i "s/your-main-api-key-here-generate-with-command-above/$MAIN_API_KEY/" .env
        fi

        print_success "环境变量已生成"
        print_warning "请编辑 .env 文件配置数据库和邮箱信息"
        read -p "按 Enter 继续..."
    fi

    # 编译项目
    print_header "编译项目"
    npm run build
    npm run frontend:build

    # 初始化数据库
    print_header "初始化数据库"
    npm run init:admin

    # 安装 PM2
    if ! command -v pm2 &> /dev/null; then
        print_info "安装 PM2..."
        npm install -g pm2
    fi

    # 启动服务
    start_services

    print_success "部署完成！"
    show_info
}

# ============================================
# 更新功能
# ============================================

update() {
    print_header "更新项目"

    # 检查 Git
    if [ ! -d .git ]; then
        print_error "当前目录不是 Git 仓库"
        exit 1
    fi

    # 备份
    print_info "备份当前版本..."
    BACKUP_DIR="backups"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    mkdir -p "$BACKUP_DIR"

    CURRENT_COMMIT=$(git rev-parse HEAD)
    echo "$CURRENT_COMMIT" > "$BACKUP_DIR/last_commit.txt"

    if [ -f .env ]; then
        cp .env "$BACKUP_DIR/backup_$TIMESTAMP.env"
    fi

    # 拉取代码
    print_info "拉取最新代码..."
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "检测到未提交的更改"
        git stash
        STASHED=true
    fi

    git pull origin $(git branch --show-current)

    if [ "$STASHED" = true ]; then
        git stash pop || print_warning "无法自动恢复暂存的更改"
    fi

    # 更新依赖
    if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
        print_info "更新后端依赖..."
        npm install
    fi

    if git diff HEAD@{1} HEAD --name-only | grep -q "frontend/package.json"; then
        print_info "更新前端依赖..."
        npm run frontend:install
    fi

    # 编译
    print_info "编译项目..."
    npm run build
    npm run frontend:build

    # 重启服务
    restart_services

    # 健康检查
    health_check

    print_success "更新完成！"
}

# ============================================
# 启动功能
# ============================================

start_services() {
    print_header "启动服务"

    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 未安装，请先运行部署: ./manage.sh deploy"
        exit
    if pm2 list | grep -q "kiro-main\|kiro-auth"; then
        print_warning "服务已在运行"
        read -p "是否重启？(y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pm2 restart ecosystem.config.js
      cosystem.config.js
        pm2 save

        # 设置开机自启
        pm2 startup | grep "sudo" | bash || print_warning "需要手动执行 PM2 startup 命令"
    fi

    print_success "服务已启动"
    pm2 stat ============================================
# 停止功能
# ============================================

stop_services() {
    print_header "停止服务"

    if command -v pm2 &> /dev/null; then
        pm2 stop ecosystem.config.js
        print_success "服务已停止"
    else
        print_error "PM2 未安装"
    fi
}

# ============================================
# 重启功能
# ============================================

restart_services() {
    print_header "重启服务"

    if command -v pm2 &> /dev/null && pm2 list | grep -q "kiro"; then
     art ecosystem.config.js
        pm2 save
        print_success "服务已重启"
        sleep 3
        pm2 status
    else
        print_error "服务未运行"
        exit 1
    fi
}

# ============================================
# 状态查看
# ============================================

show_status() {
    print_header "服务状态"

    if command -v pm2 &> /dev/null; then
        pm2 status
        echo ""
        pm2 logs --lines 20 --nostream
    else
        print_error "PM2 未安装"
    fi
}

# ============================================
# 健康检查
# ============================================

health_check() {
    print_header "健康检查"

    sleep 5

    # 检查主服务
    if curl -f http://localhost:1455/health &> /dev/null; then
        print_success "主服务运行正常"
    else
        print_error "主服务健康检查失败"
        return 1
    fi

    # 检查认证服务
    if curl -f http://localhost:2233/health &> /dev/null; then
        print_success "认证服务运行正常"
        print_error "认证服务健康检查失败"
        return 1
    fi

    print_success "所有服务运行正常"
}

# ============================================
# 回滚功能
# ============================================

rollback() {
    print_header "回滚版本"

    if [ ! -d backups ] || [ ! -f backups/last_commit.txt ]; then
        print_error "未找到备份信息"
        exit 1
    fi

    LAST_COMMIT=$(cat backups/last_commit.txt)
    print_info "上一个版本: $LAST_COMMIT"

    read -p "确认回滚？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "取消回滚"
        exit 0
    fi

    # 回滚代码
    git reset --hard $LAST_COMMIT

    # 恢复 .env
    LATEST_ENV=$(ls -t backups/*.env 2>/dev/null | head -1)
    if [ -n "$LATEST_ENV" ]; then
        cp "$LATEST_ENV" .env
       fi

    # 重新编译
    npm run build
    npm run frontend:build

    # 重启服务
    restart_services

    print_success "回滚完成"
}

# ============================================
# 日志查看
# ============================================

show_logs() {
    if command -v pm2 &> /dev/null; then
     pm2 logs
    else
      "PM2 未安装"
    fi
}

# ============================================
# 信息显示
# ============================================

show_info() {
    echo ""
    print_success "Kiro Account Manager"
    echo ""
    print_info "访问地址:"
    print_info "  - 前端: http://localhost:1455"
    print_info "  - API: http://localhost:1455/api"
    print_info "  - 健康检查: http://localhost:1455/health"
    echo ""
    print_info "常用命令:"
    print_info "  - 查看状态: ./manage.sh status"
    print_info "  - 查看日志: ./manage.sh logs"
    print_info "  - 重启服务: ./manage.sh restart"
    print_info "  - 停止服务: ./manage.sh stop"
    echo ""
}

# ============================================
# 帮助信息
# ============================================

show_help() {
    echo "Kiro Account Manager - 统一管理脚本"
    echo ""
    echo "用法: ./manage.sh [命令]"
    echo ""
    echo "命令:"
    echo "  check      - 检查系统环境"
    echo "  deploy     - 首次部署（安装依赖、编译、启动）"
    echo "  update     - 更新项目（拉取代码、编译、重启）"
    echo "  start      - 启动服务"
    echo "  stop       - 停止服务"
    echo "  restart    - 重启服务"
    echo "  status     - 查看服务状态"
    echo "  logs       - 查看日志"
    echo "  health     - 健康检查"
    echo "  rollback   - 回滚到上一个版本"
    echo "  info       - 显示访问信息"
    echo "  help       - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./manage.sh check      # 检查环境"
    echo "  ./manage.sh deploy     # 首次部署"
    echo "  ./manage.sh update     # 更新项目"
    echo "  ./manage.sh restart    # 重启服务"
    echo ""
}

# ============================================
# 主函数
# ============================================

main() {
    case "${1:-help}" in
        check)
            check_environment
            ;;
        deploy)
            deploy
            ;;
        update)
            update
            ;;
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        health)
            health_check
            ;;
        rollback)
            rollback
            ;;
        info)
            show_info
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
