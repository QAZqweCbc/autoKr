/**
 * 配置路由
 */

import { Router } from 'express'
import {
  getConfig,
  updateConfigHandler,
  testConnection,
  getEmailConfig,
  updateEmailConfig,
  testEmailConnection,
  verifyEmailConfigDecryption,
  getAutoRefreshConfig,
  saveAutoRefreshConfig,
  getConfigChangeHistory,
  getConfigMigrationHistory,
  validateConfigCompletenessHandler
} from '../controllers/config.controller'

const router = Router()

// ============================================
// 配置管理路由（认证已禁用 - 个人使用）
// ============================================

router.get('/', getConfig)
router.get('/email', getEmailConfig)
router.get('/email/verify-decryption', verifyEmailConfigDecryption)
router.get('/auto-refresh', getAutoRefreshConfig)
router.get('/changes', getConfigChangeHistory)
router.get('/migrations', getConfigMigrationHistory)
router.get('/validate', validateConfigCompletenessHandler)
router.put('/', updateConfigHandler)
router.post('/test', testConnection)
router.put('/email', updateEmailConfig)
router.post('/email/test', testEmailConnection)
router.post('/auto-refresh', saveAutoRefreshConfig)

export default router
