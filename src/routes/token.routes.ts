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

// ============================================
// Token 管理路由（认证已禁用 - 个人使用）
// ============================================

router.get('/:id/usage', getAccountUsage)
router.get('/stats', getAccountStatsByStatus)
router.post('/submit', submitToken)
router.post('/:id/refresh', refreshToken)
router.post('/refresh-all', refreshAllTokens)
router.post('/:id/sync-usage', syncAccountUsage)
router.post('/sync-all-usage', syncAllAccountsUsage)
router.post('/request', requestAccount)
router.post('/import-from-app', importFromApp)
router.post('/:id/reset-error', resetAccountError)
router.post('/reset-errors', resetAccountErrors)

export default router
