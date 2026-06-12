/**
 * 邮箱配置管理器
 * 统一管理 JSON 和 MySQL 两种存储方式
 */

import { loadConfig, updateConfig, getStorageType } from './config.service'
import { 
  getEmailConfig as getMySQLEmailConfig, 
  saveEmailConfig as saveMySQLEmailConfig,
  hasEmailConfig as hasMySQLEmailConfig
} from './email-config.service'

export interface EmailConfig {
  qqEmail?: string
  authCode?: string
  domains?: string
  useAlias?: boolean
  aliasType?: 'gmail' | 'qq'
  gmailBase?: string
  gmailAppPassword?: string
  qqAliases?: string
}

/**
 * 获取邮箱配置
 * @param decryptSecrets 是否解密敏感信息（默认 true，用于内部使用；false 用于返回给前端）
 */
export async function getEmailConfig(decryptSecrets: boolean = true): Promise<EmailConfig | null> {
  const storageType = getStorageType()
  
  if (storageType === 'mysql') {
    // 从 MySQL 获取（自动解密）
    const config = await getMySQLEmailConfig(decryptSecrets)
    if (!config) return null
    
    return {
      qqEmail: config.qqEmail,
      authCode: config.authCode,
      domains: config.domains,
      useAlias: config.useAlias,
      aliasType: config.aliasType,
      gmailBase: config.gmailBase,
      gmailAppPassword: config.gmailAppPassword,
      qqAliases: config.qqAliases
    }
  } else {
    // 从 JSON 文件获取
    const config = loadConfig()
    if (!config.email) return null
    
    // JSON 存储时，如果不需要解密，返回脱敏数据
    if (!decryptSecrets) {
      return {
        ...config.email,
        authCode: config.email.authCode ? '******' : undefined,
        gmailAppPassword: config.email.gmailAppPassword ? '******' : undefined
      }
    }
    
    return config.email
  }
}

/**
 * 保存邮箱配置
 */
export async function saveEmailConfig(emailConfig: EmailConfig): Promise<void> {
  const storageType = getStorageType()
  
  if (storageType === 'mysql') {
    // 保存到 MySQL（自动加密）
    await saveMySQLEmailConfig({
      id: 'default',
      ...emailConfig
    })
  } else {
    // 保存到 JSON 文件
    updateConfig({ email: emailConfig })
  }
}

/**
 * 检查邮箱配置是否存在
 */
export async function hasEmailConfig(): Promise<boolean> {
  const storageType = getStorageType()
  
  if (storageType === 'mysql') {
    return await hasMySQLEmailConfig()
  } else {
    const config = loadConfig()
    return !!config.email && !!config.email.qqEmail
  }
}

/**
 * 获取用于内部使用的完整配置（包含解密后的敏感信息）
 */
export async function getEmailConfigForInternal(): Promise<EmailConfig | null> {
  return await getEmailConfig(true)
}

/**
 * 获取用于前端显示的配置（敏感信息脱敏）
 */
export async function getEmailConfigForFrontend(): Promise<EmailConfig | null> {
  return await getEmailConfig(false)
}
