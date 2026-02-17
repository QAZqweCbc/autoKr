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
    
    socket.on('disconnect', () => {
      console.log(`❌ WebSocket 客户端已断开: ${socket.id}`)
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
 */
export function emitTaskLog(taskId: string, message: string) {
  if (!io) return
  
  // 发送到订阅该任务的客户端
  io.to(`task:${taskId}`).emit('task:log', {
    taskId,
    message,
    timestamp: Date.now()
  })
  
  // 同时广播到所有客户端（用于全局日志）
  io.emit('log', {
    taskId,
    message,
    timestamp: Date.now()
  })
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
