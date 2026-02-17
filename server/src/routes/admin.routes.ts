/**
 * 管理员路由
 * 处理管理员登录、审批、用户管理等功能
 */

import { Router } from 'express'
import { authMiddleware, adminMiddleware } from '../auth-service/middleware/auth.middleware'
import {
  adminLogin,
  getPendingRequests,
  approveRequest,
  rejectRequest,
  getAllUsers,
  getAllAllocations,
  revokeAllocation,
  updateUserQuota,
  updateUserStatus,
  getAccountStats,
  getAccountDetails,
  getPoolStats,
  refreshAllAccounts
} from '../controllers/admin.controller'

const router = Router()

// 管理员登录（不需要认证）
router.post('/login', adminLogin)

// 以下路由需要管理员认证
router.use(authMiddleware, adminMiddleware)

// 申请管理
router.get('/requests/pending', getPendingRequests)
router.post('/requests/:id/approve', approveRequest)
router.post('/requests/:id/reject', rejectRequest)

// 用户管理
router.get('/users', getAllUsers)
router.put('/users/:id/quota', updateUserQuota)
router.put('/users/:id/status', updateUserStatus)

// 分配管理
router.get('/allocations', getAllAllocations)
router.post('/allocations/:id/revoke', revokeAllocation)

// 统计
router.get('/accounts/stats', getAccountStats)
router.get('/accounts/details', getAccountDetails)
router.get('/stats/pool', getPoolStats)

// 账户管理
router.post('/accounts/refresh-all', refreshAllAccounts)

export default router
