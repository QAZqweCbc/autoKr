/**
 * 注册日志控制器
 */

import { Request, Response } from 'express'
import { 
  getRegistrationLogs, 
  getRegistrationStats, 
  getRecentRegistrationLogs 
} from '../services/registration-log.service'

/**
 * 获取注册日志列表
 */
export async function getLogsHandler(req: Request, res: Response) {
  try {
    const { 
      email, 
      status, 
      startTime, 
      endTime, 
      limit = 50, 
      offset = 0 
    } = req.query
    
    const logs = await getRegistrationLogs({
      email: email as string,
      status: status as 'success' | 'failed',
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
    console.error('获取注册日志失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取最近的注册日志
 */
export async function getRecentLogsHandler(req: Request, res: Response) {
  try {
    const { limit = 10 } = req.query
    
    const logs = await getRecentRegistrationLogs(Number(limit))
    
    res.json({
      success: true,
      logs
    })
  } catch (error: any) {
    console.error('获取最近注册日志失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取注册统计
 */
export async function getStatsHandler(req: Request, res: Response) {
  try {
    const { startTime, endTime } = req.query
    
    const stats = await getRegistrationStats(
      startTime ? Number(startTime) : undefined,
      endTime ? Number(endTime) : undefined
    )
    
    res.json({
      success: true,
      stats
    })
  } catch (error: any) {
    console.error('获取注册统计失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
