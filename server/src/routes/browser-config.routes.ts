/**
 * Browser Configuration Routes
 * API endpoints for managing browser configuration
 */

import { Router } from 'express'
import {
  getBrowserConfig,
  updateBrowserConfig,
  testBrowserConfig,
  detectBrowsers
} from '../controllers/browser-config.controller'

const router = Router()

// ============================================
// 浏览器配置路由（认证已禁用 - 个人使用）
// ============================================

router.get('/', getBrowserConfig)
router.get('/detect', detectBrowsers)
router.put('/', updateBrowserConfig)
router.post('/test', testBrowserConfig)

export default router
