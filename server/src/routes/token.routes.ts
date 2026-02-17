/**
 * Token 路由
 */

import { Router } from 'express'
import { 
  submitToken, 
  refreshToken, 
  refreshAllTokens, 
  requestAccount, 
  getAccountStatsByStatus, 
  importFromApp,
  syncAccountUsage,
  syncAllAccountsUsage,
  resetAccountError,
  resetAccountErrors
} from '../controllers/token.controller'
import { getAccountUsage } from '../controllers/client-usage.controller'

const router = Router()

// 提交 SSO Token
router.post('/submit', submitToken)

// 🆕 客户端请求账号使用量（自动检查并刷新Token）
router.get('/:id/usage', getAccountUsage)

// 刷新 Token
router.post('/:id/refresh', refreshToken)

// 刷新所有 Token
router.post('/refresh-all', refreshAllTokens)

// 同步账号使用量
router.post('/:id/sync-usage', syncAccountUsage)

// 批量同步所有账号使用量
router.post('/sync-all-usage', syncAllAccountsUsage)

// 请求获取账号
router.post('/request', requestAccount)

// 获取账号统计
router.get('/stats', getAccountStatsByStatus)

// 从应用端导入Token
router.post('/import-from-app', importFromApp)

// 重置账号错误状态
router.post('/:id/reset-error', resetAccountError)

// 批量重置账号错误状态
router.post('/reset-errors', resetAccountErrors)

export default router
