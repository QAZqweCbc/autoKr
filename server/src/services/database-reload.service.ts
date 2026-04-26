/**
 * 数据库热重载服务
 * 支持在不重启服务器的情况下切换存储模式
 */

import { loadDatabaseConfig } from './database-config.service'
import { closeMySQL, initMySQL } from './mysql.service'
import { closeRedis, initRedis } from './redis.service'
import { initDatabase as initJSON } from './database.service'

// 全局状态
let currentStorage: 'json' | 'mysql' | 'redis' = 'json'
let isInitialized = false

/**
 * 重新加载数据库连接
 */
export async function reloadDatabase(): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log('🔄 开始热重载数据库连接...')
  console.log('='.repeat(60))
  
  try {
    // 1. 关闭现有连接
    console.log(`📤 关闭现有连接 (${currentStorage})...`)
    await closeCurrentConnections()
    
    // 2. 加载新配置
    const config = loadDatabaseConfig()
    const newStorage = config.storage
    
    console.log(`📥 切换到新存储模式: ${newStorage}`)
    
    // 3. 初始化新连接
    if (newStorage === 'mysql') {
      if (!config.mysql) {
        throw new Error('MySQL 配置缺失')
      }
      
      console.log('🔌 正在连接 MySQL...')
      await initMySQL(config.mysql)
      console.log('✅ MySQL 连接成功')
      
      // 可选：初始化 Redis 缓存
      if (config.redis && config.redis.host && config.redis.host.trim() !== '') {
        try {
          console.log('🔌 正在连接 Redis 缓存...')
          await initRedis(config.redis)
          console.log('✅ Redis 缓存已启用')
        } catch (error: any) {
          console.warn('⚠️  Redis 连接失败，将不使用缓存:', error.message)
        }
      } else {
        console.log('ℹ️  Redis 未配置，跳过缓存初始化')
      }
    } else if (newStorage === 'redis') {
      if (!config.redis || !config.redis.host || config.redis.host.trim() === '') {
        throw new Error('Redis 配置缺失或主机地址为空')
      }
      
      console.log('🔌 正在连接 Redis...')
      await initRedis(config.redis)
      console.log('✅ Redis 连接成功')
    } else {
      console.log('📁 初始化 JSON 文件存储...')
      initJSON()
      console.log('✅ JSON 存储已就绪')
    }
    
    // 4. 更新全局状态
    const oldStorage = currentStorage
    currentStorage = newStorage
    isInitialized = true
    
    // 5. 更新 database.adapter.ts 中的状态
    await updateAdapterState(newStorage)
    
    console.log('='.repeat(60))
    console.log(`✅ 数据库热重载完成！`)
    console.log(`   旧存储: ${oldStorage.toUpperCase()}`)
    console.log(`   新存储: ${newStorage.toUpperCase()}`)
    console.log('='.repeat(60) + '\n')
  } catch (error: any) {
    console.error('='.repeat(60))
    console.error('❌ 数据库热重载失败:', error.message)
    console.error('   堆栈:', error.stack)
    console.error('='.repeat(60) + '\n')
    throw error
  }
}

/**
 * 关闭当前数据库连接
 */
async function closeCurrentConnections(): Promise<void> {
  try {
    if (currentStorage === 'mysql') {
      await closeMySQL()
      await closeRedis() // 关闭可能的 Redis 缓存
    } else if (currentStorage === 'redis') {
      await closeRedis()
    }
    // JSON 存储不需要关闭连接
  } catch (error: any) {
    console.warn('⚠️  关闭连接时出现警告:', error.message)
    // 继续执行，不抛出错误
  }
}

/**
 * 更新适配器状态（通过模块缓存清除）
 */
async function updateAdapterState(newStorage: 'json' | 'mysql' | 'redis'): Promise<void> {
  try {
    // 清除 database.adapter 的模块缓存，强制重新加载
    const adapterPath = require.resolve('./database.adapter')
    delete require.cache[adapterPath]
    
    // 重新导入适配器以更新状态
    const adapter = require('./database.adapter')
    
    // 如果适配器有内部状态更新方法，调用它
    if (typeof adapter.updateStorageMode === 'function') {
      adapter.updateStorageMode(newStorage)
    }
    
    console.log('✅ 适配器状态已更新')
  } catch (error: any) {
    console.warn('⚠️  更新适配器状态时出现警告:', error.message)
    // 不抛出错误，因为这不是致命问题
  }
}

/**
 * 获取当前存储模式
 */
export function getCurrentStorage(): 'json' | 'mysql' | 'redis' {
  return currentStorage
}

/**
 * 检查是否已初始化
 */
export function isReloadServiceInitialized(): boolean {
  return isInitialized
}
