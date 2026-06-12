/**
 * 审计日志中间件
 * 自动记录关键操作
 */

import { Request, Response, NextFunction } from 'express'
import { logAudit } from '../../services/audit-log.service'
import { JWTPayload } from '../services/jwt.service'

// 注意：Request.user 类型已在 auth.middleware.ts 中定义为 JWTPayload

/**
 * 审计日志中间件工厂
 * @param action 操作类型
 * @param resourceType 资源类型
 * @param getResourceId 获取资源ID的函数（可选）
 */
export function auditLog(
  action: string,
  resourceType: string,
  getResourceId?: (req: Request) => string | undefined
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 保存原始的res.json方法
    const originalJson = res.json.bind(res)
    
    // 重写res.json方法以在响应后记录日志
    res.json = function(body: any) {
      // 只在成功响应时记录日志
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // 异步记录日志，不阻塞响应
        setImmediate(async () => {
          try {
            const userId = req.user?.id || 'anonymous'
            // 将 'user' 角色映射为 'client'
            let userType: 'admin' | 'client' = 'client'
            if (req.user?.role === 'admin') {
              userType = 'admin'
            }
            const resourceId = getResourceId ? getResourceId(req) : undefined
            
            await logAudit({
              user_id: userId,
              user_type: userType,
              action,
              resource_type: resourceType,
              resource_id: resourceId,
              details: {
                method: req.method,
                path: req.path,
                query: req.query,
                body: sanitizeBody(req.body)
              },
              ip_address: req.ip || req.socket.remoteAddress,
              user_agent: req.get('user-agent')
            })
          } catch (error) {
            console.error('审计日志记录失败:', error)
          }
        })
      }
      
      return originalJson(body)
    }
    
    next()
  }
}

/**
 * 清理敏感信息
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body
  
  const sanitized = { ...body }
  const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'auth_code']
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***'
    }
  }
  
  return sanitized
}
