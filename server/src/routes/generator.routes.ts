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

// 获取生成器配置
router.get('/config', getGeneratorConfigHandler)

// 保存生成器配置
router.put('/config', saveGeneratorConfigHandler)

// 生成账号
router.post('/', generateAccountsHandler)

export default router
