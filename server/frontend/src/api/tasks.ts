import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export interface Task {
  id: string
  email: string
  password: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'paused'
  created_at: string
  error?: string
}

export interface TaskStats {
  total: number
  pending: number
  running: number
  success: number
  failed: number
  paused: number
}

export const getTasks = async () => {
  const { data } = await api.get<{ success: boolean; tasks: Task[] }>('/tasks')
  return data
}

export const getTaskStats = async () => {
  const { data } = await api.get<{ success: boolean; stats: TaskStats }>('/tasks/stats')
  return data
}

export const createTask = async (taskData: {
  email: string
  password: string
  receive_email: string
  auth_code: string
  proxy_url?: string
}) => {
  const { data } = await api.post<{ success: boolean; message?: string; error?: string }>('/tasks', taskData)
  return data
}

export const deleteTask = async (id: string) => {
  const { data } = await api.delete<{ success: boolean; message?: string }>(`/tasks/${id}`)
  return data
}

export const batchDeleteTasks = async (ids: string[]) => {
  const { data } = await api.post<{ success: boolean; message?: string }>('/tasks/batch-delete', { ids })
  return data
}

export const pauseTask = async (id: string) => {
  const { data } = await api.patch<{ success: boolean; message?: string }>(`/tasks/${id}/pause`)
  return data
}

export const resumeTask = async (id: string) => {
  const { data } = await api.patch<{ success: boolean; message?: string }>(`/tasks/${id}/resume`)
  return data
}
