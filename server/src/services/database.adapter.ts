/**
 * 数据库适配器 - 统一接口，支持 JSON、MySQL 和 Redis 动态切换
 */

import { Task, TaskStats } from '../models/task.model'
import { Account, AccountStats } from '../models/account.model'
import { MySQLTaskDB, initMySQL, closeMySQL } from './mysql.service'
import { MySQLAccountDB } from './mysql-account.service'
import { RedisTaskDB, RedisAccountDB } from './redis-storage.service'
import { initRedis, closeRedis } from './redis.service'
import { loadDatabaseConfig, DatabaseConfig } from './database-config.service'

// 重新导出类型
export type { Task, Account }

import {
  tryBecomeInitializer,
  waitForDatabaseInit,
  markPreCheckDone,
  markInitDone,
  getInitState
} from './database-init-coordinator.service'

let currentStorage: 'mysql' | 'redis' = 'mysql'
let config: DatabaseConfig
let isInitialized = false
let initializationPromise: Promise<void> | null = null
let preCheckPassed = false  // 标记预检是否已通过
let isInitializer = false  // 当前进程是否为初始化进程

/**
 * 初始化数据库（根据配置自动选择，支持多进程共享初始化）
 */
export async function initDatabase() {
  // 如果已经在初始化中，返回同一个Promise
  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = (async () => {
    try {
      // 检查是否已有其他进程完成初始化
      const existingState = getInitState()
      if (existingState?.initialized) {
        console.log('ℹ️  检测到数据库已由其他服务初始化完成')
        console.log(`   存储模式: ${existingState.storageMode.toUpperCase()}`)
        currentStorage = existingState.storageMode

        // 为当前进程创建自己的连接池
        await createConnectionPool(existingState.storageMode)

        isInitialized = true
        console.log('✅ 数据库连接池创建完成（复用已有初始化）')
        return
      }

      // 尝试成为初始化进程
      isInitializer = tryBecomeInitializer()

      if (!isInitializer) {
        // 不是初始化进程，等待主进程完成初始化
        console.log('ℹ️  等待主服务完成数据库初始化...')
        const state = await waitForDatabaseInit()
        currentStorage = state.storageMode

        // 为当前进程创建自己的连接池
        await createConnectionPool(state.storageMode)

        isInitialized = true
        console.log('✅ 数据库连接池创建完成')
        return
      }

      // 作为主初始化进程，执行完整初始化
      console.log('🎯 当前进程负责数据库初始化')
      config = loadDatabaseConfig()
      currentStorage = config.storage

      console.log(`\n📦 存储模式: ${currentStorage.toUpperCase()}`)

      if (currentStorage === 'mysql') {
        // 初始化 MySQL
        if (!config.mysql) {
          throw new Error('MySQL 配置缺失')
        }
        await initMySQL(config.mysql, preCheckPassed)

        // 初始化 Redis（可选，用于缓存）
        if (config.redis && config.redis.host && config.redis.host.trim() !== '') {
          try {
            await initRedis(config.redis)
          } catch (error) {
            console.warn('⚠️  Redis 连接失败，将不使用缓存')
          }
        } else {
          console.log('ℹ️  Redis 未配置，跳过缓存初始化')
        }
      } else if (currentStorage === 'redis') {
        // 初始化 Redis（作为主存储）
        if (!config.redis || !config.redis.host || config.redis.host.trim() === '') {
          throw new Error('Redis 配置缺失或主机地址为空')
        }
        await initRedis(config.redis)
      } else {
        throw new Error(`不支持的存储模式: ${currentStorage}。仅支持 'mysql' 或 'redis'`)
      }

      isInitialized = true
      markInitDone(currentStorage)

      console.log('✅ 数据库初始化完成（主进程）')
    } catch (error: any) {
      console.error('❌ 数据库初始化失败:', error.message)
      isInitialized = false
      initializationPromise = null
      throw error
    }
  })()

  return initializationPromise
}

/**
 * 为当前进程创建数据库连接池（不执行表创建等初始化操作）
 */
async function createConnectionPool(storageMode: 'mysql' | 'redis') {
  config = loadDatabaseConfig()

  if (storageMode === 'mysql') {
    if (!config.mysql) {
      throw new Error('MySQL 配置缺失')
    }

    // 只创建连接池，不执行初始化
    const mysql = await import('mysql2/promise')
    const { getPool, setPool } = await import('./mysql.service')

    const pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    })

    // 测试连接
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()

    // 设置全局连接池
    setPool(pool)

    console.log('✅ MySQL 连接池已创建')

    // 初始化 Redis（可选，用于缓存）
    if (config.redis && config.redis.host && config.redis.host.trim() !== '') {
      try {
        await initRedis(config.redis)
      } catch (error) {
        console.warn('⚠️  Redis 连接失败，将不使用缓存')
      }
    }
  } else if (storageMode === 'redis') {
    if (!config.redis || !config.redis.host || config.redis.host.trim() === '') {
      throw new Error('Redis 配置缺失或主机地址为空')
    }
    await initRedis(config.redis)
  } else {
    throw new Error(`不支持的存储模式: ${storageMode}。仅支持 'mysql' 或 'redis'`)
  }
}

/**
 * 检查数据库是否已初始化
 */
export function isDatabaseInitialized(): boolean {
  return isInitialized
}

/**
 * 等待数据库初始化完成
 */
export async function waitForInitializationPromise(timeoutMs: number = 30000): Promise<void> {
  if (isInitialized) {
    return
  }
  
  if (initializationPromise) {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('数据库初始化超时')), timeoutMs)
    })
    
    await Promise.race([initializationPromise, timeoutPromise])
    return
  }
  
  throw new Error('数据库未开始初始化')
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

/**
 * 更新存储模式（用于热重载）
 * @internal 仅供 database-reload.service 使用
 */
export function updateStorageMode(newStorage: 'mysql' | 'redis') {
  console.log(`🔄 适配器存储模式更新: ${currentStorage} → ${newStorage}`)
  currentStorage = newStorage
  isInitialized = true
  initializationPromise = null
}

// ==================== 任务操作适配器 ====================

export const TaskDB = {
  async create(task: Omit<Task, 'created_at' | 'updated_at'>): Promise<Task> {
    const now = Date.now()
    const fullTask = { ...task, created_at: now, updated_at: now } as Task

    if (currentStorage === 'mysql') {
      return await MySQLTaskDB.create(fullTask)
    } else {
      return await RedisTaskDB.create(fullTask)
    }
  },

  async getById(id: string): Promise<Task | null> {
    if (currentStorage === 'mysql') {
      return await MySQLTaskDB.getById(id)
    } else {
      return await RedisTaskDB.getById(id)
    }
  },

  async getAll(status?: string): Promise<Task[]> {
    if (currentStorage === 'mysql') {
      return await MySQLTaskDB.getAll(status)
    } else {
      return await RedisTaskDB.getAll(status)
    }
  },

  async updateStatus(id: string, status: Task['status'], error?: string): Promise<void> {
    if (currentStorage === 'mysql') {
      await MySQLTaskDB.updateStatus(id, status, error)
    } else {
      await RedisTaskDB.updateStatus(id, status, error)
    }
  },

  async delete(id: string): Promise<void> {
    if (currentStorage === 'mysql') {
      await MySQLTaskDB.delete(id)
    } else {
      await RedisTaskDB.delete(id)
    }
  },

  async getStats(): Promise<TaskStats> {
    if (currentStorage === 'mysql') {
      return await MySQLTaskDB.getStats()
    } else {
      return await RedisTaskDB.getStats()
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
    } else {
      return await RedisAccountDB.create(fullAccount)
    }
  },

  async getById(id: string): Promise<Account | null> {
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.getById(id)
    } else {
      return await RedisAccountDB.getById(id)
    }
  },

  async getAll(): Promise<Account[]> {
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.getAll()
    } else {
      return await RedisAccountDB.getAll()
    }
  },

  async delete(id: string): Promise<void> {
    if (currentStorage === 'mysql') {
      await MySQLAccountDB.delete(id)
    } else {
      await RedisAccountDB.delete(id)
    }
  },

  async getStats(): Promise<AccountStats> {
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.getStats()
    } else {
      return await RedisAccountDB.getStats()
    }
  },

  async getDomainStats(): Promise<Array<{ domain: string; count: number }>> {
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.getDomainStats()
    } else {
      return await RedisAccountDB.getDomainStats()
    }
  },

  async getDailyStats(days: number = 7): Promise<Array<{ date: string; total: number; domain: string }>> {
    if (currentStorage === 'mysql') {
      return await MySQLAccountDB.getDailyStats(days)
    } else {
      return await RedisAccountDB.getDailyStats(days)
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
    access_token?: string
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
          // 显式保留 ssoToken，防止丢失
          ssoToken: account.credentials.ssoToken,
          // 更新或保留其他字段
          accessToken: credentials.access_token ?? account.credentials.accessToken,
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
    } else {
      await RedisAccountDB.update(id, updates)
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

// ============================================
// 数据库热重载（原 database-reload.service.ts）
// ============================================

/**
 * 关闭当前数据库连接（供热重载使用）
 */
async function closeCurrentReloadConnections(): Promise<void> {
  try {
    if (currentStorage === 'mysql') {
      try {
        await closeMySQL()
      } catch (error: any) {
        console.warn('⚠️  关闭 MySQL 连接时出错:', error.message)
      }

      try {
        await closeRedis()
      } catch (error: any) {
        console.warn('⚠️  关闭 Redis 连接时出错:', error.message)
      }
    } else if (currentStorage === 'redis') {
      try {
        await closeRedis()
      } catch (error: any) {
        console.warn('⚠️  关闭 Redis 连接时出错:', error.message)
      }
    }
  } catch (error: any) {
    console.warn('⚠️  关闭连接时出现警告:', error.message)
  }
}

/**
 * 重新加载数据库连接（热重载）
 */
export async function reloadDatabase(): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log('🔄 开始热重载数据库连接...')
  console.log('='.repeat(60))

  const oldStorage = currentStorage
  const config = loadDatabaseConfig()
  const newStorage = config.storage

  try {
    // 1. 关闭现有连接
    console.log('📤 关闭现有连接 (' + oldStorage.toUpperCase() + ')...')
    await closeCurrentReloadConnections()

    console.log('📥 切换到新存储模式: ' + newStorage.toUpperCase())

    // 2. 初始化新连接
    try {
      if (newStorage === 'mysql') {
        if (!config.mysql) {
          throw new Error('MySQL 配置缺失')
        }
        console.log('🔌 正在连接 MySQL...')
        await initMySQL(config.mysql)
        console.log('✅ MySQL 连接成功')

        if (config.redis && config.redis.host && config.redis.host.trim() !== '') {
          try {
            console.log('🔌 正在连接 Redis 缓存...')
            await initRedis(config.redis)
            console.log('✅ Redis 缓存已启用')
          } catch (err: any) {
            console.warn('⚠️  Redis 连接失败，将不使用缓存:', err.message)
          }
        }
      } else if (newStorage === 'redis') {
        if (!config.redis || !config.redis.host || config.redis.host.trim() === '') {
          throw new Error('Redis 配置缺失或主机地址为空')
        }
        console.log('🔌 正在连接 Redis...')
        await initRedis(config.redis)
        console.log('✅ Redis 连接成功')
      } else {
        throw new Error(`不支持的存储模式: ${newStorage}。仅支持 'mysql' 或 'redis'`)
      }

      // 3. 更新全局状态（仅在成功时）
      currentStorage = newStorage
      isInitialized = true

      console.log('='.repeat(60))
      console.log('✅ 数据库热重载完成！')
      console.log('   旧存储: ' + oldStorage.toUpperCase())
      console.log('   新存储: ' + newStorage.toUpperCase())
      console.log('='.repeat(60) + '\n')
    } catch (initError: any) {
      // 新存储模式初始化失败，尝试恢复原来的存储模式
      console.error('❌ 新存储模式初始化失败:', initError.message)
      console.log('\n🔄 尝试恢复原始存储模式: ' + oldStorage.toUpperCase() + '...')

      try {
        // 恢复原始存储模式
        if (oldStorage === 'mysql') {
          await initMySQL(config.mysql)
          console.log('✅ MySQL 连接已恢复')

          if (config.redis && config.redis.host && config.redis.host.trim() !== '') {
            try {
              await initRedis(config.redis)
              console.log('✅ Redis 缓存已恢复')
            } catch (err: any) {
              console.warn('⚠️  Redis 连接失败，将不使用缓存:', err.message)
            }
          }
        } else if (oldStorage === 'redis') {
          await initRedis(config.redis)
          console.log('✅ Redis 连接已恢复')
        }

        // 恢复全局状态
        currentStorage = oldStorage
        isInitialized = true

        console.log('='.repeat(60))
        console.log('⚠️  存储模式切换失败，已恢复原始模式')
        console.log('   原因: ' + initError.message)
        console.log('='.repeat(60) + '\n')

        throw new Error(`无法切换到 ${newStorage.toUpperCase()} 模式: ${initError.message}`)
      } catch (recoveryError: any) {
        console.error('❌ 恢复原始存储模式失败:', recoveryError.message)
        console.error('⚠️  系统可能处于不稳定状态，请手动重启服务器')
        throw recoveryError
      }
    }
  } catch (error: any) {
    console.error('='.repeat(60))
    console.error('❌ 数据库热重载失败:', error.message)
    console.error('   堆栈:', error.stack)
    console.error('='.repeat(60) + '\n')
    throw error
  }
}
