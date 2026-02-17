/**
 * 告警规则引擎
 * 根据系统状态评估并生成告警
 */

import {
  Alert,
  AlertLevel,
  AlertRuleConfig,
  AlertEvaluationResult,
  AccountStats,
  LastRefreshInfo
} from '../models/health-status.model'

/**
 * 默认告警规则配置
 */
export const DEFAULT_ALERT_RULES: AlertRuleConfig = {
  bannedAccountsError: 1,               // 有1个封禁账号就告警
  failureRateWarning: 0.3,              // 失败率超过30%告警
  consecutiveFailuresError: 3,          // 连续失败3次告警
  refreshTimeoutWarning: 120            // 超过2小时未刷新告警
}

/**
 * 创建告警对象
 */
function createAlert(
  level: AlertLevel,
  message: string,
  details?: Record<string, any>
): Alert {
  return {
    level,
    message,
    timestamp: Date.now(),
    details
  }
}

/**
 * 评估封禁账号告警
 */
function evaluateBannedAccounts(
  accountStats: AccountStats,
  threshold: number
): Alert | null {
  if (accountStats.banned >= threshold) {
    return createAlert(
      'ERROR',
      `检测到 ${accountStats.banned} 个封禁账号`,
      {
        bannedCount: accountStats.banned,
        totalCount: accountStats.total,
        threshold
      }
    )
  }
  return null
}

/**
 * 评估失败率告警
 */
function evaluateFailureRate(
  lastRefresh: LastRefreshInfo,
  threshold: number
): Alert | null {
  const totalAttempts = lastRefresh.success + lastRefresh.failed
  
  // 如果没有刷新尝试，不生成告警
  if (totalAttempts === 0) {
    return null
  }
  
  const failureRate = lastRefresh.failed / totalAttempts
  
  if (failureRate > threshold) {
    return createAlert(
      'WARNING',
      `上次刷新失败率过高: ${(failureRate * 100).toFixed(1)}%`,
      {
        failedCount: lastRefresh.failed,
        totalAttempts,
        failureRate: failureRate.toFixed(3),
        threshold
      }
    )
  }
  return null
}

/**
 * 评估连续失败账号告警
 */
function evaluateConsecutiveFailures(
  accountStats: AccountStats,
  threshold: number
): Alert | null {
  if (accountStats.failed > 0) {
    return createAlert(
      'WARNING',
      `有 ${accountStats.failed} 个账号连续失败 ${threshold} 次以上`,
      {
        failedCount: accountStats.failed,
        totalCount: accountStats.total,
        threshold
      }
    )
  }
  return null
}

/**
 * 评估刷新超时告警
 */
function evaluateRefreshTimeout(
  lastRefreshTime: number,
  thresholdMinutes: number
): Alert | null {
  // 如果从未刷新过（lastRefreshTime === 0），不生成告警
  if (lastRefreshTime === 0) {
    return null
  }
  
  const now = Date.now()
  const timeSinceLastRefresh = now - lastRefreshTime
  const thresholdMs = thresholdMinutes * 60 * 1000
  
  if (timeSinceLastRefresh > thresholdMs) {
    const minutesAgo = Math.floor(timeSinceLastRefresh / 60000)
    return createAlert(
      'WARNING',
      `系统已超过 ${minutesAgo} 分钟未执行刷新`,
      {
        lastRefreshTime,
        minutesSinceLastRefresh: minutesAgo,
        thresholdMinutes
      }
    )
  }
  return null
}

/**
 * 评估需要刷新的账号数量（信息性告警）
 */
function evaluateNeedsRefresh(
  accountStats: AccountStats
): Alert | null {
  if (accountStats.needsRefresh > 0) {
    return createAlert(
      'INFO',
      `有 ${accountStats.needsRefresh} 个账号需要刷新`,
      {
        needsRefreshCount: accountStats.needsRefresh,
        totalCount: accountStats.total
      }
    )
  }
  return null
}

/**
 * 评估所有告警规则
 */
export function evaluateAlertRules(
  accountStats: AccountStats,
  lastRefresh: LastRefreshInfo,
  config: AlertRuleConfig = DEFAULT_ALERT_RULES
): AlertEvaluationResult {
  const alerts: Alert[] = []
  
  // 1. 评估封禁账号
  const bannedAlert = evaluateBannedAccounts(
    accountStats,
    config.bannedAccountsError
  )
  if (bannedAlert) alerts.push(bannedAlert)
  
  // 2. 评估失败率
  const failureRateAlert = evaluateFailureRate(
    lastRefresh,
    config.failureRateWarning
  )
  if (failureRateAlert) alerts.push(failureRateAlert)
  
  // 3. 评估连续失败账号
  const consecutiveFailuresAlert = evaluateConsecutiveFailures(
    accountStats,
    config.consecutiveFailuresError
  )
  if (consecutiveFailuresAlert) alerts.push(consecutiveFailuresAlert)
  
  // 4. 评估刷新超时
  const timeoutAlert = evaluateRefreshTimeout(
    lastRefresh.time,
    config.refreshTimeoutWarning
  )
  if (timeoutAlert) alerts.push(timeoutAlert)
  
  // 5. 评估需要刷新的账号（信息性）
  const needsRefreshAlert = evaluateNeedsRefresh(accountStats)
  if (needsRefreshAlert) alerts.push(needsRefreshAlert)
  
  // 判断整体健康状态：有 ERROR 级别告警则不健康
  const isHealthy = !alerts.some(alert => alert.level === 'ERROR')
  
  return {
    alerts,
    isHealthy,
    evaluatedAt: Date.now()
  }
}

/**
 * 过滤指定级别的告警
 */
export function filterAlertsByLevel(
  alerts: Alert[],
  levels: AlertLevel[]
): Alert[] {
  return alerts.filter(alert => levels.includes(alert.level))
}

/**
 * 获取最高告警级别
 */
export function getHighestAlertLevel(alerts: Alert[]): AlertLevel | null {
  if (alerts.length === 0) return null
  
  const levelPriority: Record<AlertLevel, number> = {
    'ERROR': 3,
    'WARNING': 2,
    'INFO': 1
  }
  
  return alerts.reduce((highest, alert) => {
    return levelPriority[alert.level] > levelPriority[highest]
      ? alert.level
      : highest
  }, alerts[0].level)
}
