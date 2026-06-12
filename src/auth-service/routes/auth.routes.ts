/**
 * 认证路由
 */

import { Router } from 'express'
import { sendCodeHandler, registerHandler, loginHandler } from '../controllers/auth.controller'

const router = Router()

// 发送验证码
router.post('/send-code', sendCodeHandler)

// 用户注册
router.post('/register', registerHandler)

// 用户登录
router.post('/login', loginHandler)

export default router
