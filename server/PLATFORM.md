# 跨平台部署指南

本项目支持 Windows 和 Linux 平台。

## 快速开始

### Windows
```powershell
# 安装依赖
npm install
cd frontend
npm install
cd ..

# 构建前端
npm run build:frontend

# 启动服务
npm run dev:all
```

### Linux
```bash
# 安装依赖
npm install
cd frontend
npm install
cd ..

# 构建前端
npm run build:frontend

# 启动服务
npm run dev:all
```

## 配置说明

### 前端 API 配置
前端使用相对路径 `/api`，自动适配部署环境：
- 开发环境：自动代理到后端服务
- 生产环境：使用相对路径，与后端同域

### 数据库配置
配置文件：`config/database.config.json`

```json
{
  "storage": "mysql",
  "mysql": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "your_password",
    "database": "KrioServer"
  }
}
```

### 环境变量（可选）
创建 `.env` 文件：
```env
PORT=3000
AUTH_PORT=2233
DATABASE_STORAGE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=KrioServer
```

## 常见问题

### 1. CORS 跨域问题
前端必须使用统一的 API 客户端（`src/api/axios.ts`），不要直接使用 axios。

### 2. 前端访问不到后端
确保：
- 后端服务已启动（端口 3000 和 2233）
- 前端已构建（`npm run build:frontend`）
- 浏览器访问的是服务器 IP，不是 localhost

### 3. 数据库连接失败
检查：
- `config/database.config.json` 配置是否正确
- MySQL 服务是否启动
- 防火墙是否允许连接

## 生产部署

### 构建
```bash
npm run build:all
```

### 启动
```bash
# 使用 PM2（推荐）
pm2 start ecosystem.config.js

# 或直接启动
npm start
```

## 开发建议

1. 使用相对路径，避免硬编码 URL
2. 使用环境变量配置敏感信息
3. 前端统一使用 `api` 实例，不要直接用 axios
4. 数据库配置文件不要提交到 git（已在 .gitignore 中）
