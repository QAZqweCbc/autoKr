/**
 * 邮箱配置服务
 * 负责邮箱配置的加密存储和解密读取
 */

import { getPool } from './mysql.service'
import { encrypt, decrypt } from '../utils/crypto.util'

export interface EmailConfig {
  id: string
  qqEmail?: string
  authCode?: string  // 加密存储
  domains?: string
  useAlias?: boolean
  aliasType?: 'gmail' | 'qq'
  gmailBase?: string
  gmailAppPassword?: string  // 加密存储
  qqAliases?: string
  // SMTP通用配置
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassword?: string  // 加密存储
  smtpFrom?: string
  createdAt?: Date
  updatedAt?: Date
}

/**
 * 创建邮箱配置表
 */
export async function createEmailConfigTable() {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS email_config (
        id VARCHAR(36) PRIMARY KEY,
        qq_email VARCHAR(255),
        auth_code TEXT COMMENT '加密存储的授权码',
        domains TEXT,
        use_alias BOOLEAN DEFAULT FALSE,
        alias_type ENUM('gmail', 'qq'),
        gmail_base VARCHAR(255),
        gmail_app_password TEXT COMMENT '加密存储的Gmail应用密码',
        qq_aliases TEXT,
        smtp_host VARCHAR(255) COMMENT 'SMTP服务器地址',
        smtp_port INT COMMENT 'SMTP端口',
        smtp_secure BOOLEAN DEFAULT FALSE COMMENT '是否使用SSL',
        smtp_user VARCHAR(255) COMMENT 'SMTP用户名',
        smtp_password TEXT COMMENT '加密存储的SMTP密码',
        smtp_from VARCHAR(255) COMMENT '发件人显示',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮箱配置表（敏感信息加密存储）'
    `)
    
    console.log('✅ 邮箱配置表创建/检查完成')
  } finally {
    connection.release()
  }
}

/**
 * 保存邮箱配置（加密敏感信息）
 */
export async function saveEmailConfig(config: EmailConfig): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    // 加密敏感信息
    const encryptedAuthCode = config.authCode ? encrypt(config.authCode) : null
    const encryptedGmailPassword = config.gmailAppPassword ? encrypt(config.gmailAppPassword) : null
    const encryptedSmtpPassword = config.smtpPassword ? encrypt(config.smtpPassword) : null
    
    await connection.execute(`
      INSERT INTO email_config (
        id, qq_email, auth_code, domains, use_alias, alias_type, 
        gmail_base, gmail_app_password, qq_aliases,
        smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, smtp_from
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        qq_email = VALUES(qq_email),
        auth_code = VALUES(auth_code),
        domains = VALUES(domains),
        use_alias = VALUES(use_alias),
        alias_type = VALUES(alias_type),
        gmail_base = VALUES(gmail_base),
        gmail_app_password = VALUES(gmail_app_password),
        qq_aliases = VALUES(qq_aliases),
        smtp_host = VALUES(smtp_host),
        smtp_port = VALUES(smtp_port),
        smtp_secure = VALUES(smtp_secure),
        smtp_user = VALUES(smtp_user),
        smtp_password = VALUES(smtp_password),
        smtp_from = VALUES(smtp_from)
    `, [
      config.id || 'default',
      config.qqEmail || null,
      encryptedAuthCode,
      config.domains || null,
      config.useAlias || false,
      config.aliasType || null,
      config.gmailBase || null,
      encryptedGmailPassword,
      config.qqAliases || null,
      config.smtpHost || null,
      config.smtpPort || null,
      config.smtpSecure || false,
      config.smtpUser || null,
      encryptedSmtpPassword,
      config.smtpFrom || null
    ])
    
    console.log('✅ 邮箱配置已保存（敏感信息已加密）')
  } finally {
    connection.release()
  }
}

/**
 * 获取邮箱配置（自动解密）
 * @param decrypt 是否解密敏感信息（默认 true）
 */
export async function getEmailConfig(decryptSecrets: boolean = true): Promise<EmailConfig | null> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM email_config WHERE id = ? LIMIT 1',
      ['default']
    )
    
    const configs = rows as any[]
    if (configs.length === 0) {
      return null
    }
    
    const row = configs[0]
    
    // 构建配置对象
    const config: EmailConfig = {
      id: row.id,
      qqEmail: row.qq_email,
      authCode: row.auth_code,
      domains: row.domains,
      useAlias: Boolean(row.use_alias),
      aliasType: row.alias_type,
      gmailBase: row.gmail_base,
      gmailAppPassword: row.gmail_app_password,
      qqAliases: row.qq_aliases,
      smtpHost: row.smtp_host,
      smtpPort: row.smtp_port,
      smtpSecure: Boolean(row.smtp_secure),
      smtpUser: row.smtp_user,
      smtpPassword: row.smtp_password,
      smtpFrom: row.smtp_from,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
    
    // 如果需要解密
    if (decryptSecrets) {
      if (config.authCode) {
        try {
          config.authCode = decrypt(config.authCode)
        } catch (error) {
          console.error('❌ 解密授权码失败')
          config.authCode = undefined
        }
      }
      
      if (config.gmailAppPassword) {
        try {
          config.gmailAppPassword = decrypt(config.gmailAppPassword)
        } catch (error) {
          console.error('❌ 解密Gmail密码失败')
          config.gmailAppPassword = undefined
        }
      }
      
      if (config.smtpPassword) {
        try {
          config.smtpPassword = decrypt(config.smtpPassword)
        } catch (error) {
          console.error('❌ 解密SMTP密码失败')
          config.smtpPassword = undefined
        }
      }
    } else {
      // 不解密时，返回脱敏数据
      config.authCode = config.authCode ? '******' : undefined
      config.gmailAppPassword = config.gmailAppPassword ? '******' : undefined
      config.smtpPassword = config.smtpPassword ? '******' : undefined
    }
    
    return config
  } finally {
    connection.release()
  }
}

/**
 * 删除邮箱配置
 */
export async function deleteEmailConfig(): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    await connection.execute('DELETE FROM email_config WHERE id = ?', ['default'])
    console.log('✅ 邮箱配置已删除')
  } finally {
    connection.release()
  }
}

/**
 * 检查邮箱配置是否存在
 */
export async function hasEmailConfig(): Promise<boolean> {
  const config = await getEmailConfig(false)
  return config !== null
}
