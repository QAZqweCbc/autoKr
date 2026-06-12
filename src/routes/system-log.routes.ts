/**
 * 系统日志路由
 */

import { Router } from 'express'
import {
  getSystemLogsHandler,
  getRecentSystemLogsHandler,
  cleanupSystemLogsHandler,
  getSystemLogStatsHandler
} from '../controllers/system-log.controller'

const router = Router()

// GET /api/system-logs/recent — 获取最近的日志
router.get('/recent', getRecentSystemLogsHandler)

// GET /api/system-logs — 分页查询日志
router.get('/', getSystemLogsHandler)

// GET /api/system-logs/stats — 统计
router.get('/stats', getSystemLogStatsHandler)

// DELETE /api/system-logs/cleanup — 清理旧日志
router.delete('/cleanup', cleanupSystemLogsHandler)

export default router
