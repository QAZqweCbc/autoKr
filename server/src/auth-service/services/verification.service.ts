/**
 * 验证码服务 - 支持 Redis 和内存存储（自动降级）
 */

import { getRedis } from '../../services/redis.service'

// 内存存储（Redis 不可用时的降级方案）
interface VerificationData {
  code: string
  type: 'register' | 'reset'
  email: string
  createdAt: number
  expiresAt: number
}

const memoryStore = new Map<string, VerificationData>()
const rateLimitStore = new Map<string, number>()

/**
 * 检查 Redis 是否可用
 */
function isRedisAvailable(): boolean {
  try {
    getRedis()
    return true
  } catch {
    return false
  }
}

/**
 * 清理过期的内存数据
 */
function cleanExpiredMemoryData() {
  const now = Date.now()
  
  // 清理过期验证码
  for (const [key, data] of memoryStore.entries()) {
    if (data.expiresAt < now) {
      memoryStore.delete(key)
    }
  }
  
  // 清理过期的频率限制
  for (const [key, expiresAt] of rateLimitStore.entries()) {
    if (expiresAt < now) {
      rateLimitStore.delete(key)
    }
  }
}

// 每分钟清理一次过期数据
setInterval(cleanExpiredMemoryData, 60000)

/**
 * 生成6位数字验证码
 */
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 检查是否可以发送验证码（频率限制：60秒）
 */
export async function canSendCode(email: string): Promise<boolean> {
  const key = `verification:rate_limit:${email}`
  
  if (isRedisAvailable()) {
    try {
      const redis = getRedis()
      const exists = await redis.exists(key)
      return exists === 0
    } catch (error) {
      console.warn('⚠️ Redis 不可用，使用内存存储')
    }
  }
  
  // 使用内存存储
  const expiresAt = rateLimitStore.get(key)
  if (!expiresAt) return true
  
  return Date.now() > expiresAt
}

/**
 * 保存验证码（自动选择存储方式）
 */
export async function saveCode(
  email: string,
  code: string,
  type: 'register' | 'reset' = 'register'
): Promise<void> {
  const codeKey = `verification:code:${type}:${email}`
  const rateLimitKey = `verification:rate_limit:${email}`
  const now = Date.now()
  
  if (isRedisAvailable()) {
    try {
      const redis = getRedis()
      
      // 验证码数据
      const codeData = {
        code,
        type,
        email,
        createdAt: now
      }
      
      // 存储验证码，5分钟后自动过期
      await redis.setex(codeKey, 300, JSON.stringify(codeData))
      
      // 设置频率限制，60秒后自动过期
      await redis.setex(rateLimitKey, 60, '1')
      
      console.log(`✅ 验证码已保存到 Redis: ${email} (${type})`)
      return
    } catch (error) {
      console.warn('⚠️ Redis 保存失败，使用内存存储:', (error as Error).message)
    }
  }
  
  // 使用内存存储
  memoryStore.set(codeKey, {
    code,
    type,
    email,
    createdAt: now,
    expiresAt: now + 300000 // 5分钟
  })
  
  rateLimitStore.set(rateLimitKey, now + 60000) // 60秒
  
  console.log(`✅ 验证码已保存到内存: ${email} (${type})`)
}

/**
 * 验证验证码
 */
export async function verifyCode(
  email: string,
  code: string,
  type: 'register' | 'reset' = 'register'
): Promise<boolean> {
  const codeKey = `verification:code:${type}:${email}`
  
  if (isRedisAvailable()) {
    try {
      const redis = getRedis()
      
      // 获取验证码数据
      const data = await redis.get(codeKey)
      
      if (!data) {
        console.log(`❌ 验证码不存在或已过期: ${email}`)
        return false
      }
      
      const codeData = JSON.parse(data)
      
      // 验证码匹配
      if (codeData.code !== code) {
        console.log(`❌ 验证码错误: ${email}`)
        return false
      }
      
      // 验证成功后删除验证码（一次性使用）
      await redis.del(codeKey)
      
      console.log(`✅ 验证码验证成功: ${email}`)
      return true
    } catch (error) {
      console.warn('⚠️ Redis 验证失败，尝试内存存储')
    }
  }
  
  // 使用内存存储
  const data = memoryStore.get(codeKey)
  
  if (!data) {
    console.log(`❌ 验证码不存在或已过期: ${email}`)
    return false
  }
  
  // 检查是否过期
  if (Date.now() > data.expiresAt) {
    memoryStore.delete(codeKey)
    console.log(`❌ 验证码已过期: ${email}`)
    return false
  }
  
  // 验证码匹配
  if (data.code !== code) {
    console.log(`❌ 验证码错误: ${email}`)
    return false
  }
  
  // 验证成功后删除验证码（一次性使用）
  memoryStore.delete(codeKey)
  
  console.log(`✅ 验证码验证成功: ${email}`)
  return true
}

/**
 * 获取验证码统计
 */
export async function getVerificationStats(): Promise<{
  totalCodes: number
  registerCodes: number
  resetCodes: number
  rateLimits: number
  storageType: 'redis' | 'memory'
}> {
  if (isRedisAvailable()) {
    try {
      const redis = getRedis()
      
      // 扫描所有验证码相关的键
      const codeKeys = await redis.keys('verification:code:*')
      const rateLimitKeys = await redis.keys('verification:rate_limit:*')
      
      // 统计不同类型的验证码
      let registerCodes = 0
      let resetCodes = 0
      
      for (const key of codeKeys) {
        if (key.includes(':register:')) {
          registerCodes++
        } else if (key.includes(':reset:')) {
          resetCodes++
        }
      }
      
      return {
        totalCodes: codeKeys.length,
        registerCodes,
        resetCodes,
        rateLimits: rateLimitKeys.length,
        storageType: 'redis'
      }
    } catch (error) {
      console.warn('⚠️ Redis 统计失败，使用内存统计')
    }
  }
  
  // 使用内存统计
  cleanExpiredMemoryData()
  
  let registerCodes = 0
  let resetCodes = 0
  
  for (const [key, data] of memoryStore.entries()) {
    if (data.type === 'register') {
      registerCodes++
    } else if (data.type === 'reset') {
      resetCodes++
    }
  }
  
  return {
    totalCodes: memoryStore.size,
    registerCodes,
    resetCodes,
    rateLimits: rateLimitStore.size,
    storageType: 'memory'
  }
}

/**
 * 手动清理所有验证码
 */
export async function clearAllCodes(): Promise<number> {
  let count = 0
  
  if (isRedisAvailable()) {
    try {
      const redis = getRedis()
      const keys = await redis.keys('verification:*')
      
      if (keys.length > 0) {
        await redis.del(...keys)
        count = keys.length
        console.log(`✅ 已清理 ${count} 个 Redis 验证码`)
      }
    } catch (error) {
      console.warn('⚠️ Redis 清理失败')
    }
  }
  
  // 清理内存
  const memoryCount = memoryStore.size + rateLimitStore.size
  memoryStore.clear()
  rateLimitStore.clear()
  
  if (memoryCount > 0) {
    console.log(`✅ 已清理 ${memoryCount} 个内存验证码`)
    count += memoryCount
  }
  
  return count
}
