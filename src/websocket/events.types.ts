/**
 * WebSocket 事件类型定义
 * 
 * 本文件定义了所有 WebSocket 事件的数据结构
 */

// ============================================
// Token 刷新相关事件
// ============================================

/**
 * 刷新开始事件数据
 * 事件名: refresh:start
 * 触发时机: 批量刷新开始时
 */
export interface RefreshStartEvent {
  timestamp: number        // 开始时间戳
  totalAccounts: number    // 总账号数
}

/**
 * 单个账号刷新完成事件数据
 * 事件名: refresh:account
 * 触发时机: 每个账号刷新完成时（包括成功、失败、跳过）
 */
export interface RefreshAccountEvent {
  accountId: string        // 账号ID
  email: string            // 账号邮箱
  success: boolean         // 是否成功
  error?: string           // 错误信息（失败时）
  duration?: number        // 耗时（毫秒）
  skipped?: boolean        // 是否跳过
  skipReason?: string      // 跳过原因
}

/**
 * 批量刷新完成事件数据
 * 事件名: refresh:complete
 * 触发时机: 整个批量刷新完成时
 */
export interface RefreshCompleteEvent {
  timestamp: number        // 完成时间戳
  successCount: number     // 成功数
  failedCount: number      // 失败数
  skippedCount: number     // 跳过数
  duration: number         // 总耗时（毫秒）
}

/**
 * 告警通知事件数据
 * 事件名: refresh:alert
 * 触发时机: 检测到告警时
 */
export interface RefreshAlertEvent {
  level: 'ERROR' | 'WARNING' | 'INFO'  // 告警级别
  message: string                       // 告警信息
  timestamp: number                     // 告警时间戳
}

// ============================================
// 其他系统事件
// ============================================

/**
 * 任务更新事件数据
 * 事件名: task:update
 */
export interface TaskUpdateEvent {
  taskId: string
  status: string
  error?: string
  timestamp: number
}

/**
 * 账号更新事件数据
 * 事件名: account:update
 */
export interface AccountUpdateEvent {
  timestamp: number
}

/**
 * 任务日志事件数据
 * 事件名: task:log
 */
export interface TaskLogEvent {
  taskId: string
  message: string
  timestamp: number
}

/**
 * 系统消息事件数据
 * 事件名: system:message
 */
export interface SystemMessageEvent {
  message: string
  level: 'info' | 'warning' | 'error'
  timestamp: number
}

// ============================================
// WebSocket 事件映射
// ============================================

/**
 * 所有 WebSocket 事件的类型映射
 * 用于类型安全的事件发送和接收
 */
export interface WebSocketEvents {
  // Token 刷新事件
  'refresh:start': RefreshStartEvent
  'refresh:account': RefreshAccountEvent
  'refresh:complete': RefreshCompleteEvent
  'refresh:alert': RefreshAlertEvent
  
  // 任务事件
  'task:update': TaskUpdateEvent
  'task:log': TaskLogEvent
  
  // 账号事件
  'account:update': AccountUpdateEvent
  
  // 系统事件
  'system:message': SystemMessageEvent
}
