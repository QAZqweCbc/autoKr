/**
 * Redis 缓存服务
 */

import Redis from 'ioredis'

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
    
    redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      retryStrategy: (times) => {
        if (times > 3) {
          return null // 停止重试
        }
        return Math.min(times * 200, 2000)
      }
    })
    
    // 测试连接
    await redis.ping()
    
    console.log('✅ Redis 连接成功')
    
    // 监听错误
    redis.on('error', (err) => {
      console.error('❌ Redis 错误:', err.message)
    })
    
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
    await redis.quit()
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
