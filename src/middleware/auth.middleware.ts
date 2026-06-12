/**
 * 认证和授权中间件
 * 使用 JWT 进行身份验证
 * 
 * 注意：当前已禁用认证（个人使用模式）
 * 此文件保留用于将来可能重新启用认证
 */

import { Request, Response, NextFunction } from 'express'
import * as jwt from 'jsonwebtoken'
import { logger } from '../utils/logger'

export interface AuthUser {
  id: string
  username: string
  email: string
  isAdmin: boolean
}

// 不再扩展 Request 类型，避免与 auth-service 冲突
// 如果需要重新启用认证，取消下面的注释
/*
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser
  }
}
*/

/**
 * 验证 JWT_SECRET 是否已配置
 */
function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET
  
  if (!jwtSecret) {
    const isDevelopment = process.env.NODE_ENV !== 'production'
    
    if (isDevelopment) {
      // 开发环境：使用默认密钥并警告
      console.warn('⚠️  警告: 未设置 JWT_SECRET，使用默认密钥（仅用于开发）')
      console.warn('⚠️  生产环境请务必设置自定义JWT密钥！')
      return 'default-jwt-secret-do-not-use-in-production-must-be-at-least-32-characters-long'
    } else {
      // 生产环境：强制要求配置
      throw new Error(
        '\n' + '='.repeat(60) + '\n' +
        '❌ 生产环境未设置 JWT 密钥！\n' +
        '='.repeat(60) + '\n' +
        '请在 .env 文件中设置 JWT_SECRET 环境变量\n\n' +
        '生成密钥命令:\n' +
        '  openssl rand -base64 32\n\n' +
        '或者:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"\n\n' +
        '示例:\n' +
        '  JWT_SECRET=your-32-character-or-longer-jwt-secret-here\n' +
        '='.repeat(60)
      )
    }
  }
  
  if (jwtSecret.length < 32) {
    throw new Error(
      '❌ JWT 密钥长度必须至少32字符\n' +
      `当前长度: ${jwtSecret.length} 字符\n` +
      '请使用更长的密钥以确保安全性'
    )
  }
  
  return jwtSecret
}

/**
 * 验证 JWT 设置
 * 在服务启动时调用
 */
export function validateJwtSetup(): void {
  try {
    getJwtSecret()
    if (process.env.JWT_SECRET) {
      console.log('✅ JWT 密钥已配置')
    } else {
      console.log('⚠️  使用默认 JWT 密钥（开发模式）')
    }
  } catch (error: any) {
    console.error(error.message)
    process.exit(1)
  }
}

/**
 * 认证中间件
 * 验证 JWT 令牌并将用户信息附加到 req.user
 * 
 * 注意：当前已禁用认证，此函数不会被调用
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 401,
        message: '未提供认证令牌',
        hint: '请在请求头中添加: Authorization: Bearer <token>'
      }
    })
  }
  
  const token = authHeader.substring(7)
  
  try {
    const jwtSecret = getJwtSecret()
    const decoded = jwt.verify(token, jwtSecret) as AuthUser
    // 使用类型断言，因为我们不再扩展 Request 类型
    ;(req as any).user = decoded
    
    logger.debug('User authenticated', {
      userId: decoded.id,
      username: decoded.username,
      path: req.path
    })
    
    next()
  } catch (error: any) {
    logger.warn('Authentication failed', {
      error: error.message,
      ip: req.ip,
      path: req.path
    })
    
    let errorMessage = '无效的认证令牌'
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = '认证令牌已过期'
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = '认证令牌格式错误'
    }
    
    return res.status(401).json({
      success: false,
      error: {
        code: 401,
        message: errorMessage,
        details: error.message
      }
    })
  }
}

/**
 * 管理员权限中间件
 * 必须在 requireAuth 之后使用
 * 
 * 注意：当前已禁用认证，此函数不会被调用
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // 类型断言，因为我们不再扩展 Request 类型
  const user = (req as any).user as AuthUser | undefined
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 401,
        message: '未认证'
      }
    })
  }
  
  if (!user.isAdmin) {
    logger.warn('Admin access denied', {
      userId: user.id,
      username: user.username,
      path: req.path,
      method: req.method
    })
    
    return res.status(403).json({
      success: false,
      error: {
        code: 403,
        message: '需要管理员权限'
      }
    })
  }
  
  logger.debug('Admin access granted', {
    userId: user.id,
    username: user.username,
    path: req.path
  })
  
  next()
}

/**
 * 可选认证中间件
 * 如果提供了令牌则验证，否则继续处理请求
 * 用于可以公开访问但认证后有额外功能的端点
 * 
 * 注意：当前已禁用认证，此函数不会被调用
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }
  
  const token = authHeader.substring(7)
  
  try {
    const jwtSecret = getJwtSecret()
    const decoded = jwt.verify(token, jwtSecret) as AuthUser
    // 使用类型断言
    ;(req as any).user = decoded
    
    logger.debug('Optional auth: User authenticated', {
      userId: decoded.id,
      username: decoded.username
    })
  } catch (error) {
    // 忽略错误，继续处理请求
    logger.debug('Optional auth: Token invalid, continuing without auth')
  }
  
  next()
}

/**
 * 生成 JWT 令牌
 * 用于登录成功后生成令牌
 */
export function generateToken(user: AuthUser, expiresIn: string = '7d'): string {
  const jwtSecret = getJwtSecret()
  
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin
    },
    jwtSecret,
    { expiresIn: expiresIn as any }
  )
}

/**
 * 验证令牌（不抛出错误）
 * 返回解码后的用户信息或 null
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const jwtSecret = getJwtSecret()
    return jwt.verify(token, jwtSecret) as AuthUser
  } catch (error) {
    return null
  }
}
