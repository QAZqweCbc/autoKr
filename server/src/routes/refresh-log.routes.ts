/**
 * 刷新日志路由
 */

import { Router } from 'express'
import {
  getRefreshLogs,
  getRecentRefreshLogs,
  getRefreshLogStats,
  getRefreshLogById,
  cleanupRefreshLogs
} from '../controllers/refresh-log.controller'

const router = Router()

// ============================================
// 刷新日志路由（认证已禁用 - 个人使用）
// ============================================

router.get('/logs', getRefreshLogs)
router.get('/logs/recent', getRecentRefreshLogs)
router.get('/logs/stats', getRefreshLogStats)
router.get('/logs/:id', getRefreshLogById)
router.delete('/logs/cleanup', cleanupRefreshLogs)

export default router
