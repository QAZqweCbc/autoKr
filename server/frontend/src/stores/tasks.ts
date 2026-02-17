import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getTasks, createTask, deleteTask, batchDeleteTasks, pauseTask, resumeTask, type Task, type TaskStats } from '../api/tasks'

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const stats = ref<TaskStats>({
    total: 0,
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
    paused: 0
  })

  // 静默刷新标志（用于WebSocket触发的后台更新）
  let silentRefreshTimer: ReturnType<typeof setTimeout> | null = null

  const loadTasks = async (silent = false) => {
    if (!silent) {
      loading.value = true
    }
    try {
      const data = await getTasks()
      tasks.value = data.tasks
      updateStats()
    } finally {
      if (!silent) {
        loading.value = false
      }
    }
  }

  // 静默刷新（防抖，避免频繁请求）
  const silentRefresh = () => {
    if (silentRefreshTimer) {
      clearTimeout(silentRefreshTimer)
    }
    silentRefreshTimer = setTimeout(() => {
      loadTasks(true)
    }, 500) // 500ms 防抖
  }

  const addTask = async (taskData: {
    email: string
    password: string
    receive_email: string
    auth_code: string
    proxy_url?: string
  }) => {
    const result = await createTask(taskData)
    await loadTasks()
    return result
  }

  const updateStats = () => {
    stats.value = {
      total: tasks.value.length,
      pending: tasks.value.filter(t => t.status === 'pending').length,
      running: tasks.value.filter(t => t.status === 'running').length,
      success: tasks.value.filter(t => t.status === 'success').length,
      failed: tasks.value.filter(t => t.status === 'failed').length,
      paused: tasks.value.filter(t => t.status === 'paused').length
    }
  }

  const removeTask = async (id: string) => {
    await deleteTask(id)
    await loadTasks()
  }

  const removeTasks = async (ids: string[]) => {
    await batchDeleteTasks(ids)
    await loadTasks()
  }

  const pause = async (id: string) => {
    await pauseTask(id)
    await loadTasks()
  }

  const resume = async (id: string) => {
    await resumeTask(id)
    await loadTasks()
  }

  return {
    tasks,
    loading,
    stats,
    loadTasks,
    silentRefresh,
    addTask,
    removeTask,
    removeTasks,
    pause,
    resume
  }
})
