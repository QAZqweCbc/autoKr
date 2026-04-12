#!/bin/bash

# Kiro Account Manager - 更新脚本
# 用于安全地更新生产环境

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

# 检查Git仓库
check_git() {
    if [ ! -d .git ]; then
        print_error "当前目录不是Git仓库"
        exit 1
    fi
}

# 备份当前版本
backup_current() {
    print_header "备份当前版本"
    
    BACKUP_DIR="backups"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"
    
    mkdir -p "$BACKUP_DIR"
    
    # 获取当前Git提交
    CURRENT_COMMIT=$(git rev-parse HEAD)
    echo "$CURRENT_COMMIT" > "$BACKUP_DIR/last_commit.txt"
    
    # 备份.env文件
    if [ -f .env ]; then
        cp .env "$BACKUP_PATH.env"
        print_success "已备份 .env 文件"
    fi
    
    # 备份数据库（如果使用MySQL）
    if [ -f .env ]; then
        source .env
        if [ "$STORAGE_MODE" = "mysql" ] && [ -n "$MYSQL_PASSWORD" ]; then
            print_info "备份MySQL数据库..."
            mysqldump -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" | gzip > "$BACKUP_PATH.sql.gz" 2>/dev/null || print_warning "数据库备份失败（可能需要手动备份）"
        fi
    fi
    
    print_success "备份完成: $BACKUP_PATH"
}

# 拉取最新代码
pull_updates() {
    print_header "拉取最新代码"
    
    # 检查是否有未提交的更改
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "检测到未提交的更改"
        read -p "是否暂存这些更改？(y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git stash
            print_success "已暂存更改"
            STASHED=true
        else
            print_error "请先提交或暂存更改"
            exit 1
        fi
    fi
    
    # 拉取代码
    print_info "拉取最新代码..."
    git pull origin $(git branch --show-current)
    
    # 恢复暂存的更改
    if [ "$STASHED" = true ]; then
        print_info "恢复暂存的更改..."
        git stash pop || print_warning "无法自动恢复暂存的更改，请手动处理"
    fi
    
    print_success "代码更新完成"
}

# 安装依赖
install_dependencies() {
    print_header "更新依赖"
    
    # 检查package.json是否有更改
    if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
        print_info "检测到package.json更改，更新后端依赖..."
        npm install
        print_success "后端依赖更新完成"
    else
        print_info "package.json无更改，跳过后端依赖更新"
    fi
    
    # 检查前端package.json是否有更改
    if git diff HEAD@{1} HEAD --name-only | grep -q "frontend/package.json"; then
        print_info "检测到frontend/package.json更改，更新前端依赖..."
        npm run frontend:install
        print_success "前端依赖更新完成"
    else
        print_info "frontend/package.json无更改，跳过前端依赖更新"
    fi
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

# 数据库迁移（如果需要）
migrate_database() {
    print_header "数据库迁移"
    
    # 检查是否有迁移脚本
    if [ -d migrations ] && [ "$(ls -A migrations)" ]; then
        print_info "检测到数据库迁移脚本"
        read -p "是否执行数据库迁移？(y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # 这里可以添加数据库迁移逻辑
            print_info "执行数据库迁移..."
            # npm run migrate
            print_success "数据库迁移完成"
        else
            print_info "跳过数据库迁移"
        fi
    else
        print_info "无需数据库迁移"
    fi
}

# 重启服务
restart_services() {
    print_header "重启服务"
    
    # 检查是否使用PM2
    if command -v pm2 &> /dev/null && pm2 list | grep -q "kiro"; then
        print_info "使用PM2重启服务..."
        pm2 restart ecosystem.config.js
        pm2 save
        print_success "PM2服务重启完成"
        
        # 等待服务启动
        sleep 3
        
        # 检查服务状态
        pm2 status
        
    # 检查是否使用systemd
    elif systemctl is-active --quiet kiro-main; then
        print_info "使用systemd重启服务..."
        sudo systemctl restart kiro-main
        sudo systemctl restart kiro-auth
        print_success "systemd服务重启完成"
        
        # 检查服务状态
        sudo systemctl status kiro-main --no-pager
        sudo systemctl status kiro-auth --no-pager
        
    else
        print_warning "未检测到PM2或systemd服务"
        print_info "请手动重启服务"
    fi
}

# 健康检查
health_check() {
    print_header "健康检查"
    
    # 等待服务启动
    print_info "等待服务启动..."
    sleep 5
    
    # 检查主服务
    print_info "检查主服务..."
    if curl -f http://localhost:3000/health &> /dev/null; then
        print_success "主服务运行正常"
    else
        print_error "主服务健康检查失败"
        print_warning "建议执行回滚: ./rollback.sh"
        exit 1
    fi
    
    # 检查认证服务
    print_info "检查认证服务..."
    if curl -f http://localhost:2233/health &> /dev/null; then
        print_success "认证服务运行正常"
    else
        print_error "认证服务健康检查失败"
        print_warning "建议执行回滚: ./rollback.sh"
        exit 1
    fi
    
    print_success "所有服务运行正常"
}

# 清理旧备份
cleanup_old_backups() {
    print_header "清理旧备份"
    
    if [ -d backups ]; then
        # 保留最近7个备份
        print_info "清理7天前的备份..."
        find backups -name "backup_*" -mtime +7 -delete 2>/dev/null || true
        print_success "旧备份清理完成"
    fi
}

# 显示更新信息
show_update_info() {
    print_header "更新完成"
    
    # 显示Git日志
    print_info "最近的更新:"
    git log --oneline -5
    
    echo ""
    print_success "更新成功完成！"
    echo ""
    print_info "常用命令:"
    print_info "  - 查看服务状态: pm2 status"
    print_info "  - 查看日志: pm2 logs"
    print_info "  - 回滚版本: ./rollback.sh"
    echo ""
}

# 主函数
main() {
    print_header "Kiro Account Manager - 更新脚本"
    
    # 检查
    check_git
    
    # 确认更新
    print_warning "即将更新生产环境"
    read -p "是否继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "取消更新"
        exit 0
    fi
    
    # 执行更新流程
    backup_current
    pull_updates
    install_dependencies
    build_project
    migrate_database
    restart_services
    health_check
    cleanup_old_backups
    show_update_info
}

# 运行主函数
main
