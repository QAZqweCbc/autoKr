/**
 * 刷新日志控制器
 * 提供刷新日志查询、统计等功能
 */

import { Request, Response } from 'express'
import { getRefreshLogStorage } from '../services/refresh-log-storage.service'
import { RefreshLogQuery } from '../models/refresh-log.model'

/**
 * 查询刷新日志
 * GET /api/refresh/logs
 * 
 * 查询参数：
 * - limit: 返回数量限制（默认10）
 * - offset: 偏移量（默认0）
 * - startDate: 开始时间戳
 * - endDate: 结束时间戳
 * - minSuccessRate: 最小成功率（0-1）
 * - maxSuccessRate: 最大成功率（0-1）
 * - sortBy: 排序字段（timestamp, successCount, failedCount, duration）
 * - sortOrder: 排序顺序（asc, desc，默认desc）
 */
export async function getRefreshLogs(req: Request, res: Response) {
  try {
    const storage = getRefreshLogStorage()
    
    // 解析查询参数
    const query: RefreshLogQuery = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      startDate: req.query.startDate ? parseInt(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? parseInt(req.query.endDate as string) : undefined,
      minSuccessRate: req.query.minSuccessRate ? parseFloat(req.query.minSuccessRate as string) : undefined,
      maxSuccessRate: req.query.maxSuccessRate ? parseFloat(req.query.maxSuccessRate as string) : undefined
    }
    
    // 验证参数
    if (query.limit && (query.limit < 1 || query.limit > 100)) {
      return res.status(400).json({
        error: 'limit 必须在 1-100 之间'
      })
    }
    
    if (query.offset && query.offset < 0) {
      return res.status(400).json({
        error: 'offset 必须大于等于 0'
      })
    }
    
    if (query.minSuccessRate !== undefined && (query.minSuccessRate < 0 || query.minSuccessRate > 1)) {
      return res.status(400).json({
        error: 'minSuccessRate 必须在 0-1 之间'
      })
    }
    
    if (query.maxSuccessRate !== undefined && (query.maxSuccessRate < 0 || query.maxSuccessRate > 1)) {
      return res.status(400).json({
        error: 'maxSuccessRate 必须在 0-1 之间'
      })
    }
    
    // 查询日志
    const result = await storage.query(query)
    
    // 获取排序参数
    const sortBy = req.query.sortBy as string || 'timestamp'
    const sortOrder = req.query.sortOrder as string || 'desc'
    
    // 应用排序
    if (sortBy && ['timestamp', 'successCount', 'failedCount', 'duration'].includes(sortBy)) {
      result.logs.sort((a, b) => {
        let aVal: number, bVal: number
        
        switch (sortBy) {
          case 'timestamp':
            aVal = a.timestamp
            bVal = b.timestamp
            break
          case 'successCount':
            aVal = a.successCount
            bVal = b.successCount
            break
          case 'failedCount':
            aVal = a.failedCount
            bVal = b.failedCount
            break
          case 'duration':
            aVal = a.duration
            bVal = b.duration
            break
          default:
            aVal = a.timestamp
            bVal = b.timestamp
        }
        
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      })
    }
    
    res.json(result)
  } catch (error: any) {
    console.error('查询刷新日志失败:', error)
    res.status(500).json({
      error: '查询刷新日志失败',
      message: error.message
    })
  }
}

/**
 * 获取最近的刷新日志
 * GET /api/refresh/logs/recent
 * 
 * 查询参数：
 * - limit: 返回数量（默认10）
 */
export async function getRecentRefreshLogs(req: Request, res: Response) {
  try {
    const storage = getRefreshLogStorage()
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'limit 必须在 1-100 之间'
      })
    }
    
    const logs = await storage.getRecent(limit)
    
    res.json({
      logs,
      total: logs.length
    })
  } catch (error: any) {
    console.error('获取最近刷新日志失败:', error)
    res.status(500).json({
      error: '获取最近刷新日志失败',
      message: error.message
    })
  }
}

/**
 * 获取刷新日志统计
 * GET /api/refresh/logs/stats
 */
export async function getRefreshLogStats(req: Request, res: Response) {
  try {
    const storage = getRefreshLogStorage()
    const stats = await storage.getStats()
    
    res.json(stats)
  } catch (error: any) {
    console.error('获取刷新日志统计失败:', error)
    res.status(500).json({
      error: '获取刷新日志统计失败',
      message: error.message
    })
  }
}

/**
 * 获取单个刷新日志详情
 * GET /api/refresh/logs/:id
 */
export async function getRefreshLogById(req: Request, res: Response) {
  try {
    const storage = getRefreshLogStorage()
    const { id } = req.params
    
    // 查询所有日志并找到匹配的
    const result = await storage.query({ limit: 1000, offset: 0 })
    const log = result.logs.find(l => l.id === id)
    
    if (!log) {
      return res.status(404).json({
        error: '日志不存在'
      })
    }
    
    res.json(log)
  } catch (error: any) {
    console.error('获取刷新日志详情失败:', error)
    res.status(500).json({
      error: '获取刷新日志详情失败',
      message: error.message
    })
  }
}

/**
 * 清理旧日志
 * DELETE /api/refresh/logs/cleanup
 * 
 * 查询参数：
 * - days: 保留天数（默认30）
 */
export async function cleanupRefreshLogs(req: Request, res: Response) {
  try {
    const storage = getRefreshLogStorage()
    const days = req.query.days ? parseInt(req.query.days as string) : 30
    
    if (days < 1) {
      return res.status(400).json({
        error: 'days 必须大于 0'
      })
    }
    
    const deletedCount = await storage.cleanup(days)
    
    res.json({
      success: true,
      deletedCount,
      message: `已清理 ${deletedCount} 条 ${days} 天前的日志`
    })
  } catch (error: any) {
    console.error('清理刷新日志失败:', error)
    res.status(500).json({
      error: '清理刷新日志失败',
      message: error.message
    })
  }
}
