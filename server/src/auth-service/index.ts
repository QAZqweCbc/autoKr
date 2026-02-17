/**
 * 注册认证服务 - 独立服务（端口2233）
 */

import express from 'express'
import cors from 'cors'
import { initDatabase } from '../services/database.adapter'
import authRoutes from './routes/auth.routes'
import tokenRoutes from './routes/token.routes'

const app = express()
const PORT = process.env.AUTH_PORT || 2233

// 中间件
app.use(cors())
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
    
    // 初始化数据库
    console.log('\n📦 初始化数据库...')
    await initDatabase()
    
    // 启动HTTP服务器
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60))
      console.log('✅ 注册认证服务启动成功！')
      console.log('='.repeat(60))
      console.log(`📡 HTTP 服务: http://0.0.0.0:${PORT}`)
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
      console.log('   - 主服务运行在端口3000')
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
  const { closeDatabase } = await import('../services/database.adapter')
  await closeDatabase()
  console.log('✅ 服务已关闭')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n\n正在关闭注册认证服务...')
  const { closeDatabase } = await import('../services/database.adapter')
  await closeDatabase()
  console.log('✅ 服务已关闭')
  process.exit(0)
})

// 启动
start()
