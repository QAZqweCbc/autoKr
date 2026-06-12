/**
 * 配置验证服务
 * 
 * 提供配置参数的验证功能，确保配置的有效性
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
  validatedFields?: string[]
}

export interface AutoRefreshConfigInput {
  enabled?: boolean
  interval?: number
  concurrency?: number
  refreshBeforeExpiry?: number
  maxConsecutiveFailures?: number
  retryFailedAfter?: number
  logRetentionDays?: number
  enableWebSocket?: boolean
  enableAlerts?: boolean
  alertThresholds?: {
    bannedAccountsError?: number
    failureRateWarning?: number
    consecutiveFailuresError?: number
    refreshTimeoutWarning?: number
  }
}

/**
 * 验证自动刷新配置
 */
export function validateAutoRefreshConfig(config: AutoRefreshConfigInput): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const validatedFields: string[] = []
  
  // 验证 enabled（必填）
  if (config.enabled !== undefined) {
    validatedFields.push('enabled')
    if (typeof config.enabled !== 'boolean') {
      errors.push('enabled 必须是布尔值')
    }
  }
  
  // 验证刷新间隔
  if (config.interval !== undefined) {
    validatedFields.push('interval')
    if (typeof config.interval !== 'number') {
      errors.push('interval 必须是数字')
    } else if (config.interval < 5 || config.interval > 1440) {
      errors.push('刷新间隔必须在 5-1440 分钟之间')
    } else if (config.interval < 10) {
      warnings.push('刷新间隔过短可能导致 API 限流')
    }
  }
  
  // 验证并发数
  if (config.concurrency !== undefined) {
    validatedFields.push('concurrency')
    if (typeof config.concurrency !== 'number') {
      errors.push('concurrency 必须是数字')
    } else if (config.concurrency < 1 || config.concurrency > 100) {
      errors.push('并发数量必须在 1-100 之间')
    } else if (config.concurrency > 20) {
      warnings.push('并发数过高可能导致 API 限流')
    }
  }
  
  // 验证过期前刷新时间
  if (config.refreshBeforeExpiry !== undefined) {
    validatedFields.push('refreshBeforeExpiry')
    if (typeof config.refreshBeforeExpiry !== 'number') {
      errors.push('refreshBeforeExpiry 必须是数字')
    } else if (config.refreshBeforeExpiry < 1 || config.refreshBeforeExpiry > 60) {
      errors.push('过期前刷新时间必须在 1-60 分钟之间')
    }
  }
  
  // 验证最大连续失败次数
  if (config.maxConsecutiveFailures !== undefined) {
    validatedFields.push('maxConsecutiveFailures')
    if (typeof config.maxConsecutiveFailures !== 'number') {
      errors.push('maxConsecutiveFailures 必须是数字')
    } else if (config.maxConsecutiveFailures < 1 || config.maxConsecutiveFailures > 10) {
      errors.push('最大连续失败次数必须在 1-10 之间')
    }
  }
  
  // 验证失败后重试时间
  if (config.retryFailedAfter !== undefined) {
    validatedFields.push('retryFailedAfter')
    if (typeof config.retryFailedAfter !== 'number') {
      errors.push('retryFailedAfter 必须是数字')
    } else if (config.retryFailedAfter < 1 || config.retryFailedAfter > 168) {
      errors.push('失败后重试时间必须在 1-168 小时之间')
    }
  }
  
  // 验证日志保留天数
  if (config.logRetentionDays !== undefined) {
    validatedFields.push('logRetentionDays')
    if (typeof config.logRetentionDays !== 'number') {
      errors.push('logRetentionDays 必须是数字')
    } else if (config.logRetentionDays < 1 || config.logRetentionDays > 365) {
      errors.push('日志保留天数必须在 1-365 天之间')
    } else if (config.logRetentionDays < 7) {
      warnings.push('日志保留天数过短可能影响故障排查')
    }
  }
  
  // 验证 WebSocket 开关
  if (config.enableWebSocket !== undefined) {
    validatedFields.push('enableWebSocket')
    if (typeof config.enableWebSocket !== 'boolean') {
      errors.push('enableWebSocket 必须是布尔值')
    }
  }
  
  // 验证告警开关
  if (config.enableAlerts !== undefined) {
    validatedFields.push('enableAlerts')
    if (typeof config.enableAlerts !== 'boolean') {
      errors.push('enableAlerts 必须是布尔值')
    }
  }
  
  // 验证告警阈值
  if (config.alertThresholds) {
    const thresholds = config.alertThresholds
    
    if (thresholds.bannedAccountsError !== undefined) {
      validatedFields.push('alertThresholds.bannedAccountsError')
      if (typeof thresholds.bannedAccountsError !== 'number') {
        errors.push('bannedAccountsError 必须是数字')
      } else if (thresholds.bannedAccountsError < 0) {
        errors.push('封禁账号告警阈值不能为负数')
      }
    }
    
    if (thresholds.failureRateWarning !== undefined) {
      validatedFields.push('alertThresholds.failureRateWarning')
      if (typeof thresholds.failureRateWarning !== 'number') {
        errors.push('failureRateWarning 必须是数字')
      } else if (thresholds.failureRateWarning < 0 || thresholds.failureRateWarning > 1) {
        errors.push('失败率告警阈值必须在 0-1 之间')
      }
    }
    
    if (thresholds.consecutiveFailuresError !== undefined) {
      validatedFields.push('alertThresholds.consecutiveFailuresError')
      if (typeof thresholds.consecutiveFailuresError !== 'number') {
        errors.push('consecutiveFailuresError 必须是数字')
      } else if (thresholds.consecutiveFailuresError < 1) {
        errors.push('连续失败告警阈值必须大于 0')
      }
    }
    
    if (thresholds.refreshTimeoutWarning !== undefined) {
      validatedFields.push('alertThresholds.refreshTimeoutWarning')
      if (typeof thresholds.refreshTimeoutWarning !== 'number') {
        errors.push('refreshTimeoutWarning 必须是数字')
      } else if (thresholds.refreshTimeoutWarning < 1) {
        errors.push('刷新超时告警阈值必须大于 0')
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
    validatedFields: validatedFields.length > 0 ? validatedFields : undefined
  }
}
