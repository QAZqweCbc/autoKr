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

// 获取注册日志列表
router.get('/logs', getLogsHandler)

// 获取最近的注册日志
router.get('/logs/recent', getRecentLogsHandler)

// 获取注册统计
router.get('/stats', getStatsHandler)

export default router
