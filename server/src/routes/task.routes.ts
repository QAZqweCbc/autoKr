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

// 任务管理
router.post('/', createTask)
router.get('/', getTasks)
router.get('/stats', getTaskStats)
router.get('/:id', getTaskById)
router.delete('/:id', deleteTask)
router.post('/batch-delete', batchDeleteTasks)
router.patch('/:id/pause', pauseTask)
router.patch('/:id/resume', resumeTask)

export default router
