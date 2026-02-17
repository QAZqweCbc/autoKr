/**
 * MySQL 账号服务 - 使用新的嵌套数据结构
 */

import { getPool } from './mysql.service'
import { Account, AccountStats } from '../models/account.model'
import { accountToFlat, flatToAccount, updateAccountUsage } from '../utils/account-mapper'

export const MySQLAccountDBNew = {
  /**
   * 创建账号
   */
  async create(account: Account): Promise<Account> {
    const connection = await getPool().getConnection()
    try {
      const flat = accountToFlat(account)
      
      await connection.execute(
        `INSERT INTO accounts (
          id, email, password, 
          access_token, csrf_token, refresh_token, x_amz_sso_authn, client_id, client_secret, region, expires_at, auth_method, provider,
          subscription_type, subscription_title, subscription_raw_type, subscription_expires_at, subscription_days_remaining,
          upgrade_capability, overage_capability, management_target,
          usage_current, usage_limit, usage_percent_used, usage_last_updated,
          base_limit, base_current, free_trial_limit, free_trial_current, free_trial_expiry,
          usage_bonuses, next_reset_date,
          resource_type, resource_display_name, resource_display_name_plural, resource_currency, resource_unit,
          overage_rate, overage_cap, overage_enabled,
          nickname, idp, user_id, visitor_id, group_id, tags,
          status, last_error, consecutive_failures, is_active, device_id, assigned_at,
          created_at, last_used_at, last_checked_at, owner_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          password = VALUES(password),
          access_token = VALUES(access_token),
          csrf_token = VALUES(csrf_token),
          refresh_token = VALUES(refresh_token),
          x_amz_sso_authn = VALUES(x_amz_sso_authn),
          client_id = VALUES(client_id),
          client_secret = VALUES(client_secret),
          region = VALUES(region),
          expires_at = VALUES(expires_at),
          auth_method = VALUES(auth_method),
          provider = VALUES(provider),
          subscription_type = VALUES(subscription_type),
          subscription_title = VALUES(subscription_title),
          subscription_raw_type = VALUES(subscription_raw_type),
          subscription_expires_at = VALUES(subscription_expires_at),
          subscription_days_remaining = VALUES(subscription_days_remaining),
          upgrade_capability = VALUES(upgrade_capability),
          overage_capability = VALUES(overage_capability),
          management_target = VALUES(management_target),
          usage_current = VALUES(usage_current),
          usage_limit = VALUES(usage_limit),
          usage_percent_used = VALUES(usage_percent_used),
          usage_last_updated = VALUES(usage_last_updated),
          base_limit = VALUES(base_limit),
          base_current = VALUES(base_current),
          free_trial_limit = VALUES(free_trial_limit),
          free_trial_current = VALUES(free_trial_current),
          free_trial_expiry = VALUES(free_trial_expiry),
          usage_bonuses = VALUES(usage_bonuses),
          next_reset_date = VALUES(next_reset_date),
          resource_type = VALUES(resource_type),
          resource_display_name = VALUES(resource_display_name),
          resource_display_name_plural = VALUES(resource_display_name_plural),
          resource_currency = VALUES(resource_currency),
          resource_unit = VALUES(resource_unit),
          overage_rate = VALUES(overage_rate),
          overage_cap = VALUES(overage_cap),
          overage_enabled = VALUES(overage_enabled),
          nickname = VALUES(nickname),
          idp = VALUES(idp),
          user_id = VALUES(user_id),
          visitor_id = VALUES(visitor_id),
          group_id = VALUES(group_id),
          tags = VALUES(tags),
          status = VALUES(status),
          last_error = VALUES(last_error),
          consecutive_failures = VALUES(consecutive_failures),
          is_active = VALUES(is_active),
          device_id = VALUES(device_id),
          assigned_at = VALUES(assigned_at),
          last_used_at = VALUES(last_used_at),
          last_checked_at = VALUES(last_checked_at),
          owner_user_id = VALUES(owner_user_id)`,
        [
          flat.id, flat.email, flat.password,
          flat.access_token, flat.csrf_token, flat.refresh_token, flat.x_amz_sso_authn, flat.client_id, flat.client_secret, flat.region, flat.expires_at, flat.auth_method, flat.provider,
          flat.subscription_type, flat.subscription_title, flat.subscription_raw_type, flat.subscription_expires_at, flat.subscription_days_remaining,
          flat.upgrade_capability, flat.overage_capability, flat.management_target,
          flat.usage_current, flat.usage_limit, flat.usage_percent_used, flat.usage_last_updated,
          flat.base_limit, flat.base_current, flat.free_trial_limit, flat.free_trial_current, flat.free_trial_expiry,
          flat.usage_bonuses, flat.next_reset_date,
          flat.resource_type, flat.resource_display_name, flat.resource_display_name_plural, flat.resource_currency, flat.resource_unit,
          flat.overage_rate, flat.overage_cap, flat.overage_enabled,
          flat.nickname, flat.idp, flat.user_id, flat.visitor_id, flat.group_id, flat.tags,
          flat.status, flat.last_error, flat.consecutive_failures, flat.is_active, flat.device_id, flat.assigned_at,
          flat.created_at, flat.last_used_at, flat.last_checked_at, flat.owner_user_id
        ]
      )
      
      return account
    } finally {
      connection.release()
    }
  },

  /**
   * 更新账号
   */
  async update(id: string, updates: Partial<Account>): Promise<void> {
    const connection = await getPool().getConnection()
    try {
      // 先获取现有账号
      const existing = await this.getById(id)
      if (!existing) {
        throw new Error(`Account ${id} not found`)
      }
      
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
    } finally {
      connection.release()
    }
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
   * 删除账号
   */
  async delete(id: string): Promise<void> {
    const connection = await getPool().getConnection()
    try {
      await connection.execute('DELETE FROM accounts WHERE id = ?', [id])
    } finally {
      connection.release()
    }
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
  }
}
