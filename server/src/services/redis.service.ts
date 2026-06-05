/**
 * Redis 缓存服务
 */

import Redis from 'ioredis'
import { dedupLogger } from '../utils/logger-dedup'

let redis: Redis | null = null

export interface RedisConfig {
  host: string
  port: number
  password?: string
  db?: number
}

/**
 * 初始化 Redis 连接
 */
export async function initRedis(config: RedisConfig) {
  try {
    console.log('\n📦 初始化 Redis 连接...')
    console.log(`   主机: ${config.host}:${config.port}`)

    let lastErrorTime = 0
    const errorSuppressMs = 3000 // 3秒内不重复输出相同错误

    redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      // 连接保活配置
      keepAlive: 30000,
      connectTimeout: 10000,
      // 重连策略 - 仅在第一次失败和最后一次失败时记录
      retryStrategy: (times) => {
        const maxRetries = 10
        if (times > maxRetries) {
          dedupLogger.log('❌ Redis 重连失败次数过多，停止重试', 'error')
          dedupLogger.flushNow()
          return null
        }
        // 只记录第1次和最后一次重试
        if (times === 1 || times === maxRetries) {
          const delay = Math.min(times * 200, 2000)
          dedupLogger.log(`🔄 Redis 重连中... (第${times}次，${delay}ms后重试)`, 'warn')
        }
        return Math.min(times * 200, 2000)
      },
      // 自动重连
      enableReadyCheck: true,
      autoResubscribe: true,
      autoResendUnfulfilledCommands: true,
      // 连接池配置
      lazyConnect: false,
      maxRetriesPerRequest: 3
    })

    // 立即添加错误处理，防止 "Unhandled error event"
    // 使用时间戳来限制错误消息的输出频率，避免日志刷屏
    redis.on('error', (err) => {
      const now = Date.now()
      if (now - lastErrorTime > errorSuppressMs) {
        const errMsg = err?.message || String(err)
        console.warn(`⚠️  Redis 连接失败: ${errMsg}`)
        lastErrorTime = now
      }
    })

    // 测试连接
    await redis.ping()

    console.log('✅ Redis 连接成功')
    lastErrorTime = 0 // 连接成功后重置

    return true
  } catch (error: any) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ Redis 连接失败')
    console.error('='.repeat(60))
    console.error(`错误: ${error.message}`)
    console.error('\n解决方法：')
    console.error('  1. 检查 Redis 服务是否运行')
    console.error('  2. 检查配置信息是否正确')
    console.error('  3. 检查网络连接')
    console.error('  4. 检查防火墙设置')
    console.error('='.repeat(60) + '\n')
    throw error
  }
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedis() {
  if (redis) {
    try {
      // 检查连接状态，只在连接有效时才调用 quit()
      if (redis.status === 'connecting' || redis.status === 'connect' || redis.status === 'ready') {
        await redis.quit()
      } else {
        // 连接已关闭或断开，直接断开连接
        redis.disconnect()
      }
    } catch (error: any) {
      console.warn(`⚠️  Redis 关闭时出错: ${error.message}，正在强制断开连接`)
      try {
        redis.disconnect()
      } catch (e) {
        // 忽略二次错误
      }
    }
    redis = null
    console.log('✅ Redis 连接已关闭')
  }
}

/**
 * 获取 Redis 客户端
 */
export function getRedis() {
  if (!redis) throw new Error('Redis 未初始化')
  return redis
}

// ==================== 缓存操作 ====================

/**
 * 设置缓存
 */
export async function setCache(key: string, value: any, ttl?: number) {
  const client = getRedis()
  const data = JSON.stringify(value)
  
  if (ttl) {
    await client.setex(key, ttl, data)
  } else {
    await client.set(key, data)
  }
}

/**
 * 获取缓存
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  const client = getRedis()
  const data = await client.get(key)
  
  if (!data) return null
  
  try {
    return JSON.parse(data) as T
  } catch {
    return data as any
  }
}

/**
 * 删除缓存
 */
export async function delCache(key: string) {
  const client = getRedis()
  await client.del(key)
}

/**
 * 检查缓存是否存在
 */
export async function hasCache(key: string): Promise<boolean> {
  const client = getRedis()
  const exists = await client.exists(key)
  return exists === 1
}

/**
 * 设置任务状态缓存
 */
export async function cacheTaskStatus(taskId: string, status: string, ttl = 3600) {
  await setCache(`task:${taskId}:status`, status, ttl)
}

/**
 * 获取任务状态缓存
 */
export async function getCachedTaskStatus(taskId: string): Promise<string | null> {
  return await getCache(`task:${taskId}:status`)
}

/**
 * 缓存统计数据
 */
export async function cacheStats(type: 'task' | 'account', stats: any, ttl = 60) {
  await setCache(`stats:${type}`, stats, ttl)
}

/**
 * 获取缓存的统计数据
 */
export async function getCachedStats(type: 'task' | 'account'): Promise<any | null> {
  return await getCache(`stats:${type}`)
}
