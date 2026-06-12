/**
 * WebSocket 处理器
 */

import { Server as SocketIOServer } from 'socket.io'
import type {
  RefreshStartEvent,
  RefreshAccountEvent,
  RefreshCompleteEvent,
  RefreshAlertEvent
} from './events.types'

let io: SocketIOServer | null = null

/**
 * 初始化 WebSocket
 */
export function initWebSocket(socketServer: SocketIOServer) {
  io = socketServer
  
  io.on('connection', (socket) => {
    console.log(`✅ WebSocket 客户端已连接: ${socket.id}`)

    // 持久化连接事件
    persistLog('connection', 'info', '连接状态', `WebSocket 已连接 (${socket.id})`, null).catch(() => {})

    socket.on('disconnect', () => {
      console.log(`❌ WebSocket 客户端已断开: ${socket.id}`)
      // 持久化断开事件
      persistLog('connection', 'info', '连接状态', `WebSocket 已断开 (${socket.id})`, null).catch(() => {})
    })
    
    // 客户端订阅任务日志
    socket.on('subscribe:task', (taskId: string) => {
      socket.join(`task:${taskId}`)
      console.log(`📡 客户端订阅任务: ${taskId}`)
    })
    
    // 客户端取消订阅
    socket.on('unsubscribe:task', (taskId: string) => {
      socket.leave(`task:${taskId}`)
      console.log(`📡 客户端取消订阅任务: ${taskId}`)
    })
  })
}

/**
 * 发送任务状态更新
 */
export function emitTaskUpdate(taskId: string, status: string, error?: string) {
  if (!io) return
  
  io.emit('task:update', {
    taskId,
    status,
    error,
    timestamp: Date.now()
  })
}

/**
 * 发送账号变化通知
 */
export function emitAccountUpdate() {
  if (!io) return
  
  io.emit('account:update', {
    timestamp: Date.now()
  })
}

/**
 * 发送任务日志
 * @param taskId 任务ID
 * @param message 消息内容
 * @param options 可选配置
 * @param options.type 日志分类：'register'(默认任务日志) | 'account'(账号相关) | 'config'(配置相关)
 */
export function emitTaskLog(
  taskId: string,
  message: string,
  options?: { type?: 'register' | 'account' | 'config' }
) {
  if (!io) return

  // 确定分类
  const category = (options?.type === 'register' || !options?.type) ? 'register' : options.type

  const payload: {
    taskId: string
    message: string
    timestamp: number
    type?: 'register' | 'account' | 'config'
  } = {
    taskId,
    message,
    timestamp: Date.now()
  }

  if (options?.type) {
    payload.type = options.type
  }

  // 持久化到数据库（不阻塞 WebSocket 发送）
  saveSystemLogToDB(category, payload.message, taskId, options?.type).catch(() => {
    // 静默失败，不影响日志推送
  })

  // 实时日志页默认不订阅单个任务，所以任务日志需要全局广播
  io.emit('task:log', payload)

  // 兼容旧客户端监听 log 事件
  io.emit('log', payload)
}

/**
 * 异步保存日志到数据库
 */
async function saveSystemLogToDB(
  category: 'register' | 'config' | 'account' | 'connection',
  message: string,
  taskId: string,
  logType?: 'register' | 'account' | 'config'
) {
  try {
    const { saveSystemLog } = await import('../services/system-log.service')
    await saveSystemLog({
      task_id: taskId,
      message,
      category,
      level: 'info',
      source: '任务日志',
      log_type: logType || null
    })
  } catch {
    // 持久化失败不阻塞
  }
}

/**
 * 广播系统消息
 */
export function emitSystemMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (!io) return

  io.emit('system:message', {
    message,
    level,
    timestamp: Date.now()
  })

  // 持久化
  persistLog('config', level, '系统通知', message, null).catch(() => {})
}

/**
 * 异步持久化日志到数据库
 */
async function persistLog(
  category: 'register' | 'config' | 'account' | 'connection',
  level: string,
  source: string,
  message: string,
  logType?: 'register' | 'account' | 'config' | null
) {
  try {
    const { saveSystemLog } = await import('../services/system-log.service')
    await saveSystemLog({
      message,
      category,
      level: level as any,
      source,
      log_type: logType
    })
  } catch {
    // 静默失败
  }
}

// ============================================
// Token 刷新相关事件
// ============================================

/**
 * 刷新开始事件
 * 在批量刷新开始时发送
 */
export function emitRefreshStart(data: RefreshStartEvent) {
  if (!io) return
  
  io.emit('refresh:start', data)
}

/**
 * 单个账号刷新完成事件
 * 每个账号刷新完成时发送
 */
export function emitRefreshAccount(data: RefreshAccountEvent) {
  if (!io) return
  
  io.emit('refresh:account', data)
}

/**
 * 批量刷新完成事件
 * 整个批量刷新完成时发送
 */
export function emitRefreshComplete(data: RefreshCompleteEvent) {
  if (!io) return
  
  io.emit('refresh:complete', data)
}

/**
 * 告警通知事件
 * 检测到告警时发送
 */
export function emitRefreshAlert(alert: RefreshAlertEvent) {
  if (!io) return
  
  io.emit('refresh:alert', alert)
}

// ============================================
// 管理员界面刷新事件
// ============================================

/**
 * 通知管理员刷新待审批申请列表
 */
export function emitAdminRefreshRequests() {
  if (!io) return
  
  io.emit('admin:refresh-requests', {
    timestamp: Date.now()
  })
}

/**
 * 通知管理员刷新待审批释放申请列表
 */
export function emitAdminRefreshRevokeRequests() {
  if (!io) return
  
  io.emit('admin:refresh-revoke-requests', {
    timestamp: Date.now()
  })
}

/**
 * 通知管理员刷新分配记录列表
 */
export function emitAdminRefreshAllocations() {
  if (!io) return

  io.emit('admin:refresh-allocations', {
    timestamp: Date.now()
  })
}

/**
 * 发送注册成功通知（包含账户详细信息）
 */
export function emitRegistrationSuccess(data: {
  taskId: string
  email: string
  password: string
  name?: string
  ssoToken?: string
  timestamp?: number
}) {
  if (!io) return

  const message = `✅ 注册成功 - 邮箱: ${data.email}, 密码: ${data.password}${data.name ? `, 姓名: ${data.name}` : ''}`

  io.emit('registration:success', {
    ...data,
    timestamp: data.timestamp || Date.now()
  })

  persistLog('account', 'success', '账号注册', message, 'account').catch(() => {})
}

/**
 * 发送注册失败通知
 */
export function emitRegistrationFailure(data: {
  taskId: string
  email: string
  password: string
  name?: string
  error: string
  timestamp?: number
}) {
  if (!io) return

  const message = `❌ 注册失败 - 邮箱: ${data.email}, 密码: ${data.password}${data.name ? `, 姓名: ${data.name}` : ''}, 原因: ${data.error}`

  io.emit('registration:failure', {
    ...data,
    timestamp: data.timestamp || Date.now()
  })

  persistLog('account', 'error', '账号注册', message, 'account').catch(() => {})
}
