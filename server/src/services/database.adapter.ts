/**
 * 数据库适配器 - 统一接口，支持 JSON、MySQL 和 Redis 动态切换
 */

import { Task, TaskStats } from '../models/task.model'
import { Account, AccountStats } from '../models/account.model'
import { TaskDB as JSONTaskDB, AccountDB as JSONAccountDB, initDatabase as initJSON } from './database.service'
import { MySQLTaskDB, MySQLAccountDB, initMySQL, closeMySQL } from './mysql.service'
import { RedisTaskDB, RedisAccountDB } from './redis-storage.service'
import { initRedis, closeRedis } from './redis.service'
import { loadDatabaseConfig, DatabaseConfig } from './database-config.service'

// 重新导出类型
export type { Task, Account }

let currentStorage: 'json' | 'mysql' | 'redis' = 'json'
let config: DatabaseConfig

/**
 * 初始化数据库（根据配置自动选择）
 */
export async function initDatabase() {
  config = loadDatabaseConfig()
  currentStorage = config.storage
  
  console.log(`\n📦 存储模式: ${currentStorage.toUpperCase()}`)
  
  if (currentStorage === 'mysql') {
    // 初始化 MySQL
    if (!config.mysql) {
      throw new Error('MySQL 配置缺失')
    }
    await initMySQL(config.mysql)
    
    // 初始化 Redis（可选，用于缓存）
    if (config.redis && config.redis.host) {
      try {
        await initRedis(config.redis)
      } catch (error) {
        console.warn('⚠️  Redis 连接失败，将不使用缓存')
      }
    }
  } else if (currentStorage === 'redis') {
    // 初始化 Redis（作为主存储）
    if (!config.redis) {
      throw new Error('Redis 配置缺失')
    }
    await initRedis(config.redis)
  } else {
    // 初始化 JSON 文件存储
    initJSON()
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase() {
  if (currentStorage === 'mysql') {
    await closeMySQL()
    await closeRedis()
  } else if (currentStorage === 'redis') {
    await closeRedis()
  }
}

/**
 * 切换存储模式（需要重启服务器）
 */
export function getStorageMode() {
  return currentStorage
}

// ==================== 任务操作适配器 ====================

export const TaskDB = {
  async create(task: Omit<Task, 'created_at' | 'updated_at'>): Promise<Task> {
    const now = Date.now()
    const fullTask = { ...task, created_at: now, updated_at: now } as Task
    
    if (currentStorage === 'mysql') {
      return await MySQLTaskDB.create(fullTask)
    } else if (currentStorage === 'redis') {
      return await RedisTaskDB.create(fullTask)
    } else {
      return JSONTaskDB.create(task)
    }
  },

  async getById(id: string): Promise<Task | null> {
    if (currentStorage === 'mysql') {
      return await MySQLTaskDB.getById(id)
    } else if (currentStorage === 'redis') {
      return await RedisTaskDB.getById(id)
    } else {
      return JSONTaskDB.getById(id) || null
    }
  },

  async getAll(status?: string): Promise<Task[]> {
    if (currentStorage === 'mysql') {
      return await MySQLTaskDB.getAll(status)
    } else if (currentStorage === 'redis') {
      return await RedisTaskDB.getAll(status)
    } else {
      return JSONTaskDB.getAll(status)
    }
  },

  async updateStatus(id: string, status: Task['status'], error?: string): Promise<void> {
    if (currentStorage === 'mysql') {
      await MySQLTaskDB.updateStatus(id, status, error)
    } else if (currentStorage === 'redis') {
      await RedisTaskDB.updateStatus(id, status, error)
    } else {
      JSONTaskDB.updateStatus(id, status, error)
    }
  },

  async delete(id: string): Promise<void> {
    if (currentStorage === 'mysql') {
      await MySQLTaskDB.delete(id)
    } else if (currentStorage === 'redis') {
      await RedisTaskDB.delete(id)
    } else {
      JSONTaskDB.delete(id)
    }
  },

  async getStats(): Promise<TaskStats> {
    if (currentStorage === 'mysql') {
      return await MySQLTaskDB.getStats()
    } else if (currentStorage === 'redis') {
      return await RedisTaskDB.getStats()
    } else {
      return JSONTaskDB.getStats()
    }
  }
}

// ==================== 账号操作适配器 ====================

export const AccountDB = {
  async create(account: Omit<Account, 'created_at'>): Promise<Account> {
    const now = Date.now()
    const fullAccount = { ...account, created_at: now } as Account
    
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.create(fullAccount)
    } else if (currentStorage === 'redis') {
      return await RedisAccountDB.create(fullAccount)
    } else {
      return JSONAccountDB.create(account)
    }
  },

  async getById(id: string): Promise<Account | null> {
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.getById(id)
    } else if (currentStorage === 'redis') {
      return await RedisAccountDB.getById(id)
    } else {
      return JSONAccountDB.getById(id) || null
    }
  },

  async getAll(): Promise<Account[]> {
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.getAll()
    } else if (currentStorage === 'redis') {
      return await RedisAccountDB.getAll()
    } else {
      return JSONAccountDB.getAll()
    }
  },

  async delete(id: string): Promise<void> {
    if (currentStorage === 'mysql') {
      await MySQLAccountDB.delete(id)
    } else if (currentStorage === 'redis') {
      await RedisAccountDB.delete(id)
    } else {
      JSONAccountDB.delete(id)
    }
  },

  async getStats(): Promise<AccountStats> {
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.getStats()
    } else if (currentStorage === 'redis') {
      return await RedisAccountDB.getStats()
    } else {
      return JSONAccountDB.getStats()
    }
  },

  async getDomainStats(): Promise<Array<{ domain: string; count: number }>> {
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.getDomainStats()
    } else if (currentStorage === 'redis') {
      return await RedisAccountDB.getDomainStats()
    } else {
      return JSONAccountDB.getDomainStats()
    }
  },

  async getDailyStats(days: number = 7): Promise<Array<{ date: string; total: number; domain: string }>> {
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.getDailyStats(days)
    } else if (currentStorage === 'redis') {
      return await RedisAccountDB.getDailyStats(days)
    } else {
      return JSONAccountDB.getDailyStats(days)
    }
  },

  async updateToken(id: string, ssoToken: string): Promise<void> {
    // 使用新的 update 方法
    await this.update(id, {
      credentials: {
        accessToken: ssoToken,
        csrfToken: undefined,
        refreshToken: undefined,
        clientId: undefined,
        clientSecret: undefined,
        region: undefined,
        expiresAt: undefined,
        authMethod: undefined,
        provider: undefined
      }
    } as Partial<Account>)
  },

  async updateAccessToken(id: string, accessToken: string): Promise<void> {
    const account = await this.getById(id)
    if (account) {
      await this.update(id, {
        credentials: {
          ...account.credentials,
          accessToken
        }
      })
    }
  },

  async assignToDevice(id: string, deviceId: string, deviceName?: string): Promise<void> {
    await this.update(id, {
      deviceId,
      assignedAt: Date.now(),
      status: 'assigned'
    })
  },

  async updateExtendedInfo(id: string, info: any): Promise<void> {
    // 使用 updateAccountUsage 映射工具
    const account = await this.getById(id)
    if (account) {
      const { updateAccountUsage } = await import('../utils/account-mapper')
      const updatedAccount = updateAccountUsage(account, info)
      await this.update(id, updatedAccount)
    }
  },

  async updateOAuthCredentials(id: string, credentials: {
    refresh_token?: string
    client_id?: string
    client_secret?: string
    region?: string
  }): Promise<void> {
    const account = await this.getById(id)
    if (account) {
      await this.update(id, {
        credentials: {
          ...account.credentials,
          refreshToken: credentials.refresh_token ?? account.credentials.refreshToken,
          clientId: credentials.client_id ?? account.credentials.clientId,
          clientSecret: credentials.client_secret ?? account.credentials.clientSecret,
          region: credentials.region ?? account.credentials.region
        }
      })
    }
  },

  async update(id: string, updates: Partial<Account>): Promise<void> {
    if (currentStorage === 'mysql') {
      await MySQLAccountDB.update(id, updates)
    } else if (currentStorage === 'redis') {
      await RedisAccountDB.update(id, updates)
    } else {
      JSONAccountDB.update(id, updates)
    }
  }
}

// ==================== 检测记录操作适配器 ====================

import { MySQLCheckDB } from './mysql.service'

/**
 * 获取数据库适配器
 */
export function getDB() {
  return {
    TaskDB,
    AccountDB,
    CheckDB: currentStorage === 'mysql' ? MySQLCheckDB : null
  }
}
