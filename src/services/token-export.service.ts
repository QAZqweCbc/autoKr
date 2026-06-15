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
 * 导出字段选项，key 使用账号对象的真实字段路径
 */
export interface ExportFieldOptions {
  [fieldPath: string]: boolean | undefined
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
    .filter(acc => acc.credentials.accessToken)
    .map(acc => {
      const result: AIClient2APIFormat = {
        email: acc.email,
        access_token: acc.credentials.accessToken,
        region: acc.credentials.region || 'us-east-1',
        provider: acc.credentials.provider || 'anthropic',
        auth_method: acc.credentials.authMethod || 'oauth'
      }

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

const getValueByPath = (source: Record<string, any>, path: string): any => {
  return path.split('.').reduce((value, key) => {
    if (value === undefined || value === null) return undefined
    return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined
  }, source as any)
}

const setValueByPath = (target: Record<string, any>, path: string, value: any) => {
  const keys = path.split('.')
  const leafKey = keys.pop()

  if (!leafKey) return

  const parent = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {}
    }
    return current[key]
  }, target)

  parent[leafKey] = value
}

/**
 * 导出为 JSON 格式，字段名保持账号对象的真实字段路径
 */
export function exportAsCustomJSON(
  accounts: Account[],
  fields: ExportFieldOptions
): Record<string, any>[] {
  return accounts.map(acc => {
    const result: Record<string, any> = {}

    Object.entries(fields).forEach(([fieldPath, enabled]) => {
      if (!enabled) return

      const value = getValueByPath(acc as Record<string, any>, fieldPath)
      if (value !== undefined) {
        setValueByPath(result, fieldPath, value)
      }
    })

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
  let filteredAccounts = accounts

  if (options.onlyWithToken) {
    filteredAccounts = filteredAccounts.filter(acc => acc.credentials.accessToken)
  }

  if (options.includeExpired === false) {
    const now = Date.now()
    filteredAccounts = filteredAccounts.filter(acc => {
      if (!acc.credentials.expiresAt) return true
      return new Date(acc.credentials.expiresAt).getTime() > now
    })
  }

  if (filteredAccounts.length === 0) {
    throw new Error('筛选后没有可导出的账号，请勾选“包含已过期的 Token”或取消过滤条件')
  }

  if (options.format === 'aiclient2api') {
    const data = exportAsAIClient2API(filteredAccounts)
    return JSON.stringify(data, null, 2)
  }

  const fields = options.fields || {
    email: true,
    'credentials.accessToken': true,
    'credentials.refreshToken': true,
    'credentials.clientId': true,
    'credentials.clientSecret': true,
    'credentials.region': true
  }
  const data = exportAsCustomJSON(filteredAccounts, fields)
  return JSON.stringify(data, null, 2)
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
