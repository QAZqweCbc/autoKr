/**
 * Kiro API 服务
 * 调用 AWS Kiro API 获取用户信息和使用量
 */

import { encode, decode } from 'cbor-x'
import { randomBytes } from 'crypto'
import { validateAccessToken, logTokenValidation } from '../utils/token-validator'

// ✅ 使用正确的 Kiro Web Portal Service 端点
const KIRO_API_BASE = 'https://app.kiro.dev/service/KiroWebPortalService/operation'

/**
 * 生成 AWS SDK 调用 ID
 */
function generateInvocationId(): string {
  return randomBytes(16).toString('hex')
}

/**
 * 调用 Kiro API（CBOR 格式）
 */
export async function kiroApiRequest<T>(
  operation: string,
  body: Record<string, unknown>,
  accessToken: string,
  idp: string = 'BuilderId'
): Promise<T> {
  console.log(`[Kiro API] Calling ${operation}`)
  console.log(`[Kiro API] Body:`, JSON.stringify(body))
  console.log(`[Kiro API] IDP: ${idp}`)
  console.log(`[Kiro API] AccessToken length:`, accessToken?.length)

  // ✅ 验证 Token 格式
  const validation = validateAccessToken(accessToken)
  logTokenValidation(`Kiro API - ${operation}`, accessToken, validation)

  if (!validation.valid) {
    console.error(`[Kiro API] ⚠️  Token 格式可能有问题，但仍尝试调用 API`)
  }

  // 编码 CBOR 请求体
  const encodedBody = encode(body)
  const bodyBuffer = Buffer.from(encodedBody)

  const response = await fetch(`${KIRO_API_BASE}/${operation}`, {
    method: 'POST',
    headers: {
      'accept': 'application/cbor',
      'content-type': 'application/cbor',
      'smithy-protocol': 'rpc-v2-cbor',
      'amz-sdk-invocation-id': generateInvocationId(),
      'amz-sdk-request': 'attempt=1; max=1',
      'x-amz-user-agent': 'aws-sdk-js/1.0.0 kiro-server/1.0.0',
      'authorization': `Bearer ${accessToken}`,
      'cookie': `Idp=${idp}; AccessToken=${accessToken}`
    },
    body: bodyBuffer
  })

  console.log(`[Kiro API] Response status: ${response.status}`)

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    let errorType: string | undefined
    const errorBuffer = await response.arrayBuffer()
    try {
      const errorData = decode(Buffer.from(errorBuffer)) as { __type?: string; message?: string }
      if (errorData.__type && errorData.message) {
        errorType = errorData.__type.split('#').pop() || errorData.__type
        errorMessage = `${errorType}: ${errorData.message}`
      } else if (errorData.message) {
        errorMessage = errorData.message
      }
      console.error(`[Kiro API] Error:`, errorData)
    } catch {
      const errorText = Buffer.from(errorBuffer).toString('utf-8')
      console.error(`[Kiro API] Error (raw): ${errorText}`)
    }
    
    // 检测账号封禁状态
    if (response.status === 423 || errorType === 'AccountSuspendedException') {
      const suspendedError = new Error(errorMessage)
      ;(suspendedError as any).isAccountSuspended = true
      ;(suspendedError as any).statusCode = response.status
      throw suspendedError
    }
    
    throw new Error(errorMessage)
  }

  const arrayBuffer = await response.arrayBuffer()
  const result = decode(Buffer.from(arrayBuffer)) as T
  console.log(`[Kiro API] Response received successfully`)
  return result
}

/**
 * 获取用户信息
 */
export interface UserInfoResponse {
  email?: string
  userId?: string
  idp?: string
  status?: string
  featureFlags?: string[]
}

export async function getUserInfo(
  accessToken: string,
  idp: string = 'BuilderId'
): Promise<UserInfoResponse> {
  return kiroApiRequest<UserInfoResponse>(
    'GetUserInfo',
    { origin: 'KIRO_IDE' },
    accessToken,
    idp
  )
}

/**
 * 获取用户使用量和限额
 */
export interface UsageResponse {
  subscriptionInfo?: {
    type?: string
    subscriptionTitle?: string
    subscriptionManagementTarget?: string
    upgradeCapability?: string
    overageCapability?: string
  }
  usageBreakdownList?: Array<{
    currentUsage?: number
    currentUsageWithPrecision?: number
    usageLimit?: number
    usageLimitWithPrecision?: number
    displayName?: string
    displayNamePlural?: string
    resourceType?: string
    currency?: string
    unit?: string
    overageRate?: number
    overageCap?: number
    overageCapWithPrecision?: number
    nextDateReset?: string
    freeTrialInfo?: {
      currentUsage?: number
      currentUsageWithPrecision?: number
      usageLimit?: number
      usageLimitWithPrecision?: number
      freeTrialExpiry?: string
      freeTrialStatus?: string
    }
  }>
  nextDateReset?: string
  overageConfiguration?: {
    overageEnabled?: boolean
  }
  userInfo?: {
    email?: string
    userId?: string
  }
}

export async function getUserUsageAndLimits(
  accessToken: string,
  idp: string = 'BuilderId'
): Promise<UsageResponse> {
  return kiroApiRequest<UsageResponse>(
    'GetUserUsageAndLimits',
    { isEmailRequired: true, origin: 'KIRO_IDE' },
    accessToken,
    idp
  )
}

async function getUserUsageAndLimitsWithRetry(
  accessToken: string,
  idp: string = 'BuilderId'
): Promise<UsageResponse> {
  try {
    return await getUserUsageAndLimits(accessToken, idp)
  } catch (error: any) {
    if (!error?.message?.includes('UnauthorizedException')) {
      throw error
    }

    console.warn('[Kiro API] GetUserUsageAndLimits unauthorized, retrying once...')
    await new Promise(resolve => setTimeout(resolve, 1500))
    return getUserUsageAndLimits(accessToken, idp)
  }
}

/**
 * 同步账号的使用量信息
 * 返回需要更新到数据库的字段
 */
export async function syncAccountUsage(
  accessToken: string,
  idp: string = 'BuilderId'
): Promise<{
  success: boolean
  data?: {
    // 用户信息
    user_id?: string
    idp?: string
    
    // 订阅信息
    subscription_type?: string
    subscription_title?: string
    subscription_status?: string
    days_remaining?: number
    expires_at?: number
    management_target?: string
    upgrade_capability?: string
    overage_capability?: string
    
    // 使用量信息
    usage_current?: number
    usage_limit?: number
    usage_percent?: number
    base_limit?: number
    base_current?: number
    free_trial_limit?: number
    free_trial_current?: number
    free_trial_expiry?: string
    next_reset_date?: string
    
    // 资源详情
    resource_display_name?: string
    resource_display_name_plural?: string
    resource_type?: string
    resource_currency?: string
    resource_unit?: string
    overage_rate?: number
    overage_cap?: number
    overage_enabled?: boolean
    
    last_sync_at: number
  }
  error?: string
  isAccountSuspended?: boolean
}> {
  try {
    // 并行调用两个 API
    const [userInfo, usageInfo] = await Promise.all([
      getUserInfo(accessToken, idp).catch(() => undefined),
      getUserUsageAndLimitsWithRetry(accessToken, idp)
    ])

    console.log('[Kiro API] Raw usageInfo:', JSON.stringify(usageInfo, null, 2))

    // ✅ 使用正确的字段名
    const sub = usageInfo.subscriptionInfo
    const usageBreakdown = usageInfo.usageBreakdownList?.[0]
    const freeTrialInfo = usageBreakdown?.freeTrialInfo
    
    // 计算总使用量和总限额
    const baseUsage = usageBreakdown?.currentUsage || 0
    const baseLimit = usageBreakdown?.usageLimit || 0
    const freeTrialUsage = freeTrialInfo?.currentUsage || 0
    const freeTrialLimit = freeTrialInfo?.usageLimit || 0
    
    const totalUsage = baseUsage + freeTrialUsage
    const totalLimit = baseLimit + freeTrialLimit
    const usagePercent = totalLimit > 0 ? Math.round((totalUsage / totalLimit) * 100) : 0

    console.log('[Kiro API] Parsed data:', {
      subscription: sub?.subscriptionTitle,
      baseUsage, baseLimit,
      freeTrialUsage, freeTrialLimit,
      totalUsage, totalLimit, usagePercent
    })

    return {
      success: true,
      data: {
        // 用户信息
        user_id: userInfo?.userId || usageInfo.userInfo?.userId,
        idp: userInfo?.idp || idp,
        
        // 订阅信息
        subscription_type: sub?.type,
        subscription_title: sub?.subscriptionTitle,
        subscription_status: userInfo?.status,
        days_remaining: undefined, // API 不再返回此字段
        expires_at: undefined,
        management_target: sub?.subscriptionManagementTarget,
        upgrade_capability: sub?.upgradeCapability,
        overage_capability: sub?.overageCapability,
        
        // 使用量信息（总计）
        usage_current: totalUsage,
        usage_limit: totalLimit,
        usage_percent: usagePercent,
        
        // 基础额度
        base_limit: baseLimit,
        base_current: baseUsage,
        
        // 免费试用额度
        free_trial_limit: freeTrialLimit,
        free_trial_current: freeTrialUsage,
        free_trial_expiry: freeTrialInfo?.freeTrialExpiry,
        next_reset_date: usageBreakdown?.nextDateReset || usageInfo.nextDateReset,
        
        // 资源详情
        resource_display_name: usageBreakdown?.displayName,
        resource_display_name_plural: usageBreakdown?.displayNamePlural,
        resource_type: usageBreakdown?.resourceType,
        resource_currency: usageBreakdown?.currency,
        resource_unit: usageBreakdown?.unit,
        overage_rate: usageBreakdown?.overageRate,
        overage_cap: usageBreakdown?.overageCap,
        overage_enabled: usageInfo.overageConfiguration?.overageEnabled,
        
        last_sync_at: Date.now()
      }
    }
  } catch (error: any) {
    console.error('[Kiro API] Sync usage failed:', error.message)
    
    // 检测账号封禁状态
    const isAccountSuspended = error.isAccountSuspended === true || 
                               error.message?.includes('AccountSuspendedException') ||
                               error.statusCode === 423
    
    return {
      success: false,
      error: error.message,
      isAccountSuspended
    }
  }
}
