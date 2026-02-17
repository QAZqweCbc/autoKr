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

// GET /api/database/config - 获取数据库配置
router.get('/config', getDatabaseConfig)

// PUT /api/database/config - 更新数据库配置
router.put('/config', updateDatabaseConfig)

// POST /api/database/test - 测试数据库连接（使用提供的配置）
router.post('/test', testDatabaseConnection)

// POST /api/database/test-current - 测试当前配置的连接（使用配置文件中的真实密码）
router.post('/test-current', testCurrentDatabaseConnection)

// GET /api/database/status - 获取数据库状态
router.get('/status', getDatabaseStatus)

export default router
