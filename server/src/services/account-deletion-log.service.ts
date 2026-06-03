/**
 * 账号删除日志服务
 * 记录因邮件检测而删除的账号信息
 */

import { getPool } from './mysql.service'
import { RowDataPacket } from 'mysql2'

export interface AccountDeletionLog {
  id?: number
  account_id: string
  email: string
  deletion_reason: string
  detected_email: string
  email_subject?: string
  email_from?: string
  email_date?: number
  email_uid?: number
  detected_at: number
  deleted_at: number
  details?: any
}

export interface DeletionLogQueryOptions {
  page?: number
  pageSize?: number
  startDate?: number
  endDate?: number
  email?: string
}

export interface DeletionLogResult {
  logs: AccountDeletionLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface DeletionStats {
  totalDeleted: number
  last24Hours: number
  last7Days: number
  last30Days: number
  byReason: Record<string, number>
}

/**
 * 创建账号删除日志表
 */
export async function createDeletionLogTable(): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS account_deletion_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        account_id VARCHAR(36) NOT NULL COMMENT '被删除的账号ID',
        email VARCHAR(255) NOT NULL COMMENT '被删除的账号邮箱',
        deletion_reason VARCHAR(100) NOT NULL COMMENT '删除原因',
        detected_email VARCHAR(255) NOT NULL COMMENT '检测到邮件的邮箱',
        email_subject VARCHAR(500) COMMENT '邮件标题',
        email_from VARCHAR(255) COMMENT '邮件发件人',
        email_date BIGINT COMMENT '邮件日期',
        email_uid INT COMMENT '邮件UID',
        detected_at BIGINT NOT NULL COMMENT '检测时间',
        deleted_at BIGINT NOT NULL COMMENT '删除时间',
        details JSON COMMENT '详细信息',
        INDEX idx_email (email),
        INDEX idx_detected_at (detected_at),
        INDEX idx_deleted_at (deleted_at),
        INDEX idx_deletion_reason (deletion_reason)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号删除日志表'
    `)
    console.log('✅ 账号删除日志表创建/检查完成')
  } finally {
    connection.release()
  }
}

/**
 * 记录账号删除日志
 */
export async function logAccountDeletion(log: Omit<AccountDeletionLog, 'id'>): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.execute(
      `INSERT INTO account_deletion_logs
       (account_id, email, deletion_reason, detected_email, email_subject, email_from,
        email_date, email_uid, detected_at, deleted_at, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.account_id,
        log.email,
        log.deletion_reason,
        log.detected_email,
        log.email_subject || null,
        log.email_from || null,
        log.email_date || null,
        log.email_uid || null,
        log.detected_at,
        log.deleted_at,
        log.details ? JSON.stringify(log.details) : null
      ]
    )
  } finally {
    connection.release()
  }
}

/**
 * 获取删除日志列表
 */
export async function getDeletionLogs(options: DeletionLogQueryOptions = {}): Promise<DeletionLogResult> {
  const {
    page = 1,
    pageSize = 20,
    startDate,
    endDate,
    email
  } = options

  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    // 构建查询条件
    const conditions: string[] = []
    const params: any[] = []

    if (startDate) {
      conditions.push('deleted_at >= ?')
      params.push(startDate)
    }

    if (endDate) {
      conditions.push('deleted_at <= ?')
      params.push(endDate)
    }

    if (email) {
      conditions.push('email LIKE ?')
      params.push(`%${email}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // 获取总数
    const [countRows] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM account_deletion_logs ${whereClause}`,
      params
    )
    const total = countRows[0].total

    // 获取分页数据
    const offset = (page - 1) * pageSize
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM account_deletion_logs ${whereClause}
       ORDER BY deleted_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    const logs = rows.map(row => ({
      id: row.id,
      account_id: row.account_id,
      email: row.email,
      deletion_reason: row.deletion_reason,
      detected_email: row.detected_email,
      email_subject: row.email_subject,
      email_from: row.email_from,
      email_date: row.email_date,
      email_uid: row.email_uid,
      detected_at: row.detected_at,
      deleted_at: row.deleted_at,
      details: row.details ? JSON.parse(row.details) : null
    }))

    return {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  } finally {
    connection.release()
  }
}

/**
 * 获取删除统计
 */
export async function getDeletionStats(): Promise<DeletionStats> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    const now = Date.now()
    const day24Ago = now - 24 * 60 * 60 * 1000
    const day7Ago = now - 7 * 24 * 60 * 60 * 1000
    const day30Ago = now - 30 * 24 * 60 * 60 * 1000

    // 总删除数
    const [totalRows] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM account_deletion_logs'
    )
    const totalDeleted = totalRows[0].count

    // 最近24小时
    const [day24Rows] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM account_deletion_logs WHERE deleted_at >= ?',
      [day24Ago]
    )
    const last24Hours = day24Rows[0].count

    // 最近7天
    const [day7Rows] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM account_deletion_logs WHERE deleted_at >= ?',
      [day7Ago]
    )
    const last7Days = day7Rows[0].count

    // 最近30天
    const [day30Rows] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM account_deletion_logs WHERE deleted_at >= ?',
      [day30Ago]
    )
    const last30Days = day30Rows[0].count

    // 按原因统计
    const [reasonRows] = await connection.execute<RowDataPacket[]>(
      'SELECT deletion_reason, COUNT(*) as count FROM account_deletion_logs GROUP BY deletion_reason'
    )
    const byReason: Record<string, number> = {}
    reasonRows.forEach(row => {
      byReason[row.deletion_reason] = row.count
    })

    return {
      totalDeleted,
      last24Hours,
      last7Days,
      last30Days,
      byReason
    }
  } finally {
    connection.release()
  }
}

/**
 * 获取单条删除日志详情
 */
export async function getDeletionLogById(id: number): Promise<AccountDeletionLog | null> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM account_deletion_logs WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return null
    }

    const row = rows[0]
    return {
      id: row.id,
      account_id: row.account_id,
      email: row.email,
      deletion_reason: row.deletion_reason,
      detected_email: row.detected_email,
      email_subject: row.email_subject,
      email_from: row.email_from,
      email_date: row.email_date,
      email_uid: row.email_uid,
      detected_at: row.detected_at,
      deleted_at: row.deleted_at,
      details: row.details ? JSON.parse(row.details) : null
    }
  } finally {
    connection.release()
  }
}
