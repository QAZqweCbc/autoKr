/**
 * 注册认证服务 - 独立服务（端口 2233）
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDatabase, getStorageMode, closeDatabase } from '../services/database.adapter'
import { markPreCheckDone } from '../services/database-init-coordinator.service'
import { guardStartup } from '../services/startup-guard.service'
import authRoutes from './routes/auth.routes'
import tokenRoutes from './routes/token.routes'
import { validateEncryptionSetup } from '../utils/crypto.util'
import { validateJwtSetup } from '../middleware/auth.middleware'

// ============================================
// 启动前验证：加密密钥和JWT密钥
// ============================================
validateEncryptionSetup()
validateJwtSetup()

const app = express()
const PORT = process.env.AUTH_PORT || 2233

// ============================================
// CORS 配置
// ============================================
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
  'http://localhost:1455',
  'http://localhost:5173',
  'http://127.0.0.1:1455',
  'http://127.0.0.1:5173'
]

console.log('🔒 [Auth Service] CORS 允许的来源:', ALLOWED_ORIGINS)

// 中间件
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      console.warn('[Auth Service] CORS blocked origin:', origin)
      callback(new Error(`来源 ${origin} 不在允许列表中`))
    }
  },
  credentials: true,
  maxAge: 86400
}))
app.use(express.json())

// 日志中间件
app.use((req, _res, next) => {
  console.log(`[Auth Service] ${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service', port: PORT })
})

// 根路由
app.get('/', (_req, res) => {
  res.json({ 
    service: 'Kiro Auth Service',
    version: '1.0.0',
    endpoints: [
      'POST /api/auth/send-code',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/tokens/request',
      'GET  /api/tokens/my-requests',
      'GET  /api/tokens/my-tokens',
      'POST /api/tokens/refresh/:id'
    ]
  })
})

// API路由
app.use('/api/auth', authRoutes)
app.use('/api/tokens', tokenRoutes)

// 404处理
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 404,
      message: 'Not Found'
    }
  })
})

// 错误处理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Auth Service] Error:', err)
  res.status(500).json({
    success: false,
    error: {
      code: 5002,
      message: 'Internal Server Error'
    }
  })
})

// 启动服务器
async function start() {
  try {
    console.log('\n' + '='.repeat(60))
    console.log('🚀 Kiro 注册认证服务 - 启动中...')
    console.log('='.repeat(60))

    // 启动守卫：非阻塞检查
    const guardResult = await guardStartup()

    if (guardResult.needsSetup) {
      console.log('⚠️  系统未完成配置，请访问 /setup 完成初始化')
    } else if (!guardResult.configValid) {
      console.warn('⚠️  数据库配置无效:', guardResult.configError)
    }

    // 初始化数据库（仅当配置完成时才初始化）
    if (guardResult.setupCompleted && guardResult.configValid) {
      console.log('\n📦 初始化数据库...')
      await initDatabase()
      console.log(`📦 当前存储模式: ${getStorageMode().toUpperCase()}`)
    } else {
      console.log('\nℹ️  跳过数据库初始化（配置未完成）')
    }
    
    // 启动HTTP服务器
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log('\n' + '='.repeat(60))
      console.log('✅ 注册认证服务启动成功！')
      console.log('='.repeat(60))
      console.log(`🔗 HTTP 服务: http://0.0.0.0:${PORT}`)
      console.log('='.repeat(60))
      console.log('\n📚 API 端点:')
      console.log(`   GET  /health                     - 健康检查`)
      console.log(`   POST /api/auth/send-code         - 发送验证码`)
      console.log(`   POST /api/auth/register          - 用户注册`)
      console.log(`   POST /api/auth/login             - 用户登录`)
      console.log(`   POST /api/tokens/request         - 申请Token`)
      console.log(`   GET  /api/tokens/my-requests     - 查看我的申请`)
      console.log(`   GET  /api/tokens/my-tokens       - 查看我的Token`)
      console.log(`   POST /api/tokens/refresh/:id     - 刷新Token额度`)
      console.log('='.repeat(60))
      console.log('\n💡 提示:')
      console.log('   - 此服务运行在独立端口2233')
      console.log('   - 主服务运行在端口1455')
      console.log('   - 按 Ctrl+C 停止服务器')
      console.log('')
    })
  } catch (error: any) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ 注册认证服务启动失败')
    console.error('='.repeat(60))
    console.error(`错误: ${error.message}`)
    console.error('='.repeat(60) + '\n')
    process.exit(1)
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n\n正在关闭注册认证服务...')
  await closeDatabase()
  console.log('✅ 服务已关闭')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n\n正在关闭注册认证服务...')
  await closeDatabase()
  console.log('✅ 服务已关闭')
  process.exit(0)
})

// 启动
start()
