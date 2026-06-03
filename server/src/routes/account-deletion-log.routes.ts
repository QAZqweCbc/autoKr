/**
 * 账号删除日志路由
 */

import { Router } from 'express'
import {
  getDeletionLogs,
  getDeletionStats,
  getDeletionLogById
} from '../services/account-deletion-log.service'
import { triggerDetection } from '../services/email-detection.service'

const router = Router()

/**
 * 获取删除日志列表
 * GET /api/deletion-logs?page=1&pageSize=20&startDate=xxx&endDate=xxx&email=xxx
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const startDate = req.query.startDate ? parseInt(req.query.startDate as string) : undefined
    const endDate = req.query.endDate ? parseInt(req.query.endDate as string) : undefined
    const email = req.query.email as string | undefined

    const result = await getDeletionLogs({
      page,
      pageSize,
      startDate,
      endDate,
      email
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('获取删除日志失败:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 5000,
        message: '获取删除日志失败',
        details: error.message
      }
    })
  }
})

/**
 * 获取删除统计
 * GET /api/deletion-logs/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getDeletionStats()

    res.json({
      success: true,
      data: stats
    })
  } catch (error: any) {
    console.error('获取删除统计失败:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 5000,
        message: '获取删除统计失败',
        details: error.message
      }
    })
  }
})

/**
 * 获取单条删除日志详情
 * GET /api/deletion-logs/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4000,
          message: '无效的日志ID'
        }
      })
    }

    const log = await getDeletionLogById(id)

    if (!log) {
      return res.status(404).json({
        success: false,
        error: {
          code: 4004,
          message: '日志不存在'
        }
      })
    }

    res.json({
      success: true,
      data: log
    })
  } catch (error: any) {
    console.error('获取删除日志详情失败:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 5000,
        message: '获取删除日志详情失败',
        details: error.message
      }
    })
  }
})

/**
 * 手动触发检测（用于测试）
 * POST /api/deletion-logs/trigger
 */
router.post('/trigger', async (req, res) => {
  try {
    const result = await triggerDetection()

    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('触发检测失败:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 5000,
        message: '触发检测失败',
        details: error.message
      }
    })
  }
})

export default router
