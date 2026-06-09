import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'

export const useWebSocketStore = defineStore('websocket', () => {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  const logs = ref<Array<{ time: string; message: string }>>([])

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
      addLog('✅ WebSocket 已连接')
    })

    socket.value.on('disconnect', () => {
      connected.value = false
      addLog('❌ WebSocket 已断开')
    })

    socket.value.on('log', (data: { taskId?: string; message: string }) => {
      if (data.taskId) return
      addLog(`💬 ${data.message}`)
    })

    socket.value.on('task:log', (data: { taskId: string; message: string }) => {
      addLog(`📋 [${data.taskId}] ${data.message}`)
    })

    socket.value.on('system:message', (data: { message: string }) => {
      addLog(`🔔 ${data.message}`)
    })

    socket.value.on('task:update', (data: { taskId: string; status: string; error?: string }) => {
      addLog(`📋 任务更新: ${data.taskId} -> ${data.status}`)
    })

    socket.value.on('account:update', () => {
      addLog('📧 账号数据已更新')
    })

    socket.value.on('refresh:start', (data: any) => {
      addLog(`🔄 开始刷新 ${data.total || 0} 个账号`)
    })

    socket.value.on('refresh:account', (data: any) => {
      addLog(`✅ 账号刷新完成: ${data.email || '未知'}`)
    })

    socket.value.on('refresh:complete', (data: any) => {
      addLog(`🎉 批量刷新完成: 成功 ${data.success || 0}, 失败 ${data.failed || 0}`)
    })

    socket.value.on('refresh:alert', (data: any) => {
      addLog(`⚠️ 告警: ${data.message || '未知告警'}`)
    })
  }

  const disconnect = () => {
    socket.value?.removeAllListeners()
    socket.value?.disconnect()
    socket.value = null
    connected.value = false
  }

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString()
    logs.value.push({ time, message })
    
    if (logs.value.length > 1000) {
      logs.value = logs.value.slice(-1000)
    }
  }

  const clearLogs = () => {
    logs.value = []
  }

  // 监听任务更新事件
  const onTaskUpdate = (callback: () => void) => {
    if (!socket.value) return () => {}
    
    socket.value.on('task:update', callback)
    
    // 返回取消订阅函数
    return () => {
      socket.value?.off('task:update', callback)
    }
  }

  // 监听账号更新事件
  const onAccountUpdate = (callback: () => void) => {
    if (!socket.value) return () => {}
    
    socket.value.on('account:update', callback)
    
    // 返回取消订阅函数
    return () => {
      socket.value?.off('account:update', callback)
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
