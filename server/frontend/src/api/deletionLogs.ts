/**
 * 账号删除日志 API
 */

import axios from './axios'

export interface DeletionLog {
  id: number
  account_id: string
  email: string
  deletion_reason: string
  detected_email: string
  email_subject?: string
  email_from?: string
  email_date?: number
  email_uid?: number
  detected_at: number
  deleted_at: number
  details?: any
}

export interface DeletionLogQueryParams {
  page?: number
  pageSize?: number
  startDate?: number
  endDate?: number
  email?: string
}

export interface DeletionLogResult {
  logs: DeletionLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface DeletionStats {
  totalDeleted: number
  last24Hours: number
  last7Days: number
  last30Days: number
  byReason: Record<string, number>
}

/**
 * 获取删除日志列表
 */
export async function getDeletionLogs(params?: DeletionLogQueryParams) {
  const response = await axios.get<{
    success: boolean
    data: DeletionLogResult
  }>('/deletion-logs', { params })
  return response.data.data
}

/**
 * 获取删除统计
 */
export async function getDeletionStats() {
  const response = await axios.get<{
    success: boolean
    data: DeletionStats
  }>('/deletion-logs/stats')
  return response.data.data
}

/**
 * 获取单条删除日志详情
 */
export async function getDeletionLogById(id: number) {
  const response = await axios.get<{
    success: boolean
    data: DeletionLog
  }>(`/deletion-logs/${id}`)
  return response.data.data
}

/**
 * 手动触发检测
 */
export async function triggerDetection() {
  const response = await axios.post<{
    success: boolean
    data: any
  }>('/deletion-logs/trigger')
  return response.data.data
}
