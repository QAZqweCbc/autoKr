import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { io, Socket } from 'socket.io-client'

export type LogCategory = 'register' | 'config' | 'account' | 'connection'
export type LogLevel = 'info' | 'success' | 'warning' | 'error'

export interface WsLogEntry {
  id: string
  time: string
  message: string
  category: LogCategory
  level: LogLevel
  source: string
}

export const useWebSocketStore = defineStore('websocket', () => {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  const logs = ref<WsLogEntry[]>([])

  const categorizedLogs = computed(() => ({
    register: logs.value.filter(log => log.category === 'register'),
    config: logs.value.filter(log => log.category === 'config'),
    account: logs.value.filter(log => log.category === 'account'),
    connection: logs.value.filter(log => log.category === 'connection')
  }))

  const connect = () => {
    if (socket.value) return

    socket.value = io('/', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 5
    })

    socket.value.on('connect', () => {
      connected.value = true
      addStructuredLog('connection', 'success', 'WebSocket 已连接', '连接状态')
    })

    socket.value.on('disconnect', () => {
      connected.value = false
      addStructuredLog('connection', 'error', 'WebSocket 已断开', '连接状态')
    })

    socket.value.on('log', (data: { taskId?: string; message: string }) => {
      if (data.taskId) return
      addDerivedLog(data.message, '系统日志')
    })

    socket.value.on('task:log', (data: { taskId: string; message: string }) => {
      addStructuredLog('register', 'info', `[${data.taskId}] ${data.message}`, '任务日志')
    })

    socket.value.on('system:message', (data: { message: string }) => {
      addDerivedLog(data.message, '系统通知')
    })

    socket.value.on('task:update', (data: { taskId: string; status: string; error?: string }) => {
      const message = data.error
        ? `任务 ${data.taskId} 状态 ${data.status}，原因：${data.error}`
        : `任务 ${data.taskId} 状态更新为 ${data.status}`
      addStructuredLog('register', data.status === 'failed' ? 'error' : 'info', message, '任务状态')
    })

    socket.value.on('account:update', () => {
      addStructuredLog('account', 'success', '账号数据已更新', '账号同步')
    })

    socket.value.on('registration:success', (data: any) => {
      const message = `✅ 注册成功 - 邮箱: ${data.email}, 密码: ${data.password}me ? `, 姓名: ${data.name}` : ''}`
      addStructuredLog('account', '', message, '账号注册')
    })

    socket.value.on('registration:failure', (data: any) => {
      const message = `❌ 注册失败 - 邮箱: ${data.email}, 密码: ${data.password}${data.name ? `, 姓名: ${data.name}` : ''}, 原因: ${data.error}`
      addStructuredLog('account', 'error', message, '账号注册')
    })

    socket.value.on('refresh:start', (data: any) => {
      addStructuredLog('account', 'info', `开始刷新 ${data.total || data.totalAccounts || 0} 个账号`, 'Token 刷新')
    })

    socket.value.on('refresh:account', (data: any) => {
      const level: LogLevel = data.success === false ? 'warning' : 'success'
      const details = data.error ? `，原因：${data.error}` : ''
      addStructuredLog('account', level, `账号刷新完成：${data.email || '未知'}${details}`, 'Token 刷新')
    })

    socket.value.on('refresh:complete', (data: any) => {
      addStructuredLog('account', 'success', `批量刷新完成：成功 ${data.success || 0}，失败 ${data.failed || 0}`, 'Token 刷新')
    })

    socket.value.on('refresh:alert', (data: any) => {
      addStructuredLog('account', 'warning', `告警：${data.message || '未知告警'}`, 'Token 刷新')
    })
  }

  const disconnect = () => {
    socket.value?.removeAllListeners()
    socket.value?.disconnect()
    socket.value = null
    connected.value = false
  }

  const addStructuredLog = (category: LogCategory, level: LogLevel, message: string, source: string) => {
    logs.value.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toLocaleTimeString('zh-CN'),
      message,
      category,
      level,
      source
    })

    if (logs.value.length > 1000) {
      logs.value = logs.value.slice(-1000)
    }
  }

  const addDerivedLog = (rawMessage: string, source: string) => {
    const normalized = rawMessage.replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '').trim()
    addStructuredLog(detectCategory(normalized), detectLevel(normalized), normalized, source)
  }

  const detectCategory = (message: string): LogCategory => {
    if (/(WebSocket|连接|断开|重连|socket)/i.test(message)) return 'connection'
    if (/(配置|保存|浏览器|邮箱|数据库|setup)/i.test(message)) return 'config'
    if (/(注册|任务|验证码|创建任务|运行|暂停|恢复)/i.test(message)) return 'register'
    return 'account'
  }

  const detectLevel = (message: string): LogLevel => {
    if (/(失败|错误|断开|异常|告警)/i.test(message)) return 'error'
    if (/(警告|跳过|缺少)/i.test(message)) return 'warning'
    if (/(成功|完成|已连接|已更新)/i.test(message)) return 'success'
    return 'info'
  }

  const clearLogs = () => {
    logs.value = []
  }

  const onTaskUpdate = (callback: () => void) => {
    if (!socket.value) return () => {}
    socket.value.on('task:update', callback)
    return () => socket.value?.off('task:update', callback)
  }

  const onAccountUpdate = (callback: () => void) => {
    if (!socket.value) return () => {}
    socket.value.on('account:update', callback)
    return () => socket.value?.off('account:update', callback)
  }

  return {
    socket,
    connected,
    logs,
    categorizedLogs,
    connect,
    disconnect,
    clearLogs,
    onTaskUpdate,
    onAccountUpdate
  }
})
