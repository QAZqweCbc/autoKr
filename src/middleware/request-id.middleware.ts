/**
 * Request ID 追踪中间件
 * 为每个请求生成唯一ID，用于日志追踪和调试
 */

import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { logger } from '../utils/logger'

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      requestId: string
      logger: typeof logger
    }
  }
}

/**
 * Request ID 中间件
 * 
 * 功能：
 * 1. 为每个请求生成或使用现有的 Request ID
 * 2. 将 Request ID 添加到响应头
 * 3. 创建带有 Request ID 的子 logger
 * 4. 支持从客户端传入的 X-Request-ID
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // 优先使用客户端提供的 Request ID，否则生成新的
  const requestId = (req.headers['x-request-id'] as string) || randomUUID()
  
  // 将 Request ID 附加到请求对象
  req.requestId = requestId
  
  // 将 Request ID 添加到响应头（方便客户端追踪）
  res.setHeader('X-Request-ID', requestId)
  
  // 创建带有 Request ID 的子 logger
  req.logger = logger.child({ 
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip
  })
  
  // 记录请求开始
  req.logger.debug('Request started', {
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.headers['user-agent']
  })
  
  // 记录请求结束
  res.on('finish', () => {
    req.logger.debug('Request finished', {
      statusCode: res.statusCode,
      contentLength: res.get('content-length')
    })
  })
  
  next()
}

/**
 * 获取当前请求的 Request ID
 * 用于在非中间件代码中获取 Request ID
 */
export function getRequestId(req: Request): string {
  return req.requestId || 'unknown'
}
