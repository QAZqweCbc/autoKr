/**
 * 刷新日志存储服务
 * 支持 MySQL 和 JSON 文件两种存储方式
 */

import { RefreshLog, RefreshLogQuery, RefreshLogQueryResult, RefreshLogStats } from '../models/refresh-log.model'
import { getStorageMode } from './database.adapter'
import { getPool } from './mysql.service'
import path from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

const DATA_DIR = path.join(__dirname, '../../data')
const LOGS_FILE = path.join(DATA_DIR, 'refresh-logs.json')

/**
 * 刷新日志存储接口
 */
export interface RefreshLogStorage {
  /**
   * 保存刷新日志
   */
  save(log: RefreshLog): Promise<void>
  
  /**
   * 查询刷新日志
   */
  query(params: RefreshLogQuery): Promise<RefreshLogQueryResult>
  
  /**
   * 获取最新的N条日志
   */
  getRecent(limit: number): Promise<RefreshLog[]>
  
  /**
   * 获取统计信息
   */
  getStats(): Promise<RefreshLogStats>
  
  /**
   * 清理旧日志（删除指定天数之前的日志）
   */
  cleanup(days: number): Promise<number>
}

/**
 * MySQL 存储实现
 */
class MySQLRefreshLogStorage implements RefreshLogStorage {
  private readonly fallbackStorage = new JSONRefreshLogStorage()
  async save(log: RefreshLog): Promise<void> {
    const pool = getPool()
    const connection = await pool.getConnection()
    
    try {
      await connection.execute(
        `INSERT INTO refresh_logs 
         (id, timestamp, total_accounts, success_count, failed_count, skipped_count, duration, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          log.id,
          log.timestamp,
          log.totalAccounts,
          log.successCount,
          log.failedCount,
          log.skippedCount,
          log.duration,
          JSON.stringify(log.details),
          log.createdAt
        ]
      )
    } finally {
      connection.release()
    }
  }
  
  async query(params: RefreshLogQuery): Promise<RefreshLogQueryResult> {
    const pool = getPool()
    const connection = await pool.getConnection()
    
    try {
      const limit = params.limit || 10
      const offset = params.offset || 0
      
      // 构建查询条件
      const conditions: string[] = []
      const values: any[] = []
      
      if (params.startDate) {
        conditions.push('timestamp >= ?')
        values.push(params.startDate)
      }
      
      if (params.endDate) {
        conditions.push('timestamp <= ?')
        values.push(params.endDate)
      }
      
      if (params.minSuccessRate !== undefined) {
        conditions.push('(success_count / (success_count + failed_count)) >= ?')
        values.push(params.minSuccessRate)
      }
      
      if (params.maxSuccessRate !== undefined) {
        conditions.push('(success_count / (success_count + failed_count)) <= ?')
        values.push(params.maxSuccessRate)
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      
      // 查询总数
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total FROM refresh_logs ${whereClause}`,
        values
      )
      const total = (countRows as any[])[0].total
      
      // 查询日志
      const [rows] = await connection.execute(
        `SELECT * FROM refresh_logs ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
        [...values, limit, offset]
      )
      
      const logs = (rows as any[]).map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        totalAccounts: row.total_accounts,
        successCount: row.success_count,
        failedCount: row.failed_count,
        skippedCount: row.skipped_count,
        duration: row.duration,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
        createdAt: row.created_at
      }))
      
      return {
        logs,
        total,
        hasMore: offset + limit < total
      }
    } finally {
      connection.release()
    }
  }
  
  async getRecent(limit: number): Promise<RefreshLog[]> {
    const result = await this.query({ limit, offset: 0 })
    return result.logs
  }
  
  async getStats(): Promise<RefreshLogStats> {
    const pool = getPool()
    const connection = await pool.getConnection()
    
    try {
      const [rows] = await connection.execute(`
        SELECT 
          COUNT(*) as total_logs,
          SUM(total_accounts) as total_refreshes,
          SUM(success_count) as total_success,
          SUM(failed_count) as total_failed,
          SUM(skipped_count) as total_skipped,
          AVG(success_count / (success_count + failed_count)) as avg_success_rate,
          AVG(duration) as avg_duration,
          MAX(timestamp) as last_refresh_time
        FROM refresh_logs
      `)
      
      const stats = (rows as any[])[0]
      
      return {
        totalLogs: Number(stats.total_logs) || 0,
        totalRefreshes: Number(stats.total_refreshes) || 0,
        totalSuccess: Number(stats.total_success) || 0,
        totalFailed: Number(stats.total_failed) || 0,
        totalSkipped: Number(stats.total_skipped) || 0,
        averageSuccessRate: Number(stats.avg_success_rate) || 0,
        averageDuration: Number(stats.avg_duration) || 0,
        lastRefreshTime: stats.last_refresh_time ? Number(stats.last_refresh_time) : undefined
      }
    } finally {
      connection.release()
    }
  }
  
  async cleanup(days: number): Promise<number> {
    const pool = getPool()
    const connection = await pool.getConnection()
    
    try {
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000)
      
      const [result] = await connection.execute(
        'DELETE FROM refresh_logs WHERE timestamp < ?',
        [cutoffTime]
      )
      
      return (result as any).affectedRows
    } finally {
      connection.release()
    }
  }
}

/**
 * JSON 文件存储实现
 */
class JSONRefreshLogStorage implements RefreshLogStorage {
  private logs: RefreshLog[] = []
  
  constructor() {
    this.loadLogs()
  }
  
  private loadLogs(): void {
    try {
      // 确保数据目录存在
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true })
      }
      
      if (existsSync(LOGS_FILE)) {
        const data = readFileSync(LOGS_FILE, 'utf-8')
        this.logs = JSON.parse(data)
      }
    } catch (error: any) {
      console.error('加载刷新日志失败:', error.message)
      this.logs = []
    }
  }
  
  private saveLogs(): void {
    try {
      writeFileSync(LOGS_FILE, JSON.stringify(this.logs, null, 2))
    } catch (error: any) {
      console.error('保存刷新日志失败:', error.message)
      throw error
    }
  }
  
  async save(log: RefreshLog): Promise<void> {
    this.logs.push(log)
    // 按时间戳降序排序
    this.logs.sort((a, b) => b.timestamp - a.timestamp)
    this.saveLogs()
  }
  
  async query(params: RefreshLogQuery): Promise<RefreshLogQueryResult> {
    const limit = params.limit || 10
    const offset = params.offset || 0
    
    // 过滤日志
    let filtered = [...this.logs]
    
    if (params.startDate) {
      filtered = filtered.filter(log => log.timestamp >= params.startDate!)
    }
    
    if (params.endDate) {
      filtered = filtered.filter(log => log.timestamp <= params.endDate!)
    }
    
    if (params.minSuccessRate !== undefined) {
      filtered = filtered.filter(log => {
        const total = log.successCount + log.failedCount
        if (total === 0) return false
        return (log.successCount / total) >= params.minSuccessRate!
      })
    }
    
    if (params.maxSuccessRate !== undefined) {
      filtered = filtered.filter(log => {
        const total = log.successCount + log.failedCount
        if (total === 0) return true
        return (log.successCount / total) <= params.maxSuccessRate!
      })
    }
    
    const total = filtered.length
    const logs = filtered.slice(offset, offset + limit)
    
    return {
      logs,
      total,
      hasMore: offset + limit < total
    }
  }
  
  async getRecent(limit: number): Promise<RefreshLog[]> {
    const result = await this.query({ limit, offset: 0 })
    return result.logs
  }
  
  async getStats(): Promise<RefreshLogStats> {
    if (this.logs.length === 0) {
      return {
        totalLogs: 0,
        totalRefreshes: 0,
        totalSuccess: 0,
        totalFailed: 0,
        totalSkipped: 0,
        averageSuccessRate: 0,
        averageDuration: 0
      }
    }
    
    const totalLogs = this.logs.length
    const totalRefreshes = this.logs.reduce((sum, log) => sum + log.totalAccounts, 0)
    const totalSuccess = this.logs.reduce((sum, log) => sum + log.successCount, 0)
    const totalFailed = this.logs.reduce((sum, log) => sum + log.failedCount, 0)
    const totalSkipped = this.logs.reduce((sum, log) => sum + log.skippedCount, 0)
    
    const successRates = this.logs
      .filter(log => (log.successCount + log.failedCount) > 0)
      .map(log => log.successCount / (log.successCount + log.failedCount))
    
    const averageSuccessRate = successRates.length > 0
      ? successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length
      : 0
    
    const averageDuration = this.logs.reduce((sum, log) => sum + log.duration, 0) / totalLogs
    
    const lastRefreshTime = this.logs.length > 0 ? this.logs[0].timestamp : undefined
    
    return {
      totalLogs,
      totalRefreshes,
      totalSuccess,
      totalFailed,
      totalSkipped,
      averageSuccessRate,
      averageDuration,
      lastRefreshTime
    }
  }
  
  async cleanup(days: number): Promise<number> {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000)
    const beforeCount = this.logs.length
    
    this.logs = this.logs.filter(log => log.timestamp >= cutoffTime)
    this.saveLogs()
    
    return beforeCount - this.logs.length
  }
}

/**
 * 获取刷新日志存储实例（根据当前存储模式）
 */
let storageInstance: RefreshLogStorage | null = null

export function getRefreshLogStorage(): RefreshLogStorage {
  if (!storageInstance) {
    const mode = getStorageMode()
    
    if (mode === 'mysql') {
      storageInstance = new MySQLRefreshLogStorage()
    } else {
      storageInstance = new JSONRefreshLogStorage()
    }
  }
  
  return storageInstance
}

/**
 * 重置存储实例（用于测试或切换存储模式）
 */
export function resetRefreshLogStorage(): void {
  storageInstance = null
}
