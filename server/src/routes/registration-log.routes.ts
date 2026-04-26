/**
 * 注册日志路由
 */

import { Router } from 'express'
import { 
  getLogsHandler, 
  getRecentLogsHandler, 
  getStatsHandler 
} from '../controllers/registration-log.controller'

const router = Router()

// ============================================
// 注册日志路由（认证已禁用 - 个人使用）
// ============================================

router.get('/logs', getLogsHandler)
router.get('/logs/recent', getRecentLogsHandler)
router.get('/stats', getStatsHandler)

export default router
