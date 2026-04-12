# 🚀 部署快速参考

## 一键部署脚本

### 首次部署
```bash
chmod +x deploy.sh update.sh rollback.sh
./deploy.sh
```

### 更新部署
```bash
./update.sh
```

### 回滚版本
```bash
./rollback.sh
```

---

## 常用命令

### PM2 进程管理

```bash
# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs                    # 所有服务
pm2 logs kiro-main-service  # 主服务
pm2 logs kiro-auth-service  # 认证服务

# 重启服务
pm2 restart all             # 重启所有
pm2 restart kiro-main-service  # 重启主服务

# 停止服务
pm2 stop all                # 停止所有
pm2 stop kiro-main-service  # 停止主服务

# 删除服务
pm2 delete all              # 删除所有
pm2 delete kiro-main-service  # 删除主服务

# 保存配置
pm2 save

# 开机自启
pm2 startup
# 执行输出的命令（通常是 sudo 开头）

# 清空日志
pm2 flush

# 监控
pm2 monit
```

### systemd 服务管理

```bash
# 启动服务
sudo systemctl start kiro-main
sudo systemctl start kiro-auth

# 停止服务
sudo systemctl stop kiro-main
sudo systemctl stop kiro-auth

# 重启服务
sudo systemctl restart kiro-main
sudo systemctl restart kiro-auth

# 查看状态
sudo systemctl status kiro-main
sudo systemctl status kiro-auth

# 开机自启
sudo systemctl enable kiro-main
sudo systemctl enable kiro-auth

# 禁用自启
sudo systemctl disable kiro-main
sudo systemctl disable kiro-auth

# 查看日志
sudo journalctl -u kiro-main -f
sudo journalctl -u kiro-auth -f
```

### Git 操作

```bash
# 查看状态
git status

# 拉取更新
git pull

# 查看提交历史
git log --oneline -10

# 回滚到指定版本
git reset --hard <commit-hash>

# 暂存更改
git stash

# 恢复暂存
git stash pop

# 查看远程仓库
git remote -v
```

### NPM 操作

```bash
# 安装依赖
npm install                 # 后端依赖
npm run frontend:install    # 前端依赖

# 编译项目
npm run build               # 编译后端
npm run frontend:build      # 编译前端
npm run build:all           # 编译全部

# 初始化
npm run init:admin          # 创建管理员账号

# 开发模式
npm run dev                 # 启动后端开发服务器
npm run dev:auth            # 启动认证服务开发服务器
npm run dev:all             # 启动所有开发服务器
```

### 数据库操作

```bash
# 登录 MySQL
mysql -u kiro -p

# 备份数据库
mysqldump -u kiro -p KrioServer > backup.sql
mysqldump -u kiro -p KrioServer | gzip > backup.sql.gz

# 恢复数据库
mysql -u kiro -p KrioServer < backup.sql
gunzip < backup.sql.gz | mysql -u kiro -p KrioServer

# 查看数据库
mysql -u kiro -p -e "SHOW DATABASES;"
mysql -u kiro -p -e "USE KrioServer; SHOW TABLES;"
```

### Nginx 操作

```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo nginx -s reload
sudo systemctl reload nginx

# 重启 Nginx
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx

# 查看日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 健康检查

```bash
# 检查主服务
curl http://localhost:3000/health

# 检查认证服务
curl http://localhost:2233/health

# 检查API
curl http://localhost:3000/api/health-basic

# 检查端口占用
sudo netstat -tlnp | grep 3000
sudo netstat -tlnp | grep 2233

# 检查进程
ps aux | grep node
```

### 日志查看

```bash
# PM2 日志
pm2 logs
pm2 logs --lines 100

# 应用日志
tail -f logs/main-out.log
tail -f logs/main-error.log
tail -f logs/auth-out.log
tail -f logs/auth-error.log
tail -f logs/combined.log

# 系统日志
sudo journalctl -u kiro-main -f
sudo journalctl -u kiro-auth -f
```

### 防火墙操作

#### UFW (Ubuntu/Debian)
```bash
# 启用防火墙
sudo ufw enable

# 允许端口
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS

# 查看状态
sudo ufw status

# 删除规则
sudo ufw delete allow 80/tcp
```

#### firewalld (CentOS/RHEL)
```bash
# 启动防火墙
sudo systemctl start firewalld

# 允许服务
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# 重载配置
sudo firewall-cmd --reload

# 查看状态
sudo firewall-cmd --list-all
```

### SSL 证书（Let's Encrypt）

```bash
# 获取证书
sudo certbot --nginx -d your-domain.com

# 续期证书
sudo certbot renew

# 测试续期
sudo certbot renew --dry-run

# 查看证书
sudo certbot certificates
```

---

## 环境变量配置

### 必需配置项

```bash
# 安全配置（必须修改！）
JWT_SECRET=<生成的密钥>
MAIN_API_KEY=<生成的密钥>
ADMIN_PASSWORD=<强密码>

# 数据库配置
STORAGE_MODE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=kiro
MYSQL_PASSWORD=<数据库密码>
MYSQL_DATABASE=KrioServer

# 邮箱配置
QQ_EMAIL=your-email@qq.com
QQ_AUTH_CODE=<QQ授权码>
EMAIL_DOMAINS=example.com
```

### 生成安全密钥

```bash
# 生成 JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 生成 MAIN_API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 故障排查

### 服务无法启动

```bash
# 1. 检查端口占用
sudo netstat -tlnp | grep 3000
sudo netstat -tlnp | grep 2233

# 2. 检查日志
pm2 logs --err
tail -f logs/main-error.log

# 3. 检查环境变量
cat .env | grep -E "JWT_SECRET|MAIN_API_KEY|ADMIN_PASSWORD"

# 4. 检查权限
ls -la /opt/kiro-account-manager
```

### 数据库连接失败

```bash
# 1. 测试连接
mysql -u kiro -p -h localhost KrioServer

# 2. 检查 MySQL 状态
sudo systemctl status mysql

# 3. 查看 MySQL 日志
sudo tail -f /var/log/mysql/error.log

# 4. 检查用户权限
mysql -u root -p -e "SELECT user, host FROM mysql.user WHERE user='kiro';"
```

### Playwright 浏览器错误

```bash
# 1. 重新安装浏览器
npx playwright install chromium --force

# 2. 安装系统依赖
npx playwright install-deps chromium

# 3. 检查缺少的库
ldd ~/.cache/ms-playwright/chromium-*/chrome-linux/chrome

# 4. 手动安装依赖（Ubuntu）
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

### 前端无法访问

```bash
# 1. 检查前端是否编译
ls -la frontend/dist

# 2. 重新编译前端
npm run frontend:build

# 3. 检查 Nginx 配置
sudo nginx -t
sudo systemctl status nginx

# 4. 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

---

## 性能优化

### PM2 集群模式

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'kiro-main-service',
    script: './dist/index.js',
    instances: 'max',  // 使用所有CPU核心
    exec_mode: 'cluster',
    max_memory_restart: '500M'
  }]
}
```

### 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_user_id ON accounts(user_id);
CREATE INDEX idx_email ON accounts(email);
CREATE INDEX idx_created_at ON accounts(created_at);

-- 查看慢查询
SHOW VARIABLES LIKE 'slow_query_log';
SET GLOBAL slow_query_log = 'ON';
```

### Nginx 缓存

```nginx
# 静态文件缓存
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Gzip 压缩
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

---

## 监控和告警

### 系统资源监控

```bash
# CPU和内存
htop

# 磁盘使用
df -h

# 磁盘IO
iostat -x 1

# 网络流量
iftop
```

### PM2 监控

```bash
# 实时监控
pm2 monit

# 安装监控模块
pm2 install pm2-server-monit

# 日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 备份策略

### 自动备份脚本

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/kiro"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u kiro -p'password' KrioServer | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 备份配置文件
cp /opt/kiro-account-manager/.env $BACKUP_DIR/env_$DATE

# 删除7天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### 添加到 crontab

```bash
# 编辑 crontab
crontab -e

# 每天凌晨2点备份
0 2 * * * /opt/kiro-account-manager/scripts/backup.sh >> /var/log/kiro-backup.log 2>&1
```

---

## 安全检查清单

- [ ] JWT_SECRET 已设置为强密钥（32字节以上）
- [ ] MAIN_API_KEY 已设置为强密钥（32字节以上）
- [ ] ADMIN_PASSWORD 已设置为强密码（8位以上，包含字母数字）
- [ ] 数据库密码已修改（不使用默认密码）
- [ ] 防火墙已配置（只开放必要端口）
- [ ] SSL 证书已配置（生产环境必须）
- [ ] 定期备份已配置
- [ ] 日志轮转已配置
- [ ] 监控告警已配置
- [ ] .env 文件权限正确（600）

```bash
# 设置 .env 文件权限
chmod 600 .env
```

---

## 快速链接

- [完整部署指南](LINUX_DEPLOYMENT.md)
- [快速开始](QUICK_START.md)
- [安全审计报告](SECURITY_AUDIT.md)
- [项目状态](PROJECT_STATUS.md)

---

**需要帮助？** 查看日志文件或联系技术支持。
