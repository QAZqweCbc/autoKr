/**
 * Token 导出服务
 * 支持多种格式导出账号凭证
 */

import { Account } from '../models/account.model'

/**
 * AIClient2API 格式接口
 * 标准 OAuth 凭据格式，兼容 AIClient2API
 */
export interface AIClient2APIFormat {
  email: string
  password?: string
  access_token: string
  refresh_token?: string
  expires_at?: string | number
  session_key?: string
  csrf_token?: string
  client_id?: string
  client_secret?: string
  region?: string
  provider?: string
  auth_method?: string
}

/**
 * 导出字段选项
 */
export interface ExportFieldOptions {
  email?: boolean
  password?: boolean
  access_token?: boolean
  refresh_token?: boolean
  csrf_token?: boolean
  sso_token?: boolean
  client_id?: boolean
  client_secret?: boolean
  region?: boolean
  expires_at?: boolean
  subscription_type?: boolean
  subscription_title?: boolean
  usage_current?: boolean
  usage_limit?: boolean
  usage_percent?: boolean
  status?: boolean
  nickname?: boolean
  user_id?: boolean
  created_at?: boolean
  last_used_at?: boolean
}

/**
 * 导出选项
 */
export interface TokenExportOptions {
  format: 'aiclient2api' | 'json'
  fields?: ExportFieldOptions
  onlyWithToken?: boolean
  includeExpired?: boolean
}

/**
 * 导出为 AIClient2API 格式
 */
export function exportAsAIClient2API(accounts: Account[]): AIClient2APIFormat[] {
  return accounts
    .filter(acc => acc.credentials.accessToken) // 只导出有 token 的账号
    .map(acc => {
      const result: AIClient2APIFormat = {
        email: acc.email,
        access_token: acc.credentials.accessToken,
        region: acc.credentials.region || 'us-east-1',
        provider: acc.credentials.provider || 'anthropic',
        auth_method: acc.credentials.authMethod || 'oauth'
      }

      // 可选字段
      if (acc.password) result.password = acc.password
      if (acc.credentials.refreshToken) result.refresh_token = acc.credentials.refreshToken
      if (acc.credentials.csrfToken) result.csrf_token = acc.credentials.csrfToken
      if (acc.credentials.clientId) result.client_id = acc.credentials.clientId
      if (acc.credentials.clientSecret) result.client_secret = acc.credentials.clientSecret
      if (acc.credentials.expiresAt) result.expires_at = acc.credentials.expiresAt
      if (acc.credentials.accessToken) result.session_key = acc.credentials.accessToken

      return result
    })
}

/**
 * 导出为 JSON 格式（自定义字段）
 */
export function exportAsCustomJSON(
  accounts: Account[],
  fields: ExportFieldOptions
): Record<string, any>[] {
  return accounts.map(acc => {
    const result: Record<string, any> = {}

    // 基础字段
    if (fields.email !== false) result.email = acc.email
    if (fields.password && acc.password) result.password = acc.password
    if (fields.nickname && acc.nickname) result.nickname = acc.nickname
    if (fields.status) result.status = acc.status

    // 凭证字段
    if (fields.access_token && acc.credentials.accessToken) {
      result.access_token = acc.credentials.accessToken
    }
    if (fields.refresh_token && acc.credentials.refreshToken) {
      result.refresh_token = acc.credentials.refreshToken
    }
    if (fields.csrf_token && acc.credentials.csrfToken) {
      result.csrf_token = acc.credentials.csrfToken
    }
    if (fields.sso_token && acc.credentials.ssoToken) {
      result.sso_token = acc.credentials.ssoToken
    }
    if (fields.client_id && acc.credentials.clientId) {
      result.client_id = acc.credentials.clientId
    }
    if (fields.client_secret && acc.credentials.clientSecret) {
      result.client_secret = acc.credentials.clientSecret
    }
    if (fields.region) {
      result.region = acc.credentials.region || 'us-east-1'
    }
    if (fields.expires_at && acc.credentials.expiresAt) {
      result.expires_at = acc.credentials.expiresAt
    }

    // 订阅字段
    if (fields.subscription_type && acc.subscription.type) {
      result.subscription_type = acc.subscription.type
    }
    if (fields.subscription_title && acc.subscription.title) {
      result.subscription_title = acc.subscription.title
    }

    // 使用量字段
    if (fields.usage_current !== undefined && acc.usage.current !== undefined) {
      result.usage_current = acc.usage.current
    }
    if (fields.usage_limit !== undefined && acc.usage.limit !== undefined) {
      result.usage_limit = acc.usage.limit
    }
    if (fields.usage_percent !== undefined && acc.usage.percentUsed !== undefined) {
      result.usage_percent = acc.usage.percentUsed
    }

    // 其他字段
    if (fields.user_id && acc.userId) result.user_id = acc.userId
    if (fields.created_at && acc.createdAt) result.created_at = acc.createdAt
    if (fields.last_used_at && acc.lastUsedAt) result.last_used_at = acc.lastUsedAt

    return result
  })
}

/**
 * 导出账号凭证
 */
export function exportTokens(
  accounts: Account[],
  options: TokenExportOptions
): string {
  // 过滤选项
  let filteredAccounts = accounts

  if (options.onlyWithToken) {
    filteredAccounts = filteredAccounts.filter(acc => acc.credentials.accessToken)
  }

  if (!options.includeExpired) {
    const now = Date.now()
    filteredAccounts = filteredAccounts.filter(acc => {
      if (!acc.credentials.expiresAt) return true
      return new Date(acc.credentials.expiresAt).getTime() > now
    })
  }

  // 根据格式导出
  if (options.format === 'aiclient2api') {
    const data = exportAsAIClient2API(filteredAccounts)
    return JSON.stringify(data, null, 2)
  } else {
    const fields = options.fields || {
      email: true,
      access_token: true,
      refresh_token: true,
      client_id: true,
      client_secret: true,
      region: true
    }
    const data = exportAsCustomJSON(filteredAccounts, fields)
    return JSON.stringify(data, null, 2)
  }
}

/**
 * 生成文件名
 */
export function generateExportFilename(
  format: 'aiclient2api' | 'json',
  count: number
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const prefix = format === 'aiclient2api' ? 'aiclient2api-tokens' : 'tokens'
  return `${prefix}_${count}_${timestamp}.json`
}
