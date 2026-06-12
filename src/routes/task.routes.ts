/**
 * 任务路由
 */

import { Router } from 'express'
import {
  createTask,
  getTasks,
  getTaskById,
  deleteTask,
  batchDeleteTasks,
  pauseTask,
  resumeTask,
  getTaskStats
} from '../controllers/task.controller'

const router = Router()

// ============================================
// 任务管理路由（认证已禁用 - 个人使用）
// ============================================

router.get('/', getTasks)
router.get('/stats', getTaskStats)
router.get('/:id', getTaskById)
router.post('/', createTask)
router.delete('/:id', deleteTask)
router.post('/batch-delete', batchDeleteTasks)
router.patch('/:id/pause', pauseTask)
router.patch('/:id/resume', resumeTask)

export default router
