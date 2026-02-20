/**
 * Kiro Account Manager - Ubuntu Server Edition
 * 主入口文件
 */

import express from 'express'
import cors from 'cors'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import path from 'path'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { initDatabase, closeDatabase } from './services/database.adapter'
import { initWebSocket } from './websocket/socket.handler'
import apiRoutes from './routes'
import { logger, requestLogger } from './utils/logger'
import { apiLimiter } from './middleware/rate-limiter'
import { 
  healthCheckHandler, 
  simpleHealthCheck, 
  metricsHandler,
  monitoringMiddleware 
} from './middleware/health-check'

const app = express()
const httpServer = createServer(app)
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  // 调整心跳配置：只在有实际操作时才响应
  pingInterval: 60000,  // 心跳间隔：60秒（默认25秒）
  pingTimeout: 30000,   // 心跳超时：30秒（默认20秒）
  transports: ['websocket', 'polling']
})

const PORT = process.env.PORT || 3000

// 将 io 实例挂载到 app，供健康检查使用
;(app as any).io = io

// 中间件
app.use(cors())
app.use(express.json())

// 监控中间件（记录请求指标）
app.use(monitoringMiddleware)

// 统一日志中间件
app.use(requestLogger)

// 健康检查端点（不需要限流）
app.get('/health', healthCheckHandler)
app.get('/health-basic', simpleHealthCheck)
app.get('/metrics', metricsHandler)

// API 限流（应用到所有 API 路由）
app.use('/api', apiLimiter)

// 代理认证服务的请求到端口 2233
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:2233'

logger.info(`🔗 配置认证服务代理: ${AUTH_SERVICE_URL}`)

// 代理 /api/auth 路由到认证服务
app.use('/api/auth', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req) => {
      logger.info(`[Proxy Auth] ${req.method} ${req.url} -> ${AUTH_SERVICE_URL}${req.url}`)
    },
    error: (err, req, res) => {
      logger.error(`[Proxy Auth Error] ${req.method} ${req.url}:`, err.message)
      ;(res as express.Response).status(502).json({
        success: false,
        error: {
          code: 502,
          message: '认证服务暂时不可用，请确保认证服务正在运行'
        }
      })
    }
  }
}))

// 代理 /api/tokens 路由到认证服务
app.use('/api/tokens', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req) => {
      logger.info(`[Proxy Tokens] ${req.method} ${req.url} -> ${AUTH_SERVICE_URL}${req.url}`)
    },
    error: (err, req, res) => {
      logger.error(`[Proxy Tokens Error] ${req.method} ${req.url}:`, err.message)
      ;(res as express.Response).status(502).json({
        success: false,
        error: {
          code: 502,
          message: 'Token服务暂时不可用，请确保认证服务正在运行'
        }
      })
    }
  }
}))

// API 路由（其他路由）
app.use('/api', apiRoutes)

// 静态文件服务
app.use(express.static(path.join(__dirname, '../frontend/dist')))

// SPA 路由回退支持（必须在最后）
// 所有GET请求如果没有匹配到静态文件或API，返回index.html
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'))
})

// 启动服务器
async function start() {
  try {
    logger.info('='.repeat(60))
    logger.info('🚀 Kiro Account Manager Server - 启动中...')
    logger.info('='.repeat(60))
    
    // 初始化数据库
    logger.info('📦 初始化数据库...')
    await initDatabase()
    
    // 初始化 WebSocket
    logger.info('🔌 初始化 WebSocket...')
    initWebSocket(io)
    logger.info('✅ WebSocket 初始化完成')
    
    // 启动自动刷新调度器（优化版）
    logger.info('🔄 启动 Token 自动刷新调度器（优化版）...')
    const { startAutoRefreshScheduler } = await import('./services/auto-refresh-optimized.service')
    startAutoRefreshScheduler()
    
    // 启动 HTTP 服务器
    httpServer.listen(PORT, () => {
      logger.info('='.repeat(60))
      logger.info('✅ 服务器启动成功！')
      logger.info('='.repeat(60))
      logger.info(`📡 HTTP 服务: http://0.0.0.0:${PORT}`)
      logger.info(`📊 管理面板: http://0.0.0.0:${PORT}`)
      logger.info(`🔌 WebSocket: ws://0.0.0.0:${PORT}`)
      logger.info(`🏥 健康检查: http://0.0.0.0:${PORT}/health`)
      logger.info(`📈 监控指标: http://0.0.0.0:${PORT}/metrics`)
      logger.info('='.repeat(60))
      logger.info('📚 API 端点:')
      logger.info(`   GET  /api/health-basic    - 基础健康检查`)
      logger.info(`   GET  /api/health/refresh  - 刷新系统健康状态`)
      logger.info(`   POST /api/tasks           - 创建任务`)
      logger.info(`   GET  /api/tasks           - 获取任务列表`)
      logger.info(`   GET  /api/tasks/stats     - 任务统计`)
      logger.info(`   GET  /api/accounts        - 获取账号列表`)
      logger.info(`   POST /api/accounts/export - 导出账号`)
      logger.info(`   POST /api/accounts/:id/reset-error - 重置账号错误状态`)
      logger.info(`   POST /api/accounts/reset-errors    - 批量重置错误状态`)
      logger.info(`   GET  /api/refresh/logs    - 查询刷新日志`)
      logger.info(`   GET  /api/refresh/logs/recent - 获取最近刷新日志`)
      logger.info(`   GET  /api/refresh/logs/stats  - 刷新日志统计`)
      logger.info(`   POST /api/generator       - 生成账号`)
      logger.info('='.repeat(60))
      logger.info('💡 提示:')
      logger.info('   - 在浏览器中打开管理面板开始使用')
      logger.info('   - 按 Ctrl+C 停止服务器')
      logger.info('   - 查看 server/README.md 了解更多信息')
      logger.info('')
    })
  } catch (error: any) {
    logger.error('='.repeat(60))
    logger.error('❌ 服务器启动失败')
    logger.error('='.repeat(60))
    logger.error(`错误: ${error.message}`, { stack: error.stack })
    logger.error('常见问题排查：')
    logger.error(`1. 端口被占用: lsof -i :${PORT}`)
    logger.error('2. 依赖未安装: npm install')
    logger.error('3. 数据库初始化失败: 检查数据库配置')
    logger.error('4. Playwright 未安装: npx playwright install chromium')
    logger.error('='.repeat(60))
    process.exit(1)
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  logger.info('正在关闭服务器...')
  
  // 停止自动刷新调度器
  const { stopAutoRefreshScheduler } = await import('./services/auto-refresh-optimized.service')
  stopAutoRefreshScheduler()
  
  await closeDatabase()
  httpServer.close(() => {
    logger.info('✅ 服务器已关闭')
    process.exit(0)
  })
})

process.on('SIGTERM', async () => {
  logger.info('正在关闭服务器...')
  
  // 停止自动刷新调度器
  const { stopAutoRefreshScheduler } = await import('./services/auto-refresh-optimized.service')
  stopAutoRefreshScheduler()
  
  await closeDatabase()
  httpServer.close(() => {
    logger.info('✅ 服务器已关闭')
    process.exit(0)
  })
})

// 启动
start()
