/**
 * 路由汇总
 */

import { Router } from 'express'
import taskRoutes from './task.routes'
import accountRoutes from './account.routes'
import generatorRoutes from './generator.routes'
import configRoutes from './config.routes'
import databaseConfigRoutes from './database-config.routes'
import tokenRoutes from './token.routes'
import checkRoutes from './check.routes'
import browserConfigRoutes from './browser-config.routes'
import adminRoutes from './admin.routes'
import refreshLogRoutes from './refresh-log.routes'
import healthCheckRoutes from './health-check.routes'
import registrationLogRoutes from './registration-log.routes'
import deletionLogRoutes from './account-deletion-log.routes'
import systemLogRoutes from './system-log.routes'
import setupRoutes from './setup.routes'
import { getStorageMode } from '../services/database.adapter'

const router = Router()

// 挂载路由
router.use('/tasks', taskRoutes)
router.use('/accounts', accountRoutes)
router.use('/generator', generatorRoutes)
router.use('/config', configRoutes)
router.use('/config/browser', browserConfigRoutes)
router.use('/database', databaseConfigRoutes)  // 新增数据库配置路由
router.use('/setup', setupRoutes)  // 配置向导路由
router.use('/token', tokenRoutes)
router.use('/check', checkRoutes)
router.use('/admin', adminRoutes)  // 新增管理员路由
router.use('/refresh', refreshLogRoutes)  // 刷新日志路由
router.use('/health', healthCheckRoutes)  // 健康检查路由
router.use('/registration', registrationLogRoutes)  // 注册日志路由
router.use('/deletion-logs', deletionLogRoutes)  // 账号删除日志路由
router.use('/system-logs', systemLogRoutes)  // 系统实时日志路由

// 基础健康检查（保留向后兼容）
router.get('/health-basic', (req, res) => {
  res.json({
    status: 'ok',
    storage: getStorageMode(),
    timestamp: Date.now(),
    uptime: process.uptime()
  })
})

export default router
