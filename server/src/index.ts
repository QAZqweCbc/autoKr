/**
 * Kiro Account Manager - Ubuntu Server Edition
 * 主入口文件
 */

import express from 'express'
import cors from 'cors'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import path from 'path'
import { initDatabase, closeDatabase } from './services/database.adapter'
import { initWebSocket } from './websocket/socket.handler'
import apiRoutes from './routes'

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

// 中间件
app.use(cors())
app.use(express.json())

// 日志中间件
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// API 路由（优先级最高）
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
    console.log('\n' + '='.repeat(60))
    console.log('🚀 Kiro Account Manager Server - 启动中...')
    console.log('='.repeat(60))
    
    // 初始化数据库
    console.log('\n📦 初始化数据库...')
    await initDatabase()
    
    // 初始化 WebSocket
    console.log('\n🔌 初始化 WebSocket...')
    initWebSocket(io)
    console.log('✅ WebSocket 初始化完成')
    
    // 启动自动刷新调度器（优化版）
    console.log('\n🔄 启动 Token 自动刷新调度器（优化版）...')
    const { startAutoRefreshScheduler } = await import('./services/auto-refresh-optimized.service')
    startAutoRefreshScheduler()
    
    // 启动 HTTP 服务器
    httpServer.listen(PORT, () => {
      console.log('\n' + '='.repeat(60))
      console.log('✅ 服务器启动成功！')
      console.log('='.repeat(60))
      console.log(`📡 HTTP 服务: http://0.0.0.0:${PORT}`)
      console.log(`📊 管理面板: http://0.0.0.0:${PORT}`)
      console.log(`🔌 WebSocket: ws://0.0.0.0:${PORT}`)
      console.log('='.repeat(60))
      console.log('\n📚 API 端点:')
      console.log(`   GET  /api/health-basic    - 基础健康检查`)
      console.log(`   GET  /api/health/refresh  - 刷新系统健康状态`)
      console.log(`   POST /api/tasks           - 创建任务`)
      console.log(`   GET  /api/tasks           - 获取任务列表`)
      console.log(`   GET  /api/tasks/stats     - 任务统计`)
      console.log(`   GET  /api/accounts        - 获取账号列表`)
      console.log(`   POST /api/accounts/export - 导出账号`)
      console.log(`   POST /api/accounts/:id/reset-error - 重置账号错误状态`)
      console.log(`   POST /api/accounts/reset-errors    - 批量重置错误状态`)
      console.log(`   GET  /api/refresh/logs    - 查询刷新日志`)
      console.log(`   GET  /api/refresh/logs/recent - 获取最近刷新日志`)
      console.log(`   GET  /api/refresh/logs/stats  - 刷新日志统计`)
      console.log(`   POST /api/generator       - 生成账号`)
      console.log('='.repeat(60))
      console.log('\n💡 提示:')
      console.log('   - 在浏览器中打开管理面板开始使用')
      console.log('   - 按 Ctrl+C 停止服务器')
      console.log('   - 查看 server/README.md 了解更多信息')
      console.log('')
    })
  } catch (error: any) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ 服务器启动失败')
    console.error('='.repeat(60))
    console.error(`错误: ${error.message}`)
    console.error('\n常见问题排查：')
    console.error('\n1. 端口被占用')
    console.error(`   lsof -i :${PORT}`)
    console.error(`   PORT=8080 npm run server:start`)
    console.error('\n2. 依赖未安装')
    console.error('   npm install')
    console.error('\n3. 数据库初始化失败')
    console.error('   rm -rf server/data')
    console.error('   mkdir -p server/data')
    console.error('\n4. Playwright 未安装')
    console.error('   npx playwright install chromium')
    console.error('='.repeat(60) + '\n')
    process.exit(1)
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n\n正在关闭服务器...')
  
  // 停止自动刷新调度器
  const { stopAutoRefreshScheduler } = await import('./services/auto-refresh-optimized.service')
  stopAutoRefreshScheduler()
  
  await closeDatabase()
  httpServer.close(() => {
    console.log('✅ 服务器已关闭')
    process.exit(0)
  })
})

process.on('SIGTERM', async () => {
  console.log('\n\n正在关闭服务器...')
  
  // 停止自动刷新调度器
  const { stopAutoRefreshScheduler } = await import('./services/auto-refresh-optimized.service')
  stopAutoRefreshScheduler()
  
  await closeDatabase()
  httpServer.close(() => {
    console.log('✅ 服务器已关闭')
    process.exit(0)
  })
})

// 启动
start()
