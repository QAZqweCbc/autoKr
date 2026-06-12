/**
 * 系统日志控制器
 */

import { Request, Response } from 'express'
import {
  getSystemLogs,
  getRecentSystemLogs,
  cleanupSystemLogs,
  getSystemLogStats
} from '../services/system-log.service'

/**
 * 获取系统日志列表
 */
export async function getSystemLogsHandler(req: Request, res: Response) {
  try {
    const {
      category,
      level,
      startTime,
      endTime,
      limit = 200,
      offset = 0
    } = req.query

    const logs = await getSystemLogs({
      category: category as string | undefined,
      level: level as string | undefined,
      startTime: startTime ? Number(startTime) : undefined,
      endTime: endTime ? Number(endTime) : undefined,
      limit: Number(limit),
      offset: Number(offset)
    })

    res.json({
      success: true,
      logs,
      count: logs.length
    })
  } catch (error: any) {
    console.error('获取系统日志失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取最近的系统日志
 */
export async function getRecentSystemLogsHandler(req: Request, res: Response) {
  try {
    const { limit = 200 } = req.query

    const logs = await getRecentSystemLogs(Number(limit))

    res.json({
      success: true,
      logs
    })
  } catch (error: any) {
    console.error('获取最近系统日志失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 清理旧日志
 */
export async function cleanupSystemLogsHandler(req: Request, res: Response) {
  try {
    const { days = 30 } = req.query
    const deleted = await cleanupSystemLogs(Number(days))

    res.json({
      success: true,
      deletedCount: deleted
    })
  } catch (error: any) {
    console.error('清理系统日志失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取日志统计
 */
export async function getSystemLogStatsHandler(req: Request, res: Response) {
  try {
    const stats = await getSystemLogStats()
    res.json({
      success: true,
      stats
    })
  } catch (error: any) {
    console.error('获取日志统计失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
