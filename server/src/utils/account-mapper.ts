/**
 * 账号数据映射工具
 * 用于在嵌套对象结构和扁平化数据库字段之间转换
 */

import { Account, AccountFlatDB, AccountCredentials, AccountSubscription, AccountUsage, ResourceDetail, BonusUsage } from '../models/account.model'

/**
 * 将嵌套的 Account 对象转换为扁平化的数据库字段
 */
/**
 * 将毫秒时间戳转换为 MySQL datetime 格式
 */
function timestampToMySQLDatetime(timestamp?: number): string | null {
  if (!timestamp) return null
  const date = new Date(timestamp)
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export function accountToFlat(account: Account): AccountFlatDB {
  return {
    id: account.id,
    email: account.email,
    password: account.password,
    
    // credentials 扁平化
    access_token: account.credentials.accessToken ?? null,
    csrf_token: account.credentials.csrfToken ?? null,
    refresh_token: account.credentials.refreshToken ?? null,
    x_amz_sso_authn: account.credentials.ssoToken ?? null,
    client_id: account.credentials.clientId ?? null,
    client_secret: account.credentials.clientSecret ?? null,
    region: account.credentials.region ?? null,
    expires_at: account.credentials.expiresAt ?? null,
    auth_method: account.credentials.authMethod ?? null,
    provider: account.credentials.provider ?? null,
    
    // subscription 扁平化（优化后只保留短字段名）
    subscription_type: account.subscription.type ?? null,
    subscription_title: account.subscription.title ?? null,
    subscription_raw_type: account.subscription.rawType ?? null,
    subscription_expires_at: account.subscription.expiresAt ?? null,
    subscription_days_remaining: account.subscription.daysRemaining ?? null,
    upgrade_capability: account.subscription.upgradeCapability ?? null,
    overage_capability: account.subscription.overageCapability ?? null,
    management_target: account.subscription.managementTarget ?? null,
    
    // usage 扁平化（优化后只保留短字段名）
    usage_current: account.usage.current ?? null,
    usage_limit: account.usage.limit ?? null,
    usage_percent_used: account.usage.percentUsed ?? null,
    usage_last_updated: account.usage.lastUpdated ?? null,
    base_limit: account.usage.baseLimit ?? null,
    base_current: account.usage.baseCurrent ?? null,
    free_trial_limit: account.usage.freeTrialLimit ?? null,
    free_trial_current: account.usage.freeTrialCurrent ?? null,
    free_trial_expiry: account.usage.freeTrialExpiry ?? null,
    usage_bonuses: account.usage.bonuses ? JSON.stringify(account.usage.bonuses) : null,
    next_reset_date: account.usage.nextResetDate ?? null,
    
    // resourceDetail 扁平化（优化后只保留短字段名）
    resource_type: account.usage.resourceDetail?.resourceType ?? null,
    resource_display_name: account.usage.resourceDetail?.displayName ?? null,
    resource_display_name_plural: account.usage.resourceDetail?.displayNamePlural ?? null,
    resource_currency: account.usage.resourceDetail?.currency ?? null,
    resource_unit: account.usage.resourceDetail?.unit ?? null,
    overage_rate: account.usage.resourceDetail?.overageRate ?? null,
    overage_cap: account.usage.resourceDetail?.overageCap ?? null,
    overage_enabled: account.usage.resourceDetail?.overageEnabled ?? null,
    
    // 其他字段
    nickname: account.nickname ?? null,
    idp: account.idp ?? null,
    user_id: account.userId ?? null,
    visitor_id: account.visitorId ?? null,
    group_id: account.groupId ?? null,
    tags: account.tags ? JSON.stringify(account.tags) : null,
    status: account.status ?? null,
    last_error: account.lastError ?? null,
    consecutive_failures: account.consecutiveFailures ?? 0,
    is_active: account.isActive ?? true,  // 默认为 true
    device_id: account.deviceId ?? null,
    assigned_at: account.assignedAt ?? null,
    created_at: account.createdAt,
    last_used_at: account.lastUsedAt ?? null,
    last_checked_at: account.lastCheckedAt ?? null,
    owner_user_id: null  // 预留字段，用于多用户系统
  }
}

/**
 * 将扁平化的数据库字段转换为嵌套的 Account 对象
 */
export function flatToAccount(flat: AccountFlatDB): Account {
  // 解析 bonuses
  let bonuses: BonusUsage[] | undefined
  if (flat.usage_bonuses) {
    try {
      bonuses = JSON.parse(flat.usage_bonuses)
    } catch (e) {
      console.warn('Failed to parse bonuses:', e)
    }
  }
  
  // 解析 tags
  let tags: string[] | undefined
  if (flat.tags) {
    try {
      tags = JSON.parse(flat.tags)
    } catch (e) {
      console.warn('Failed to parse tags:', e)
    }
  }
  
  // 构建 resourceDetail (匹配实际数据库字段名)
  const resourceDetail: ResourceDetail | undefined = (
    flat.resource_type ||
    flat.resource_display_name ||
    flat.resource_currency ||
    flat.resource_unit
  ) ? {
    resourceType: flat.resource_type,
    displayName: flat.resource_display_name,
    displayNamePlural: flat.resource_display_name_plural,
    currency: flat.resource_currency,
    unit: flat.resource_unit,
    overageRate: flat.overage_rate,
    overageCap: flat.overage_cap,
    overageEnabled: flat.overage_enabled
  } : undefined
  
  return {
    id: flat.id,
    email: flat.email,
    password: flat.password,
    nickname: flat.nickname,
    idp: (flat.idp as any) || 'BuilderId',
    userId: flat.user_id,
    visitorId: flat.visitor_id,
    
    credentials: {
      accessToken: flat.access_token || '',
      csrfToken: flat.csrf_token,
      refreshToken: flat.refresh_token,
      ssoToken: flat.x_amz_sso_authn,
      clientId: flat.client_id,
      clientSecret: flat.client_secret,
      region: flat.region,
      expiresAt: flat.expires_at,
      authMethod: flat.auth_method as any,
      provider: flat.provider as any
    },
    
    subscription: {
      type: (flat.subscription_type as any) || 'Free',
      title: flat.subscription_title,
      rawType: flat.subscription_raw_type,
      expiresAt: flat.subscription_expires_at,
      daysRemaining: flat.subscription_days_remaining,
      upgradeCapability: flat.upgrade_capability,
      overageCapability: flat.overage_capability,
      managementTarget: flat.management_target
    },
    
    usage: {
      current: flat.usage_current || 0,
      limit: flat.usage_limit || 0,
      percentUsed: flat.usage_percent_used || 0,
      lastUpdated: flat.usage_last_updated || Date.now(),
      baseLimit: flat.base_limit,
      baseCurrent: flat.base_current,
      freeTrialLimit: flat.free_trial_limit,
      freeTrialCurrent: flat.free_trial_current,
      freeTrialExpiry: flat.free_trial_expiry,
      bonuses,
      nextResetDate: flat.next_reset_date,
      resourceDetail
    },
    
    groupId: flat.group_id,
    tags,
    status: (flat.status as any) || 'pending',
    lastError: flat.last_error,
    consecutiveFailures: flat.consecutive_failures ?? 0,
    isActive: flat.is_active,
    deviceId: flat.device_id,
    assignedAt: flat.assigned_at,
    createdAt: flat.created_at,
    lastUsedAt: flat.last_used_at,
    lastCheckedAt: flat.last_checked_at
  }
}

/**
 * 从 ImportFromAppDTO 转换为 Account
 */
export function importDTOToAccount(dto: any, password: string = ''): Account {
  const acc = dto.account
  
  return {
    id: acc.id || acc.email,
    email: acc.email,
    password: password,
    nickname: acc.nickname || undefined,
    idp: (acc.idp as any) || 'BuilderId',
    userId: acc.userId || undefined,
    visitorId: undefined,
    
    credentials: {
      accessToken: acc.credentials.accessToken || '',
      csrfToken: acc.credentials.csrfToken || undefined,
      refreshToken: acc.credentials.refreshToken || undefined,
      clientId: acc.credentials.clientId || undefined,
      clientSecret: acc.credentials.clientSecret || undefined,
      region: acc.credentials.region || 'us-east-1',
      expiresAt: acc.credentials.expiresAt || undefined,
      authMethod: acc.credentials.authMethod as any || undefined,
      provider: acc.credentials.provider as any || undefined
    },
    
    subscription: {
      type: acc.subscription?.type || 'Free',
      title: acc.subscription?.title || undefined,
      rawType: acc.subscription?.rawType || undefined,
      expiresAt: acc.subscription?.expiresAt || undefined,
      daysRemaining: acc.subscription?.daysRemaining ?? undefined,
      upgradeCapability: acc.subscription?.upgradeCapability || undefined,
      overageCapability: acc.subscription?.overageCapability || undefined,
      managementTarget: acc.subscription?.managementTarget || undefined
    },
    
    usage: {
      current: acc.usage?.current ?? 0,
      limit: acc.usage?.limit ?? 0,
      percentUsed: acc.usage?.percentUsed ?? 0,
      lastUpdated: acc.usage?.lastUpdated || Date.now(),
      baseLimit: acc.usage?.baseLimit ?? undefined,
      baseCurrent: acc.usage?.baseCurrent ?? undefined,
      freeTrialLimit: acc.usage?.freeTrialLimit ?? undefined,
      freeTrialCurrent: acc.usage?.freeTrialCurrent ?? undefined,
      freeTrialExpiry: acc.usage?.freeTrialExpiry || undefined,
      bonuses: acc.usage?.bonuses || undefined,
      nextResetDate: acc.usage?.nextResetDate || undefined,
      resourceDetail: acc.usage?.resourceDetail || undefined
    },
    
    groupId: undefined,
    tags: acc.tags || undefined,
    status: (acc.status as any) || 'active',
    lastError: acc.lastError || undefined,
    consecutiveFailures: acc.consecutiveFailures ?? 0,
    isActive: acc.isActive ?? undefined,
    deviceId: undefined,
    assignedAt: undefined,
    createdAt: acc.createdAt || Date.now(),
    lastUsedAt: acc.lastUsedAt || undefined,
    lastCheckedAt: acc.lastCheckedAt || undefined
  }
}

/**
 * 更新账号的使用量信息（从 syncAccountUsage 返回的数据）
 */
export function updateAccountUsage(account: Account, syncData: any): Account {
  return {
    ...account,
    userId: syncData.user_id || account.userId,
    idp: (syncData.idp as any) || account.idp,
    
    subscription: {
      ...account.subscription,
      type: syncData.subscription_type || account.subscription.type,
      title: syncData.subscription_title || account.subscription.title,
      expiresAt: syncData.expires_at || account.subscription.expiresAt,
      daysRemaining: syncData.days_remaining || account.subscription.daysRemaining,
      upgradeCapability: syncData.upgrade_capability || account.subscription.upgradeCapability,
      overageCapability: syncData.overage_capability || account.subscription.overageCapability,
      managementTarget: syncData.management_target || account.subscription.managementTarget
    },
    
    usage: {
      ...account.usage,
      current: syncData.usage_current ?? account.usage.current,
      limit: syncData.usage_limit ?? account.usage.limit,
      percentUsed: syncData.usage_percent ?? account.usage.percentUsed,
      lastUpdated: syncData.last_sync_at || Date.now(),
      baseLimit: syncData.base_limit ?? account.usage.baseLimit,
      baseCurrent: syncData.base_current ?? account.usage.baseCurrent,
      freeTrialLimit: syncData.free_trial_limit ?? account.usage.freeTrialLimit,
      freeTrialCurrent: syncData.free_trial_current ?? account.usage.freeTrialCurrent,
      freeTrialExpiry: syncData.free_trial_expiry || account.usage.freeTrialExpiry,
      nextResetDate: syncData.next_reset_date || account.usage.nextResetDate,
      resourceDetail: {
        resourceType: syncData.resource_type || account.usage.resourceDetail?.resourceType,
        displayName: syncData.resource_display_name || account.usage.resourceDetail?.displayName,
        displayNamePlural: account.usage.resourceDetail?.displayNamePlural,
        currency: syncData.resource_currency || account.usage.resourceDetail?.currency,
        unit: syncData.resource_unit || account.usage.resourceDetail?.unit,
        overageRate: syncData.overage_rate ?? account.usage.resourceDetail?.overageRate,
        overageCap: syncData.overage_cap ?? account.usage.resourceDetail?.overageCap,
        overageEnabled: syncData.overage_enabled ?? account.usage.resourceDetail?.overageEnabled
      }
    },
    
    lastCheckedAt: syncData.last_sync_at || Date.now()
  }
}
