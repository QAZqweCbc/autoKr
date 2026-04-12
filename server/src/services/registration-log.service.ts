/**
 * 注册日志服务
 * 记录每个账号的注册过程和结果
 */

import { getPool } from './mysql.service'

export interface RegistrationLog {
  id?: string
  task_id: string
  email: string
  status: 'success' | 'failed'
  
  // 注册结果信息
  sso_token?: string
  access_token?: string
  refresh_token?: string
  client_id?: string
  client_secret?: string
  region?: string
  
  // 账号信息
  user_id?: string
  nickname?: string
  idp?: string
  
  // 订阅信息
  subscription_type?: string
  subscription_title?: string
  subscription_status?: string
  days_remaining?: number
  expires_at?: number
  
  // 使用量信息
  usage_current?: number
  usage_limit?: number
  usage_percent?: number
  
  // 注册配置
  browser_type?: string
  headless?: boolean
  proxy_url?: string
  
  // 时间信息
  duration?: number  // 注册耗时（毫秒）
  error_message?: string
  created_at: number
}

/**
 * 创建注册日志表
 */
export async function createRegistrationLogTable() {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS registration_logs (
        id VARCHAR(36) PRIMARY KEY COMMENT '日志ID',
        task_id VARCHAR(36) NOT NULL COMMENT '任务ID',
        email VARCHAR(255) NOT NULL COMMENT '注册邮箱',
        status ENUM('success', 'failed') NOT NULL COMMENT '注册状态',
        
        -- 注册结果信息
        sso_token TEXT COMMENT 'SSO Token',
        access_token TEXT COMMENT 'Access Token',
        refresh_token TEXT COMMENT 'Refresh Token',
        client_id VARCHAR(255) COMMENT 'Client ID',
        client_secret TEXT COMMENT 'Client Secret',
        region VARCHAR(50) COMMENT '区域',
        
        -- 账号信息
        user_id VARCHAR(255) COMMENT '用户ID',
        nickname VARCHAR(255) COMMENT '昵称',
        idp VARCHAR(50) COMMENT '身份提供商',
        
        -- 订阅信息
        subscription_type VARCHAR(100) COMMENT '订阅类型',
        subscription_title VARCHAR(100) COMMENT '订阅标题',
        subscription_status VARCHAR(50) COMMENT '订阅状态',
        days_remaining INT COMMENT '剩余天数',
        expires_at BIGINT COMMENT '过期时间戳',
        
        -- 使用量信息
        usage_current INT COMMENT '当前使用量',
        usage_limit INT COMMENT '使用限制',
        usage_percent DECIMAL(5,2) COMMENT '使用百分比',
        
        -- 注册配置
        browser_type VARCHAR(50) COMMENT '浏览器类型',
        headless BOOLEAN COMMENT '无头模式',
        proxy_url VARCHAR(255) COMMENT '代理地址',
        
        -- 时间信息
        duration INT COMMENT '注册耗时（毫秒）',
        error_message TEXT COMMENT '错误信息',
        created_at BIGINT NOT NULL COMMENT '创建时间戳',
        
        INDEX idx_task_id (task_id),
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号注册日志表'
    `)
    console.log('✅ 注册日志表创建/检查完成')
  } finally {
    connection.release()
  }
}

/**
 * 记录注册日志
 */
export async function logRegistration(log: RegistrationLog): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    await connection.execute(
      `INSERT INTO registration_logs 
       (id, task_id, email, status, sso_token, access_token, refresh_token, 
        client_id, client_secret, region, user_id, nickname, idp,
        subscription_type, subscription_title, subscription_status, 
        days_remaining, expires_at, usage_current, usage_limit, usage_percent,
        browser_type, headless, proxy_url, duration, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.task_id,
        log.email,
        log.status,
        log.sso_token || null,
        log.access_token || null,
        log.refresh_token || null,
        log.client_id || null,
        log.client_secret || null,
        log.region || null,
        log.user_id || null,
        log.nickname || null,
        log.idp || null,
        log.subscription_type || null,
        log.subscription_title || null,
        log.subscription_status || null,
        log.days_remaining || null,
        log.expires_at || null,
        log.usage_current || null,
        log.usage_limit || null,
        log.usage_percent || null,
        log.browser_type || null,
        log.headless !== undefined ? log.headless : null,
        log.proxy_url || null,
        log.duration || null,
        log.error_message || null,
        log.created_at
      ]
    )
  } finally {
    connection.release()
  }
}

/**
 * 查询注册日志
 */
export async function getRegistrationLogs(options: {
  email?: string
  status?: 'success' | 'failed'
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
}): Promise<RegistrationLog[]> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    const conditions: string[] = []
    const params: any[] = []
    
    if (options.email) {
      conditions.push('email = ?')
      params.push(options.email)
    }
    
    if (options.status) {
      conditions.push('status = ?')
      params.push(options.status)
    }
    
    if (options.startTime) {
      conditions.push('created_at >= ?')
      params.push(options.startTime)
    }
    
    if (options.endTime) {
      conditions.push('created_at <= ?')
      params.push(options.endTime)
    }
    
    let query = 'SELECT * FROM registration_logs'
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
    return rows as RegistrationLog[]
  } finally {
    connection.release()
  }
}

/**
 * 获取注册统计
 */
export async function getRegistrationStats(startTime?: number, endTime?: number): Promise<{
  total: number
  success: number
  failed: number
  avgDuration: number
  successRate: number
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
    
    const [rows] = await connection.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN status = 'success' THEN duration ELSE NULL END) as avgDuration
       FROM registration_logs ${whereClause}`,
      params
    )
    
    const stats = (rows as any[])[0]
    const total = Number(stats.total)
    const success = Number(stats.success)
    const failed = Number(stats.failed)
    const avgDuration = Number(stats.avgDuration) || 0
    const successRate = total > 0 ? (success / total) * 100 : 0
    
    return {
      total,
      success,
      failed,
      avgDuration: Math.round(avgDuration),
      successRate: Math.round(successRate * 100) / 100
    }
  } finally {
    connection.release()
  }
}

/**
 * 获取最近的注册日志
 */
export async function getRecentRegistrationLogs(limit: number = 10): Promise<RegistrationLog[]> {
  return getRegistrationLogs({ limit })
}
