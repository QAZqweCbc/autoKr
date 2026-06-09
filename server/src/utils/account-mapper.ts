/**
 * 账号数据映射工具
 * 用于在嵌套对象结构和扁平化数据库字段之间转换
 */

import { Account, AccountFlatDB, BonusUsage, ResourceDetail } from '../models/account.model'

export function accountToFlat(account: Account): AccountFlatDB {
  return {
    id: account.id,
    email: account.email,
    password: account.password,

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

    subscription_type: account.subscription.type ?? null,
    subscription_title: account.subscription.title ?? null,
    subscription_raw_type: account.subscription.rawType ?? null,
    subscription_expires_at: account.subscription.expiresAt ?? null,
    subscription_days_remaining: account.subscription.daysRemaining ?? null,
    upgrade_capability: account.subscription.upgradeCapability ?? null,
    overage_capability: account.subscription.overageCapability ?? null,
    management_target: account.subscription.managementTarget ?? null,

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

    resource_type: account.usage.resourceDetail?.resourceType ?? null,
    resource_display_name: account.usage.resourceDetail?.displayName ?? null,
    resource_display_name_plural: account.usage.resourceDetail?.displayNamePlural ?? null,
    resource_currency: account.usage.resourceDetail?.currency ?? null,
    resource_unit: account.usage.resourceDetail?.unit ?? null,
    overage_rate: account.usage.resourceDetail?.overageRate ?? null,
    overage_cap: account.usage.resourceDetail?.overageCap ?? null,
    overage_enabled: account.usage.resourceDetail?.overageEnabled ?? null,

    nickname: account.nickname ?? null,
    idp: account.idp ?? null,
    user_id: account.userId ?? null,
    visitor_id: account.visitorId ?? null,
    group_id: account.groupId ?? null,
    tags: account.tags ? JSON.stringify(account.tags) : null,
    status: account.status ?? null,
    last_error: account.lastError ?? null,
    consecutive_failures: account.consecutiveFailures ?? 0,
    is_active: typeof account.isActive === 'boolean'
      ? account.isActive
      : account.status === 'active',
    device_id: account.deviceId ?? null,
    assigned_at: account.assignedAt ?? null,
    created_at: account.createdAt,
    last_used_at: account.lastUsedAt ?? null,
    last_checked_at: account.lastCheckedAt ?? null,
    owner_user_id: account.ownerUserId ?? null
  }
}

export function flatToAccount(flat: AccountFlatDB): Account {
  let bonuses: BonusUsage[] | undefined
  if (flat.usage_bonuses) {
    try {
      bonuses = JSON.parse(flat.usage_bonuses)
    } catch (error) {
      console.warn('Failed to parse bonuses:', error)
    }
  }

  let tags: string[] | undefined
  if (flat.tags) {
    try {
      tags = JSON.parse(flat.tags)
    } catch (error) {
      console.warn('Failed to parse tags:', error)
    }
  }

  const resourceDetail: ResourceDetail | undefined = (
    flat.resource_type ||
    flat.resource_display_name ||
    flat.resource_currency ||
    flat.resource_unit
  )
    ? {
        resourceType: flat.resource_type,
        displayName: flat.resource_display_name,
        displayNamePlural: flat.resource_display_name_plural,
        currency: flat.resource_currency,
        unit: flat.resource_unit,
        overageRate: flat.overage_rate,
        overageCap: flat.overage_cap,
        overageEnabled: flat.overage_enabled
      }
    : undefined

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
    ownerUserId: flat.owner_user_id,
    status: (flat.status as any) || 'pending',
    lastError: flat.last_error,
    consecutiveFailures: flat.consecutive_failures ?? 0,
    isActive: flat.is_active ?? (flat.status === 'active'),
    deviceId: flat.device_id,
    assignedAt: flat.assigned_at,
    createdAt: flat.created_at,
    lastUsedAt: flat.last_used_at,
    lastCheckedAt: flat.last_checked_at
  }
}

export function importDTOToAccount(dto: any, password: string = ''): Account {
  const acc = dto.account

  return {
    id: acc.id || acc.email,
    email: acc.email,
    password,
    nickname: acc.nickname,
    idp: (acc.idp as any) || 'BuilderId',
    userId: acc.userId,
    visitorId: undefined,

    credentials: {
      accessToken: acc.credentials.accessToken,
      csrfToken: acc.credentials.csrfToken,
      refreshToken: acc.credentials.refreshToken,
      ssoToken: acc.credentials.ssoToken,
      clientId: acc.credentials.clientId,
      clientSecret: acc.credentials.clientSecret,
      region: acc.credentials.region || 'us-east-1',
      expiresAt: acc.credentials.expiresAt,
      authMethod: acc.credentials.authMethod as any,
      provider: acc.credentials.provider as any
    },

    subscription: {
      type: acc.subscription.type,
      title: acc.subscription.title,
      rawType: acc.subscription.rawType,
      expiresAt: acc.subscription.expiresAt,
      daysRemaining: acc.subscription.daysRemaining,
      upgradeCapability: acc.subscription.upgradeCapability,
      overageCapability: acc.subscription.overageCapability,
      managementTarget: acc.subscription.managementTarget
    },

    usage: {
      current: acc.usage.current,
      limit: acc.usage.limit,
      percentUsed: acc.usage.percentUsed,
      lastUpdated: acc.usage.lastUpdated || Date.now(),
      baseLimit: acc.usage.baseLimit,
      baseCurrent: acc.usage.baseCurrent,
      freeTrialLimit: acc.usage.freeTrialLimit,
      freeTrialCurrent: acc.usage.freeTrialCurrent,
      freeTrialExpiry: acc.usage.freeTrialExpiry,
      bonuses: acc.usage.bonuses,
      nextResetDate: acc.usage.nextResetDate,
      resourceDetail: acc.usage.resourceDetail
    },

    groupId: undefined,
    tags: acc.tags,
    ownerUserId: acc.ownerUserId,
    status: (acc.status as any) || 'active',
    lastError: acc.lastError,
    consecutiveFailures: acc.consecutiveFailures ?? 0,
    isActive: acc.isActive ?? (acc.status === 'active'),
    deviceId: undefined,
    assignedAt: undefined,
    createdAt: acc.createdAt || Date.now(),
    lastUsedAt: acc.lastUsedAt,
    lastCheckedAt: acc.lastCheckedAt
  }
}

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
        displayNamePlural: syncData.resource_display_name_plural || account.usage.resourceDetail?.displayNamePlural,
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
