/**
 * 环境配置向导控制器
 * 提供配置向导相关的 API 端点
 */

import { Request, Response } from 'express'
import {
  checkSetupStatus,
  generateEnvVars,
  saveEnvVars,
  checkSystemDependencies,
  markSetupComplete,
  needsRestart,
  getPlatform,
  getInstallCommand,
  EnvVars,
  ConfigChanges
} from '../services/setup.service'
import { logger } from '../utils/logger'

/**
 * 获取配置状态
 * GET /api/setup/status
 */
export function getSetupStatus(req: Request, res: Response) {
  try {
    const status = checkSetupStatus()

    res.json({
      success: true,
      status,
      platform: getPlatform()
    })
  } catch (error: any) {
    logger.error('获取配置状态失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取配置状态失败'
    })
  }
}

/**
 * 生成环境变量
 * POST /api/setup/env-vars/generate
 */
export function generateEnvVarsHandler(req: Request, res: Response) {
  try {
    const vars = generateEnvVars()

    // 不在日志中输出密钥
    logger.info('已生成新的环境变量')

    res.json({
      success: true,
      envVars: vars,
      message: '环境变量已生成'
    })
  } catch (error: any) {
    logger.error('生成环境变量失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '生成环境变量失败'
    })
  }
}

/**
 * 保存环境变量
 * POST /api/setup/env-vars
 */
export function saveEnvVarsHandler(req: Request, res: Response) {
  try {
    const vars = req.body as EnvVars

    // 验证输入
    if (!vars.JWT_SECRET || !vars.ENCRYPTION_KEY) {
      return res.status(400).json({
        success: false,
        error: 'JWT_SECRET 和 ENCRYPTION_KEY 不能为空'
      })
    }

    // 验证密钥长度（至少 32 字符）
    if (vars.JWT_SECRET.length < 32 || vars.ENCRYPTION_KEY.length < 32) {
      return res.status(400).json({
        success: false,
        error: '密钥长度必须至少 32 字符'
      })
    }

    saveEnvVars(vars)

    logger.info('环境变量已保存')

    res.json({
      success: true,
      message: '环境变量已保存到 .env 文件',
      needsRestart: true // 修改环境变量需要重启
    })
  } catch (error: any) {
    logger.error('保存环境变量失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '保存环境变量失败'
    })
  }
}

/**
 * 检测系统依赖
 * GET /api/setup/check-deps
 */
export function checkDependencies(req: Request, res: Response) {
  try {
    const dependencies = checkSystemDependencies()
    const platform = getPlatform()

    // 为每个依赖添加安装命令
    const depsWithCommands = dependencies.map(dep => ({
      ...dep,
      installCommand: dep.installCommand || getInstallCommand(dep.name)
    }))

    res.json({
      success: true,
      dependencies: depsWithCommands,
      platform
    })
  } catch (error: any) {
    logger.error('检测系统依赖失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '检测系统依赖失败'
    })
  }
}

/**
 * 标记配置完成
 * POST /api/setup/complete
 */
export function completeSetup(req: Request, res: Response) {
  try {
    const changes = req.body as ConfigChanges

    // 判断是否需要重启
    const shouldRestart = needsRestart(changes)

    // 标记配置完成
    markSetupComplete()

    logger.info('配置向导已完成')

    res.json({
      success: true,
      message: '配置已完成',
      needsRestart: shouldRestart,
      restartCommand: shouldRestart
        ? (getPlatform() === 'win32' ? 'npm run dev' : 'npm run dev')
        : undefined
    })
  } catch (error: any) {
    logger.error('标记配置完成失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '标记配置完成失败'
    })
  }
}

/**
 * 重置配置状态（开发/调试用）
 * POST /api/setup/reset
 */
export function resetSetup(req: Request, res: Response) {
  try {
    const fs = require('fs')
    const path = require('path')
    const setupFile = path.join(process.cwd(), '.setup-completed')

    if (fs.existsSync(setupFile)) {
      fs.unlinkSync(setupFile)
      logger.info('配置状态已重置')
    }

    res.json({
      success: true,
      message: '配置状态已重置，刷新页面将重新显示配置向导'
    })
  } catch (error: any) {
    logger.error('重置配置状态失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '重置配置状态失败'
    })
  }
}
