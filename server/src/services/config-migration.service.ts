/**
 * 配置迁移服务
 * 
 * 负责自动迁移旧版本配置到新版本，确保向后兼容性
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { ServerConfig } from './config.service'

const MIGRATION_LOG_DIR = path.join(__dirname, '../../logs')
const MIGRATION_LOG_FILE = path.join(MIGRATION_LOG_DIR, 'config-migrations.log')

export interface MigrationResult {
  migrated: boolean
  version: string
  changes: string[]
  timestamp: number
}

/**
 * 确保日志目录存在
 */
function ensureMigrationLogDirectory(): void {
  if (!existsSync(MIGRATION_LOG_DIR)) {
    mkdirSync(MIGRATION_LOG_DIR, { recursive: true })
  }
}

/**
 * 记录迁移日志
 */
function logMigration(result: MigrationResult): void {
  try {
    ensureMigrationLogDirectory()
    
    const logEntry = {
      timestamp: new Date(result.timestamp).toISOString(),
      version: result.version,
      migrated: result.migrated,
      changes: result.changes
    }
    
    const logLine = JSON.stringify(logEntry) + '\n'
    
    // 追加到日志文件
    const existingLog = existsSync(MIGRATION_LOG_FILE) 
      ? readFileSync(MIGRATION_LOG_FILE, 'utf-8') 
      : ''
    
    writeFileSync(MIGRATION_LOG_FILE, existingLog + logLine, 'utf-8')
    
    console.log(`📝 配置迁移已记录: ${result.version}`)
  } catch (error: any) {
    console.error('❌ 记录配置迁移失败:', error.message)
  }
}

/**
 * 获取配置版本
 * 根据配置字段判断配置版本
 */
function getConfigVersion(config: ServerConfig): string {
  // 检查是否有新版本的字段
  if (config.autoRefresh?.alertThresholds?.consecutiveFailuresError !== undefined) {
    return '2.3.x' // 最新版本
  }
  
  if (config.autoRefresh?.alertThresholds !== undefined) {
    return '2.2.x' // 有告警阈值但缺少部分字段
  }
  
  if (config.autoRefresh?.refreshBeforeExpiry !== undefined) {
    return '2.1.x' // 有刷新策略配置
  }
  
  if (config.autoRefresh !== undefined) {
    return '1.x' // 旧版本，只有基础配置
  }
  
  return '0.x' // 非常旧的版本，没有自动刷新配置
}

/**
 * 迁移到 v2.3.x
 * 添加完整的告警阈值配置
 */
function migrateToV2_3(config: ServerConfig): string[] {
  const changes: string[] = []
  
  if (!config.autoRefresh) {
    config.autoRefresh = {
      enabled: false,
      interval: 30,
      concurrency: 10,
      lastRefreshTime: null
    }
    changes.push('初始化 autoRefresh 配置')
  }
  
  // 添加刷新策略配置（如果缺失）
  if (config.autoRefresh.refreshBeforeExpiry === undefined) {
    config.autoRefresh.refreshBeforeExpiry = 5
    changes.push('添加 refreshBeforeExpiry 字段（默认值: 5）')
  }
  
  if (config.autoRefresh.maxConsecutiveFailures === undefined) {
    config.autoRefresh.maxConsecutiveFailures = 3
    changes.push('添加 maxConsecutiveFailures 字段（默认值: 3）')
  }
  
  if (config.autoRefresh.retryFailedAfter === undefined) {
    config.autoRefresh.retryFailedAfter = 24
    changes.push('添加 retryFailedAfter 字段（默认值: 24）')
  }
  
  // 添加日志配置（如果缺失）
  if (config.autoRefresh.logRetentionDays === undefined) {
    config.autoRefresh.logRetentionDays = 30
    changes.push('添加 logRetentionDays 字段（默认值: 30）')
  }
  
  // 添加通知配置（如果缺失）
  if (config.autoRefresh.enableWebSocket === undefined) {
    config.autoRefresh.enableWebSocket = false
    changes.push('添加 enableWebSocket 字段（默认值: false）')
  }
  
  if (config.autoRefresh.enableAlerts === undefined) {
    config.autoRefresh.enableAlerts = true
    changes.push('添加 enableAlerts 字段（默认值: true）')
  }
  
  // 添加或更新告警阈值配置
  if (!config.autoRefresh.alertThresholds) {
    config.autoRefresh.alertThresholds = {}
    changes.push('初始化 alertThresholds 配置')
  }
  
  const thresholds = config.autoRefresh.alertThresholds
  
  if (thresholds.bannedAccountsError === undefined) {
    thresholds.bannedAccountsError = 1
    changes.push('添加 alertThresholds.bannedAccountsError 字段（默认值: 1）')
  }
  
  if (thresholds.failureRateWarning === undefined) {
    thresholds.failureRateWarning = 0.3
    changes.push('添加 alertThresholds.failureRateWarning 字段（默认值: 0.3）')
  }
  
  if (thresholds.consecutiveFailuresError === undefined) {
    thresholds.consecutiveFailuresError = 3
    changes.push('添加 alertThresholds.consecutiveFailuresError 字段（默认值: 3）')
  }
  
  if (thresholds.refreshTimeoutWarning === undefined) {
    thresholds.refreshTimeoutWarning = 120
    changes.push('添加 alertThresholds.refreshTimeoutWarning 字段（默认值: 120）')
  }
  
  return changes
}

/**
 * 自动迁移配置
 * 
 * @param config 当前配置
 * @returns 迁移结果
 */
export function migrateConfig(config: ServerConfig): MigrationResult {
  const currentVersion = getConfigVersion(config)
  const targetVersion = '2.3.x'
  
  console.log(`🔍 检测到配置版本: ${currentVersion}`)
  
  // 如果已经是最新版本，不需要迁移
  if (currentVersion === targetVersion) {
    console.log('✅ 配置已是最新版本，无需迁移')
    return {
      migrated: false,
      version: currentVersion,
      changes: [],
      timestamp: Date.now()
    }
  }
  
  console.log(`🔄 开始迁移配置: ${currentVersion} → ${targetVersion}`)
  
  const changes: string[] = []
  
  // 执行迁移
  try {
    const migrationChanges = migrateToV2_3(config)
    changes.push(...migrationChanges)
    
    const result: MigrationResult = {
      migrated: changes.length > 0,
      version: `${currentVersion} → ${targetVersion}`,
      changes,
      timestamp: Date.now()
    }
    
    // 记录迁移日志
    if (result.migrated) {
      logMigration(result)
      console.log(`✅ 配置迁移完成，共 ${changes.length} 项变更`)
      changes.forEach(change => console.log(`   - ${change}`))
    }
    
    return result
  } catch (error: any) {
    console.error('❌ 配置迁移失败:', error.message)
    throw error
  }
}

/**
 * 获取迁移历史
 * 
 * @param limit 查询数量
 * @returns 迁移历史记录
 */
export function getMigrationHistory(limit: number = 10): MigrationResult[] {
  try {
    ensureMigrationLogDirectory()
    
    if (!existsSync(MIGRATION_LOG_FILE)) {
      return []
    }
    
    const content = readFileSync(MIGRATION_LOG_FILE, 'utf-8')
    const lines = content.trim().split('\n').filter(line => line.length > 0)
    
    // 获取最近的 N 条记录
    const recentLines = lines.slice(-limit)
    
    return recentLines.map(line => {
      try {
        const parsed = JSON.parse(line)
        return {
          migrated: parsed.migrated,
          version: parsed.version,
          changes: parsed.changes,
          timestamp: new Date(parsed.timestamp).getTime()
        }
      } catch {
        return null
      }
    }).filter(log => log !== null) as MigrationResult[]
  } catch (error: any) {
    console.error('❌ 读取迁移历史失败:', error.message)
    return []
  }
}

/**
 * 验证配置完整性
 * 检查配置是否包含所有必需的字段
 */
export function validateConfigCompleteness(config: ServerConfig): {
  valid: boolean
  missingFields: string[]
} {
  const missingFields: string[] = []
  
  // 检查 autoRefresh 配置
  if (!config.autoRefresh) {
    missingFields.push('autoRefresh')
    return { valid: false, missingFields }
  }
  
  const ar = config.autoRefresh
  
  // 检查基础字段
  if (ar.enabled === undefined) missingFields.push('autoRefresh.enabled')
  if (ar.interval === undefined) missingFields.push('autoRefresh.interval')
  if (ar.concurrency === undefined) missingFields.push('autoRefresh.concurrency')
  
  // 检查刷新策略字段
  if (ar.refreshBeforeExpiry === undefined) missingFields.push('autoRefresh.refreshBeforeExpiry')
  if (ar.maxConsecutiveFailures === undefined) missingFields.push('autoRefresh.maxConsecutiveFailures')
  if (ar.retryFailedAfter === undefined) missingFields.push('autoRefresh.retryFailedAfter')
  
  // 检查日志配置
  if (ar.logRetentionDays === undefined) missingFields.push('autoRefresh.logRetentionDays')
  
  // 检查通知配置
  if (ar.enableWebSocket === undefined) missingFields.push('autoRefresh.enableWebSocket')
  if (ar.enableAlerts === undefined) missingFields.push('autoRefresh.enableAlerts')
  
  // 检查告警阈值
  if (!ar.alertThresholds) {
    missingFields.push('autoRefresh.alertThresholds')
  } else {
    const at = ar.alertThresholds
    if (at.bannedAccountsError === undefined) missingFields.push('autoRefresh.alertThresholds.bannedAccountsError')
    if (at.failureRateWarning === undefined) missingFields.push('autoRefresh.alertThresholds.failureRateWarning')
    if (at.consecutiveFailuresError === undefined) missingFields.push('autoRefresh.alertThresholds.consecutiveFailuresError')
    if (at.refreshTimeoutWarning === undefined) missingFields.push('autoRefresh.alertThresholds.refreshTimeoutWarning')
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields
  }
}
