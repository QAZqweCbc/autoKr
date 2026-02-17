/**
 * JWT认证中间件
 */

import { Request, Response, NextFunction } from 'express'
import { verifyToken, JWTPayload } from '../services/jwt.service'

// 扩展Express Request类型
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload
    }
  }
}

/**
 * JWT认证中间件
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 1004,
          message: 'Unauthorized: No token provided'
        }
      })
    }
    
    const token = authHeader.substring(7) // Remove 'Bearer '
    const payload = verifyToken(token)
    
    req.user = payload
    next()
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: {
        code: 1003,
        message: 'Unauthorized: Invalid token'
      }
    })
  }
}

/**
 * 管理员权限中间件
 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 1004,
        message: 'Forbidden: Admin access required'
      }
    })
  }
  next()
}
