/**
 * Token路由
 * 处理用户Token申请和查询
 */

import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import {
  requestToken,
  getMyRequests,
  getMyTokens,
  refreshToken,
  requestRevoke
} from '../controllers/token.controller'

const router = Router()

// 所有Token路由都需要JWT认证
router.use(authMiddleware)

// 提交Token申请
router.post('/request', requestToken)

// 查看我的申请
router.get('/my-requests', getMyRequests)

// 查看我的Token
router.get('/my-tokens', getMyTokens)

// 刷新Token额度
router.post('/refresh/:accountId', refreshToken)

// 请求释放Token
router.post('/:id/request-revoke', requestRevoke)

export default router
