/**
 * MySQL 数据库服务
 */

import mysql from 'mysql2/promise'
import { Account, Task } from './database.service'

let pool: mysql.Pool | null = null

export interface MySQLConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

/**
 * 初始化 MySQL 连接池
 */
export async function initMySQL(config: MySQLConfig) {
  try {
    console.log('\n📦 初始化 MySQL 连接...')
    console.log(`   主机: ${config.host}:${config.port}`)
    console.log(`   数据库: ${config.database}`)
    
    // 先连接到 MySQL（不指定数据库）
    const tempConnection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password
    })
    
    // 创建数据库（如果不存在）
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log(`✅ 数据库 ${config.database} 已就绪`)
    await tempConnection.end()
    
    // 创建连接池（指定数据库）
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    })
    
    // 测试连接
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()
    
    console.log('✅ MySQL 连接成功')
    
    // 创建表
    await createTables()
    
    // 创建邮箱配置表
    const { createEmailConfigTable } = await import('./email-config.service')
    await createEmailConfigTable()
    
    // 创建审计日志表
    const { createAuditLogTable } = await import('./audit-log.service')
    await createAuditLogTable()
    
    // 创建刷新日志表
    await createRefreshLogsTable()
    
    return true
  } catch (error: any) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ MySQL 连接失败')
    console.error('='.repeat(60))
    console.error(`错误: ${error.message}`)
    console.error('\n解决方法：')
    console.error('  1. 检查 MySQL 服务是否运行')
    console.error('  2. 检查配置信息是否正确')
    console.error('  3. 检查网络连接')
    console.error('  4. 检查防火墙设置')
    console.error('  5. 确保用户有创建数据库的权限')
    console.error('='.repeat(60) + '\n')
    throw error
  }
}

/**
 * 创建数据表
 */
async function createTables() {
  if (!pool) throw new Error('MySQL 未初始化')
  
  const connection = await pool.getConnection()
  
  try {
    // 创建任务表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        receive_email VARCHAR(255) NOT NULL,
        auth_code VARCHAR(255) NOT NULL,
        client_id VARCHAR(255),
        proxy_url VARCHAR(255),
        status ENUM('pending', 'running', 'success', 'failed') DEFAULT 'pending',
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_email (email),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    
    // 创建账号表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        x_amz_sso_authn TEXT COMMENT 'AWS SSO 授权 token (x-amz-sso_authn)',
        access_token TEXT,
        refresh_token TEXT,
        client_id VARCHAR(255),
        region VARCHAR(50),
        device_id VARCHAR(255) COMMENT '分配的设备ID',
        status ENUM('pending', 'active', 'assigned', 'expired') DEFAULT 'pending' COMMENT '账号状态',
        assigned_at TIMESTAMP NULL COMMENT '分配时间',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_device_id (device_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号表'
    `)
    
    // 迁移：添加扩展字段（如果不存在）
    await migrateAccountsTable(connection)
    await migrateCurrentAccountSchema(connection)
    
    // 创建检测记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS check_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip VARCHAR(45) NOT NULL COMMENT 'IP地址',
        proxy_url VARCHAR(255) COMMENT '代理地址',
        verdict ENUM('safe', 'warning', 'risky', 'blocked') NOT NULL COMMENT '判定结果',
        suggestion TEXT COMMENT '建议',
        result_data JSON COMMENT '完整检测结果',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '检测时间',
        INDEX idx_ip (ip),
        INDEX idx_verdict (verdict),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='IP检测记录表'
    `)
    
    // 创建浏览器配置表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS browser_config (
        id INT PRIMARY KEY DEFAULT 1 COMMENT '单例配置，固定ID=1',
        browser_type ENUM('chrome', 'firefox') NOT NULL DEFAULT 'chrome' COMMENT '浏览器类型',
        browser_path VARCHAR(500) DEFAULT '' COMMENT '浏览器路径（空表示使用Playwright内置）',
        headless BOOLEAN NOT NULL DEFAULT TRUE COMMENT '无头模式',
        show_window BOOLEAN NOT NULL DEFAULT FALSE COMMENT '显示窗口',
        args TEXT COMMENT '启动参数（JSON数组）',
        delay_min INT NOT NULL DEFAULT 3 COMMENT '最小延迟（秒）',
        delay_max INT NOT NULL DEFAULT 8 COMMENT '最大延迟（秒）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        CHECK (id = 1)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='浏览器配置表（单例）'
    `)
    
    // 创建普通用户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS client_users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
        max_tokens INT DEFAULT 2 COMMENT '最大Token配额',
        created_at BIGINT NOT NULL,
        last_login_at BIGINT,
        INDEX idx_email (email),
        INDEX idx_username (username),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='普通用户表'
    `)
    
    // 创建Token分配表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS token_allocations (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        account_id VARCHAR(36),
        status ENUM('pending', 'approved', 'rejected', 'active', 'revoked') DEFAULT 'pending',
        requested_at BIGINT NOT NULL,
        approved_at BIGINT,
        approved_by VARCHAR(36),
        reject_reason TEXT,
        revoked_at BIGINT,
        revoked_by VARCHAR(36),
        INDEX idx_user_id (user_id),
        INDEX idx_account_id (account_id),
        INDEX idx_status (status),
        FOREIGN KEY (user_id) REFERENCES client_users(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Token分配表'
    `)
    
    // 创建验证码表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        type ENUM('register', 'reset') DEFAULT 'register',
        expires_at BIGINT NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at BIGINT NOT NULL,
        INDEX idx_email (email),
        INDEX idx_code (code),
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验证码表'
    `)
    
    console.log('✅ 数据表创建/检查完成')
  } finally {
    connection.release()
  }
}

/**
 * 迁移accounts表，添加扩展字段
 */
async function migrateAccountsTable(connection: mysql.PoolConnection) {
  const fieldsToAdd = [
    { name: 'client_secret', definition: 'TEXT COMMENT "OAuth客户端密钥"' },
    { name: 'user_id', definition: 'VARCHAR(255) COMMENT "AWS用户ID"' },
    { name: 'nickname', definition: 'VARCHAR(255) COMMENT "昵称"' },
    { name: 'idp', definition: 'VARCHAR(50) COMMENT "身份提供商"' },
    
    // 订阅信息
    { name: 'subscription_type', definition: 'VARCHAR(100) COMMENT "订阅类型"' },
    { name: 'subscription_title', definition: 'VARCHAR(100) COMMENT "订阅标题"' },
    { name: 'subscription_status', definition: 'VARCHAR(50) COMMENT "订阅状态"' },
    { name: 'days_remaining', definition: 'INT COMMENT "剩余天数"' },
    { name: 'expires_at', definition: 'BIGINT COMMENT "过期时间戳"' },
    { name: 'management_target', definition: 'VARCHAR(50) COMMENT "管理目标"' },
    { name: 'upgrade_capability', definition: 'VARCHAR(50) COMMENT "升级能力"' },
    { name: 'overage_capability', definition: 'VARCHAR(50) COMMENT "超额能力"' },
    
    // 使用量信息
    { name: 'usage_current', definition: 'INT COMMENT "当前使用量"' },
    { name: 'usage_limit', definition: 'INT COMMENT "使用限制"' },
    { name: 'usage_percent', definition: 'DECIMAL(5,2) COMMENT "使用百分比"' },
    { name: 'base_limit', definition: 'INT COMMENT "基础限制"' },
    { name: 'base_current', definition: 'INT COMMENT "基础使用量"' },
    { name: 'free_trial_limit', definition: 'INT COMMENT "试用限制"' },
    { name: 'free_trial_current', definition: 'INT COMMENT "试用使用量"' },
    { name: 'free_trial_expiry', definition: 'VARCHAR(50) COMMENT "试用到期时间"' },
    { name: 'next_reset_date', definition: 'VARCHAR(50) COMMENT "下次重置日期"' },
    
    // 资源详情
    { name: 'resource_display_name', definition: 'VARCHAR(100) COMMENT "资源显示名称"' },
    { name: 'resource_type', definition: 'VARCHAR(50) COMMENT "资源类型"' },
    { name: 'resource_currency', definition: 'VARCHAR(10) COMMENT "货币"' },
    { name: 'resource_unit', definition: 'VARCHAR(50) COMMENT "单位"' },
    { name: 'overage_rate', definition: 'DECIMAL(10,2) COMMENT "超额费率"' },
    { name: 'overage_cap', definition: 'INT COMMENT "超额上限"' },
    { name: 'overage_enabled', definition: 'BOOLEAN COMMENT "是否启用超额"' },
    
    { name: 'last_sync_at', definition: 'BIGINT COMMENT "最后同步时间"' },
    { name: 'last_checked_at', definition: 'BIGINT COMMENT "最后检查时间"' },
    { name: 'last_error', definition: 'TEXT COMMENT "最后一次错误信息"' },
    { name: 'consecutive_failures', definition: 'INT DEFAULT 0 COMMENT "连续刷新失败次数"' }
  ]
  
  for (const field of fieldsToAdd) {
    try {
      // 检查列是否存在
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'accounts' 
         AND COLUMN_NAME = ?`,
        [field.name]
      )
      
      if ((columns as any[]).length === 0) {
        // 列不存在，添加它
        await connection.execute(
          `ALTER TABLE accounts ADD COLUMN ${field.name} ${field.definition}`
        )
        console.log(`✅ 添加字段: accounts.${field.name}`)
      }
    } catch (error) {
      console.warn(`⚠️  迁移字段 ${field.name} 失败:`, error)
    }
  }
}

/**
 * 关闭 MySQL 连接
 */
// 补齐当前账户读写逻辑依赖的新字段，并将旧列数据回填到新列。
async function migrateCurrentAccountSchema(connection: mysql.PoolConnection) {
  const fieldsToAdd = [
    { name: 'csrf_token', definition: 'TEXT COMMENT "CSRF Token"' },
    { name: 'auth_method', definition: 'VARCHAR(50) COMMENT "认证方式"' },
    { name: 'provider', definition: 'VARCHAR(50) COMMENT "身份提供商"' },
    { name: 'visitor_id', definition: 'VARCHAR(255) COMMENT "访问者ID"' },
    { name: 'group_id', definition: 'VARCHAR(255) COMMENT "分组ID"' },
    { name: 'tags', definition: 'TEXT COMMENT "标签(JSON)"' },
    { name: 'is_active', definition: 'BOOLEAN COMMENT "是否激活"' },
    { name: 'subscription_raw_type', definition: 'VARCHAR(100) COMMENT "原始订阅类型"' },
    { name: 'subscription_expires_at', definition: 'BIGINT COMMENT "订阅过期时间戳"' },
    { name: 'subscription_days_remaining', definition: 'INT COMMENT "订阅剩余天数"' },
    { name: 'usage_percent_used', definition: 'DECIMAL(5,2) COMMENT "已使用百分比"' },
    { name: 'usage_last_updated', definition: 'BIGINT COMMENT "使用量最后更新时间戳"' },
    { name: 'usage_bonuses', definition: 'TEXT COMMENT "奖励额度(JSON)"' },
    { name: 'resource_display_name_plural', definition: 'VARCHAR(100) COMMENT "资源显示名称复数"' }
  ]

  for (const field of fieldsToAdd) {
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'accounts'
       AND COLUMN_NAME = ?`,
      [field.name]
    )

    if ((columns as any[]).length === 0) {
      await connection.execute(
        `ALTER TABLE accounts ADD COLUMN ${field.name} ${field.definition}`
      )
      console.log(`Added current account column: accounts.${field.name}`)
    }
  }

  const backfillStatements = [
    `UPDATE accounts
       SET access_token = COALESCE(access_token, x_amz_sso_authn)
     WHERE access_token IS NULL OR access_token = ''`,
    `UPDATE accounts
       SET subscription_days_remaining = COALESCE(subscription_days_remaining, days_remaining)
     WHERE subscription_days_remaining IS NULL`,
    `UPDATE accounts
       SET subscription_expires_at = COALESCE(subscription_expires_at, expires_at)
     WHERE subscription_expires_at IS NULL`,
    `UPDATE accounts
       SET usage_percent_used = COALESCE(usage_percent_used, usage_percent)
     WHERE usage_percent_used IS NULL`,
    `UPDATE accounts
       SET usage_last_updated = COALESCE(usage_last_updated, last_sync_at)
     WHERE usage_last_updated IS NULL`,
    `UPDATE accounts
       SET last_checked_at = COALESCE(last_checked_at, last_sync_at)
     WHERE last_checked_at IS NULL`
  ]

  for (const statement of backfillStatements) {
    try {
      await connection.execute(statement)
    } catch (error) {
      console.warn('Current account schema backfill failed:', error)
    }
  }
}

export async function closeMySQL() {
  if (pool) {
    await pool.end()
    pool = null
    console.log('✅ MySQL 连接已关闭')
  }
}

/**
 * 获取连接池
 */
export function getPool() {
  if (!pool) throw new Error('MySQL 未初始化')
  return pool
}

// ==================== 任务操作 ====================

export const MySQLTaskDB = {
  async create(task: Task): Promise<Task> {
    const connection = await getPool().getConnection()
    try {
      await connection.execute(
        `INSERT INTO tasks (id, email, password, receive_email, auth_code, client_id, proxy_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [task.id, task.email, task.password, task.receive_email, task.auth_code, 
         task.client_id || null, task.proxy_url || null, task.status]
      )
      return task
    } finally {
      connection.release()
    }
  },

  async getAll(status?: string): Promise<Task[]> {
    const connection = await getPool().getConnection()
    try {
      let query = 'SELECT * FROM tasks'
      const params: any[] = []
      
      if (status) {
        query += ' WHERE status = ?'
        params.push(status)
      }
      
      query += ' ORDER BY created_at DESC'
      
      const [rows] = await connection.execute(query, params)
      return rows as Task[]
    } finally {
      connection.release()
    }
  },

  async getById(id: string): Promise<Task | null> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM tasks WHERE id = ?',
        [id]
      )
      const tasks = rows as Task[]
      return tasks.length > 0 ? tasks[0] : null
    } finally {
      connection.release()
    }
  },

  async updateStatus(id: string, status: Task['status'], error?: string): Promise<void> {
    const connection = await getPool().getConnection()
    try {
      await connection.execute(
        'UPDATE tasks SET status = ?, error = ? WHERE id = ?',
        [status, error || null, id]
      )
    } finally {
      connection.release()
    }
  },

  async delete(id: string): Promise<void> {
    const connection = await getPool().getConnection()
    try {
      await connection.execute('DELETE FROM tasks WHERE id = ?', [id])
    } finally {
      connection.release()
    }
  },

  async getStats() {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused
        FROM tasks
      `)
      const stats = (rows as any[])[0]
      return {
        total: Number(stats.total),
        pending: Number(stats.pending),
        running: Number(stats.running),
        success: Number(stats.success),
        failed: Number(stats.failed),
        paused: Number(stats.paused)
      }
    } finally {
      connection.release()
    }
  }
}

// ==================== 账号操作 ====================

export const MySQLAccountDB = {
  async create(account: Account): Promise<Account> {
    const connection = await getPool().getConnection()
    try {
      // 使用新的服务
      const { MySQLAccountDBNew } = await import('./mysql-account.service')
      return await MySQLAccountDBNew.create(account)
    } finally {
      connection.release()
    }
  },

  async update(id: string, account: Partial<Account>): Promise<void> {
    const { MySQLAccountDBNew } = await import('./mysql-account.service')
    return await MySQLAccountDBNew.update(id, account)
  },

  async getAll(): Promise<Account[]> {
    const { MySQLAccountDBNew } = await import('./mysql-account.service')
    return await MySQLAccountDBNew.getAll()
  },

  async getById(id: string): Promise<Account | null> {
    const { MySQLAccountDBNew } = await import('./mysql-account.service')
    return await MySQLAccountDBNew.getById(id)
  },

  async delete(id: string): Promise<void> {
    const { MySQLAccountDBNew } = await import('./mysql-account.service')
    return await MySQLAccountDBNew.delete(id)
  },

  async getStats() {
    const { MySQLAccountDBNew } = await import('./mysql-account.service')
    return await MySQLAccountDBNew.getStats()
  },

  // 获取域名统计
  async getDomainStats() {
    const { MySQLAccountDBNew } = await import('./mysql-account.service')
    return await MySQLAccountDBNew.getDomainStats()
  },

  // 获取每日注册统计（最近7天）
  async getDailyStats(days: number = 7) {
    const { MySQLAccountDBNew } = await import('./mysql-account.service')
    return await MySQLAccountDBNew.getDailyStats(days)
  },

  async updateToken(id: string, xAmzSsoAuthn: string): Promise<void> {
    const account = await this.getById(id)
    if (!account) return
    
    await this.update(id, {
      credentials: {
        ...account.credentials,
        accessToken: xAmzSsoAuthn
      },
      status: 'active'
    })
  },

  async updateAccessToken(id: string, accessToken: string): Promise<void> {
    const account = await this.getById(id)
    if (!account) return
    
    await this.update(id, {
      credentials: {
        ...account.credentials,
        accessToken
      }
    })
  },

  async assignToDevice(id: string, deviceId: string, deviceName?: string): Promise<void> {
    await this.update(id, {
      deviceId,
      status: 'assigned',
      assignedAt: Date.now()
    })
  },

  async updateExtendedInfo(id: string, info: any): Promise<void> {
    const { MySQLAccountDBNew } = await import('./mysql-account.service')
    return await MySQLAccountDBNew.updateUsageInfo(id, info)
  },

  async updateOAuthCredentials(id: string, credentials: {
    refresh_token?: string
    client_id?: string
    client_secret?: string
    region?: string
  }): Promise<void> {
    const account = await this.getById(id)
    if (!account) return
    
    await this.update(id, {
      credentials: {
        ...account.credentials,
        refreshToken: credentials.refresh_token,
        clientId: credentials.client_id,
        clientSecret: credentials.client_secret,
        region: credentials.region
      }
    })
  }
}

// ==================== 检测记录操作 ====================

export interface CheckRecord {
  id?: number
  ip: string
  proxyUrl?: string
  verdict: 'safe' | 'warning' | 'risky' | 'blocked'
  suggestion: string
  result: any
  timestamp: string
}

export const MySQLCheckDB = {
  async create(record: Omit<CheckRecord, 'id' | 'timestamp'>): Promise<CheckRecord> {
    const connection = await getPool().getConnection()
    try {
      const [result] = await connection.execute(
        `INSERT INTO check_records (ip, proxy_url, verdict, suggestion, result_data)
         VALUES (?, ?, ?, ?, ?)`,
        [record.ip, record.proxyUrl || null, record.verdict, record.suggestion, JSON.stringify(record.result)]
      )
      const insertId = (result as any).insertId
      return {
        id: insertId,
        ...record,
        timestamp: new Date().toISOString()
      }
    } finally {
      connection.release()
    }
  },

  async getRecords(limit: number = 20): Promise<CheckRecord[]> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(
        `SELECT id, ip, proxy_url as proxyUrl, verdict, suggestion, 
                result_data as result, timestamp 
         FROM check_records 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [limit]
      )
      return (rows as any[]).map(row => ({
        ...row,
        result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result
      }))
    } finally {
      connection.release()
    }
  },

  async getStats() {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN verdict = 'safe' THEN 1 ELSE 0 END) as safe,
          SUM(CASE WHEN verdict = 'warning' THEN 1 ELSE 0 END) as warning,
          SUM(CASE WHEN verdict = 'risky' THEN 1 ELSE 0 END) as risky,
          SUM(CASE WHEN verdict = 'blocked' THEN 1 ELSE 0 END) as blocked
        FROM check_records
      `)
      const stats = (rows as any[])[0]
      return {
        total: Number(stats.total),
        safe: Number(stats.safe),
        warning: Number(stats.warning),
        risky: Number(stats.risky),
        blocked: Number(stats.blocked)
      }
    } finally {
      connection.release()
    }
  },

  async clear(): Promise<void> {
    const connection = await getPool().getConnection()
    try {
      await connection.execute('TRUNCATE TABLE check_records')
    } finally {
      connection.release()
    }
  }
}

// ==================== 浏览器配置操作 ====================

export const MySQLBrowserConfigDB = {
  /**
   * 获取浏览器配置（单例）
   */
  async get(): Promise<any | null> {
    const connection = await getPool().getConnection()
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM browser_config WHERE id = 1'
      )
      const configs = rows as any[]
      if (configs.length === 0) return null
      
      const config = configs[0]
      return {
        browserType: config.browser_type,
        browserPath: config.browser_path || '',
        headless: Boolean(config.headless),
        showWindow: Boolean(config.show_window),
        args: config.args ? JSON.parse(config.args) : [],
        delayMin: config.delay_min,
        delayMax: config.delay_max
      }
    } finally {
      connection.release()
    }
  },

  /**
   * 保存浏览器配置（单例，使用 REPLACE INTO）
   */
  async save(config: any): Promise<void> {
    const connection = await getPool().getConnection()
    try {
      await connection.execute(
        `REPLACE INTO browser_config 
         (id, browser_type, browser_path, headless, show_window, args, delay_min, delay_max)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          config.browserType,
          config.browserPath || '',
          config.headless ? 1 : 0,
          config.showWindow ? 1 : 0,
          JSON.stringify(config.args || []),
          config.delayMin,
          config.delayMax
        ]
      )
    } finally {
      connection.release()
    }
  }
}

/**
 * 创建刷新日志表
 */
async function createRefreshLogsTable() {
  if (!pool) throw new Error('MySQL 未初始化')
  
  const connection = await pool.getConnection()
  
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS refresh_logs (
        id VARCHAR(36) PRIMARY KEY COMMENT '日志ID（UUID）',
        timestamp BIGINT NOT NULL COMMENT '刷新开始时间戳',
        total_accounts INT NOT NULL COMMENT '总账号数',
        success_count INT NOT NULL DEFAULT 0 COMMENT '成功数',
        failed_count INT NOT NULL DEFAULT 0 COMMENT '失败数',
        skipped_count INT NOT NULL DEFAULT 0 COMMENT '跳过数',
        duration INT NOT NULL COMMENT '总耗时（毫秒）',
        details JSON COMMENT '详细结果（JSON数组）',
        created_at BIGINT NOT NULL COMMENT '创建时间戳',
        INDEX idx_timestamp (timestamp),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Token刷新日志表'
    `)
    
    console.log('✅ 刷新日志表创建/检查完成')
  } finally {
    connection.release()
  }
}
