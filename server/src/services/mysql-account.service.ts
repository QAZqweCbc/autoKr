/**
 * MySQL 账号服务 - 使用新的嵌套数据结构
 */

import { getPool } from './mysql.service'
import { Account, AccountStats } from '../models/account.model'
import { accountToFlat, flatToAccount, updateAccountUsage } from '../utils/account-mapper'
import { withTransaction } from '../utils/transaction.util'

const ACCOUNT_INSERT_FIELDS = [
  'id', 'email', 'password',
  'access_token', 'csrf_token', 'refresh_token', 'x_amz_sso_authn', 'client_id', 'client_secret', 'region', 'expires_at', 'auth_method', 'provider',
  'subscription_type', 'subscription_title', 'subscription_raw_type', 'subscription_expires_at', 'subscription_days_remaining',
  'upgrade_capability', 'overage_capability', 'management_target',
  'usage_current', 'usage_limit', 'usage_percent_used', 'usage_last_updated',
  'base_limit', 'base_current', 'free_trial_limit', 'free_trial_current', 'free_trial_expiry',
  'usage_bonuses', 'next_reset_date',
  'resource_type', 'resource_display_name', 'resource_display_name_plural', 'resource_currency', 'resource_unit',
  'overage_rate', 'overage_cap', 'overage_enabled',
  'nickname', 'idp', 'user_id', 'visitor_id', 'group_id', 'tags',
  'status', 'last_error', 'consecutive_failures', 'is_active', 'device_id', 'assigned_at',
  'created_at', 'last_used_at', 'last_checked_at', 'owner_user_id'
] as const

const ACCOUNT_UPDATE_FIELDS = ACCOUNT_INSERT_FIELDS.filter(
  (field) => !['id', 'email', 'created_at'].includes(field)
)

export const MySQLAccountDB = {
  /**
   * 创建账号（使用事务保护）
   */
  async create(account: Account): Promise<Account> {
    return withTransaction(async (connection) => {
      const flat = accountToFlat(account)
      
      // 确保所有值都不是 undefined
      const values = ACCOUNT_INSERT_FIELDS.map((field) => flat[field] ?? null)
      
      // 检查 undefined 值
      const undefinedIndexes = values.map((v, i) => v === undefined ? i : -1).filter(i => i !== -1)
      if (undefinedIndexes.length > 0) {
        console.error('❌ Found undefined values at indexes:', undefinedIndexes)
        console.error('❌ Flat object:', JSON.stringify(flat, null, 2))
        throw new Error(`Undefined values found at positions: ${undefinedIndexes.join(', ')}`)
      }
      
      await connection.execute(
        `INSERT INTO accounts (
          ${ACCOUNT_INSERT_FIELDS.join(', ')}
        )
        VALUES (${ACCOUNT_INSERT_FIELDS.map(() => '?').join(', ')})
        ON DUPLICATE KEY UPDATE
          ${ACCOUNT_UPDATE_FIELDS.map((field) => `${field} = VALUES(${field})`).join(',\n          ')}`,
        values
      )
      
      return account
    }, 'createAccount')
  },

  /**
   * 更新账号（使用事务保护）
   */
  async update(id: string, updates: Partial<Account>): Promise<void> {
    return withTransaction(async (connection) => {
      // 先获取现有账号
      const [rows] = await connection.execute(
        'SELECT * FROM accounts WHERE id = ?',
        [id]
      )
      const accounts = rows as any[]
      if (accounts.length === 0) {
        throw new Error(`Account ${id} not found`)
      }
      
      const existing = flatToAccount(accounts[0])
      
      // 合并更新
      const merged = { ...existing, ...updates }
      const flat = accountToFlat(merged)
      
      const updateFields: string[] = []
      const values: any[] = []
      
      // 动态构建更新字段
      Object.entries(flat).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'email' && key !== 'created_at') {
          updateFields.push(`${key} = ?`)
          values.push(value === undefined ? null : value)
        }
      })
      
      if (updateFields.length > 0) {
        values.push(id)
        await connection.execute(
          `UPDATE accounts SET ${updateFields.join(', ')} WHERE id = ?`,
          values
        )
      }
    }, 'updateAccount')
  },

  /**
   * 获取所有账号
   */
  async getAll(): Promise<Account[]> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM accounts ORDER BY created_at DESC'
      )
      return (rows as any[]).map(row => flatToAccount(row))
    } finally {
      connection.release()
    }
  },

  /**
   * 根据 ID 获取账号
   */
  async getById(id: string): Promise<Account | null> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM accounts WHERE id = ?',
        [id]
      )
      const accounts = rows as any[]
      return accounts.length > 0 ? flatToAccount(accounts[0]) : null
    } finally {
      connection.release()
    }
  },

  /**
   * 根据邮箱获取账号
   */
  async getByEmail(email: string): Promise<Account | null> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM accounts WHERE email = ?',
        [email]
      )
      const accounts = rows as any[]
      return accounts.length > 0 ? flatToAccount(accounts[0]) : null
    } finally {
      connection.release()
    }
  },

  /**
   * 删除账号（使用事务保护）
   */
  async delete(id: string): Promise<void> {
    return withTransaction(async (connection) => {
      await connection.execute('DELETE FROM accounts WHERE id = ?', [id])
    }, 'deleteAccount')
  },

  /**
   * 获取统计信息
   */
  async getStats(): Promise<AccountStats> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute('SELECT COUNT(*) as total FROM accounts')
      const stats = (rows as any[])[0]
      return {
        total: Number(stats.total)
      }
    } finally {
      connection.release()
    }
  },

  /**
   * 更新使用量信息（从 syncAccountUsage 返回的数据）
   */
  async updateUsageInfo(id: string, syncData: any): Promise<void> {
    const account = await this.getById(id)
    if (!account) {
      throw new Error(`Account ${id} not found`)
    }
    
    const updated = updateAccountUsage(account, syncData)
    await this.update(id, updated)
  },

  /**
   * 分配账号到设备
   */
  async assignToDevice(id: string, deviceId: string): Promise<void> {
    await this.update(id, {
      deviceId,
      status: 'assigned',
      assignedAt: Date.now()
    } as any)
  },

  /**
   * 获取域名统计
   */
  async getDomainStats(): Promise<Array<{ domain: string; count: number }>> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(`
        SELECT 
          SUBSTRING_INDEX(email, '@', -1) as domain,
          COUNT(*) as count
        FROM accounts
        GROUP BY domain
        ORDER BY count DESC
      `)
      return rows as Array<{ domain: string; count: number }>
    } finally {
      connection.release()
    }
  },

  /**
   * 获取每日统计
   */
  async getDailyStats(days: number = 7): Promise<Array<{ date: string; total: number; domain: string }>> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(`
        SELECT
          DATE(FROM_UNIXTIME(created_at / 1000)) as date,
          COUNT(*) as total,
          SUBSTRING_INDEX(email, '@', -1) as domain
        FROM accounts
        WHERE FROM_UNIXTIME(created_at / 1000) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY date, domain
        ORDER BY date DESC, domain
      `, [days])
      return rows as Array<{ date: string; total: number; domain: string }>
    } finally {
      connection.release()
    }
  },

  /**
   * 更新 Access Token（便捷方法）
   */
  async updateAccessToken(id: string, accessToken: string): Promise<void> {
    const account = await this.getById(id)
    if (!account) {
      throw new Error(`Account ${id} not found`)
    }

    await this.update(id, {
      credentials: {
        ...account.credentials,
        accessToken
      }
    } as any)
  },

  /**
   * 更新 OAuth 凭证（便捷方法）
   */
  async updateOAuthCredentials(id: string, credentials: { access_token: string; refresh_token: string }): Promise<void> {
    const account = await this.getById(id)
    if (!account) {
      throw new Error(`Account ${id} not found`)
    }

    await this.update(id, {
      credentials: {
        ...account.credentials,
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token
      }
    } as any)
  },

  /**
   * 更新扩展信息（别名方法，兼容旧代码）
   */
  async updateExtendedInfo(id: string, syncData: any): Promise<void> {
    return this.updateUsageInfo(id, syncData)
  }
}
