/**
 * 验证码服务 - 使用 Redis 存储
 */

import { getRedis } from '../../services/redis.service'

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
  const redis = getRedis()
  const key = `verification:rate_limit:${email}`
  
  const exists = await redis.exists(key)
  return exists === 0
}

/**
 * 保存验证码到 Redis（自动过期）
 */
export async function saveCode(
  email: string,
  code: string,
  type: 'register' | 'reset' = 'register'
): Promise<void> {
  const redis = getRedis()
  
  // 验证码数据
  const codeData = {
    code,
    type,
    email,
    createdAt: Date.now()
  }
  
  // 存储验证码，5分钟后自动过期
  const codeKey = `verification:code:${type}:${email}`
  await redis.setex(codeKey, 300, JSON.stringify(codeData)) // 300秒 = 5分钟
  
  // 设置频率限制，60秒后自动过期
  const rateLimitKey = `verification:rate_limit:${email}`
  await redis.setex(rateLimitKey, 60, '1') // 60秒内不能重复发送
  
  console.log(`✅ 验证码已保存到 Redis: ${email} (${type})`)
}

/**
 * 验证验证码
 */
export async function verifyCode(
  email: string,
  code: string,
  type: 'register' | 'reset' = 'register'
): Promise<boolean> {
  const redis = getRedis()
  const codeKey = `verification:code:${type}:${email}`
  
  try {
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
    console.error('❌ 验证码验证失败:', error)
    return false
  }
}

/**
 * 清理过期验证码（Redis 自动过期，此方法用于统计）
 */
export async function getVerificationStats(): Promise<{
  totalCodes: number
  registerCodes: number
  resetCodes: number
  rateLimits: number
}> {
  const redis = getRedis()
  
  try {
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
      rateLimits: rateLimitKeys.length
    }
  } catch (error) {
    console.error('❌ 获取验证码统计失败:', error)
    return {
      totalCodes: 0,
      registerCodes: 0,
      resetCodes: 0,
      rateLimits: 0
    }
  }
}

/**
 * 手动清理所有验证码（用于测试或维护）
 */
export async function clearAllCodes(): Promise<number> {
  const redis = getRedis()
  
  try {
    const keys = await redis.keys('verification:*')
    
    if (keys.length === 0) {
      return 0
    }
    
    await redis.del(...keys)
    console.log(`✅ 已清理 ${keys.length} 个验证码相关键`)
    
    return keys.length
  } catch (error) {
    console.error('❌ 清理验证码失败:', error)
    return 0
  }
}
