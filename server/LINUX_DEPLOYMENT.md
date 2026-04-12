# 🐧 Linux 部署指南

## 系统要求

- Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- Node.js 18.0+
- MySQL 8.0+ (可选)
- Redis 6.0+ (可选)
- 至少 2GB RAM
- 至少 10GB 磁盘空间

---

## 1. 系统准备

### 1.1 更新系统

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 1.2 安装基础工具

```bash
# Ubuntu/Debian
sudo apt install -y curl wget git build-essential

# CentOS/RHEL
sudo yum install -y curl wget git gcc-c++ make
```

---

## 2. 安装 Node.js

### 方式1: 使用 NodeSource 仓库（推荐）

```bash
# Ubuntu/Debian - Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# CentOS/RHEL - Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version  # 应该显示 v18.x.x
npm --version   # 应该显示 9.x.x
```

### 方式2: 使用 nvm（推荐开发环境）

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载配置
source ~/.bashrc

# 安装 Node.js 18
nvm install 18
nvm use 18
nvm alias default 18

# 验证
node --version
```

---

## 3. 安装 MySQL（可选）

### Ubuntu/Debian

```bash
# 安装 MySQL
sudo apt install -y mysql-server

# 启动 MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全配置
sudo mysql_secure_installation

# 创建数据库和用户
sudo mysql -u root -p
```

### CentOS/RHEL

```bash
# 安装 MySQL
sudo yum install -y mysql-server

# 启动 MySQL
sudo systemctl start mysqld
sudo systemctl enable mysqld

# 获取临时密码
sudo grep 'temporary password' /var/log/mysqld.log

# 安全配置
sudo mysql_secure_installation
```

### MySQL 配置

```sql
-- 登录 MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE KrioServer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（替换密码）
CREATE USER 'kiro'@'localhost' IDENTIFIED BY 'your_strong_password';

-- 授权
GRANT ALL PRIVILEGES ON KrioServer.* TO 'kiro'@'localhost';
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

---

## 4. 安装 Redis（可选）

### Ubuntu/Debian

```bash
# 安装 Redis
sudo apt install -y redis-server

# 启动 Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 测试
redis-cli ping  # 应该返回 PONG
```

### CentOS/RHEL

```bash
# 安装 Redis
sudo yum install -y redis

# 启动 Redis
sudo systemctl start redis
sudo systemctl enable redis

# 测试
redis-cli ping
```

---

## 5. 克隆项目

```bash
# 创建项目目录
sudo mkdir -p /opt/kiro-account-manager
sudo chown $USER:$USER /opt/kiro-account-manager

# 克隆项目
cd /opt/kiro-account-manager
git clone https://github.com/QAZqweCbc/autoKr.git .

# 或者从本地上传
# scp -r /path/to/project user@server:/opt/kiro-account-manager/
```

---

## 6. 安装依赖

```bash
cd /opt/kiro-account-manager

# 安装后端依赖
npm install

# 安装前端依赖
npm run frontend:install

# 安装 Playwright 浏览器
npx playwright install chromium

# 安装 Playwright 系统依赖（重要！）
npx playwright install-deps chromium
```

---

## 7. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
nano .env  # 或使用 vim
```

### 必需配置项

```bash
# 服务端口
PORT=3000
AUTH_PORT=2233

# 环境
NODE_ENV=production

# 安全配置（必须修改！）
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
MAIN_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ADMIN_PASSWORD=your_secure_password_here

# 数据库配置
STORAGE_MODE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=kiro
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=KrioServer

# 邮箱配置
QQ_EMAIL=your-email@qq.com
QQ_AUTH_CODE=your-qq-auth-code
EMAIL_DOMAINS=example.com
```

### 快速生成密钥

```bash
# 生成 JWT_SECRET
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env

# 生成 MAIN_API_KEY
echo "MAIN_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env
```

---

## 8. 编译项目

```bash
# 编译后端
npm run build

# 编译前端
npm run frontend:build
```

---

## 9. 初始化数据库

```bash
# 初始化管理员账号
npm run init:admin

# 记录显示的管理员密码！
```

---

## 10. 安装 PM2（进程管理器）

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 验证安装
pm2 --version
```

---

## 11. 启动服务

### 方式1: 使用 PM2（推荐）

```bash
# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 执行输出的命令（通常是 sudo 开头的命令）
```

### 方式2: 使用 systemd

创建服务文件：

```bash
# 创建主服务
sudo nano /etc/systemd/system/kiro-main.service
```

```ini
[Unit]
Description=Kiro Account Manager - Main Service
After=network.target mysql.service

[Service]
Type=simple
User=your_username
WorkingDirectory=/opt/kiro-account-manager
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/kiro-account-manager/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 创建认证服务
sudo nano /etc/systemd/system/kiro-auth.service
```

```ini
[Unit]
Description=Kiro Account Manager - Auth Service
After=network.target mysql.service

[Service]
Type=simple
User=your_username
WorkingDirectory=/opt/kiro-account-manager
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/kiro-account-manager/dist/auth-service/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 重载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start kiro-main
sudo systemctl start kiro-auth

# 设置开机自启
sudo systemctl enable kiro-main
sudo systemctl enable kiro-auth

# 查看状态
sudo systemctl status kiro-main
sudo systemctl status kiro-auth

# 查看日志
sudo journalctl -u kiro-main -f
sudo journalctl -u kiro-auth -f
```

---

## 12. 配置 Nginx 反向代理（推荐）

### 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 配置反向代理

```bash
# 创建配置文件
sudo nano /etc/nginx/sites-available/kiro
```

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    # 前端静态文件
    location / {
        root /opt/kiro-account-manager/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 支持
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/kiro /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

## 13. 配置 SSL/HTTPS（推荐）

### 使用 Let's Encrypt（免费）

```bash
# 安装 Certbot
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 14. 配置防火墙

### UFW (Ubuntu/Debian)

```bash
# 启用 UFW
sudo ufw enable

# 允许 SSH
sudo ufw allow 22/tcp

# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 查看状态
sudo ufw status
```

### firewalld (CentOS/RHEL)

```bash
# 启动 firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# 允许 HTTP/HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# 重载配置
sudo firewall-cmd --reload

# 查看状态
sudo firewall-cmd --list-all
```

---

## 15. 验证部署

```bash
# 检查服务状态
pm2 status
# 或
sudo systemctl status kiro-main
sudo systemctl status kiro-auth

# 测试健康检查
curl http://localhost:3000/health

# 测试 API
curl http://localhost:3000/api/health-basic

# 测试前端（如果配置了 Nginx）
curl http://your-domain.com
```

---

## 16. 日志管理

### PM2 日志

```bash
# 查看所有日志
pm2 logs

# 查看特定服务日志
pm2 logs kiro-main
pm2 logs kiro-auth

# 清空日志
pm2 flush

# 日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 应用日志

```bash
# 查看应用日志
tail -f /opt/kiro-account-manager/logs/main-out.log
tail -f /opt/kiro-account-manager/logs/auth-out.log
tail -f /opt/kiro-account-manager/logs/main-error.log
tail -f /opt/kiro-account-manager/logs/auth-error.log
```

---

## 17. 备份策略

### 数据库备份

```bash
# 创建备份脚本
sudo nano /opt/kiro-account-manager/scripts/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/kiro"
DATE=$(date +%Y%m%d_%H%M%S)
MYSQL_USER="kiro"
MYSQL_PASSWORD="your_mysql_password"
MYSQL_DATABASE="KrioServer"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE | gzip > $BACKUP_DIR/kiro_$DATE.sql.gz

# 删除7天前的备份
find $BACKUP_DIR -name "kiro_*.sql.gz" -mtime +7 -delete

echo "Backup completed: kiro_$DATE.sql.gz"
```

```bash
# 设置执行权限
chmod +x /opt/kiro-account-manager/scripts/backup-db.sh

# 添加到 crontab（每天凌晨2点备份）
crontab -e
```

```cron
0 2 * * * /opt/kiro-account-manager/scripts/backup-db.sh >> /var/log/kiro-backup.log 2>&1
```

---

## 18. 监控和告警

### 使用 PM2 监控

```bash
# 安装 PM2 监控
pm2 install pm2-server-monit

# 查看监控
pm2 monit
```

### 系统资源监控

```bash
# 安装 htop
sudo apt install -y htop  # Ubuntu/Debian
sudo yum install -y htop  # CentOS/RHEL

# 运行
htop
```

---

## 19. 常见问题排查

### 服务无法启动

```bash
# 检查端口占用
sudo netstat -tlnp | grep 3000
sudo netstat -tlnp | grep 2233

# 检查日志
pm2 logs --err
tail -f logs/main-error.log

# 检查权限
ls -la /opt/kiro-account-manager
```

### 数据库连接失败

```bash
# 测试 MySQL 连接
mysql -u kiro -p -h localhost KrioServer

# 检查 MySQL 状态
sudo systemctl status mysql

# 查看 MySQL 日志
sudo tail -f /var/log/mysql/error.log
```

### Playwright 浏览器错误

```bash
# 重新安装浏览器
npx playwright install chromium --force

# 安装系统依赖
npx playwright install-deps chromium

# 检查是否缺少库
ldd ~/.cache/ms-playwright/chromium-*/chrome-linux/chrome
```

---

## 20. 更新部署

### 方式1: 使用自动更新脚本（推荐）

```bash
# 进入项目目录
cd /opt/kiro-account-manager

# 给脚本添加执行权限（首次使用）
chmod +x update.sh rollback.sh

# 执行更新
./update.sh
```

**更新脚本会自动执行以下操作：**
- ✅ 备份当前版本（代码、.env、数据库）
- ✅ 拉取最新代码
- ✅ 更新依赖（仅当package.json有变化）
- ✅ 重新编译项目
- ✅ 执行数据库迁移（如果需要）
- ✅ 重启服务
- ✅ 健康检查
- ✅ 清理旧备份（保留7天）

**如果更新失败，可以快速回滚：**

```bash
# 回滚到上一个版本
./rollback.sh
```

### 方式2: 手动更新

```bash
# 进入项目目录
cd /opt/kiro-account-manager

# 备份当前版本
git rev-parse HEAD > backups/last_commit.txt
cp .env backups/backup_$(date +%Y%m%d_%H%M%S).env

# 拉取最新代码
git pull

# 安装新依赖
npm install
npm run frontend:install

# 重新编译
npm run build
npm run frontend:build

# 重启服务
pm2 restart all
# 或
sudo systemctl restart kiro-main
sudo systemctl restart kiro-auth

# 健康检查
curl http://localhost:3000/health
curl http://localhost:2233/health
```

### 回滚到上一个版本

如果更新后出现问题，可以使用回滚脚本：

```bash
# 执行回滚
./rollback.sh
```

**回滚脚本会自动执行以下操作：**
- ✅ 显示可用的备份信息
- ✅ 回滚代码到上一个版本
- ✅ 恢复.env文件
- ✅ 恢复数据库（可选）
- ✅ 重新安装依赖
- ✅ 重新编译项目
- ✅ 重启服务
- ✅ 健康检查

### 手动回滚

```bash
# 查看备份的提交
cat backups/last_commit.txt

# 回滚到指定提交
git reset --hard <commit-hash>

# 重新安装依赖和编译
npm install
npm run frontend:install
npm run build
npm run frontend:build

# 重启服务
pm2 restart all
```

---

## 21. 卸载

```bash
# 停止服务
pm2 stop all
pm2 delete all
# 或
sudo systemctl stop kiro-main kiro-auth
sudo systemctl disable kiro-main kiro-auth

# 删除服务文件（如果使用 systemd）
sudo rm /etc/systemd/system/kiro-*.service
sudo systemctl daemon-reload

# 删除项目文件
sudo rm -rf /opt/kiro-account-manager

# 删除数据库（可选）
mysql -u root -p -e "DROP DATABASE KrioServer; DROP USER 'kiro'@'localhost';"

# 删除 Nginx 配置（可选）
sudo rm /etc/nginx/sites-enabled/kiro
sudo rm /etc/nginx/sites-available/kiro
sudo systemctl reload nginx
```

---

## 📋 快速部署脚本

项目已包含完整的自动化部署脚本：

### 1. 首次部署

```bash
# 给脚本添加执行权限
chmod +x deploy.sh update.sh rollback.sh

# 执行部署
./deploy.sh
```

**部署脚本功能：**
- ✅ 自动检测操作系统
- ✅ 检查Node.js和MySQL环境
- ✅ 安装所有依赖（包括Playwright）
- ✅ 配置环境变量（自动生成安全密钥）
- ✅ 编译前后端项目
- ✅ 初始化数据库和管理员账号
- ✅ 安装和配置PM2
- ✅ 启动服务并设置开机自启
- ✅ 显示部署状态和访问信息

### 2. 更新部署

```bash
# 更新到最新版本
./update.sh
```

### 3. 回滚版本

```bash
# 如果更新出现问题，回滚到上一个版本
./rollback.sh
```

**脚本特点：**
- 🎨 彩色输出，清晰易读
- 🔒 安全检查，防止误操作
- 💾 自动备份，支持快速回滚
- 🏥 健康检查，确保服务正常
- 📝 详细日志，便于排查问题

---

## 🎯 生产环境检查清单

- [ ] Node.js 18+ 已安装
- [ ] MySQL/Redis 已安装并配置
- [ ] 项目已克隆到服务器
- [ ] 依赖已安装
- [ ] .env 文件已配置
- [ ] JWT_SECRET 已设置（强密钥）
- [ ] MAIN_API_KEY 已设置（强密钥）
- [ ] 数据库已创建并授权
- [ ] 项目已编译
- [ ] 管理员账号已初始化
- [ ] PM2 已安装并配置
- [ ] 服务已启动
- [ ] Nginx 已配置（可选）
- [ ] SSL 证书已配置（可选）
- [ ] 防火墙已配置
- [ ] 备份策略已实施
- [ ] 监控已配置

---

**部署完成后，访问**: `http://your-server-ip:3000` 或 `http://your-domain.com`

**需要帮助？** 查看 [QUICK_START.md](QUICK_START.md) 或 [README.md](README.md)
