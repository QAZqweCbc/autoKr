/**
 * 账号路由
 */

import { Router } from 'express'
import {
  getAccounts,
  getAccountById,
  deleteAccount,
  exportAccounts,
  getAccountStats,
  getDomainStats,
  getDailyStats,
  resetAccountError,
  resetAccountErrors
} from '../controllers/account.controller'

const router = Router()

// ============================================
// 账号管理路由（认证已禁用 - 个人使用）
// ============================================

router.get('/', getAccounts)
router.get('/stats', getAccountStats)
router.get('/stats/domain', getDomainStats)
router.get('/stats/daily', getDailyStats)
router.get('/:id', getAccountById)
router.post('/:id/reset-error', resetAccountError)
router.post('/export', exportAccounts)
router.post('/reset-errors', resetAccountErrors)
router.delete('/:id', deleteAccount)

export default router
