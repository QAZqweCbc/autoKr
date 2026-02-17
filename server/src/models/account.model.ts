/**
 * 账号数据模型 - 完整版（与客户端一致）
 */

export type IdpType = 'Google' | 'Github' | 'BuilderId' | 'AWSIdC' | 'Internal'
export type SubscriptionType = 'Free' | 'Pro' | 'Pro_Plus' | 'Enterprise' | 'Teams'
export type AccountStatus = 'active' | 'expired' | 'error' | 'refreshing' | 'unknown' | 'pending' | 'assigned'

/**
 * 账号凭证信息
 */
export interface AccountCredentials {
  accessToken: string
  csrfToken?: string
  refreshToken?: string
  ssoToken?: string  // 用于重新获取 RefreshToken 的长期凭证
  clientId?: string
  clientSecret?: string
  region?: string
  expiresAt?: number
  authMethod?: 'IdC' | 'social'
  provider?: 'BuilderId' | 'Github' | 'Google'
}

/**
 * 奖励额度信息
 */
export interface BonusUsage {
  code: string
  name: string
  current: number
  limit: number
  expiresAt?: string
}

/**
 * 账号使用量信息
 */
export interface AccountUsage {
  current: number
  limit: number
  percentUsed: number
  lastUpdated: number
  baseLimit?: number
  baseCurrent?: number
  freeTrialLimit?: number
  freeTrialCurrent?: number
  freeTrialExpiry?: string
  bonuses?: BonusUsage[]
  nextResetDate?: string
  resourceDetail?: ResourceDetail
}

/**
 * 账号订阅信息
 */
export interface AccountSubscription {
  type: SubscriptionType
  title?: string
  rawType?: string
  expiresAt?: number
  daysRemaining?: number
  upgradeCapability?: string
  overageCapability?: string
  managementTarget?: string
}

/**
 * 资源使用详情
 */
export interface ResourceDetail {
  resourceType?: string
  displayName?: string
  displayNamePlural?: string
  currency?: string
  unit?: string
  overageRate?: number
  overageCap?: number
  overageEnabled?: boolean
}

/**
 * 账号标签
 */
export interface AccountTag {
  id: string
  name: string
  color: string
}

/**
 * 账号分组
 */
export interface AccountGroup {
  id: string
  name: string
  description?: string
  color?: string
  order: number
  createdAt: number
}

/**
 * 账号实体 - 完整版
 */
export interface Account {
  // 基本信息
  id: string
  email: string
  password: string
  nickname?: string
  idp: IdpType
  userId?: string
  visitorId?: string

  // 认证信息
  credentials: AccountCredentials

  // 订阅信息
  subscription: AccountSubscription

  // 使用量
  usage: AccountUsage

  // 分组和标签
  groupId?: string
  tags?: string[]

  // 状态
  status: AccountStatus
  lastError?: string
  consecutiveFailures?: number  // 连续失败次数
  isActive?: boolean

  // 服务端特有字段
  deviceId?: string
  assignedAt?: number

  // 时间戳
  createdAt: number
  lastUsedAt?: number
  lastCheckedAt?: number
}


export interface AccountCreateDTO {
  email: string
  password: string
  nickname?: string
  idp?: IdpType
  userId?: string
  credentials: AccountCredentials
  subscription?: AccountSubscription
  usage?: AccountUsage
  groupId?: string
  tags?: string[]
  deviceId?: string
  status?: AccountStatus
}

export interface AccountStats {
  total: number
  byStatus?: Record<AccountStatus, number>
  bySubscription?: Record<SubscriptionType, number>
  byIdp?: Record<IdpType, number>
}

// 从应用端导入完整账号的DTO（支持应用端导出的JSON格式）
export interface ImportFromAppDTO {
  version?: string
  exportedAt?: number
  account: {
    id?: string
    email: string
    userId: string
    nickname?: string
    idp?: string
    credentials: {
      accessToken: string
      csrfToken?: string
      refreshToken: string
      clientId?: string
      clientSecret?: string
      region?: string
      expiresAt?: number
      authMethod?: string
      provider?: string
    }
    subscription: {
      type: string
      title: string
      rawType?: string
      daysRemaining?: number
      expiresAt?: number
      managementTarget?: string
      upgradeCapability?: string
      overageCapability?: string
    }
    usage: {
      current: number
      limit: number
      percentUsed?: number
      lastUpdated?: number
      baseLimit?: number
      baseCurrent?: number
      freeTrialLimit?: number
      freeTrialCurrent?: number
      freeTrialExpiry?: string
      bonuses?: any[]
      nextResetDate?: string
      resourceDetail?: {
        displayName?: string
        displayNamePlural?: string
        resourceType?: string
        currency?: string
        unit?: string
        overageRate?: number
        overageCap?: number
        overageEnabled?: boolean
      }
    }
    tags?: string[]
    status?: string
    lastError?: string
    consecutiveFailures?: number
    lastUsedAt?: number
    createdAt?: number
    isActive?: boolean
    lastCheckedAt?: number
  }
}

/**
 * 数据库扁平化字段（用于 MySQL 存储）
 * 优化后的表结构：删除了重复字段，统一使用短字段名
 */
export interface AccountFlatDB {
  id: string
  email: string
  password: string
  
  // credentials 扁平化
  access_token?: string
  csrf_token?: string
  refresh_token?: string
  x_amz_sso_authn?: string
  client_id?: string
  client_secret?: string
  region?: string
  expires_at?: number
  auth_method?: string
  provider?: string
  
  // subscription 扁平化（只保留短字段名）
  subscription_type?: string
  subscription_title?: string
  subscription_raw_type?: string
  subscription_expires_at?: number
  subscription_days_remaining?: number
  upgrade_capability?: string
  overage_capability?: string
  management_target?: string
  
  // usage 扁平化（只保留短字段名）
  usage_current?: number
  usage_limit?: number
  usage_percent_used?: number
  usage_last_updated?: number
  base_limit?: number
  base_current?: number
  free_trial_limit?: number
  free_trial_current?: number
  free_trial_expiry?: string
  usage_bonuses?: string // JSON string
  next_reset_date?: string
  
  // resourceDetail 扁平化（只保留短字段名）
  resource_type?: string
  resource_display_name?: string
  resource_display_name_plural?: string
  resource_currency?: string
  resource_unit?: string
  overage_rate?: number
  overage_cap?: number
  overage_enabled?: boolean
  
  // 其他字段
  nickname?: string
  idp?: string
  user_id?: string
  visitor_id?: string
  group_id?: string
  tags?: string // JSON string
  status?: string
  last_error?: string
  consecutive_failures?: number
  is_active?: boolean
  device_id?: string
  assigned_at?: number
  created_at: number
  last_used_at?: number
  last_checked_at?: number
  owner_user_id?: string
}
