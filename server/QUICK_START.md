# 🚀 快速开始指南

## 📦 安装依赖

```bash
cd server
npm install
```

## 🔧 配置环境

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，配置必要参数

## 🏗️ 构建项目

```bash
npm run build
```

## 🎯 启动服务

### 开发模式（推荐）
```bash
npm run dev:all
```

这将同时启动：
- 主服务（端口 3000）
- 认证服务（端口 2233）

### 生产模式
```bash
npm start
```

## ✅ 验证优化功能

启动服务后，运行验证脚本：

```bash
npm run verify
```

这将测试：
- ✅ 健康检查端点
- ✅ Prometheus 指标
- ✅ 请求限流
- ✅ 日志系统

## 🧪 运行测试

```bash
# 运行所有测试
npm test

# 监听模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 📊 监控端点

服务启动后，可以访问以下端点：

### 管理面板
```
http://localhost:3000
```

### 健康检查
```bash
# 完整健康状态
curl http://localhost:3000/health | jq

# 简单检查
curl http://localhost:3000/health-basic

# Prometheus 指标
curl http://localhost:3000/metrics
```

### 示例响应

**健康检查**：
```json
{
  "status": "healthy",
  "timestamp": 1708234567890,
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "database": { "status": "up", "responseTime": 5 },
    "websocket": { "status": "up" },
    "memory": { "status": "healthy", "percentage": 50 },
    "cpu": { "status": "healthy", "usage": 30 }
  },
  "metrics": {
    "requests": {
      "total": 1000,
      "success": 950,
      "failed": 50,
      "avgResponseTime": 120
    },
    "errors": {
      "last24h": 10,
      "last1h": 2
    }
  }
}
```

## 📝 查看日志

```bash
# 实时查看所有日志
tail -f logs/combined.log

# 只看错误日志
tail -f logs/error.log

# 查看最近 100 行
tail -n 100 logs/combined.log
```

## 🔍 常见问题

### 端口被占用

如果遇到 `EADDRINUSE` 错误：

**Windows**:
```bash
# 查找占用端口的进程
netstat -ano | findstr :3000
netstat -ano | findstr :2233

# 杀死进程（替换 <PID>）
taskkill /PID <PID> /F

# 或一次性杀死所有 node 进程
taskkill /IM node.exe /F
```

**Linux/Mac**:
```bash
# 查找占用端口的进程
lsof -i :3000
lsof -i :2233

# 杀死进程
kill -9 <PID>
```

### 测试失败

如果测试失败，尝试：

1. 清理并重新安装依赖：
```bash
rm -rf node_modules package-lock.json
npm install
```

2. 重新构建：
```bash
npm run build
```

3. 再次运行测试：
```bash
npm test
```

### 日志文件不存在

日志文件会在服务首次运行时自动创建。如果不存在：

```bash
mkdir -p logs
```

## 📚 更多文档

- [优化总结](./OPTIMIZATION_SUMMARY.md) - 优化功能概览
- [优化指南](./docs/OPTIMIZATION_GUIDE.md) - 详细使用说明
- [平台指南](./PLATFORM.md) - 跨平台部署说明

## 🎉 完成！

现在你的项目已经具备：
- ✅ 统一日志系统
- ✅ API 请求限流
- ✅ 监控告警系统
- ✅ 自动化测试

享受更稳定、可靠的开发体验！🚀
