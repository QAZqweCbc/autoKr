/**
 * JWT服务
 */

import * as jwt from 'jsonwebtoken'
import * as crypto from 'crypto'

const isProduction = process.env.NODE_ENV === 'production'

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    if (isProduction) {
      console.error('错误: 生产环境未设置 JWT_SECRET 环境变量！')
      console.error('请在 .env 文件中设置 JWT_SECRET')
      console.error('生成方法: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
      process.exit(1)
    }

    console.warn('警告: 未设置 JWT_SECRET，开发环境将使用临时密钥')
    console.warn('提示: 临时密钥在进程重启后会变化，不适合生产环境')
    return crypto.randomBytes(32).toString('hex')
  }

  if (secret.length < 32) {
    console.warn(`警告: JWT_SECRET 长度不足32字符（当前 ${secret.length} 字符），存在安全风险`)
  }

  return secret
})()
const JWT_EXPIRES_IN = '7d'

export interface JWTPayload {
  id: string
  email: string
  role?: 'user' | 'admin'
}

/**
 * 生成JWT Token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/**
 * 验证JWT Token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch (error: any) {
    throw new Error('Invalid or expired token')
  }
}

/**
 * 解码Token（不验证）
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload
  } catch {
    return null
  }
}
