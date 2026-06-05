/**
 * 配置变更日志服务
 * 
 * 记录配置的变更历史，用于审计和故障排查
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const CONFIG_CHANGE_LOG = path.join(LOG_DIR, 'config-changes.log')

export interface ConfigChange {
  timestamp: number
  field: string
  oldValue: any
  newValue: any
  changedBy?: string
}

export interface ConfigChangeLog {
  timestamp: number
  changes: ConfigChange[]
  summary: string
}

/**
 * 确保日志目录存在
 */
function ensureLogDirectory(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }
}

/**
 * 记录配置变更
 */
export function logConfigChange(log: ConfigChangeLog): void {
  try {
    ensureLogDirectory()
    
    const logEntry = {
      timestamp: new Date(log.timestamp).toISOString(),
      changes: log.changes.map(change => ({
        field: change.field,
        oldValue: maskSensitiveValue(change.field, change.oldValue),
        newValue: maskSensitiveValue(change.field, change.newValue),
        changedBy: change.changedBy
      })),
      summary: log.summary
    }
    
    const logLine = JSON.stringify(logEntry) + '\n'
    appendFileSync(CONFIG_CHANGE_LOG, logLine, 'utf-8')
    
    console.log(`📝 配置变更已记录: ${log.summary}`)
  } catch (error: any) {
    console.error('❌ 记录配置变更失败:', error.message)
  }
}

/**
 * 脱敏敏感字段值
 */
function maskSensitiveValue(field: string, value: any): any {
  const sensitiveFields = ['authCode', 'password', 'secret', 'token']
  
  if (sensitiveFields.some(sf => field.toLowerCase().includes(sf))) {
    if (typeof value === 'string' && value.length > 0) {
      return '******'
    }
  }
  
  return value
}

/**
 * 比较配置对象，生成变更列表
 */
export function compareConfigs(oldConfig: any, newConfig: any, prefix: string = ''): ConfigChange[] {
  const changes: ConfigChange[] = []
  const timestamp = Date.now()
  
  // 获取所有键的并集
  const allKeys = new Set([
    ...Object.keys(oldConfig || {}),
    ...Object.keys(newConfig || {})
  ])
  
  for (const key of allKeys) {
    const fieldPath = prefix ? `${prefix}.${key}` : key
    const oldValue = oldConfig?.[key]
    const newValue = newConfig?.[key]
    
    // 跳过相同的值
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      continue
    }
    
    // 如果是对象，递归比较
    if (
      typeof oldValue === 'object' && 
      typeof newValue === 'object' && 
      oldValue !== null && 
      newValue !== null &&
      !Array.isArray(oldValue) &&
      !Array.isArray(newValue)
    ) {
      changes.push(...compareConfigs(oldValue, newValue, fieldPath))
    } else {
      // 记录变更
      changes.push({
        timestamp,
        field: fieldPath,
        oldValue,
        newValue
      })
    }
  }
  
  return changes
}

/**
 * 生成变更摘要
 */
export function generateChangeSummary(changes: ConfigChange[]): string {
  if (changes.length === 0) {
    return '无配置变更'
  }
  
  const fields = changes.map(c => c.field).join(', ')
  return `更新了 ${changes.length} 个配置项: ${fields}`
}

/**
 * 读取最近的配置变更日志
 */
export function getRecentConfigChanges(limit: number = 10): ConfigChangeLog[] {
  try {
    ensureLogDirectory()
    
    if (!existsSync(CONFIG_CHANGE_LOG)) {
      return []
    }
    
    const content = readFileSync(CONFIG_CHANGE_LOG, 'utf-8')
    const lines = content.trim().split('\n').filter(line => line.length > 0)
    
    // 获取最近的 N 条记录
    const recentLines = lines.slice(-limit)
    
    return recentLines.map(line => {
      try {
        const parsed = JSON.parse(line)
        return {
          timestamp: new Date(parsed.timestamp).getTime(),
          changes: parsed.changes,
          summary: parsed.summary
        }
      } catch {
        return null
      }
    }).filter(log => log !== null) as ConfigChangeLog[]
  } catch (error: any) {
    console.error('❌ 读取配置变更日志失败:', error.message)
    return []
  }
}
