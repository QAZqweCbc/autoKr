/**
 * 健康检查控制器
 * 提供系统健康状态 API
 */

import { Request, Response } from 'express'
import { getHealthStatus } from '../services/health-check.service'

/**
 * 获取刷新系统健康状态
 * GET /api/health/refresh
 */
export async function getRefreshHealthStatus(req: Request, res: Response) {
  try {
    const healthStatus = await getHealthStatus()
    
    res.json({
      success: true,
      data: healthStatus
    })
  } catch (error: any) {
    console.error('获取健康状态失败:', error.message)
    
    res.status(500).json({
      success: false,
      error: error.message || '获取健康状态失败'
    })
  }
}
