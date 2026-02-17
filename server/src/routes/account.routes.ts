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

// 账号管理
router.get('/', getAccounts)
router.get('/stats', getAccountStats)
router.get('/stats/domain', getDomainStats)
router.get('/stats/daily', getDailyStats)
router.post('/export', exportAccounts)
router.post('/reset-errors', resetAccountErrors)  // 批量重置错误状态
router.post('/:id/reset-error', resetAccountError)  // 重置单个账号错误状态
router.get('/:id', getAccountById)
router.delete('/:id', deleteAccount)

export default router
