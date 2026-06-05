/**
 * Kiro Account Manager - Ubuntu Server Edition
 * 主入口文件
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import path from 'path'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { initDatabase, closeDatabase, getStorageMode } from './services/database.adapter'
import { guardStartup } from './services/startup-guard.service'
import { markPreCheckDone, cleanupInitState } from './services/database-init-coordinator.service'
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
import { validateEncryptionSetup } from './utils/crypto.util'
import { validateDatabaseEnv } from './utils/env-validator'
import { validateJwtSetup } from './middleware/auth.middleware'
import { requestIdMiddleware } from './middleware/request-id.middleware'

// ============================================
// 启动前验证：加密密钥和JWT密钥
// ============================================
validateEncryptionSetup()
validateJwtSetup()

const app = express()
const httpServer = createServer(app)

const PORT = process.env.PORT || 1455

async function cleanupStartupResources() {
  try {
    const { stopAutoRefreshScheduler } = await import('./services/auto-refresh-optimized.service')
    stopAutoRefreshScheduler()
  } catch (error: any) {
    logger.warn('停止自动刷新调度器失败:', error?.message || error)
  }

  try {
    await closeDatabase()
  } catch (error: any) {
    logger.warn('关闭数据库连接失败:', error?.message || error)
  }
}

function logStartupError(error: any) {
  logger.error('='.repeat(60))
  logger.error('❌ 服务器启动失败')
  logger.error('='.repeat(60))

  if (error?.code === 'EADDRINUSE') {
    logger.error(`端口 ${PORT} 已被占用，服务无法启动`)
    logger.error('处理方式:')
    logger.error(`1. Linux/macOS: lsof -i :${PORT} 或 ss -ltnp | grep :${PORT}`)
    logger.error(`2. Windows: netstat -ano | findstr :${PORT}`)
    logger.error('3. 停止占用该端口的旧进程，或在 .env 中修改 PORT')
  } else {
    logger.error(`错误: ${error?.message || error}`, { stack: error?.stack })
    logger.error('常见问题排查:')
    logger.error('1. 配置不完整: 运行 npm run setup 完成初始化')
    logger.error('2. 依赖未安装: npm install')
    logger.error('3. Playwright 未安装: npx playwright install chromium')
  }

  logger.error('='.repeat(60))
}

// ============================================
// CORS 配置
// ============================================
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
  'http://localhost:1455',
  'http://localhost:5173',  // Vite dev server
  'http://127.0.0.1:1455',
  'http://127.0.0.1:5173'
]

logger.info('🔒 CORS 允许的来源:', ALLOWED_ORIGINS)

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,  // 使用相同的CORS配置
    methods: ['GET', 'POST'],
    credentials: true
  },
  // 调整心跳配置：只在有实际操作时才响应
  pingInterval: 60000,  // 心跳间隔：60秒（默认25秒）
  pingTimeout: 30000,   // 心跳超时：30秒（默认20秒）
  transports: ['websocket', 'polling']
})

// 将 io 实例挂载到 app，供健康检查使用
;(app as any).io = io

// 中间件
app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（如 Postman、curl、服务器端请求）
    if (!origin) return callback(null, true)
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      logger.warn('CORS blocked origin:', origin)
      callback(new Error(`来源 ${origin} 不在允许列表中`))
    }
  },
  credentials: true,  // 允许携带凭证
  maxAge: 86400  // 预检请求缓存24小时
}))
app.use(express.json())

// Request ID 追踪中间件（必须在其他中间件之前）
app.use(requestIdMiddleware)

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

    // 启动守卫：确保配置完整
    await guardStartup()

    // 启动前校验：数据库密码环境变量
    validateDatabaseEnv()

    // 初始化数据库
    logger.info('📦 初始化数据库...')
    await initDatabase()
    logger.info(`📦 当前存储模式: ${getStorageMode().toUpperCase()}`)

    // 初始化账号删除日志表
    logger.info('📦 初始化账号删除日志表...')
    const { createDeletionLogTable } = await import('./services/account-deletion-log.service')
    await createDeletionLogTable()

    // 初始化 WebSocket
    logger.info('🔌 初始化 WebSocket...')
    initWebSocket(io)
    logger.info('✅ WebSocket 初始化完成')

    // 启动自动刷新调度器（优化版）
    logger.info('🔄 启动 Token 自动刷新调度器（优化版）...')
    const { startAutoRefreshScheduler } = await import('./services/auto-refresh-optimized.service')
    startAutoRefreshScheduler()

    // 启动邮箱检测调度器
    logger.info('📧 启动邮箱检测调度器...')
    const { startEmailDetectionScheduler } = await import('./services/email-detection.service')
    startEmailDetectionScheduler()
    
    // 启动 HTTP 服务器
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject)
      httpServer.listen(PORT, () => {
        httpServer.off('error', reject)
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
        resolve()
      })
    })
  } catch (error: any) {
    await cleanupStartupResources()
    logStartupError(error)
    process.exit(1)
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  logger.info('正在关闭服务器...')

  // 停止自动刷新调度器
  const { stopAutoRefreshScheduler } = await import('./services/auto-refresh-optimized.service')
  stopAutoRefreshScheduler()

  // 停止邮箱检测调度器
  const { stopEmailDetectionScheduler } = await import('./services/email-detection.service')
  stopEmailDetectionScheduler()

  // 清理数据库初始化状态
  cleanupInitState()

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

  // 停止邮箱检测调度器
  const { stopEmailDetectionScheduler } = await import('./services/email-detection.service')
  stopEmailDetectionScheduler()

  // 清理数据库初始化状态
  cleanupInitState()

  await closeDatabase()
  httpServer.close(() => {
    logger.info('✅ 服务器已关闭')
    process.exit(0)
  })
})

// 启动
start()
