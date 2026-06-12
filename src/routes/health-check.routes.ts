/**
 * 健康检查路由
 * 提供系统健康状态查询接口
 */

import { Router } from 'express'
import { getRefreshHealthStatus } from '../controllers/health-check.controller'

const router = Router()

/**
 * GET /api/health/refresh
 * 获取刷新系统健康状态
 * 
 * 响应示例:
 * {
 *   "success": true,
 *   "data": {
 *     "timestamp": 1234567890,
 *     "accounts": {
 *       "total": 10,
 *       "active": 8,
 *       "banned": 1,
 *       "failed": 1,
 *       "needsRefresh": 2
 *     },
 *     "lastRefresh": {
 *       "time": 1234567890,
 *       "success": 8,
 *       "failed": 2,
 *       "skipped": 0,
 *       "duration": 5000
 *     },
 *     "nextRefresh": 1234567890,
 *     "alerts": [],
 *     "isHealthy": true
 *   }
 * }
 */
router.get('/refresh', getRefreshHealthStatus)

export default router
