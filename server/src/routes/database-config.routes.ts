/**
 * 数据库配置路由
 */

import { Router } from 'express'
import {
  getDatabaseConfig,
  updateDatabaseConfig,
  testDatabaseConnection,
  testCurrentDatabaseConnection,
  getDatabaseStatus
} from '../controllers/database-config.controller'

const router = Router()

// ============================================
// 数据库配置路由（认证已禁用 - 个人使用）
// ============================================

router.get('/config', getDatabaseConfig)
router.get('/status', getDatabaseStatus)
router.put('/config', updateDatabaseConfig)
router.post('/test', testDatabaseConnection)
router.post('/test-current', testCurrentDatabaseConnection)

export default router
