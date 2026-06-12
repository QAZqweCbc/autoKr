/**
 * 健康状态数据模型
 * 用于监控 Token 自动刷新系统的健康状况和告警
 */

/**
 * 告警级别
 */
export type AlertLevel = 'ERROR' | 'WARNING' | 'INFO'

/**
 * 告警信息
 */
export interface Alert {
  level: AlertLevel                     // 告警级别
  message: string                       // 告警信息
  timestamp: number                     // 告警时间（毫秒时间戳）
  details?: Record<string, any>         // 额外的告警详情
}

/**
 * 账号统计信息
 */
export interface AccountStats {
  total: number                         // 总账号数
  active: number                        // 活跃账号数（有效凭证且未封禁）
  banned: number                        // 封禁账号数
  failed: number                        // 失败账号数（连续失败>=3次）
  needsRefresh: number                  // 需要刷新的账号数（即将过期）
}

/**
 * 上次刷新信息
 */
export interface LastRefreshInfo {
  time: number                          // 上次刷新时间（毫秒时间戳）
  success: number                       // 成功数
  failed: number                        // 失败数
  skipped: number                       // 跳过数
  duration: number                      // 耗时（毫秒）
}

/**
 * 健康状态
 */
export interface HealthStatus {
  timestamp: number                     // 检查时间（毫秒时间戳）
  accounts: AccountStats                // 账号统计
  lastRefresh: LastRefreshInfo          // 上次刷新信息
  nextRefresh: number                   // 下次刷新时间（毫秒时间戳）
  alerts: Alert[]                       // 告警列表
  isHealthy: boolean                    // 整体健康状态
}

/**
 * 告警规则配置
 */
export interface AlertRuleConfig {
  bannedAccountsError: number           // 封禁账号告警阈值（默认1，即有封禁就告警）
  failureRateWarning: number            // 失败率告警阈值（默认0.3，即30%）
  consecutiveFailuresError: number      // 连续失败告警阈值（默认3）
  refreshTimeoutWarning: number         // 刷新超时告警阈值（分钟，默认120）
}

/**
 * 告警规则评估结果
 */
export interface AlertEvaluationResult {
  alerts: Alert[]                       // 生成的告警列表
  isHealthy: boolean                    // 是否健康
  evaluatedAt: number                   // 评估时间
}
