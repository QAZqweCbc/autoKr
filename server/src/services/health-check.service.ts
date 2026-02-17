/**
 * 健康检查服务
 * 统计账号状态、计算刷新指标、生成告警列表
 */

import { AccountDB } from './database.adapter'
import { loadConfig } from './config.service'
import { getRefreshLogStorage } from './refresh-log-storage.service'
import { evaluateAlertRules, DEFAULT_ALERT_RULES } from '../utils/alert-rules'
import { sendAlerts } from './alert-notification.service'
import {
  HealthStatus,
  AccountStats,
  LastRefreshInfo,
  AlertRuleConfig
} from '../models/health-status.model'
import { Account } from '../models/account.model'

// 常量配置
const TOKEN_REFRESH_BEFORE_EXPIRY = 5 * 60 * 1000 // 过期前 5 分钟
const MAX_CONSECUTIVE_FAILURES = 3 // 最大连续失败次数

/**
 * 检查账号是否需要刷新
 */
function needsRefresh(account: Account): boolean {
  const now = Date.now()
  const expiresAt = account.credentials.expiresAt
  
  // 没有过期时间，需要刷新
  if (!expiresAt) {
    return true
  }
  
  // 检查是否即将过期
  const timeUntilExpiry = expiresAt - now
  return timeUntilExpiry <= TOKEN_REFRESH_BEFORE_EXPIRY
}

/**
 * 检查账号是否被封禁
 */
function isBanned(account: Account): boolean {
  const lastError = account.lastError || ''
  
  // 方式1: 检查错误信息中的关键词
  if (lastError.includes('AccountSuspendedException') ||
      lastError.includes('UnauthorizedException')) {
    return true
  }
  
  // 方式2: 检查HTTP状态码423（Locked）
  if (lastError.includes('423') || lastError.includes('Locked')) {
    return true
  }
  
  // 方式3: 检查常见的封禁错误消息
  const bannedKeywords = [
    'suspended',
    'banned',
    'locked',
    'disabled',
    'account is not active',
    'account has been suspended'
  ]
  
  const lowerError = lastError.toLowerCase()
  return bannedKeywords.some(keyword => lowerError.includes(keyword))
}

/**
 * 检查账号是否连续失败
 */
function hasTooManyFailures(account: Account): boolean {
  return !!(
    account.consecutiveFailures &&
    account.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
  )
}

/**
 * 检查账号是否活跃（有效凭证且未封禁）
 */
function isActive(account: Account): boolean {
  // 有完整的 OAuth 凭证
  const hasCredentials = !!(
    account.credentials.refreshToken &&
    account.credentials.clientId &&
    account.credentials.clientSecret
  )
  
  // 未被封禁
  const notBanned = !isBanned(account)
  
  // 未连续失败过多
  const notFailed = !hasTooManyFailures(account)
  
  return hasCredentials && notBanned && notFailed
}

/**
 * 统计账号状态
 */
async function collectAccountStats(): Promise<AccountStats> {
  const accounts = await AccountDB.getAll()
  
  const stats: AccountStats = {
    total: accounts.length,
    active: 0,
    banned: 0,
    failed: 0,
    needsRefresh: 0
  }
  
  for (const account of accounts) {
    // 统计封禁账号
    if (isBanned(account)) {
      stats.banned++
      continue
    }
    
    // 统计失败账号
    if (hasTooManyFailures(account)) {
      stats.failed++
      continue
    }
    
    // 统计活跃账号
    if (isActive(account)) {
      stats.active++
      
      // 统计需要刷新的账号
      if (needsRefresh(account)) {
        stats.needsRefresh++
      }
    }
  }
  
  return stats
}

/**
 * 获取上次刷新信息
 */
async function getLastRefreshInfo(): Promise<LastRefreshInfo> {
  const storage = getRefreshLogStorage()
  
  try {
    // 获取最近一次刷新日志
    const recentLogs = await storage.getRecent(1)
    
    if (recentLogs.length === 0) {
      // 没有刷新历史，返回默认值
      return {
        time: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
    }
    
    const lastLog = recentLogs[0]
    
    return {
      time: lastLog.timestamp,
      success: lastLog.successCount,
      failed: lastLog.failedCount,
      skipped: lastLog.skippedCount,
      duration: lastLog.duration
    }
  } catch (error: any) {
    console.error('获取上次刷新信息失败:', error.message)
    
    // 出错时返回默认值
    return {
      time: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    }
  }
}

/**
 * 计算下次刷新时间
 */
function calculateNextRefreshTime(lastRefreshTime: number): number {
  const config = loadConfig()
  const interval = config.autoRefresh?.interval || 60 // 默认 60 分钟
  const intervalMs = interval * 60 * 1000
  
  // 如果从未刷新过，返回当前时间
  if (lastRefreshTime === 0) {
    return Date.now()
  }
  
  return lastRefreshTime + intervalMs
}

/**
 * 获取告警规则配置
 */
function getAlertRuleConfig(): AlertRuleConfig {
  const config = loadConfig()
  
  // 从配置中读取告警阈值，如果没有则使用默认值
  return {
    bannedAccountsError: config.autoRefresh?.alertThresholds?.bannedAccountsError ?? DEFAULT_ALERT_RULES.bannedAccountsError,
    failureRateWarning: config.autoRefresh?.alertThresholds?.failureRateWarning ?? DEFAULT_ALERT_RULES.failureRateWarning,
    consecutiveFailuresError: config.autoRefresh?.alertThresholds?.consecutiveFailuresError ?? DEFAULT_ALERT_RULES.consecutiveFailuresError,
    refreshTimeoutWarning: config.autoRefresh?.alertThresholds?.refreshTimeoutWarning ?? DEFAULT_ALERT_RULES.refreshTimeoutWarning
  }
}

/**
 * 获取系统健康状态
 * @param sendNotifications 是否发送告警通知（默认 false）
 */
export async function getHealthStatus(sendNotifications: boolean = false): Promise<HealthStatus> {
  const timestamp = Date.now()
  
  // 1. 统计账号状态
  const accountStats = await collectAccountStats()
  
  // 2. 获取上次刷新信息
  const lastRefresh = await getLastRefreshInfo()
  
  // 3. 计算下次刷新时间
  const nextRefresh = calculateNextRefreshTime(lastRefresh.time)
  
  // 4. 获取告警规则配置
  const alertConfig = getAlertRuleConfig()
  
  // 5. 评估告警规则
  const alertResult = evaluateAlertRules(accountStats, lastRefresh, alertConfig)
  
  // 6. 构建健康状态
  const healthStatus: HealthStatus = {
    timestamp,
    accounts: accountStats,
    lastRefresh,
    nextRefresh,
    alerts: alertResult.alerts,
    isHealthy: alertResult.isHealthy
  }
  
  // 7. 发送告警通知（如果启用）
  if (sendNotifications && alertResult.alerts.length > 0) {
    const config = loadConfig()
    const enableAlerts = config.autoRefresh?.enableAlerts ?? true
    
    if (enableAlerts) {
      sendAlerts(alertResult.alerts)
    }
  }
  
  return healthStatus
}

/**
 * 格式化健康状态为可读文本
 */
export function formatHealthStatus(status: HealthStatus): string {
  const lines: string[] = []
  
  lines.push('='.repeat(60))
  lines.push(`🏥 系统健康检查 - ${new Date(status.timestamp).toLocaleString('zh-CN')}`)
  lines.push('='.repeat(60))
  
  // 整体状态
  const statusIcon = status.isHealthy ? '✅' : '❌'
  const statusText = status.isHealthy ? '健康' : '异常'
  lines.push(`\n${statusIcon} 整体状态: ${statusText}`)
  
  // 账号统计
  lines.push(`\n📊 账号统计:`)
  lines.push(`   总账号数: ${status.accounts.total}`)
  lines.push(`   活跃账号: ${status.accounts.active}`)
  lines.push(`   封禁账号: ${status.accounts.banned}`)
  lines.push(`   失败账号: ${status.accounts.failed}`)
  lines.push(`   需要刷新: ${status.accounts.needsRefresh}`)
  
  // 上次刷新
  lines.push(`\n🔄 上次刷新:`)
  if (status.lastRefresh.time === 0) {
    lines.push(`   尚未执行过刷新`)
  } else {
    const lastRefreshDate = new Date(status.lastRefresh.time).toLocaleString('zh-CN')
    const minutesAgo = Math.floor((Date.now() - status.lastRefresh.time) / 60000)
    lines.push(`   时间: ${lastRefreshDate} (${minutesAgo} 分钟前)`)
    lines.push(`   成功: ${status.lastRefresh.success}`)
    lines.push(`   失败: ${status.lastRefresh.failed}`)
    lines.push(`   跳过: ${status.lastRefresh.skipped}`)
    lines.push(`   耗时: ${(status.lastRefresh.duration / 1000).toFixed(2)} 秒`)
  }
  
  // 下次刷新
  lines.push(`\n⏰ 下次刷新:`)
  const nextRefreshDate = new Date(status.nextRefresh).toLocaleString('zh-CN')
  const minutesUntil = Math.floor((status.nextRefresh - Date.now()) / 60000)
  if (minutesUntil > 0) {
    lines.push(`   ${nextRefreshDate} (${minutesUntil} 分钟后)`)
  } else {
    lines.push(`   ${nextRefreshDate} (已到期)`)
  }
  
  // 告警信息
  if (status.alerts.length > 0) {
    lines.push(`\n⚠️  告警信息 (${status.alerts.length} 条):`)
    
    status.alerts.forEach((alert, index) => {
      const icon = alert.level === 'ERROR' ? '❌' : alert.level === 'WARNING' ? '⚠️' : 'ℹ️'
      lines.push(`   ${index + 1}. ${icon} [${alert.level}] ${alert.message}`)
    })
  } else {
    lines.push(`\n✅ 无告警`)
  }
  
  lines.push('='.repeat(60))
  
  return lines.join('\n')
}
