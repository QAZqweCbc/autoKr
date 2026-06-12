/**
 * 系统日志服务
 * 持久化 WebSocket 实时日志到 MySQL
 */

import { getPool } from './mysql.service'

export interface SystemLog {
  id?: string
  task_id?: string
  message: string
  category: 'register' | 'config' | 'account' | 'connection'
  level: 'info' | 'success' | 'warning' | 'error'
  source: string
  log_type?: 'register' | 'account' | 'config' | null
  payload?: string  // JSON 序列化的结构化数据
  created_at?: number
}

/**
 * 创建系统日志表
 */
export async function createSystemLogTable() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id VARCHAR(36) PRIMARY KEY COMMENT '日志ID',
        task_id VARCHAR(36) COMMENT '关联任务ID',
        message TEXT NOT NULL COMMENT '日志消息',
        category ENUM('register', 'config', 'account', 'connection') NOT NULL COMMENT '日志分类',
        level ENUM('info', 'success', 'warning', 'error') NOT NULL COMMENT '日志级别',
        source VARCHAR(100) COMMENT '来源标识',
        log_type ENUM('register', 'account', 'config') COMMENT '扩展类型标识',
        payload TEXT COMMENT '结构化数据(JSON)',
        created_at BIGINT NOT NULL COMMENT '创建时间戳',

        INDEX idx_category (category),
        INDEX idx_level (level),
        INDEX idx_task_id (task_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统实时日志表'
    `)
    console.log('✅ 系统日志表创建/检查完成')
  } finally {
    connection.release()
  }
}

/**
 * 写入系统日志
 */
export async function saveSystemLog(log: Omit<SystemLog, 'id' | 'created_at'>): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()

    await connection.execute(
      `INSERT INTO system_logs
       (id, task_id, message, category, level, source, log_type, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        log.task_id || null,
        log.message,
        log.category,
        log.level,
        log.source || null,
        log.log_type || null,
        log.payload ? JSON.stringify(log.payload) : null,
        now
      ]
    )
  } finally {
    connection.release()
  }
}

/**
 * 批量写入系统日志（性能优化）
 */
export async function batchSaveSystemLogs(logs: Omit<SystemLog, 'id' | 'created_at'>[]): Promise<void> {
  if (logs.length === 0) return

  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    const now = Date.now()
    const values = logs.map(log => [
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      log.task_id || null,
      log.message,
      log.category,
      log.level,
      log.source || null,
      log.log_type || null,
      log.payload ? JSON.stringify(log.payload) : null,
      now
    ])

    await connection.execute(
      `INSERT INTO system_logs
       (id, task_id, message, category, level, source, log_type, payload, created_at)
       VALUES ?`,
      [values as any]
    )
  } finally {
    connection.release()
  }
}

/**
 * 查询系统日志
 */
export async function getSystemLogs(options: {
  category?: string
  level?: string
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
}): Promise<SystemLog[]> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    const conditions: string[] = []
    const params: any[] = []

    if (options.category) {
      conditions.push('category = ?')
      params.push(options.category)
    }

    if (options.level) {
      conditions.push('level = ?')
      params.push(options.level)
    }

    if (options.startTime) {
      conditions.push('created_at >= ?')
      params.push(options.startTime)
    }

    if (options.endTime) {
      conditions.push('created_at <= ?')
      params.push(options.endTime)
    }

    let query = 'SELECT * FROM system_logs'
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }
    query += ' ORDER BY created_at DESC'

    const limit = options.limit || 200
    params.push(limit)

    if (options.offset) {
      query += ' LIMIT ? OFFSET ?'
      params.push(options.offset)
    } else {
      query += ' LIMIT ?'
    }

    const [rows] = await connection.execute(query, params)
    return (rows as any[]).map((row: any) => ({
      ...row,
      payload: row.payload ? JSON.parse(row.payload) : null
    })) as SystemLog[]
  } finally {
    connection.release()
  }
}

/**
 * 获取最近的系统日志
 */
export async function getRecentSystemLogs(limit: number = 200): Promise<SystemLog[]> {
  return getSystemLogs({ limit })
}

/**
 * 清理旧日志（保留最近 N 天）
 */
export async function cleanupSystemLogs(days: number = 30): Promise<number> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const [result] = await connection.execute(
      'DELETE FROM system_logs WHERE created_at < ?',
      [cutoff]
    ) as any
    return result.affectedRows || 0
  } finally {
    connection.release()
  }
}

/**
 * 获取日志分类统计
 */
export async function getSystemLogStats(): Promise<Record<string, number>> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    const [rows] = await connection.execute(
      'SELECT category, COUNT(*) as count FROM system_logs GROUP BY category'
    )
    const stats: Record<string, number> = {}
    for (const row of (rows as any[])) {
      stats[row.category] = row.count
    }
    return stats
  } finally {
    connection.release()
  }
}
