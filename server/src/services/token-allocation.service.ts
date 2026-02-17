/**
 * Token分配服务
 * 处理Token分配记录的CRUD操作
 */

import { getPool } from './mysql.service'
import { TokenAllocation } from '../models/token-allocation.model'

export const TokenAllocationService = {
  /**
   * 创建分配记录
   */
  async create(allocation: TokenAllocation): Promise<TokenAllocation> {
    const connection = await getPool().getConnection()
    try {
      await connection.execute(
        `INSERT INTO token_allocations (
          id, user_id, account_id, status, requested_at, 
          approved_at, approved_by, reject_reason, revoked_at, revoked_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          allocation.id,
          allocation.user_id,
          allocation.account_id || null,
          allocation.status,
          allocation.requested_at,
          allocation.approved_at || null,
          allocation.approved_by || null,
          allocation.reject_reason || null,
          allocation.revoked_at || null,
          allocation.revoked_by || null
        ]
      )
      return allocation
    } finally {
      connection.release()
    }
  },

  /**
   * 根据ID查询分配记录
   */
  async getById(id: string): Promise<TokenAllocation | null> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM token_allocations WHERE id = ?',
        [id]
      )
      const allocations = rows as TokenAllocation[]
      return allocations.length > 0 ? allocations[0] : null
    } finally {
      connection.release()
    }
  },

  /**
   * 根据用户ID查询分配记录
   */
  async getByUserId(userId: string, status?: string): Promise<TokenAllocation[]> {
    const connection = await getPool().getConnection()
    try {
      let query = 'SELECT * FROM token_allocations WHERE user_id = ?'
      const params: any[] = [userId]
      
      if (status) {
        query += ' AND status = ?'
        params.push(status)
      }
      
      query += ' ORDER BY requested_at DESC'
      
      const [rows] = await connection.execute(query, params)
      return rows as TokenAllocation[]
    } finally {
      connection.release()
    }
  },

  /**
   * 查询所有待审批的申请
   */
  async getPendingRequests(): Promise<any[]> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(
        `SELECT 
          ta.id,
          ta.user_id,
          cu.username,
          cu.email,
          ta.status,
          ta.requested_at
        FROM token_allocations ta
        JOIN client_users cu ON ta.user_id = cu.id
        WHERE ta.status = 'pending'
        ORDER BY ta.requested_at ASC`
      )
      return rows as any[]
    } finally {
      connection.release()
    }
  },

  /**
   * 查询所有分配记录
   */
  async getAll(): Promise<any[]> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(
        `SELECT 
          ta.*,
          cu.username,
          cu.email,
          a.email as account_email,
          a.usage_current,
          a.usage_limit,
          a.usage_percent,
          a.subscription_type
        FROM token_allocations ta
        JOIN client_users cu ON ta.user_id = cu.id
        LEFT JOIN accounts a ON ta.account_id = a.id
        ORDER BY ta.requested_at DESC`
      )
      return rows as any[]
    } finally {
      connection.release()
    }
  },

  /**
   * 更新分配记录
   */
  async update(id: string, data: Partial<TokenAllocation>): Promise<void> {
    const connection = await getPool().getConnection()
    try {
      const updates: string[] = []
      const values: any[] = []
      
      if (data.account_id !== undefined) { updates.push('account_id = ?'); values.push(data.account_id) }
      if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status) }
      if (data.approved_at !== undefined) { updates.push('approved_at = ?'); values.push(data.approved_at) }
      if (data.approved_by !== undefined) { updates.push('approved_by = ?'); values.push(data.approved_by) }
      if (data.reject_reason !== undefined) { updates.push('reject_reason = ?'); values.push(data.reject_reason) }
      if (data.revoked_at !== undefined) { updates.push('revoked_at = ?'); values.push(data.revoked_at) }
      if (data.revoked_by !== undefined) { updates.push('revoked_by = ?'); values.push(data.revoked_by) }
      
      if (updates.length > 0) {
        values.push(id)
        await connection.execute(
          `UPDATE token_allocations SET ${updates.join(', ')} WHERE id = ?`,
          values
        )
      }
    } finally {
      connection.release()
    }
  },

  /**
   * 统计用户的活跃Token数量
   */
  async countActiveByUserId(userId: string): Promise<number> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(
        'SELECT COUNT(*) as count FROM token_allocations WHERE user_id = ? AND status = ?',
        [userId, 'active']
      )
      const result = (rows as any[])[0]
      return Number(result.count)
    } finally {
      connection.release()
    }
  }
}
