/**
 * JWT服务
 */

import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.error('❌ 错误: 未设置 JWT_SECRET 环境变量！')
  console.error('💡 请在 .env 文件中设置 JWT_SECRET')
  console.error('💡 生成方法: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  process.exit(1)
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
