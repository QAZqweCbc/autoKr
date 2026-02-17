# Kiro Account Manager

Kiro 账号管理系统 - 自动化账号注册、管理和 Token 刷新平台

## 项目简介

Kiro Account Manager 是一个全栈账号管理系统，提供自动化账号注册、Token 管理、使用量监控等功能。系统采用前后端分离架构，支持多种存储方式，具备实时通信能力。

## 技术栈

### 后端
- **运行时**: Node.js + TypeScript
- **框架**: Express.js
- **实时通信**: Socket.IO
- **存储**: JSON / MySQL / Redis（可配置）
- **自动化**: Playwright（浏览器自动化）
- **邮件**: IMAP + Nodemailer
- **进程管理**: PM2

### 前端
- **框架**: Vue 3 + TypeScript
- **UI 组件**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router
- **图表**: ECharts
- **构建工具**: Vite

## 核心功能

### 1. 账号管理
- 自动注册账号
- 账号导入/导出
- 账号状态监控
- 批量操作支持

### 2. Token 管理
- 自动刷新 Token
- Token 分配与回收
- 使用量统计
- 过期监控

### 3. 任务系统
- 并发任务控制
- 任务队列管理
- 实时日志输出
- 任务统计分析

### 4. 配置管理
- 浏览器配置（支持 Chromium/Firefox/WebKit）
- 邮箱配置（QQ/Gmail/Outlook）
- 数据库配置
- 系统参数配置

### 5. 监控告警
- 健康检查
- 刷新日志
- 错误追踪
- 实时通知

## 项目结构

```
kiro-account-manager/
├── src/                      # 后端源码
│   ├── controllers/          # 控制器层
│   ├── services/             # 业务逻辑层
│   ├── models/               # 数据模型
│   ├── routes/               # 路由定义
│   ├── websocket/            # WebSocket 处理
│   ├── utils/                # 工具函数
│   ├── scripts/              # 脚本工具
│   ├── auth-service/         # 认证服务
│   └── index.ts              # 主入口
├── frontend/                 # 前端源码
│   ├── src/
│   │   ├── views/            # 页面组件
│   │   ├── components/       # 通用组件
│   │   ├── stores/           # 状态管理
│   │   ├── api/              # API 接口
│   │   ├── router/           # 路由配置
│   │   └── styles/           # 样式文件
│   └── package.json
├── data/                     # JSON 数据存储
├── logs/                     # 日志文件
├── dist/                     # 编译输出
├── ecosystem.config.js       # PM2 配置
├── package.json              # 项目配置
└── tsconfig.json             # TypeScript 配置
```

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- （可选）MySQL >= 8.0
- （可选）Redis >= 6.0

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
npm run frontend:install

# 安装 Playwright 浏览器
npx playwright install chromium
```

### 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置数据库等信息
```

### 开发模式

```bash
# 启动后端服务（开发模式）
npm run dev

# 启动认证服务（开发模式）
npm run dev:auth

# 同时启动两个服务
npm run dev:all

# 启动前端开发服务器
cd frontend && npm run dev
```

### 生产部署

```bash
# 1. 构建前端
npm run frontend:build

# 2. 编译后端
npm run build

# 3. 使用 PM2 启动服务
pm2 start ecosystem.config.js

# 4. 查看服务状态
pm2 status

# 5. 查看日志
pm2 logs
```

## 配置说明

### 数据库配置

系统支持三种存储方式，通过 `.env` 文件配置：

```env
# 存储类型: json | mysql | redis
DATABASE_STORAGE=json

# MySQL 配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=KrioServer

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
```

### 浏览器配置

在管理面板的"浏览器配置"页面设置：
- 浏览器类型（Chromium/Firefox/WebKit）
- 运行模式（Headless/Headed）
- 自定义浏览器路径
- 启动参数

### 邮箱配置

在管理面板的"邮箱配置"页面设置：
- QQ 邮箱授权码
- Gmail 配置
- Outlook 配置

## API 文档

### 健康检查
```
GET /api/health-basic          # 基础健康检查
GET /api/health/refresh        # 刷新健康状态
```

### 账号管理
```
GET    /api/accounts           # 获取账号列表
POST   /api/accounts/import    # 导入账号
POST   /api/accounts/export    # 导出账号
DELETE /api/accounts/:id       # 删除账号
POST   /api/accounts/:id/reset-error  # 重置错误状态
```

### 任务管理
```
GET  /api/tasks                # 获取任务列表
POST /api/tasks                # 创建任务
GET  /api/tasks/stats          # 任务统计
```

### Token 管理
```
GET  /api/tokens               # 获取 Token 列表
POST /api/tokens/refresh       # 刷新 Token
GET  /api/tokens/available     # 获取可用 Token
```

### 配置管理
```
GET  /api/config/browser       # 获取浏览器配置
PUT  /api/config/browser       # 更新浏览器配置
POST /api/config/browser/test  # 测试浏览器配置
```

## 脚本工具

```bash
# 初始化管理员账号
npm run init:admin

# 设置 SMTP 邮件服务
npm run setup:smtp

# 优化数据库
npm run optimize:db

# 迁移数据库配置
npm run migrate:db-config
```

## 开发指南

### 添加新功能

1. 在 `src/models/` 定义数据模型
2. 在 `src/services/` 实现业务逻辑
3. 在 `src/controllers/` 创建控制器
4. 在 `src/routes/` 注册路由
5. 在 `frontend/src/api/` 添加 API 调用
6. 在 `frontend/src/views/` 创建页面

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 async/await 处理异步操作
- 添加适当的错误处理和日志

### 测试

```bash
# 运行测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 故障排查

### 端口被占用
```bash
# 查看端口占用
lsof -i :3000

# 使用其他端口
PORT=8080 npm start
```

### 数据库连接失败
- 检查 `.env` 配置是否正确
- 确认数据库服务是否运行
- 验证网络连接和防火墙设置

### Playwright 错误
```bash
# 重新安装浏览器
npx playwright install chromium --force

# Linux 系统安装依赖
npx playwright install-deps
```

## 许可证

MIT License

## 作者

Kiro Team

## 贡献

欢迎提交 Issue 和 Pull Request！
