/**
 * Kiro Account Manager - Ubuntu Server Edition
 * 主入口文件
 */

import 'dotenv/config'
import express, { Request, Response } from 'express'
import { existsSync } from 'fs'
import cors from 'cors'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import path from 'path'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { initDatabase, closeDatabase, getStorageMode } from './services/database.adapter'
import { guardStartup, StartupGuardResult } from './services/startup-guard.service'
import { cleanupInitState } from './services/database-init-coordinator.service'
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

const PORT = process.env.PORT || 14558

// 存储守护检查结果，供路由判断是否需要显示 setup 页面
let guardResult: StartupGuardResult | null = null

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
  'http://localhost:14558',
  'http://localhost:5173',  // Vite dev server
  'http://127.0.0.1:14558',
  'http://127.0.0.1:5173',
  'http://0.0.0.0:14558',
  'http://0.0.0.0:5173',
  'http://0.0.0.0:3000'
]

logger.info('🔒 CORS 允许的来源:', ALLOWED_ORIGINS)

/**
 * 检查 Origin 是否为本地地址
 * 支持 localhost、127.0.0.1、0.0.0.0 以及内网 IP（192.168.x.x、10.x.x.x、172.16-31.x.x）
 */
function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  try {
    const url = new URL(origin)
    const hostname = url.hostname
    // localhost / 127.0.0.1
    if (/^localhost$|^127\.0\.0\.1$|^0\.0\.0\.0$/.test(hostname)) return true
    // 内网 IP 范围
    if (/^192\.168\./.test(hostname)) return true
    if (/^10\./.test(hostname)) return true
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true
    return false
  } catch {
    return false
  }
}

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
      if (isLocalOrigin(origin)) return callback(null, true)
      callback(null, false)
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: 60000,
  pingTimeout: 30000,
  transports: ['websocket', 'polling']
})

;(app as any).io = io

// 中间件
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else if (isLocalOrigin(origin)) {
      // 本地/内网 IP 自动放行
      callback(null, true)
    } else {
      logger.warn('CORS blocked origin:', origin)
      callback(new Error(`来源 ${origin} 不在允许列表中`))
    }
  },
  credentials: true,
  maxAge: 86400
}))
app.use(express.json())
app.use(requestIdMiddleware)
app.use(monitoringMiddleware)
app.use(requestLogger)

// 健康检查端点（不需要限流）
app.get('/health', healthCheckHandler)
app.get('/health-basic', simpleHealthCheck)
app.get('/metrics', metricsHandler)

// 系统健康检查：集成守护检查结果
app.get('/api/system/health', (req, res) => {
  const status: Record<string, any> = {
    setupCompleted: guardResult?.setupCompleted ?? false,
    mysqlOk: guardResult?.mysqlOk ?? false,
    redisOk: guardResult?.redisOk ?? false,
    configValid: guardResult?.configValid ?? false,
  }

  // 如果有数据库连接，也报告
  if (getStorageMode) {
    status.storageMode = getStorageMode().toUpperCase()
  }

  res.json({ success: true, data: status })
})

// 配置向导 API 路由（必须在静态文件之前）
import setupRoutes from './routes/setup.routes'
app.use('/api/setup', setupRoutes)

// 数据库配置 API 路由
import databaseConfigRoutes from './routes/database-config.routes'
app.use('/api/database', databaseConfigRoutes)

// API 限流
app.use('/api', apiLimiter)

// 主 API 路由（必须在 /api 限流之后）
app.use('/api', apiRoutes)


// 代理认证服务请求到端口 2233
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:2233'
logger.info(`配置认证服务代理: ${AUTH_SERVICE_URL}`)

const authProxy = createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (p) => p
})
app.use('/api/auth', authProxy as any)


// Setup 页面：当需要配置时，直接返回 setup 页面
const SETUP_WIZARD_PUBLIC = path.join(__dirname, 'setup-wizard', 'public')
const FRONTEND_DIST = path.join(__dirname, '../frontend/dist')

if (existsSync(SETUP_WIZARD_PUBLIC)) {
  // 独立 Setup Wizard 静态文件（旧版）
  app.use('/setup', express.static(SETUP_WIZARD_PUBLIC))
  app.get('/setup/*', (_req, res) => {
    res.sendFile(path.join(SETUP_WIZARD_PUBLIC, 'index.html'))
  })
} else {
  // 使用 frontend/dist 提供 Setup 页面（Vue 应用）
  // 静态资源挂载在根路径（/assets/xxx），因为前端构建资源引用的是绝对路径
  app.use(express.static(FRONTEND_DIST))
  // /setup 路径返回前端 index.html，Vue 应用根据 API 决定是否显示 SetupWizardView
  app.get('/setup', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
  })
  app.get('/setup/*', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
  })
}

// 所有 GET 请求如果没有匹配到 API 或静态文件，返回前端 index.html
app.get(/^\/(?!api|setup).*/, (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
})

// 启动服务器
async function start() {
  try {
    logger.info('='.repeat(60))
    logger.info('🚀 Kiro Account Manager Server - 启动中...')
    logger.info('='.repeat(60))

    // 启动守卫：非阻塞检查
    guardResult = await guardStartup()

    if (guardResult.needsSetup) {
      logger.warn('⚠️  系统未完成配置，请访问 http://localhost:' + PORT + '/setup 完成初始化')
    } else {
      logger.info('✅ 启动守卫检查通过')
    }

    // 启动前校验：数据库密码环境变量（非阻塞，仅警告）
    const envResult = validateDatabaseEnv()
    if (!envResult.success) {
      logger.warn('⚠️  部分数据库环境变量未设置，服务继续运行但功能可能受限')
    }

    // 初始化数据库（在 guard 非阻塞后，如果配置完成才初始化）
    if (guardResult.setupCompleted && guardResult.configValid) {
      logger.info('📦 初始化数据库...')
      await initDatabase()
      logger.info(`📦 当前存储模式: ${getStorageMode().toUpperCase()}`)

      // 初始化账号删除日志表
      logger.info('📦 初始化账号删除日志表...')
      const { createDeletionLogTable } = await import('./services/account-deletion-log.service')
      await createDeletionLogTable()

      // 初始化注册日志表
      logger.info('📦 初始化注册日志表...')
      const { createRegistrationLogTable } = await import('./services/registration-log.service')
      await createRegistrationLogTable()
    } else {
      logger.info('ℹ️  跳过数据库初始化（配置未完成）')
    }

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
      httpServer.listen(Number(PORT), '0.0.0.0', () => {
        httpServer.off('error', reject)
        logger.info('='.repeat(60))
        logger.info('✅ 服务器启动成功！')
        logger.info('='.repeat(60))
        logger.info(`📡 HTTP 服务: http://0.0.0.0:${PORT}`)
        logger.info(`📊 管理面板: http://0.0.0.0:${PORT}`)
        logger.info(`🔌 WebSocket: ws://0.0.0.0:${PORT}`)
        logger.info(`🏥 健康检查: http://0.0.0.0:${PORT}/health`)
        logger.info(`📈 监控指标: http://0.0.0.0:${PORT}/metrics`)
        if (guardResult && guardResult.needsSetup) {
          logger.info(`🔧 配置向导: http://0.0.0.0:${PORT}/setup`)
          logger.info('💡 提示: 系统尚未完成配置，请访问配置向导完成初始化')
        }
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

// ============================================
// 优雅关闭
// ============================================
let isShuttingDown = false

async function gracefulShutdown() {
  if (isShuttingDown) return
  isShuttingDown = true
  logger.info('正在关闭服务器...')

  // 1. 停止调度器
  try {
    const { stopAutoRefreshScheduler } = await import('./services/auto-refresh-optimized.service')
    stopAutoRefreshScheduler()
  } catch { /* ignore */ }

  try {
    const { stopEmailDetectionScheduler } = await import('./services/email-detection.service')
    stopEmailDetectionScheduler()
  } catch { /* ignore */ }

  // 2. 清理 WebSocket 客户端连接
  try {
    const allRooms = (io as any).adapter?.store?.rooms
    if (allRooms) {
      for (const [roomId, sids] of (allRooms as Map<string, Set<string>>).entries()) {
        if (roomId !== 'global' && roomId !== 'undefined') {
          // 断开单个客户端房间
          for (const sid of sids) {
            const socket = io.sockets.sockets.get(sid)
            if (socket) {
              socket.disconnect(true)
            }
          }
        }
      }
    }
  } catch { /* ignore */ }

  // 3. 清理初始化状态
  cleanupInitState()

  // 4. 关闭数据库
  try {
    await closeDatabase()
  } catch { /* ignore */ }

  // 5. 关闭 HTTP 服务器（强制超时 5 秒）
  httpServer.close(() => {
    logger.info('✅ 服务器已关闭')
    process.exit(0)
  })

  // 强制退出：如果 5 秒内还没关完，直接退出
  setTimeout(() => {
    logger.warn('⚠️  强制关闭超时，直接退出')
    process.exit(0)
  }, 5000)
}

process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)

// 启动
start()
