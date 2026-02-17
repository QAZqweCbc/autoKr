import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'

// 数据更新回调类型
type DataUpdateCallback = () => void | Promise<void>

export const useWebSocketStore = defineStore('websocket', () => {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  const logs = ref<Array<{ time: string; message: string }>>([])
  
  // 数据更新回调注册表
  const taskUpdateCallbacks = ref<Set<DataUpdateCallback>>(new Set())
  const accountUpdateCallbacks = ref<Set<DataUpdateCallback>>(new Set())

  const connect = () => {
    if (socket.value?.connected) return

    socket.value = io('/', {
      transports: ['websocket', 'polling'],
      // 调整重连配置
      reconnection: true,
      reconnectionDelay: 5000,      // 重连延迟：5秒
      reconnectionDelayMax: 10000,  // 最大重连延迟：10秒
      reconnectionAttempts: 5       // 最多重连5次
    })

    socket.value.on('connect', () => {
      connected.value = true
      addLog('✅ WebSocket 已连接')
    })

    socket.value.on('disconnect', () => {
      connected.value = false
      addLog('❌ WebSocket 已断开')
    })

    socket.value.on('log', (data: { message: string }) => {
      addLog(`💬 ${data.message}`)
    })

    socket.value.on('task:log', (data: { taskId: string; message: string }) => {
      addLog(`📋 [${data.taskId}] ${data.message}`)
    })

    socket.value.on('system:message', (data: { message: string }) => {
      addLog(`🔔 ${data.message}`)
    })

    // 监听任务更新事件
    socket.value.on('task:update', (data: { taskId: string; status: string; error?: string }) => {
      addLog(`📋 任务更新: ${data.taskId} -> ${data.status}`)
      // 触发所有注册的任务更新回调
      taskUpdateCallbacks.value.forEach(callback => {
        try {
          callback()
        } catch (error) {
          console.error('任务更新回调执行失败:', error)
        }
      })
    })

    // 监听账号更新事件
    socket.value.on('account:update', () => {
      addLog('📧 账号数据已更新')
      // 触发所有注册的账号更新回调
      accountUpdateCallbacks.value.forEach(callback => {
        try {
          callback()
        } catch (error) {
          console.error('账号更新回调执行失败:', error)
        }
      })
    })

    // 监听刷新相关事件
    socket.value.on('refresh:start', (data: any) => {
      addLog(`🔄 开始刷新 ${data.total || 0} 个账号`)
    })

    socket.value.on('refresh:account', (data: any) => {
      addLog(`✅ 账号刷新完成: ${data.email || '未知'}`)
      // 触发账号更新
      accountUpdateCallbacks.value.forEach(callback => {
        try {
          callback()
        } catch (error) {
          console.error('账号更新回调执行失败:', error)
        }
      })
    })

    socket.value.on('refresh:complete', (data: any) => {
      addLog(`🎉 批量刷新完成: 成功 ${data.success || 0}, 失败 ${data.failed || 0}`)
    })

    socket.value.on('refresh:alert', (data: any) => {
      addLog(`⚠️ 告警: ${data.message || '未知告警'}`)
    })
  }

  const disconnect = () => {
    socket.value?.disconnect()
    socket.value = null
    connected.value = false
  }

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString()
    logs.value.push({ time, message })
    
    // 限制日志数量，保留最新1000条
    if (logs.value.length > 1000) {
      logs.value = logs.value.slice(-1000)
    }
  }

  const clearLogs = () => {
    logs.value = []
  }

  // 注册任务更新回调
  const onTaskUpdate = (callback: DataUpdateCallback) => {
    taskUpdateCallbacks.value.add(callback)
    // 返回取消注册函数
    return () => {
      taskUpdateCallbacks.value.delete(callback)
    }
  }

  // 注册账号更新回调
  const onAccountUpdate = (callback: DataUpdateCallback) => {
    accountUpdateCallbacks.value.add(callback)
    // 返回取消注册函数
    return () => {
      accountUpdateCallbacks.value.delete(callback)
    }
  }

  return {
    socket,
    connected,
    logs,
    connect,
    disconnect,
    addLog,
    clearLogs,
    onTaskUpdate,
    onAccountUpdate
  }
})
