/**
 * 任务控制器
 */

import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { TaskDB } from '../services/database.adapter'
import { startRegisterTask, getQueueStatus } from '../services/register.service'
import { TaskCreateDTO } from '../models/task.model'

/**
 * 创建任务
 */
export async function createTask(req: Request, res: Response) {
  try {
    const dto: TaskCreateDTO = req.body
    
    // 验证必填字段
    if (!dto.email || !dto.password || !dto.receive_email || !dto.auth_code) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: email, password, receive_email, auth_code'
      })
    }
    
    // 创建任务
    const task = await TaskDB.create({
      id: uuidv4(),
      ...dto,
      status: 'pending'
    })
    
    // 启动注册任务
    startRegisterTask(task)
    
    res.json({
      success: true,
      task
    })
  } catch (error: any) {
    console.error('创建任务失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取任务列表
 */
export async function getTasks(req: Request, res: Response) {
  try {
    const { status } = req.query
    const tasks = await TaskDB.getAll(status as string)
    
    res.json({
      success: true,
      tasks,
      count: tasks.length
    })
  } catch (error: any) {
    console.error('获取任务列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取任务详情
 */
export async function getTaskById(req: Request, res: Response) {
  try {
    const { id } = req.params
    const task = await TaskDB.getById(id as string)
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      })
    }
    
    res.json({
      success: true,
      task
    })
  } catch (error: any) {
    console.error('获取任务详情失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 删除任务
 */
export async function deleteTask(req: Request, res: Response) {
  try {
    const { id } = req.params
    await TaskDB.delete(id as string)
    
    res.json({
      success: true,
      message: '任务已删除'
    })
  } catch (error: any) {
    console.error('删除任务失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 批量删除任务
 */
export async function batchDeleteTasks(req: Request, res: Response) {
  try {
    const { ids } = req.body
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供要删除的任务ID列表'
      })
    }
    
    for (const id of ids) {
      await TaskDB.delete(id as string)
    }
    
    res.json({
      success: true,
      message: `已删除 ${ids.length} 个任务`
    })
  } catch (error: any) {
    console.error('批量删除任务失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 暂停任务
 */
export async function pauseTask(req: Request, res: Response) {
  try {
    const { id } = req.params
    const task = await TaskDB.getById(id as string)
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      })
    }
    
    if (task.status !== 'pending' && task.status !== 'running') {
      return res.status(400).json({
        success: false,
        error: '只能暂停待处理或运行中的任务'
      })
    }
    
    await TaskDB.updateStatus(id as string, 'paused')
    
    res.json({
      success: true,
      message: '任务已暂停'
    })
  } catch (error: any) {
    console.error('暂停任务失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 恢复任务（取消暂停）
 */
export async function resumeTask(req: Request, res: Response) {
  try {
    const { id } = req.params
    const task = await TaskDB.getById(id as string)
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      })
    }
    
    if (task.status !== 'paused') {
      return res.status(400).json({
        success: false,
        error: '只能恢复已暂停的任务'
      })
    }
    
    await TaskDB.updateStatus(id as string, 'pending')
    
    res.json({
      success: true,
      message: '任务已恢复'
    })
  } catch (error: any) {
    console.error('恢复任务失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取任务统计
 */
export async function getTaskStats(req: Request, res: Response) {
  try {
    const stats = await TaskDB.getStats()
    const queueStatus = getQueueStatus()
    
    res.json({
      success: true,
      stats,
      queue: queueStatus
    })
  } catch (error: any) {
    console.error('获取任务统计失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
