# 🚀 快速启动指南

## 前置要求

- Node.js >= 18.0.0
- MySQL >= 8.0 (可选，也可使用 JSON 存储)
- Redis >= 6.0 (可选)

## 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
npm run frontend:install

# 安装 Playwright 浏览器
npx playwright install chromium
```

## 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
# 必须配置的项目：
# - JWT_SECRET (生成: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
# - MAIN_API_KEY (生成: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
# - MYSQL_* (如果使用 MySQL)
# - QQ_EMAIL, QQ_AUTH_CODE (邮箱配置)
```

## 3. 启动服务

### 开发模式

```bash
# 方式1: 同时启动主服务和认证服务
npm run dev:all

# 方式2: 分别启动
# 终端1: 启动主服务
npm run dev

# 终端2: 启动认证服务
npm run dev:auth

# 终端3: 启动前端开发服务器
cd frontend && npm run dev
```

### 生产模式

```bash
# 1. 构建前端
npm run frontend:build

# 2. 编译后端
npm run build

# 3. 使用 PM2 启动
pm2 start ecosystem.config.js

# 4. 查看服务状态
pm2 status

# 5. 查看日志
pm2 logs
```

## 4. 访问应用

- **前端界面**: http://localhost:5173 (开发) 或 http://localhost:3000 (生产)
- **主服务 API**: http://localhost:3000/api
- **认证服务 API**: http://localhost:2233/api/auth
- **健康检查**: http://localhost:3000/health

## 5. 首次使用

### 5.1 初始化管理员账号

```bash
npm run init:admin
```

### 5.2 配置邮箱

1. 访问前端界面
2. 登录管理员账号
3. 进入"邮箱配置"页面
4. 配置 QQ 邮箱授权码

### 5.3 配置浏览器

1. 进入"浏览器配置"页面
2. 选择浏览器类型（Chromium/Firefox）
3. 配置启动参数
4. 测试配置

## 6. 创建注册任务

### 方式1: 通过前端界面

1. 进入"任务管理"页面
2. 点击"创建任务"
3. 填写邮箱、密码等信息
4. 提交任务
5. 查看实时日志

### 方式2: 通过 API

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "YourPassword123",
    "receive_email": "your-qq@qq.com",
    "auth_code": "your-qq-auth-code"
  }'
```

## 7. 查看注册日志

### 通过 API

```bash
# 获取最近10条注册日志
curl http://localhost:3000/api/registration/logs/recent?limit=10

# 获取注册统计
curl http://localhost:3000/api/registration/stats

# 查询特定邮箱的注册日志
curl http://localhost:3000/api/registration/logs?email=test@example.com
```

### 通过数据库

```sql
-- 查看最近的注册日志
SELECT * FROM registration_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- 查看注册统计
SELECT 
  status,
  COUNT(*) as count,
  AVG(duration) as avg_duration
FROM registration_logs
GROUP BY status;
```

## 8. Token 刷新

### 自动刷新

系统会自动刷新 Token，无需手动操作。

### 手动刷新

```bash
# 刷新单个账号
curl -X POST http://localhost:3000/api/token/{account_id}/refresh

# 批量刷新所有账号
curl -X POST http://localhost:3000/api/token/refresh-all
```

## 9. 常见问题

### 端口被占用

```bash
# 查看端口占用
netstat -ano | findstr :3000

# 修改端口
# 编辑 .env 文件
PORT=8080
AUTH_PORT=2234
```

### 数据库连接失败

1. 检查 MySQL 服务是否运行
2. 检查 `.env` 中的数据库配置
3. 确认数据库用户有创建数据库的权限

### Playwright 错误

```bash
# 重新安装浏览器
npx playwright install chromium --force

# Windows 系统可能需要安装 Visual C++ Redistributable
```

### 邮箱授权码错误

1. 确认已开启 QQ 邮箱的 SMTP 服务
2. 使用授权码而不是邮箱密码
3. 检查授权码是否正确（16位）

## 10. 停止服务

### 开发模式

按 `Ctrl+C` 停止服务

### 生产模式

```bash
# 停止所有服务
pm2 stop all

# 停止特定服务
pm2 stop kiro-main
pm2 stop kiro-auth

# 删除服务
pm2 delete all
```

## 11. 日志查看

### 开发模式

日志直接输出到控制台

### 生产模式

```bash
# PM2 日志
pm2 logs

# 应用日志
tail -f logs/main-out.log
tail -f logs/auth-out.log
tail -f logs/main-error.log
tail -f logs/auth-error.log
```

## 12. 数据备份

### 备份数据库

```bash
# MySQL
mysqldump -u root -p KrioServer > backup.sql

# 恢复
mysql -u root -p KrioServer < backup.sql
```

### 备份 JSON 数据

```bash
# 复制 data 目录
cp -r data data_backup_$(date +%Y%m%d)
```

## 13. 更新项目

```bash
# 拉取最新代码
git pull

# 安装新依赖
npm install
cd frontend && npm install

# 重新编译
npm run build
npm run frontend:build

# 重启服务
pm2 restart all
```

## 14. 性能优化

### 调整并发数

```bash
# 编辑 src/services/register.service.ts
# 修改 MAX_CONCURRENT 变量
let MAX_CONCURRENT = 3  // 改为 5 或更高
```

### 数据库优化

```bash
npm run optimize:db
```

### 清理旧日志

```sql
-- 删除30天前的注册日志
DELETE FROM registration_logs 
WHERE created_at < UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 30 DAY)) * 1000;

-- 删除旧的刷新日志
DELETE FROM refresh_logs 
WHERE created_at < UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY)) * 1000;
```

## 15. 监控和告警

### 健康检查

```bash
# 基础健康检查
curl http://localhost:3000/health-basic

# 详细健康检查
curl http://localhost:3000/health

# 指标监控
curl http://localhost:3000/metrics
```

### 设置告警

可以使用 PM2 的监控功能或第三方监控服务（如 Prometheus + Grafana）

## 16. 安全建议

1. **定期更换密钥**
   ```bash
   # 生成新的 JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **限制 API 访问**
   - 配置防火墙规则
   - 使用 Nginx 反向代理
   - 启用 HTTPS

3. **定期备份数据**
   - 设置自动备份脚本
   - 异地备份

4. **监控异常登录**
   - 查看审计日志
   - 设置告警规则

## 17. 故障排查

### 查看错误日志

```bash
# 后端错误
tail -f logs/main-error.log
tail -f logs/auth-error.log

# PM2 错误
pm2 logs --err
```

### 检查数据库连接

```bash
# 测试 MySQL 连接
mysql -u root -p -h localhost -P 3306 -e "SELECT 1"
```

### 检查端口监听

```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :2233

# Linux
netstat -tlnp | grep 3000
netstat -tlnp | grep 2233
```

## 18. 开发调试

### 启用调试模式

```bash
# 设置环境变量
NODE_ENV=development
LOG_LEVEL=debug

# 启动服务
npm run dev
```

### 使用 VS Code 调试

1. 打开 VS Code
2. 按 F5 启动调试
3. 设置断点
4. 查看变量

## 需要帮助？

- 查看 `PROJECT_STATUS.md` 了解项目状态
- 查看 `README.md` 了解详细文档
- 查看源代码注释
- 提交 Issue

---

**祝你使用愉快！** 🎉
