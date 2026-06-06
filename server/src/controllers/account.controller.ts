/**
 * 账号控制器
 */

import { Request, Response } from 'express'
import { AccountDB } from '../services/database.adapter'
import { exportAccountsAsJSON, exportAccountsAsCSV } from '../services/generator.service'

/**
 * 获取账号列表
 */
export async function getAccounts(req: Request, res: Response) {
  try {
    const accounts = await AccountDB.getAll()

    // 将嵌套结构转换为扁平结构（兼容前端）
    const flatAccounts = accounts.map(acc => ({
      id: acc.id,
      email: acc.email,
      password: acc.password,
      nickname: acc.nickname,
      status: acc.status,

      // credentials 扁平化
      access_token: acc.credentials.accessToken,
      csrf_token: acc.credentials.csrfToken,
      refresh_token: acc.credentials.refreshToken,
      sso_token: acc.credentials.ssoToken,
      client_id: acc.credentials.clientId,
      client_secret: acc.credentials.clientSecret,
      region: acc.credentials.region,
      expires_at: acc.credentials.expiresAt,
      auth_method: acc.credentials.authMethod,
      provider: acc.credentials.provider,

      // subscription 扁平化
      subscription_type: acc.subscription.type,
      subscription_title: acc.subscription.title,
      subscription_raw_type: acc.subscription.rawType,
      subscription_expires_at: acc.subscription.expiresAt,
      subscription_days_remaining: acc.subscription.daysRemaining,
      upgrade_capability: acc.subscription.upgradeCapability,
      overage_capability: acc.subscription.overageCapability,
      management_target: acc.subscription.managementTarget,

      // usage 扁平化
      usage_current: acc.usage.current,
      usage_limit: acc.usage.limit,
      usage_percent: acc.usage.percentUsed,
      usage_last_updated: acc.usage.lastUpdated,
      base_limit: acc.usage.baseLimit,
      base_current: acc.usage.baseCurrent,
      free_trial_limit: acc.usage.freeTrialLimit,
      free_trial_current: acc.usage.freeTrialCurrent,
      free_trial_expiry: acc.usage.freeTrialExpiry,
      usage_bonuses: acc.usage.bonuses,
      next_reset_date: acc.usage.nextResetDate,

      // resourceDetail 扁平化
      resource_type: acc.usage.resourceDetail?.resourceType,
      resource_display_name: acc.usage.resourceDetail?.displayName,
      resource_display_name_plural: acc.usage.resourceDetail?.displayNamePlural,
      resource_currency: acc.usage.resourceDetail?.currency,
      resource_unit: acc.usage.resourceDetail?.unit,
      overage_rate: acc.usage.resourceDetail?.overageRate,
      overage_cap: acc.usage.resourceDetail?.overageCap,
      overage_enabled: acc.usage.resourceDetail?.overageEnabled,

      // 其他字段
      idp: acc.idp,
      user_id: acc.userId,
      visitor_id: acc.visitorId,
      group_id: acc.groupId,
      tags: acc.tags,
      last_error: acc.lastError,
      consecutive_failures: acc.consecutiveFailures,
      is_active: acc.isActive,
      device_id: acc.deviceId,
      assigned_at: acc.assignedAt,
      owner_user_id: (acc as any).ownerUserId,
      created_at: acc.createdAt,
      last_used_at: acc.lastUsedAt,
      last_checked_at: acc.lastCheckedAt
    }))

    res.json({
      success: true,
      accounts: flatAccounts,
      count: flatAccounts.length
    })
  } catch (error: any) {
    console.error('获取账号列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取账号详情
 */
export async function getAccountById(req: Request, res: Response) {
  try {
    const { id } = req.params
    const account = await AccountDB.getById(id as string)

    if (!account) {
      return res.status(404).json({
        success: false,
        error: '账号不存在'
      })
    }

    // 转换为扁平结构
    const flatAccount = {
      id: account.id,
      email: account.email,
      password: account.password,
      nickname: account.nickname,
      status: account.status,
      access_token: account.credentials.accessToken,
      csrf_token: account.credentials.csrfToken,
      refresh_token: account.credentials.refreshToken,
      client_id: account.credentials.clientId,
      client_secret: account.credentials.clientSecret,
      region: account.credentials.region,
      expires_at: account.credentials.expiresAt,
      auth_method: account.credentials.authMethod,
      provider: account.credentials.provider,
      subscription_type: account.subscription.type,
      subscription_title: account.subscription.title,
      subscription_raw_type: account.subscription.rawType,
      subscription_expires_at: account.subscription.expiresAt,
      subscription_days_remaining: account.subscription.daysRemaining,
      upgrade_capability: account.subscription.upgradeCapability,
      overage_capability: account.subscription.overageCapability,
      management_target: account.subscription.managementTarget,
      usage_current: account.usage.current,
      usage_limit: account.usage.limit,
      usage_percent: account.usage.percentUsed,
      usage_last_updated: account.usage.lastUpdated,
      base_limit: account.usage.baseLimit,
      base_current: account.usage.baseCurrent,
      free_trial_limit: account.usage.freeTrialLimit,
      free_trial_current: account.usage.freeTrialCurrent,
      free_trial_expiry: account.usage.freeTrialExpiry,
      usage_bonuses: account.usage.bonuses,
      next_reset_date: account.usage.nextResetDate,
      resource_type: account.usage.resourceDetail?.resourceType,
      resource_display_name: account.usage.resourceDetail?.displayName,
      resource_display_name_plural: account.usage.resourceDetail?.displayNamePlural,
      resource_currency: account.usage.resourceDetail?.currency,
      resource_unit: account.usage.resourceDetail?.unit,
      overage_rate: account.usage.resourceDetail?.overageRate,
      overage_cap: account.usage.resourceDetail?.overageCap,
      overage_enabled: account.usage.resourceDetail?.overageEnabled,
      idp: account.idp,
      user_id: account.userId,
      visitor_id: account.visitorId,
      group_id: account.groupId,
      tags: account.tags,
      last_error: account.lastError,
      is_active: account.isActive,
      device_id: account.deviceId,
      assigned_at: account.assignedAt,
      created_at: account.createdAt,
      last_used_at: account.lastUsedAt,
      last_checked_at: account.lastCheckedAt
    }

    res.json({
      success: true,
      account: flatAccount
    })
  } catch (error: any) {
    console.error('获取账号详情失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 删除账号
 */
export async function deleteAccount(req: Request, res: Response) {
  try {
    const { id } = req.params
    await AccountDB.delete(id as string)

    res.json({
      success: true,
      message: '账号已删除'
    })
  } catch (error: any) {
    console.error('删除账号失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 导出账号
 */
export async function exportAccounts(req: Request, res: Response) {
  try {
    const { format = 'json' } = req.body
    const accounts = await AccountDB.getAll()

    if (format === 'csv') {
      const csv = exportAccountsAsCSV(accounts)
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=accounts.csv')
      res.send(csv)
    } else {
      const json = exportAccountsAsJSON(accounts)
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', 'attachment; filename=accounts.json')
      res.send(json)
    }
  } catch (error: any) {
    console.error('导出账号失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 导出 Token（支持多种格式）
 */
export async function exportTokens(req: Request, res: Response) {
  try {
    const {
      accountIds,
      format = 'json',
      fields,
      onlyWithToken = true,
      includeExpired = false
    } = req.body

    // 获取要导出的账号
    let accounts: any[]
    if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
      // 导出指定账号
      accounts = await Promise.all(
        accountIds.map((id: string) => AccountDB.getById(id))
      )
      accounts = accounts.filter(Boolean) // 过滤掉不存在的账号
    } else {
      // 导出所有账号
      accounts = await AccountDB.getAll()
    }

    if (accounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有可导出的账号'
      })
    }

    const { exportTokens: doExport, generateExportFilename } =
      await import('../services/token-export.service')

    const exportData = doExport(accounts, {
      format: format === 'aiclient2api' ? 'aiclient2api' : 'json',
      fields,
      onlyWithToken,
      includeExpired
    })

    const filename = generateExportFilename(
      format === 'aiclient2api' ? 'aiclient2api' : 'json',
      accounts.length
    )

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(exportData)

  } catch (error: any) {
    console.error('导出 Token 失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取账号统计
 */
export async function getAccountStats(req: Request, res: Response) {
  try {
    const stats = await AccountDB.getStats()

    res.json({
      success: true,
      stats
    })
  } catch (error: any) {
    console.error('获取账号统计失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取域名统计
 */
export async function getDomainStats(req: Request, res: Response) {
  try {
    const stats = await AccountDB.getDomainStats()

    res.json({
      success: true,
      stats
    })
  } catch (error: any) {
    console.error('获取域名统计失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取每日注册统计
 */
export async function getDailyStats(req: Request, res: Response) {
  try {
    const days = parseInt(req.query.days as string) || 7
    const stats = await AccountDB.getDailyStats(days)

    res.json({
      success: true,
      stats
    })
  } catch (error: any) {
    console.error('获取每日统计失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 重置单个账号的错误状态
 */
export async function resetAccountError(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { resetAccountError } = await import('../services/auto-refresh-optimized.service')

    const success = await resetAccountError(id)

    if (!success) {
      return res.status(404).json({
        success: false,
        error: '账号不存在'
      })
    }

    res.json({
      success: true,
      message: '错误状态已重置'
    })
  } catch (error: any) {
    console.error('重置账号错误状态失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 批量重置账号错误状态
 */
export async function resetAccountErrors(req: Request, res: Response) {
  try {
    const { accountIds } = req.body

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供账号ID数组'
      })
    }

    const { resetAccountErrors } = await import('../services/auto-refresh-optimized.service')
    const count = await resetAccountErrors(accountIds)

    res.json({
      success: true,
      count,
      message: `已重置 ${count} 个账号的错误状态`
    })
  } catch (error: any) {
    console.error('批量重置账号错误状态失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
