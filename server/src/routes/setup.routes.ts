/**
 * 配置向导路由
 */

import { Router } from 'express'
import {
  getSetupStatus,
  generateEnvVarsHandler,
  saveEnvVarsHandler,
  checkDependencies,
  completeSetup,
  resetSetup
} from '../controllers/setup.controller'

const router = Router()

// 获取配置状态
router.get('/status', getSetupStatus)

// 生成环境变量
router.post('/env-vars/generate', generateEnvVarsHandler)

// 保存环境变量
router.post('/env-vars', saveEnvVarsHandler)

// 检测系统依赖
router.get('/check-deps', checkDependencies)

// 标记配置完成
router.post('/complete', completeSetup)

// 重置配置状态（开发/调试用）
router.post('/reset', resetSetup)

export default router
