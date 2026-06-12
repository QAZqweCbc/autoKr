/**
 * 审计日志服务
 * 记录所有关键操作，用于安全审计和问题排查
 */

import { getPool } from './mysql.service'

export interface AuditLog {
  id?: number
  user_id: string
  user_type: 'admin' | 'client'
  action: string
  resource_type: string
  resource_id?: string
  details?: any
  ip_address?: string
  user_agent?: string
  created_at?: number
}

/**
 * 创建审计日志表
 */
export async function createAuditLogTable() {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        user_type ENUM('admin', 'client') NOT NULL,
        action VARCHAR(100) NOT NULL COMMENT '操作类型',
        resource_type VARCHAR(50) NOT NULL COMMENT '资源类型',
        resource_id VARCHAR(36) COMMENT '资源ID',
        details JSON COMMENT '详细信息',
        ip_address VARCHAR(45) COMMENT 'IP地址',
        user_agent TEXT COMMENT '用户代理',
        created_at BIGINT NOT NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_resource (resource_type, resource_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表'
    `)
    console.log('✅ 审计日志表创建/检查完成')
  } finally {
    connection.release()
  }
}

/**
 * 记录审计日志
 */
export async function logAudit(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    await connection.execute(
      `INSERT INTO audit_logs 
       (user_id, user_type, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.user_id,
        log.user_type,
        log.action,
        log.resource_type,
        log.resource_id || null,
        log.details ? JSON.stringify(log.details) : null,
        log.ip_address || null,
        log.user_agent || null,
        Date.now()
      ]
    )
  } finally {
    connection.release()
  }
}

/**
 * 查询审计日志
 */
export async function getAuditLogs(options: {
  userId?: string
  action?: string
  resourceType?: string
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
}): Promise<AuditLog[]> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    const conditions: string[] = []
    const params: any[] = []
    
    if (options.userId) {
      conditions.push('user_id = ?')
      params.push(options.userId)
    }
    
    if (options.action) {
      conditions.push('action = ?')
      params.push(options.action)
    }
    
    if (options.resourceType) {
      conditions.push('resource_type = ?')
      params.push(options.resourceType)
    }
    
    if (options.startTime) {
      conditions.push('created_at >= ?')
      params.push(options.startTime)
    }
    
    if (options.endTime) {
      conditions.push('created_at <= ?')
      params.push(options.endTime)
    }
    
    let query = 'SELECT * FROM audit_logs'
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }
    query += ' ORDER BY created_at DESC'
    
    if (options.limit) {
      query += ' LIMIT ?'
      params.push(options.limit)
      
      if (options.offset) {
        query += ' OFFSET ?'
        params.push(options.offset)
      }
    }
    
    const [rows] = await connection.execute(query, params)
    return (rows as any[]).map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null
    }))
  } finally {
    connection.release()
  }
}

/**
 * 获取审计日志统计
 */
export async function getAuditStats(startTime?: number, endTime?: number): Promise<{
  total: number
  byAction: Record<string, number>
  byResourceType: Record<string, number>
}> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    const conditions: string[] = []
    const params: any[] = []
    
    if (startTime) {
      conditions.push('created_at >= ?')
      params.push(startTime)
    }
    
    if (endTime) {
      conditions.push('created_at <= ?')
      params.push(endTime)
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    
    // 总数
    const [totalRows] = await connection.execute(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      params
    )
    const total = (totalRows as any[])[0].total
    
    // 按操作类型统计
    const [actionRows] = await connection.execute(
      `SELECT action, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY action`,
      params
    )
    const byAction: Record<string, number> = {}
    for (const row of actionRows as any[]) {
      byAction[row.action] = row.count
    }
    
    // 按资源类型统计
    const [resourceRows] = await connection.execute(
      `SELECT resource_type, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY resource_type`,
      params
    )
    const byResourceType: Record<string, number> = {}
    for (const row of resourceRows as any[]) {
      byResourceType[row.resource_type] = row.count
    }
    
    return { total, byAction, byResourceType }
  } finally {
    connection.release()
  }
}
