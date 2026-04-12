# 🚀 Kiro Account Manager

自动化账号管理系统 - 支持AWS账号自动注册、Token管理、邮箱验证等功能。

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ 主要特性

### 🔐 账号管理
- ✅ AWS账号自动注册
- ✅ 多账号批量管理
- ✅ 账号状态实时监控
- ✅ 账号导入/导出功能

### 🎫 Token管理
- ✅ 自动刷新Token（三层策略）
- ✅ Token过期监控
- ✅ 批量Token更新
- ✅ Token安全存储

### 📧 邮箱系统
- ✅ QQ邮箱自动验证
- ✅ Gmail支持
- ✅ 验证码自动提取
- ✅ 邮件实时监控

### 🎨 现代化界面
- ✅ Vue 3 + TypeScript
- ✅ 响应式设计
- ✅ 实时WebSocket通信
- ✅ 深色/浅色主题

### 🔒 安全特性
- ✅ JWT身份验证
- ✅ API密钥保护
- ✅ 敏感信息加密
- ✅ 审计日志记录

### 📊 监控和日志
- ✅ 实时日志查看
- ✅ 注册记录保存
- ✅ 性能监控
- ✅ 错误追踪

---

## 🎯 快速开始

### 步骤0: 环境检查（推荐）

在部署前，先运行环境检查脚本：

```bash
# 克隆项目
git clone https://github.com/QAZqweCbc/autoKr.git
cd autoKr

# 给脚本添加执行权限
chmod +x check-environment.sh deploy.sh update.sh rollback.sh

# 检查环境
./check-environment.sh
```

环境检查脚本会自动检测：
- ✅ 操作系统版本
- ✅ Node.js 版本（需要18+）
- ✅ npm、Git、MySQL、Redis等工具
- ✅ 端口占用情况（3000、2233）
- ✅ 磁盘空间和内存
- ✅ 系统依赖库

### 方式1: 一键部署（推荐）

```bash
# 执行部署
./deploy.sh
```

### 方式2: 手动部署

```bash
# 1. 安装依赖
npm install
npm run frontend:install
npx playwright install chromium
npx playwright install-deps chromium

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置必要的参数

# 3. 编译项目
npm run build
npm run frontend:build

# 4. 初始化数据库
npm run init:admin

# 5. 启动服务
pm2 start ecosystem.config.js
```

**详细步骤请查看：** [完整部署指南](LINUX_DEPLOYMENT.md)

---

## 📋 系统要求

### 最低要求
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+ / Windows 10+
- **Node.js**: 18.0+
- **内存**: 2GB RAM
- **磁盘**: 10GB 可用空间

### 推荐配置
- **操作系统**: Ubuntu 22.04 LTS
- **Node.js**: 20.0+
- **内存**: 4GB RAM
- **磁盘**: 20GB SSD

### 可选组件
- **MySQL**: 8.0+ (用于数据持久化)
- **Redis**: 6.0+ (用于缓存和Session)
- **Nginx**: 1.18+ (用于反向代理)

---

## 🛠️ 技术栈

### 后端
- **运行时**: Node.js 18+
- **语言**: TypeScript 5.0+
- **框架**: Express.js
- **数据库**: MySQL 8.0 / JSON文件存储
- **缓存**: Redis (可选)
- **自动化**: Playwright
- **进程管理**: PM2

### 前端
- **框架**: Vue 3
- **语言**: TypeScript
- **构建工具**: Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **HTTP客户端**: Axios
- **实时通信**: Socket.IO

### 开发工具
- **测试**: Jest
- **代码质量**: TypeScript ESLint
- **版本控制**: Git

---

## 📚 文档

### 快速入门
- [快速开始指南](QUICK_START.md) - 5分钟快速上手
- [部署快速参考](DEPLOYMENT_QUICK_REFERENCE.md) - 常用命令速查

### 部署文档
- [Linux部署指南](LINUX_DEPLOYMENT.md) - 完整的Linux部署步骤
- [部署脚本说明](#部署脚本) - 自动化部署脚本使用

### 项目文档
- [项目状态报告](PROJECT_STATUS.md) - 当前项目状态和功能清单
- [安全审计报告](SECURITY_AUDIT.md) - 安全审计详细报告
- [审计总结](AUDIT_SUMMARY.md) - 审计结果摘要

### 系统文档
- [自动审批系统](docs/AUTO_APPROVAL_SYSTEM.md) - 自动审批功能说明
- [优化指南](docs/OPTIMIZATION_GUIDE.md) - 性能优化建议
- [代码审计报告](docs/CODE_AUDIT_REPORT.md) - 代码质量审计

---

## 🚀 部署脚本

项目提供四个自动化脚本：

### 0. check-environment.sh - 环境检查
在部署前检查系统环境是否满足要求。

```bash
./check-environment.sh
```

**检查项目：**
- ✅ 操作系统和版本
- ✅ Node.js版本（18+）
- ✅ npm、Git等工具
- ✅ MySQL、Redis等服务
- ✅ 端口占用情况
- ✅ 磁盘空间和内存
- ✅ 系统依赖库

### 1. deploy.sh - 首次部署
自动完成环境检查、依赖安装、项目编译、数据库初始化、服务启动等全部流程。

```bash
./deploy.sh
```

**功能：**
- ✅ 检测操作系统和环境
- ✅ 安装所有依赖
- ✅ 自动生成安全密钥
- ✅ 编译前后端项目
- ✅ 初始化数据库
- ✅ 配置PM2并启动服务
- ✅ 设置开机自启

### 2. update.sh - 更新部署
安全地更新生产环境，包含自动备份和健康检查。

```bash
./update.sh
```

**功能：**
- ✅ 自动备份当前版本
- ✅ 拉取最新代码
- ✅ 智能更新依赖
- ✅ 重新编译项目
- ✅ 执行数据库迁移
- ✅ 重启服务
- ✅ 健康检查
- ✅ 清理旧备份

### 3. rollback.sh - 回滚版本
快速回滚到上一个稳定版本。

```bash
./rollback.sh
```

**功能：**
- ✅ 显示备份信息
- ✅ 回滚代码
- ✅ 恢复配置文件
- ✅ 恢复数据库（可选）
- ✅ 重新编译和启动
- ✅ 健康检查

---

## 🔧 配置说明

### 环境变量配置

复制 `.env.example` 到 `.env` 并配置以下参数：

```bash
# 服务端口
PORT=3000
AUTH_PORT=2233

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

## 📊 常用命令

### PM2 进程管理

```bash
# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启服务
pm2 restart all

# 停止服务
pm2 stop all
```

### NPM 脚本

```bash
# 开发模式
npm run dev              # 启动后端开发服务器
npm run dev:auth         # 启动认证服务开发服务器
npm run dev:all          # 启动所有开发服务器

# 编译
npm run build            # 编译后端
npm run frontend:build   # 编译前端
npm run build:all        # 编译全部

# 测试
npm test                 # 运行测试
npm run test:watch       # 监听模式测试
npm run test:coverage    # 测试覆盖率

# 初始化
npm run init:admin       # 创建管理员账号
```

---

## 🏗️ 项目结构

```
kiro-account-manager/
├── src/                          # 后端源码
│   ├── auth-service/            # 认证服务
│   ├── controllers/             # 控制器
│   ├── services/                # 业务逻辑
│   ├── routes/                  # 路由
│   ├── config/                  # 配置
│   └── scripts/                 # 脚本工具
├── frontend/                     # 前端源码
│   ├── src/
│   │   ├── api/                 # API接口
│   │   ├── components/          # 组件
│   │   ├── views/               # 页面
│   │   ├── stores/              # 状态管理
│   │   └── router/              # 路由配置
│   └── dist/                    # 编译输出
├── data/                         # 数据存储（JSON模式）
├── logs/                         # 日志文件
├── docs/                         # 文档
├── deploy.sh                     # 部署脚本
├── update.sh                     # 更新脚本
├── rollback.sh                   # 回滚脚本
├── ecosystem.config.js           # PM2配置
├── .env.example                  # 环境变量模板
└── package.json                  # 项目配置
```

---

## 🔒 安全特性

### 身份验证
- JWT Token认证
- 管理员权限控制
- API密钥验证
- Session管理

### 数据安全
- 敏感信息加密存储
- Token安全传输
- 密码哈希（bcrypt）
- SQL注入防护

### 审计日志
- 操作日志记录
- 登录日志追踪
- 错误日志监控
- 配置变更记录

---

## 📈 性能优化

### 后端优化
- 批量操作优化
- 数据库连接池
- Redis缓存（可选）
- 异步处理

### 前端优化
- 代码分割
- 懒加载
- 资源压缩
- CDN加速（可选）

### 部署优化
- PM2集群模式
- Nginx反向代理
- Gzip压缩
- 静态资源缓存

---

## 🐛 故障排查

### 服务无法启动
```bash
# 检查端口占用
sudo netstat -tlnp | grep 3000

# 查看日志
pm2 logs --err
tail -f logs/main-error.log
```

### 数据库连接失败
```bash
# 测试连接
mysql -u kiro -p -h localhost KrioServer

# 检查MySQL状态
sudo systemctl status mysql
```

### Playwright错误
```bash
# 重新安装浏览器
npx playwright install chromium --force

# 安装系统依赖
npx playwright install-deps chromium
```

**更多故障排查：** [部署快速参考](DEPLOYMENT_QUICK_REFERENCE.md#故障排查)

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 开发流程
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范
- 使用 TypeScript
- 遵循 ESLint 规则
- 编写单元测试
- 更新相关文档

---

## 📝 更新日志

### v1.0.0 (2024-01-XX)
- ✅ 初始版本发布
- ✅ AWS账号自动注册
- ✅ Token自动刷新
- ✅ 邮箱验证系统
- ✅ 管理后台界面
- ✅ 完整部署文档

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

感谢以下开源项目：

- [Node.js](https://nodejs.org/)
- [Vue.js](https://vuejs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Express.js](https://expressjs.com/)
- [Playwright](https://playwright.dev/)
- [PM2](https://pm2.keymetrics.io/)

---

## 📞 联系方式

- **GitHub**: [QAZqweCbc/autoKr](https://github.com/QAZqweCbc/autoKr)
- **Issues**: [提交问题](https://github.com/QAZqweCbc/autoKr/issues)

---

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐️

---

**Made with ❤️ by Kiro Team**
