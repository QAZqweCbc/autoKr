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
  getAutoRefreshConfig,
  saveAutoRefreshConfig,
  getConfigChangeHistory,
  getConfigMigrationHistory,
  validateConfigCompletenessHandler
} from '../controllers/config.controller'

const router = Router()

// 获取配置
router.get('/', getConfig)

// 更新配置
router.put('/', updateConfigHandler)

// 测试连接
router.post('/test', testConnection)

// 获取邮箱配置
router.get('/email', getEmailConfig)

// 更新邮箱配置
router.put('/email', updateEmailConfig)

// 测试邮箱连接
router.post('/email/test', testEmailConnection)

// 获取自动刷新配置
router.get('/auto-refresh', getAutoRefreshConfig)

// 保存自动刷新配置
router.post('/auto-refresh', saveAutoRefreshConfig)

// 获取配置变更历史
router.get('/changes', getConfigChangeHistory)

// 获取配置迁移历史
router.get('/migrations', getConfigMigrationHistory)

// 验证配置完整性
router.get('/validate', validateConfigCompletenessHandler)

export default router
