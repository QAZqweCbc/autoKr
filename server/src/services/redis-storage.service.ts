/**
 * Redis 存储服务 - 完整的数据持久化实现（支持新的嵌套结构）
 */

import { getRedis } from './redis.service'
import { Task, TaskStats } from '../models/task.model'
import { Account, AccountStats } from '../models/account.model'
import { accountToFlat, flatToAccount } from '../utils/account-mapper'

// ==================== 任务操作 ====================

export const RedisTaskDB = {
  async create(task: Task): Promise<Task> {
    const redis = getRedis()
    const taskKey = `task:${task.id}`
    
    // 存储任务详情（Hash结构）
    await redis.hmset(taskKey, {
      id: task.id,
      email: task.email,
      password: task.password,
      receive_email: task.receive_email || '',
      auth_code: task.auth_code || '',
      client_id: task.client_id || '',
      proxy_url: task.proxy_url || '',
      status: task.status,
      error: task.error || '',
      created_at: task.created_at.toString(),
      updated_at: task.updated_at.toString()
    })
    
    // 添加到任务列表（Sorted Set，按创建时间排序）
    await redis.zadd('tasks:all', task.created_at, task.id)
    
    // 添加到状态索引
    await redis.sadd(`tasks:status:${task.status}`, task.id)
    
    return task
  },

  async getById(id: string): Promise<Task | null> {
    const redis = getRedis()
    const taskKey = `task:${id}`
    
    const data = await redis.hgetall(taskKey)
    if (!data || !data.id) return null
    
    return {
      id: data.id,
      email: data.email,
      password: data.password,
      receive_email: data.receive_email || undefined,
      auth_code: data.auth_code || undefined,
      client_id: data.client_id || undefined,
      proxy_url: data.proxy_url || undefined,
      status: data.status as Task['status'],
      error: data.error || undefined,
      created_at: parseInt(data.created_at),
      updated_at: parseInt(data.updated_at)
    }
  },

  async getAll(status?: string): Promise<Task[]> {
    const redis = getRedis()
    
    let taskIds: string[]
    
    if (status) {
      // 从状态索引获取
      taskIds = await redis.smembers(`tasks:status:${status}`)
    } else {
      // 从全部任务列表获取（按时间倒序）
      taskIds = await redis.zrevrange('tasks:all', 0, -1)
    }
    
    const tasks: Task[] = []
    for (const id of taskIds) {
      const task = await this.getById(id)
      if (task) tasks.push(task)
    }
    
    return tasks
  },

  async updateStatus(id: string, status: Task['status'], error?: string): Promise<void> {
    const redis = getRedis()
    const task = await this.getById(id)
    if (!task) return
    
    // 从旧状态索引移除
    await redis.srem(`tasks:status:${task.status}`, id)
    
    // 更新任务状态
    const updates: any = {
      status,
      updated_at: Date.now().toString()
    }
    if (error !== undefined) {
      updates.error = error
    }
    
    await redis.hmset(`task:${id}`, updates)
    
    // 添加到新状态索引
    await redis.sadd(`tasks:status:${status}`, id)
  },

  async delete(id: string): Promise<void> {
    const redis = getRedis()
    const task = await this.getById(id)
    if (!task) return
    
    // 删除任务详情
    await redis.del(`task:${id}`)
    
    // 从任务列表移除
    await redis.zrem('tasks:all', id)
    
    // 从状态索引移除
    await redis.srem(`tasks:status:${task.status}`, id)
  },

  async getStats(): Promise<TaskStats> {
    const redis = getRedis()
    
    const total = await redis.zcard('tasks:all')
    const pending = await redis.scard('tasks:status:pending')
    const running = await redis.scard('tasks:status:running')
    const success = await redis.scard('tasks:status:success')
    const failed = await redis.scard('tasks:status:failed')
    const paused = await redis.scard('tasks:status:paused')
    
    return {
      total,
      pending,
      running,
      success,
      failed,
      paused
    }
  }
}

// ==================== 账号操作 ====================

export const RedisAccountDB = {
  async create(account: Account): Promise<Account> {
    const redis = getRedis()
    const accountKey = `account:${account.id}`
    const flat = accountToFlat(account)
    
    // 存储账号详情（Hash结构）- 使用扁平化字段
    const hashData: Record<string, string> = {}
    Object.entries(flat).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        hashData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value)
      }
    })
    
    await redis.hmset(accountKey, hashData)
    
    // 添加到账号列表（Sorted Set，按创建时间排序）
    await redis.zadd('accounts:all', account.createdAt, account.id)
    
    // 添加到邮箱索引（用于快速查找）
    await redis.set(`account:email:${account.email}`, account.id)
    
    // 添加到域名统计（Hash结构）
    const domain = account.email.split('@')[1]
    await redis.hincrby('accounts:domains', domain, 1)
    
    // 添加到每日统计（Hash结构）
    const date = new Date(account.createdAt).toISOString().split('T')[0]
    await redis.hincrby(`accounts:daily:${date}`, domain, 1)
    await redis.hincrby(`accounts:daily:${date}`, '_total', 1)
    
    return account
  },

  async getById(id: string): Promise<Account | null> {
    const redis = getRedis()
    const accountKey = `account:${id}`
    
    const data = await redis.hgetall(accountKey)
    if (!data || !data.id) return null
    
    // 转换回嵌套结构
    return flatToAccount(data as any)
  },

  async getAll(): Promise<Account[]> {
    const redis = getRedis()
    
    // 从账号列表获取所有ID（按时间倒序）
    const accountIds = await redis.zrevrange('accounts:all', 0, -1)
    
    const accounts: Account[] = []
    for (const id of accountIds) {
      const account = await this.getById(id)
      if (account) accounts.push(account)
    }
    
    return accounts
  },

  async update(id: string, updates: Partial<Account>): Promise<void> {
    const redis = getRedis()
    const existing = await this.getById(id)
    if (!existing) return
    
    // 合并更新
    const merged = { ...existing, ...updates }
    const flat = accountToFlat(merged)
    
    const hashData: Record<string, string> = {}
    Object.entries(flat).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        hashData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value)
      }
    })
    
    await redis.hmset(`account:${id}`, hashData)
  },

  async delete(id: string): Promise<void> {
    const redis = getRedis()
    const account = await this.getById(id)
    if (!account) return
    
    const domain = account.email.split('@')[1]
    const date = new Date(account.createdAt).toISOString().split('T')[0]
    
    // 删除账号详情
    await redis.del(`account:${id}`)
    
    // 从账号列表移除
    await redis.zrem('accounts:all', id)
    
    // 删除邮箱索引
    await redis.del(`account:email:${account.email}`)
    
    // 更新域名统计
    await redis.hincrby('accounts:domains', domain, -1)
    
    // 更新每日统计
    await redis.hincrby(`accounts:daily:${date}`, domain, -1)
    await redis.hincrby(`accounts:daily:${date}`, '_total', -1)
  },

  async getStats(): Promise<AccountStats> {
    const redis = getRedis()
    const total = await redis.zcard('accounts:all')
    return { total }
  },

  async getDomainStats(): Promise<Array<{ domain: string; count: number }>> {
    const redis = getRedis()
    const domains = await redis.hgetall('accounts:domains')
    
    return Object.entries(domains)
      .map(([domain, count]) => ({
        domain,
        count: parseInt(count as string)
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
  },

  async getDailyStats(days: number = 7): Promise<Array<{ date: string; total: number; domain: string }>> {
    const redis = getRedis()
    const result: Array<{ date: string; total: number; domain: string }> = []
    
    // 获取最近N天的日期
    const now = new Date()
    for (let i = 0; i < days; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const dailyData = await redis.hgetall(`accounts:daily:${dateStr}`)
      
      if (dailyData && Object.keys(dailyData).length > 0) {
        for (const [key, count] of Object.entries(dailyData)) {
          if (key !== '_total') {
            result.push({
              date: dateStr,
              domain: key,
              total: parseInt(count as string)
            })
          }
        }
      }
    }
    
    return result.sort((a, b) => b.date.localeCompare(a.date))
  }
}
