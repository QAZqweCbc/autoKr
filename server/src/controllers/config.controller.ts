/**
 * 配置控制器
 */

import { Request, Response } from 'express'
import { loadConfig, saveConfig, updateConfig } from '../services/config.service'
import { fetchQQEmail } from '../services/email.service'
import { 
  getEmailConfigForFrontend, 
  getEmailConfigForInternal,
  saveEmailConfig as saveEmailConfigToStorage
} from '../services/email-config-manager.service'
import { validateAutoRefreshConfig } from '../services/config-validator.service'
import { 
  logConfigChange, 
  compareConfigs, 
  generateChangeSummary,
  getRecentConfigChanges
} from '../services/config-change-logger.service'

/**
 * 获取配置
 * 
 * 注意：数据库配置已迁移到独立的 API
 * 使用 /api/database/config 获取数据库配置
 */
export async function getConfig(req: Request, res: Response) {
  try {
    const config = loadConfig()
    
    // 脱敏邮箱配置中的敏感信息
    const maskedConfig = {
      ...config,
      email: await getEmailConfigForFrontend()
    }
    
    res.json({
      success: true,
      config: maskedConfig,
      message: '数据库配置已迁移到 /api/database/config'
    })
  } catch (error: any) {
    console.error('获取配置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 更新配置
 * 
 * 注意：数据库配置已迁移到独立的 API
 * 使用 /api/database/config 更新数据库配置
 */
export function updateConfigHandler(req: Request, res: Response) {
  try {
    const updates = req.body
    
    const newConfig = updateConfig(updates)
    
    res.json({
      success: true,
      config: newConfig,
      message: '配置已更新'
    })
  } catch (error: any) {
    console.error('更新配置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 测试数据库连接
 * 
 * @deprecated 使用 /api/database/test 代替
 */
export async function testConnection(req: Request, res: Response) {
  res.status(410).json({
    success: false,
    error: '此 API 已废弃，请使用 /api/database/test'
  })
}

/**
 * 获取邮箱配置
 * 
 * 返回脱敏后的配置（敏感信息显示为 ******）
 * 实际使用时会从存储中自动解密
 */
export async function getEmailConfig(req: Request, res: Response) {
  try {
    // 获取脱敏后的配置（用于前端显示）
    const config = await getEmailConfigForFrontend()
    
    res.json({
      success: true,
      config: config
    })
  } catch (error: any) {
    console.error('获取邮箱配置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 验证邮箱配置解密状态
 */
export async function verifyEmailConfigDecryption(req: Request, res: Response) {
  try {
    const decrypted = await getEmailConfigForInternal()

    if (!decrypted) {
      return res.json({
        success: true,
        status: 'no_config',
        message: '未配置邮箱信息'
      })
    }

    const authCodeOk = decrypted.authCode && decrypted.authCode !== '******'
    const gmailPasswordOk = !decrypted.gmailAppPassword || decrypted.gmailAppPassword !== '******'

    res.json({
      success: true,
      status: 'verified',
      decryption: {
        authCode: {
          isSet: !!decrypted.authCode,
          isDecrypted: authCodeOk,
          preview: authCodeOk ? decrypted.authCode.substring(0, 4) + '****' : '未解密'
        },
        gmailPassword: {
          isSet: !!decrypted.gmailAppPassword,
          isDecrypted: gmailPasswordOk
        }
      },
      message: authCodeOk ? '✅ 授权码已正确加密并可解密' : '⚠️ 授权码未正确配置'
    })
  } catch (error: any) {
    console.error('验证解密失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 更新邮箱配置
 */
export async function updateEmailConfig(req: Request, res: Response) {
  try {
    const emailConfig = req.body
    
    // 验证必填字段
    if (!emailConfig.useAlias) {
      if (!emailConfig.qqEmail || !emailConfig.authCode || !emailConfig.domains) {
        return res.status(400).json({
          success: false,
          error: '请填写完整的邮箱配置'
        })
      }
    } else {
      if (emailConfig.aliasType === 'gmail') {
        if (!emailConfig.gmailBase || !emailConfig.gmailAppPassword) {
          return res.status(400).json({
            success: false,
            error: '请填写完整的 Gmail 配置'
          })
        }
      } else if (emailConfig.aliasType === 'qq') {
        if (!emailConfig.qqEmail || !emailConfig.authCode || !emailConfig.qqAliases) {
          return res.status(400).json({
            success: false,
            error: '请填写完整的 QQ 邮箱别名配置'
          })
        }
      }
    }
    
    // 自动将QQ邮箱配置转换为SMTP配置（用于发送验证码邮件）
    if (emailConfig.qqEmail && emailConfig.authCode) {
      emailConfig.smtpHost = 'smtp.qq.com'
      emailConfig.smtpPort = 587
      emailConfig.smtpSecure = false
      emailConfig.smtpUser = emailConfig.qqEmail
      emailConfig.smtpPassword = emailConfig.authCode
      emailConfig.smtpFrom = `"Kiro Account System" <${emailConfig.qqEmail}>`
    }
    
    // 保存配置（自动加密敏感信息）
    await saveEmailConfigToStorage(emailConfig)
    
    // 返回脱敏后的配置
    const savedConfig = await getEmailConfigForFrontend()
    
    res.json({
      success: true,
      config: savedConfig,
      message: '邮箱配置已保存（敏感信息已加密）'
    })
  } catch (error: any) {
    console.error('更新邮箱配置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 测试邮箱连接
 */
export async function testEmailConnection(req: Request, res: Response) {
  try {
    // 获取解密后的配置（用于内部使用）
    const config = await getEmailConfigForInternal()
    
    if (!config || !config.qqEmail || !config.authCode) {
      return res.status(400).json({
        success: false,
        error: '请先配置 QQ 邮箱和授权码'
      })
    }
    
    console.log('开始测试邮箱连接...')
    
    // 尝试连接并获取最近的邮件
    const messages = await fetchQQEmail(
      config.qqEmail,
      config.authCode,
      ['UNSEEN']  // 只获取未读邮件
    )
    
    res.json({
      success: true,
      message: `✅ 邮箱连接成功！找到 ${messages.length} 封未读邮件`,
      data: {
        email: config.qqEmail,
        unreadCount: messages.length,
        recentMessages: messages.slice(0, 5).map(msg => ({
          subject: msg.subject,
          from: msg.from,
          date: msg.date
        }))
      }
    })
  } catch (error: any) {
    console.error('测试邮箱连接失败:', error)

    // 提供详细的错误提示
    let errorMessage = error.message
    let suggestions: string[] = []

    if (error.message.includes('Login fail') || error.message.includes('Account is abnormal')) {
      errorMessage = 'QQ 邮箱登录失败'
      suggestions = [
        '确认已在 QQ 邮箱网页版开启 IMAP/SMTP 服务',
        '使用授权码而不是 QQ 邮箱密码（设置→账户→生成授权码）',
        '检查授权码是否正确（16位字符）',
        '如果频繁尝试，请等待 10-30 分钟后再试',
        '尝试在 QQ 邮箱网页版登录一次解除限制'
      ]
    } else if (error.message.includes('AUTHENTICATIONFAILED')) {
      errorMessage = '授权码验证失败'
      suggestions = [
        '检查授权码是否正确（不是 QQ 密码）',
        '确认已在 QQ 邮箱中开启 IMAP 服务',
        '检查授权码是否已过期（需要重新生成）'
      ]
    } else if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
      errorMessage = '网络连接失败'
      suggestions = [
        '检查网络连接是否正常',
        '确认防火墙没有阻止 993 端口',
        '如果在公司网络，可能需要配置代理'
      ]
    } else if (error.message.includes('ENOTFOUND')) {
      errorMessage = 'DNS 解析失败'
      suggestions = [
        '检查网络连接',
        '尝试更换 DNS 服务器'
      ]
    }

    res.status(400).json({
      success: false,
      error: errorMessage,
      suggestions: suggestions,
      details: error.message
    })
  }
}

/**
 * 获取自动刷新配置
 */
export function getAutoRefreshConfig(req: Request, res: Response) {
  try {
    const config = loadConfig()
    const autoRefresh = config.autoRefresh || {
      enabled: false,
      interval: 30,
      concurrency: 10,
      lastRefreshTime: null,
      refreshBeforeExpiry: 5,
      maxConsecutiveFailures: 3,
      retryFailedAfter: 24,
      logRetentionDays: 30,
      enableWebSocket: false,
      enableAlerts: true,
      alertThresholds: {
        bannedAccountsError: 1,
        failureRateWarning: 0.3,
        consecutiveFailuresError: 3,
        refreshTimeoutWarning: 120
      }
    }
    
    res.json({
      success: true,
      enabled: autoRefresh.enabled,
      interval: autoRefresh.interval,
      concurrency: autoRefresh.concurrency,
      lastRefreshTime: autoRefresh.lastRefreshTime,
      refreshBeforeExpiry: autoRefresh.refreshBeforeExpiry ?? 5,
      maxConsecutiveFailures: autoRefresh.maxConsecutiveFailures ?? 3,
      retryFailedAfter: autoRefresh.retryFailedAfter ?? 24,
      logRetentionDays: autoRefresh.logRetentionDays ?? 30,
      enableWebSocket: autoRefresh.enableWebSocket ?? false,
      enableAlerts: autoRefresh.enableAlerts ?? true,
      alertThresholds: {
        bannedAccountsError: autoRefresh.alertThresholds?.bannedAccountsError ?? 1,
        failureRateWarning: autoRefresh.alertThresholds?.failureRateWarning ?? 0.3,
        consecutiveFailuresError: autoRefresh.alertThresholds?.consecutiveFailuresError ?? 3,
        refreshTimeoutWarning: autoRefresh.alertThresholds?.refreshTimeoutWarning ?? 120
      }
    })
  } catch (error: any) {
    console.error('获取自动刷新配置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 保存自动刷新配置
 */
export function saveAutoRefreshConfig(req: Request, res: Response) {
  try {
    const configInput = req.body
    
    // 1. 使用验证服务验证配置
    const validation = validateAutoRefreshConfig(configInput)
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: '配置验证失败',
        errors: validation.errors,
        warnings: validation.warnings
      })
    }
    
    const { 
      enabled, 
      interval, 
      concurrency,
      refreshBeforeExpiry,
      maxConsecutiveFailures,
      retryFailedAfter,
      logRetentionDays,
      enableWebSocket,
      enableAlerts,
      alertThresholds
    } = configInput
    
    // 2. 保存旧配置用于对比
    const oldConfig = loadConfig()
    const oldAutoRefresh = oldConfig.autoRefresh
    
    const config = loadConfig()
    const currentAutoRefresh = config.autoRefresh
    
    // 3. 构建新配置
    const newAutoRefresh = {
      enabled: enabled ?? false,
      interval: interval ?? 30,
      concurrency: concurrency ?? 10,
      lastRefreshTime: currentAutoRefresh?.lastRefreshTime || null,
      refreshBeforeExpiry: refreshBeforeExpiry ?? 5,
      maxConsecutiveFailures: maxConsecutiveFailures ?? 3,
      retryFailedAfter: retryFailedAfter ?? 24,
      logRetentionDays: logRetentionDays ?? 30,
      enableWebSocket: enableWebSocket ?? false,
      enableAlerts: enableAlerts ?? true,
      alertThresholds: {
        bannedAccountsError: alertThresholds?.bannedAccountsError ?? 1,
        failureRateWarning: alertThresholds?.failureRateWarning ?? 0.3,
        consecutiveFailuresError: alertThresholds?.consecutiveFailuresError ?? 3,
        refreshTimeoutWarning: alertThresholds?.refreshTimeoutWarning ?? 120
      }
    }
    
    config.autoRefresh = newAutoRefresh
    
    // 4. 比较配置变更
    const changes = compareConfigs(oldAutoRefresh, newAutoRefresh, 'autoRefresh')
    const changeSummary = generateChangeSummary(changes)
    
    // 5. 保存配置
    saveConfig(config)
    
    // 6. 记录配置变更日志
    if (changes.length > 0) {
      logConfigChange({
        timestamp: Date.now(),
        changes,
        summary: changeSummary
      })
    }
    
    // 7. 触发配置热更新 - 自动重启调度器
    let schedulerRestarted = false
    let schedulerError: string | undefined
    
    try {
      const { reloadScheduler } = require('../services/auto-refresh-optimized.service')
      reloadScheduler(oldConfig)
      schedulerRestarted = true
    } catch (error: any) {
      console.error('❌ 重启调度器失败:', error.message)
      schedulerError = error.message
    }
    
    // 8. 返回详细的更新结果
    res.json({
      success: true,
      message: '自动刷新配置已保存',
      result: {
        validated: true,
        validatedFields: validation.validatedFields,
        warnings: validation.warnings,
        changesCount: changes.length,
        changeSummary,
        changes: changes.map(c => ({
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue
        })),
        schedulerRestarted,
        schedulerError,
        timestamp: Date.now()
      }
    })
  } catch (error: any) {
    console.error('保存自动刷新配置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取配置变更历史
 */
export function getConfigChangeHistory(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 10
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: '查询数量必须在 1-100 之间'
      })
    }
    
    const history = getRecentConfigChanges(limit)
    
    res.json({
      success: true,
      total: history.length,
      history
    })
  } catch (error: any) {
    console.error('获取配置变更历史失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取配置迁移历史
 */
export function getConfigMigrationHistory(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 10
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: '查询数量必须在 1-100 之间'
      })
    }
    
    const { getMigrationHistory } = require('../services/config-migration.service')
    const history = getMigrationHistory(limit)
    
    res.json({
      success: true,
      total: history.length,
      history
    })
  } catch (error: any) {
    console.error('获取配置迁移历史失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 验证配置完整性
 */
export function validateConfigCompletenessHandler(req: Request, res: Response) {
  try {
    const config = loadConfig()
    const { validateConfigCompleteness } = require('../services/config-migration.service')
    const validation = validateConfigCompleteness(config)
    
    res.json({
      success: true,
      valid: validation.valid,
      missingFields: validation.missingFields,
      message: validation.valid 
        ? '配置完整，所有必需字段都已存在' 
        : `配置不完整，缺少 ${validation.missingFields.length} 个字段`
    })
  } catch (error: any) {
    console.error('验证配置完整性失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
