/**
 * Token 刷新日志记录服务
 * 
 * 功能：
 * 1. 批次日志记录 - 记录每次批量刷新的整体情况
 * 2. 账号详情记录 - 记录每个账号的刷新结果
 * 3. 性能指标记录 - 记录耗时、成功率等指标
 */

import { v4 as uuidv4 } from 'uuid'
import {
  RefreshLog,
  RefreshLogCreateDTO,
  RefreshDetail
} from '../models/refresh-log.model'
import { getRefreshLogStorage } from './refresh-log-storage.service'

/**
 * 刷新日志记录器
 */
export class RefreshLogger {
  private logId: string
  private startTime: number
  private details: RefreshDetail[] = []
  private totalAccounts: number = 0
  
  constructor() {
    this.logId = uuidv4()
    this.startTime = Date.now()
  }
  
  /**
   * 设置总账号数
   */
  setTotalAccounts(count: number): void {
    this.totalAccounts = count
  }
  
  /**
   * 记录单个账号的刷新结果
   */
  logAccountRefresh(detail: Omit<RefreshDetail, 'timestamp'>): void {
    this.details.push({
      ...detail,
      timestamp: Date.now()
    })
  }
  
  /**
   * 批量记录账号刷新结果
   */
  logAccountRefreshBatch(details: Omit<RefreshDetail, 'timestamp'>[]): void {
    const timestamp = Date.now()
    this.details.push(...details.map(d => ({ ...d, timestamp })))
  }
  
  /**
   * 完成日志记录并返回完整的日志对象
   * 同时保存到存储
   */
  async finalize(): Promise<RefreshLog> {
    const duration = Date.now() - this.startTime
    
    // 统计结果
    const successCount = this.details.filter(d => d.success && !d.skipped).length
    const failedCount = this.details.filter(d => !d.success && !d.skipped).length
    const skippedCount = this.details.filter(d => d.skipped).length
    
    const log: RefreshLog = {
      id: this.logId,
      timestamp: this.startTime,
      totalAccounts: this.totalAccounts,
      successCount,
      failedCount,
      skippedCount,
      duration,
      details: this.details,
      createdAt: Date.now()
    }
    
    // 保存到存储
    try {
      const storage = getRefreshLogStorage()
      await storage.save(log)
    } catch (error: any) {
      console.error('保存刷新日志失败:', error.message)
      // 不抛出错误，避免影响主流程
    }
    
    return log
  }
  
  /**
   * 获取当前统计信息（用于实时监控）
   */
  getCurrentStats(): {
    processed: number
    success: number
    failed: number
    skipped: number
    duration: number
  } {
    const successCount = this.details.filter(d => d.success && !d.skipped).length
    const failedCount = this.details.filter(d => !d.success && !d.skipped).length
    const skippedCount = this.details.filter(d => d.skipped).length
    
    return {
      processed: this.details.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      duration: Date.now() - this.startTime
    }
  }
}

/**
 * 创建新的日志记录器
 */
export function createRefreshLogger(): RefreshLogger {
  return new RefreshLogger()
}

/**
 * 格式化日志输出（用于控制台显示）
 */
export function formatRefreshLog(log: RefreshLog): string {
  const lines: string[] = []
  
  lines.push('='.repeat(60))
  lines.push(`📊 刷新日志 - ${new Date(log.timestamp).toLocaleString('zh-CN')}`)
  lines.push('='.repeat(60))
  lines.push(`总账号数: ${log.totalAccounts}`)
  lines.push(`成功: ${log.successCount}`)
  lines.push(`失败: ${log.failedCount}`)
  lines.push(`跳过: ${log.skippedCount}`)
  lines.push(`总耗时: ${(log.duration / 1000).toFixed(2)} 秒`)
  
  if (log.details.length > 0) {
    const avgDuration = log.details
      .filter(d => !d.skipped)
      .reduce((sum, d) => sum + d.duration, 0) / (log.successCount + log.failedCount || 1)
    lines.push(`平均耗时: ${(avgDuration / 1000).toFixed(2)} 秒/账号`)
  }
  
  // 成功率
  const totalProcessed = log.successCount + log.failedCount
  if (totalProcessed > 0) {
    const successRate = (log.successCount / totalProcessed * 100).toFixed(1)
    lines.push(`成功率: ${successRate}%`)
  }
  
  lines.push('='.repeat(60))
  
  return lines.join('\n')
}

/**
 * 格式化账号详情输出
 */
export function formatRefreshDetails(details: RefreshDetail[]): string {
  const lines: string[] = []
  
  lines.push('\n账号详情:')
  lines.push('-'.repeat(60))
  
  details.forEach((detail, index) => {
    const status = detail.skipped 
      ? `⏭️  跳过 (${detail.skipReason})`
      : detail.success 
        ? `✅ 成功 (${(detail.duration / 1000).toFixed(2)}s)`
        : `❌ 失败 (${detail.error})`
    
    lines.push(`${index + 1}. ${detail.email} - ${status}`)
  })
  
  lines.push('-'.repeat(60))
  
  return lines.join('\n')
}

/**
 * 计算性能指标
 */
export function calculatePerformanceMetrics(log: RefreshLog): {
  successRate: number
  failureRate: number
  skipRate: number
  averageDuration: number
  totalDuration: number
  throughput: number
} {
  const totalProcessed = log.successCount + log.failedCount
  const totalAccounts = log.totalAccounts
  
  // 计算平均耗时（只计算实际处理的账号）
  const processedDetails = log.details.filter(d => !d.skipped)
  const averageDuration = processedDetails.length > 0
    ? processedDetails.reduce((sum, d) => sum + d.duration, 0) / processedDetails.length
    : 0
  
  // 计算吞吐量（账号数/秒）
  const throughput = log.duration > 0 
    ? (totalProcessed / (log.duration / 1000))
    : 0
  
  return {
    successRate: totalProcessed > 0 ? log.successCount / totalProcessed : 0,
    failureRate: totalProcessed > 0 ? log.failedCount / totalProcessed : 0,
    skipRate: totalAccounts > 0 ? log.skippedCount / totalAccounts : 0,
    averageDuration,
    totalDuration: log.duration,
    throughput
  }
}

/**
 * 生成日志摘要
 */
export function generateLogSummary(log: RefreshLog): string {
  const metrics = calculatePerformanceMetrics(log)
  
  return [
    `刷新完成: ${log.successCount}/${log.totalAccounts} 成功`,
    `成功率: ${(metrics.successRate * 100).toFixed(1)}%`,
    `总耗时: ${(metrics.totalDuration / 1000).toFixed(2)}s`,
    `平均: ${(metrics.averageDuration / 1000).toFixed(2)}s/账号`,
    `吞吐量: ${metrics.throughput.toFixed(1)} 账号/秒`
  ].join(', ')
}
