/**
 * 账号生成器路由
 */

import { Router } from 'express'
import { 
  generateAccountsHandler,
  getGeneratorConfigHandler,
  saveGeneratorConfigHandler
} from '../controllers/generator.controller'

const router = Router()

// ============================================
// 账号生成器路由（认证已禁用 - 个人使用）
// ============================================

router.get('/config', getGeneratorConfigHandler)
router.put('/config', saveGeneratorConfigHandler)
router.post('/', generateAccountsHandler)

export default router
