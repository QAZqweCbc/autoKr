#!/bin/bash

# Kiro Account Manager - 回滚脚本
# 用于回滚到上一个稳定版本

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

# 检查备份目录
check_backup() {
    if [ ! -d backups ]; then
        print_error "备份目录不存在"
        exit 1
    fi
    
    if [ ! -f backups/last_commit.txt ]; then
        print_error "未找到备份信息"
        exit 1
    fi
}

# 显示备份信息
show_backup_info() {
    print_header "可用的备份"
    
    LAST_COMMIT=$(cat backups/last_commit.txt)
    CURRENT_COMMIT=$(git rev-parse HEAD)
    
    echo "当前版本: $CURRENT_COMMIT"
    echo "备份版本: $LAST_COMMIT"
    echo ""
    
    # 显示可用的备份文件
    print_info "可用的备份文件:"
    ls -lh backups/backup_* 2>/dev/null || print_warning "未找到备份文件"
    echo ""
}

# 回滚代码
rollback_code() {
    print_header "回滚代码"
    
    LAST_COMMIT=$(cat backups/last_commit.txt)
    
    print_warning "即将回滚到: $LAST_COMMIT"
    read -p "是否继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "取消回滚"
        exit 0
    fi
    
    # 暂存当前更改
    if [ -n "$(git status --porcelain)" ]; then
        print_info "暂存当前更改..."
        git stash
    fi
    
    # 回滚到上一个提交
    print_info "回滚代码..."
    git reset --hard "$LAST_COMMIT"
    
    print_success "代码回滚完成"
}

# 恢复环境变量
restore_env() {
    print_header "恢复环境变量"
    
    # 查找最新的.env备份
    LATEST_ENV_BACKUP=$(ls -t backups/backup_*.env 2>/dev/null | head -1)
    
    if [ -n "$LATEST_ENV_BACKUP" ]; then
        print_info "找到.env备份: $LATEST_ENV_BACKUP"
        read -p "是否恢复.env文件？(y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp "$LATEST_ENV_BACKUP" .env
            print_success ".env文件已恢复"
        else
            print_info "跳过.env恢复"
        fi
    else
        print_warning "未找到.env备份"
    fi
}

# 恢复数据库
restore_database() {
    print_header "恢复数据库"
    
    # 查找最新的数据库备份
    LATEST_DB_BACKUP=$(ls -t backups/backup_*.sql.gz 2>/dev/null | head -1)
    
    if [ -n "$LATEST_DB_BACKUP" ]; then
        print_warning "找到数据库备份: $LATEST_DB_BACKUP"
        print_warning "⚠️  恢复数据库将覆盖当前数据！"
        read -p "是否恢复数据库？(y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [ -f .env ]; then
                source .env
                if [ "$STORAGE_MODE" = "mysql" ] && [ -n "$MYSQL_PASSWORD" ]; then
                    print_info "恢复MySQL数据库..."
                    gunzip < "$LATEST_DB_BACKUP" | mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"
                    print_success "数据库已恢复"
                else
                    print_warning "未配置MySQL，跳过数据库恢复"
                fi
            fi
        else
            print_info "跳过数据库恢复"
        fi
    else
        print_info "未找到数据库备份"
    fi
}

# 重新安装依赖
reinstall_dependencies() {
    print_header "重新安装依赖"
    
    print_info "安装后端依赖..."
    npm install
    
    print_info "安装前端依赖..."
    npm run frontend:install
    
    print_success "依赖安装完成"
}

# 重新编译
rebuild_project() {
    print_header "重新编译项目"
    
    print_info "编译后端..."
    npm run build
    
    print_info "编译前端..."
    npm run frontend:build
    
    print_success "项目编译完成"
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
    elif systemctl is-active --quiet kiro-main 2>/dev/null; then
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
        print_warning "请检查日志: pm2 logs kiro-main-service"
        exit 1
    fi
    
    # 检查认证服务
    print_info "检查认证服务..."
    if curl -f http://localhost:2233/health &> /dev/null; then
        print_success "认证服务运行正常"
    else
        print_error "认证服务健康检查失败"
        print_warning "请检查日志: pm2 logs kiro-auth-service"
        exit 1
    fi
    
    print_success "所有服务运行正常"
}

# 显示回滚信息
show_rollback_info() {
    print_header "回滚完成"
    
    CURRENT_COMMIT=$(git rev-parse HEAD)
    
    echo "当前版本: $CURRENT_COMMIT"
    echo ""
    
    print_success "回滚成功完成！"
    echo ""
    print_info "常用命令:"
    print_info "  - 查看服务状态: pm2 status"
    print_info "  - 查看日志: pm2 logs"
    print_info "  - 查看Git日志: git log --oneline -10"
    echo ""
    print_warning "如果问题仍然存在，请检查日志文件"
}

# 主函数
main() {
    print_header "Kiro Account Manager - 回滚脚本"
    
    # 检查
    check_backup
    show_backup_info
    
    # 确认回滚
    print_warning "即将回滚到上一个版本"
    print_warning "这将覆盖当前的代码和配置"
    read -p "是否继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "取消回滚"
        exit 0
    fi
    
    # 执行回滚流程
    rollback_code
    restore_env
    restore_database
    reinstall_dependencies
    rebuild_project
    restart_services
    health_check
    show_rollback_info
}

# 运行主函数
main
