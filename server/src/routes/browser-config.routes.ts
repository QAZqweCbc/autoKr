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

// GET /api/config/browser - Get current browser configuration
router.get('/', getBrowserConfig)

// PUT /api/config/browser - Update browser configuration
router.put('/', updateBrowserConfig)

// POST /api/config/browser/test - Test browser launch
router.post('/test', testBrowserConfig)

// GET /api/config/browser/detect - Detect available browsers
router.get('/detect', detectBrowsers)

export default router
