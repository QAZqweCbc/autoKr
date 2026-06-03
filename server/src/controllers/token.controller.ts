/**
 * Token 控制器 - 处理 SSO Token 提交和账号分发
 */

import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { AccountDB } from '../services/database.adapter'
import { TokenSubmitDTO, AccountRequestDTO, OidcTokenResponse } from '../models/token.model'
import { ImportFromAppDTO, Account } from '../models/account.model'
import { validateAccessToken, logTokenValidation } from '../utils/token-validator'

/**
 * 提交 SSO Token
 * 用户注册成功后，访问 view.awsapps.com 获取 token 并提交
 * 
 * 新版本：使用SSO Token（Bearer Token）执行完整的设备授权流程
 * 获取完整的OAuth凭证，支持自动刷新
 */
export async function submitToken(req: Request, res: Response) {
  try {
    const { email, x_amz_sso_authn }: TokenSubmitDTO = req.body

    // 调试日志
    console.log('📥 收到 SSO Token 提交请求')
    console.log('   请求体:', JSON.stringify(req.body, null, 2))
    console.log('   邮箱:', email)
    console.log('   Token长度:', x_amz_sso_authn?.length || 0)

    // 验证必填字段
    if (!email || !x_amz_sso_authn) {
      console.log('❌ 验证失败: 邮箱或Token为空')
      return res.status(400).json({
        success: false,
        error: '邮箱和 SSO Token 不能为空'
      })
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`📥 提交SSO Token并执行设备授权`)
    console.log(`📧 邮箱: ${email}`)
    console.log('='.repeat(60))

    // 执行SSO设备授权流程，获取完整OAuth凭证
    const region = 'us-east-1'
    const ssoResult = await ssoDeviceAuth(x_amz_sso_authn, region)

    if (!ssoResult.success || !ssoResult.accessToken) {
      return res.status(400).json({
        success: false,
        error: ssoResult.error || 'SSO授权失败'
      })
    }

    console.log(`✅ SSO设备授权成功`)
    console.log(`   获取到完整OAuth凭证`)

    // 查找或创建账号
    const accounts = await AccountDB.getAll()
    let account = accounts.find(a => a.email === email)

    if (!account) {
      console.log(`📝 账号不存在，创建新账号: ${email}`)

      // 创建新账号
      const newAccount: Account = {
        id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email,
        password: '', // SSO 导入不需要密码
        nickname: email.split('@')[0],
        idp: 'BuilderId',
        userId: undefined,
        visitorId: undefined,
        credentials: {
          accessToken: ssoResult.accessToken || '',
          ssoToken: x_amz_sso_authn,
          refreshToken: ssoResult.refreshToken || '',
          clientId: ssoResult.clientId || '',
          clientSecret: ssoResult.clientSecret || '',
          region: ssoResult.region || region,
          authMethod: 'IdC'
        },
        subscription: {
          type: 'Free',
          title: 'KIRO FREE'
        },
        usage: {
          current: 0,
          limit: 0,
          percentUsed: 0,
          lastUpdated: Date.now()
        },
        groupId: undefined,
        tags: undefined,
        status: 'active',
        lastError: undefined,
        consecutiveFailures: 0,
        isActive: true,  // 明确设置为 true
        deviceId: undefined,
        assignedAt: undefined,
        createdAt: Date.now(),
        lastUsedAt: undefined,
        lastCheckedAt: undefined
      }

      await AccountDB.create(newAccount)
      account = newAccount
      console.log(`✅ 新账号已创建: ${email}`)
    } else {
      console.log(`📝 账号已存在，更新凭证: ${email}`)

      // 更新现有账号的OAuth信息
      await AccountDB.update(account.id, {
        credentials: {
          ...account.credentials,
          accessToken: ssoResult.accessToken,
          ssoToken: x_amz_sso_authn,
          refreshToken: ssoResult.refreshToken || account.credentials.refreshToken,
          clientId: ssoResult.clientId || account.credentials.clientId,
          clientSecret: ssoResult.clientSecret || account.credentials.clientSecret,
          region: ssoResult.region || account.credentials.region || region,
          authMethod: 'IdC'
        },
        status: 'active',
        lastError: undefined,
        consecutiveFailures: 0,
        isActive: true,
        lastCheckedAt: Date.now()
      })

      console.log(`✅ 凭证已更新: ${email}`)
    }

    console.log(`✅ 支持自动刷新: 是`)
    console.log('='.repeat(60))

    res.json({
      success: true,
      message: account ? 'Token 绑定成功，账号已激活，支持自动刷新' : '账号创建成功，支持自动刷新',
      can_auto_refresh: true,
      account: {
        email: account.email,
        userId: account.userId,
        nickname: account.nickname,
        idp: account.idp,
        subscription: account.subscription,
        usage: account.usage,
        canAutoRefresh: !!(account.credentials.refreshToken && account.credentials.clientId && account.credentials.clientSecret)
      }
    })
  } catch (error: any) {
    console.error('提交 Token 失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}


/**
 * AWS SSO 设备授权流程
 * 使用Bearer Token（x-amz-sso_authn）执行完整的OAuth设备授权
 * 完全复用应用端的ssoDeviceAuth逻辑
 */
interface SsoAuthResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  clientId?: string
  clientSecret?: string
  region?: string
  expiresIn?: number
  error?: string
}

async function ssoDeviceAuth(bearerToken: string, region: string = 'us-east-1'): Promise<SsoAuthResult> {
  const oidcBase = `https://oidc.${region}.amazonaws.com`
  const portalBase = 'https://portal.sso.us-east-1.amazonaws.com'
  const startUrl = 'https://view.awsapps.com/start'
  const scopes = ['codewhisperer:analysis', 'codewhisperer:completions', 'codewhisperer:conversations', 'codewhisperer:taskassist', 'codewhisperer:transformations']

  let clientId: string, clientSecret: string
  let deviceCode: string, userCode: string
  let deviceSessionToken: string
  let interval = 1

  // Step 1: 注册 OIDC 客户端
  console.log('[SSO] Step 1: Registering OIDC client...')
  try {
    const regRes = await fetch(`${oidcBase}/client/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: 'Kiro Account Manager',
        clientType: 'public',
        scopes,
        grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'],
        issuerUrl: startUrl
      })
    })
    if (!regRes.ok) throw new Error(`Register failed: ${regRes.status}`)
    const regData = await regRes.json() as { clientId: string; clientSecret: string }
    clientId = regData.clientId
    clientSecret = regData.clientSecret
    console.log(`[SSO] Client registered: ${clientId.substring(0, 30)}...`)
  } catch (e) {
    return { success: false, error: `注册客户端失败: ${e}` }
  }

  // Step 2: 发起设备授权
  console.log('[SSO] Step 2: Starting device authorization...')
  try {
    const devRes = await fetch(`${oidcBase}/device_authorization`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret, startUrl })
    })
    if (!devRes.ok) throw new Error(`Device auth failed: ${devRes.status}`)
    const devData = await devRes.json() as { deviceCode: string; userCode: string; interval?: number }
    deviceCode = devData.deviceCode
    userCode = devData.userCode
    interval = devData.interval || 1
    console.log(`[SSO] Device code obtained, user_code: ${userCode}`)
  } catch (e) {
    return { success: false, error: `设备授权失败: ${e}` }
  }

  // Step 3: 验证 Bearer Token (whoAmI)
  console.log('[SSO] Step 3: Verifying bearer token...')
  try {
    const whoRes = await fetch(`${portalBase}/token/whoAmI`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${bearerToken}`, 'Accept': 'application/json' }
    })
    if (!whoRes.ok) throw new Error(`whoAmI failed: ${whoRes.status}`)
    console.log('[SSO] Bearer token verified')
  } catch (e) {
    return { success: false, error: `Token 验证失败: ${e}` }
  }

  // Step 4: 获取设备会话令牌
  console.log('[SSO] Step 4: Getting device session token...')
  try {
    const sessRes = await fetch(`${portalBase}/session/device`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    if (!sessRes.ok) throw new Error(`Device session failed: ${sessRes.status}`)
    const sessData = await sessRes.json() as { token: string }
    deviceSessionToken = sessData.token
    console.log('[SSO] Device session token obtained')
  } catch (e) {
    return { success: false, error: `获取设备会话失败: ${e}` }
  }

  // Step 5: 接受用户代码
  console.log('[SSO] Step 5: Accepting user code...')
  let deviceContext: { deviceContextId?: string; clientId?: string; clientType?: string } | null = null
  try {
    const acceptRes = await fetch(`${oidcBase}/device_authorization/accept_user_code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Referer': 'https://view.awsapps.com/' },
      body: JSON.stringify({ userCode, userSessionId: deviceSessionToken })
    })
    if (!acceptRes.ok) throw new Error(`Accept user code failed: ${acceptRes.status}`)
    const acceptData = await acceptRes.json() as { deviceContext?: { deviceContextId?: string; clientId?: string; clientType?: string } }
    deviceContext = acceptData.deviceContext || null
    console.log('[SSO] User code accepted')
  } catch (e) {
    return { success: false, error: `接受用户代码失败: ${e}` }
  }

  // Step 6: 批准授权
  if (deviceContext?.deviceContextId) {
    console.log('[SSO] Step 6: Approving authorization...')
    try {
      const approveRes = await fetch(`${oidcBase}/device_authorization/associate_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Referer': 'https://view.awsapps.com/' },
        body: JSON.stringify({
          deviceContext: {
            deviceContextId: deviceContext.deviceContextId,
            clientId: deviceContext.clientId || clientId,
            clientType: deviceContext.clientType || 'public'
          },
          userSessionId: deviceSessionToken
        })
      })
      if (!approveRes.ok) throw new Error(`Approve failed: ${approveRes.status}`)
      console.log('[SSO] Authorization approved')
    } catch (e) {
      return { success: false, error: `批准授权失败: ${e}` }
    }
  }

  // Step 7: 轮询获取 Token
  console.log('[SSO] Step 7: Polling for token...')
  const startTime = Date.now()
  const timeout = 120000 // 2 分钟超时

  while (Date.now() - startTime < timeout) {
    await new Promise(r => setTimeout(r, interval * 1000))
    
    try {
      const tokenRes = await fetch(`${oidcBase}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientSecret,
          grantType: 'urn:ietf:params:oauth:grant-type:device_code',
          deviceCode
        })
      })

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json() as { accessToken: string; refreshToken: string; expiresIn?: number }
        console.log('[SSO] Token obtained successfully!')

        // ✅ 验证 Access Token 格式
        const validation = validateAccessToken(tokenData.accessToken)
        logTokenValidation('SSO Device Auth - Access Token', tokenData.accessToken, validation)

        if (!validation.valid) {
          console.error('[SSO] ⚠️  获取的 Access Token 格式异常，但仍然继续（可能是新格式）')
        }

        return {
          success: true,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          clientId,
          clientSecret,
          region,
          expiresIn: tokenData.expiresIn
        }
      }

      if (tokenRes.status === 400) {
        const errData = await tokenRes.json() as { error?: string }
        if (errData.error === 'authorization_pending') {
          continue // 继续轮询
        } else if (errData.error === 'slow_down') {
          interval += 5
        } else {
          return { success: false, error: `Token 获取失败: ${errData.error}` }
        }
      }
    } catch (e) {
      console.error('[SSO] Token poll error:', e)
    }
  }

  return { success: false, error: '授权超时，请重试' }
}

/**
 * 刷新账号 Token
 * 完全复用应用端的refreshOidcToken逻辑
 */
export async function refreshToken(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    // 查找账号
    const account = await AccountDB.getById(id as string)
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: '账号不存在'
      })
    }
    
    // 检查是否有必需的OAuth凭证
    if (!account.credentials.refreshToken || !account.credentials.clientId) {
      return res.status(400).json({
        success: false,
        error: '该账号缺少OAuth凭证，无法自动刷新',
        message: '请使用应用端重新登录并导入Token，以获取完整的OAuth信息',
        needReimport: true,
        missingFields: {
          refresh_token: !account.credentials.refreshToken,
          client_id: !account.credentials.clientId,
          client_secret: !account.credentials.clientSecret
        }
      })
    }
    
    // 完全复用应用端的refreshOidcToken逻辑
    const region = account.credentials.region || 'us-east-1'
    const url = `https://oidc.${region}.amazonaws.com/token`
    
    console.log(`[OIDC] Refreshing token for: ${account.email}`)
    console.log(`[OIDC] Client ID: ${account.credentials.clientId.substring(0, 20)}...`)
    
    const payload = {
      clientId: account.credentials.clientId,
      clientSecret: account.credentials.clientSecret,
      refreshToken: account.credentials.refreshToken,
      grantType: 'refresh_token'
    }
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[OIDC] Refresh failed: ${response.status} - ${errorText}`)
        
        return res.status(response.status).json({
          success: false,
          error: `刷新失败: HTTP ${response.status}`,
          details: errorText,
          needReimport: response.status === 401
        })
      }
      
      const data = await response.json() as OidcTokenResponse
      console.log(`[OIDC] Token refreshed successfully, expires in ${data.expiresIn}s`)
      
      // ✅ 只更新 access_token，保留原始的 sso_token
      await AccountDB.updateAccessToken(id as string, data.accessToken)
      
      // 如果返回了新的refresh_token，也更新它和 access_token
      if (data.refreshToken && data.refreshToken !== account.credentials.refreshToken) {
        await AccountDB.updateOAuthCredentials(id as string, {
          access_token: data.accessToken,
          refresh_token: data.refreshToken
        })
        console.log(`[OIDC] Access token and refresh token updated`)
      }
      
      // 🆕 刷新成功后，同步使用量信息
      console.log(`[OIDC] Syncing usage data...`)
      const { syncAccountUsage } = await import('../services/kiro-api.service')
      const syncResult = await syncAccountUsage(data.accessToken, account.idp || 'BuilderId')
      
      if (syncResult.success && syncResult.data) {
        await AccountDB.updateExtendedInfo(id as string, syncResult.data)
        console.log(`[OIDC] Usage data synced successfully`)
      } else {
        console.warn(`[OIDC] Usage sync failed: ${syncResult.error}`)
      }
      
      // ✅ 重置错误计数器和错误信息（刷新成功后）
      await AccountDB.update(id as string, {
        ...account,
        credentials: {
          ...account.credentials,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || account.credentials.refreshToken,
          expiresAt: Date.now() + data.expiresIn * 1000
        },
        consecutiveFailures: 0,
        lastError: undefined,
        lastCheckedAt: Date.now()
      })
      console.log(`[OIDC] Error counter reset to 0`)
      
      res.json({
        success: true,
        message: 'Token刷新成功，使用量已同步',
        account: {
          email: account.email,
          expiresIn: data.expiresIn
        }
      })
    } catch (error: any) {
      console.error(`[OIDC] Refresh error:`, error)
      res.status(500).json({
        success: false,
        error: error.message || 'Unknown error'
      })
    }
  } catch (error: any) {
    console.error('刷新 Token 失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 刷新所有账号的 Token
 * 手动触发批量刷新
 */
export async function refreshAllTokens(req: Request, res: Response) {
  try {
    console.log('\n🔄 手动触发批量刷新...')
    
    const { refreshAllAccounts } = await import('../services/auto-refresh-optimized.service')
    const result = await refreshAllAccounts()
    
    res.json({
      success: true,
      message: `刷新完成：成功 ${result.success} 个，失败 ${result.failed} 个`,
      successCount: result.success,
      failedCount: result.failed,
      details: result.details
    })
  } catch (error: any) {
    console.error('批量刷新失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 请求获取账号
 * 应用端调用此接口获取可用账号
 */
export async function requestAccount(req: Request, res: Response) {
  try {
    const { device_id, device_name }: AccountRequestDTO = req.body
    
    // 验证设备 ID
    if (!device_id) {
      return res.status(400).json({
        success: false,
        error: '设备 ID 不能为空'
      })
    }
    
    // 查找可用账号（状态为 active 且有 token）
    const accounts = await AccountDB.getAll()
    const availableAccount = accounts.find(
      a => a.status === 'active' && a.credentials.accessToken && !a.deviceId
    )
    
    if (!availableAccount) {
      return res.status(404).json({
        success: false,
        message: '暂无可用账号，请稍后再试'
      })
    }
    
    // 分配账号给设备
    await AccountDB.assignToDevice(availableAccount.id, device_id, device_name)
    
    console.log(`📤 账号已分发: ${availableAccount.email} → 设备: ${device_id}`)
    
    res.json({
      success: true,
      account: {
        id: availableAccount.id,
        email: availableAccount.email,
        password: availableAccount.password,
        accessToken: availableAccount.credentials.accessToken,
        assigned_at: new Date().toISOString()
      },
      message: '账号获取成功'
    })
  } catch (error: any) {
    console.error('分发账号失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 从应用端导入完整账号信息
 * 支持应用端导出的完整JSON格式
 */
export async function importFromApp(req: Request, res: Response) {
  try {
    const data = req.body as ImportFromAppDTO
    
    // 验证必填字段
    if (!data.account || !data.account.email || !data.account.credentials) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：account.email 和 account.credentials'
      })
    }
    
    const acc = data.account
    const cred = acc.credentials
    const sub = acc.subscription
    const usage = acc.usage
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📥 从应用端导入完整账号`)
    console.log(`📧 邮箱: ${acc.email}`)
    console.log(`🆔 用户ID: ${acc.userId || '未提供'}`)
    console.log(`👤 昵称: ${acc.nickname || '未提供'}`)
    console.log(`🔐 IDP: ${acc.idp || 'BuilderId'}`)
    console.log(`📦 订阅: ${sub?.title || sub?.type || '未知'}`)
    console.log(`📊 使用: ${usage?.current || 0}/${usage?.limit || 0}`)
    console.log(`⏰ 剩余天数: ${sub?.daysRemaining !== undefined ? sub.daysRemaining : '未知'}`)
    console.log(`🔄 Refresh Token: ${cred.refreshToken ? '✅' : '❌'}`)
    console.log(`🔑 Client ID: ${cred.clientId ? '✅' : '❌'}`)
    console.log(`🔐 Client Secret: ${cred.clientSecret ? '✅' : '❌'}`)
    console.log('='.repeat(60))
    
    // 查找账号
    const accounts = await AccountDB.getAll()
    let existingAccount = accounts.find(a => a.email === acc.email || (acc.userId && a.userId === acc.userId))
    
    // 使用映射工具转换数据
    const { importDTOToAccount } = await import('../utils/account-mapper')
    const accountData = importDTOToAccount(data, existingAccount?.password || '')
    
    // 保留现有账号的ID
    if (existingAccount) {
      accountData.id = existingAccount.id
    }
    
    let account: Account
    if (!existingAccount) {
      // 创建新账号
      account = await AccountDB.create(accountData)
      console.log(`✅ 新账号已创建: ${acc.email}`)
    } else {
      // 更新现有账号
      await AccountDB.update(existingAccount.id, accountData)
      account = accountData
      console.log(`✅ 账号已更新: ${acc.email}`)
    }
    
    const canAutoRefresh = !!(cred.refreshToken && cred.clientId && cred.clientSecret)
    console.log(`✅ 支持自动刷新: ${canAutoRefresh ? '是' : '否'}`)
    console.log('='.repeat(60))
    
    res.json({
      success: true,
      message: '账号导入成功',
      account: {
        id: account.id,
        email: acc.email,
        userId: acc.userId,
        nickname: acc.nickname,
        idp: acc.idp,
        subscription: {
          type: sub?.type,
          title: sub?.title,
          daysRemaining: sub?.daysRemaining
        },
        usage: {
          current: usage?.current,
          limit: usage?.limit,
          percentUsed: usage?.percentUsed
        },
        status: 'active',
        canAutoRefresh
      }
    })
  } catch (error: any) {
    console.error('导入账号失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 同步账号使用量
 * 调用 Kiro API 获取最新的使用量和订阅信息
 */
export async function syncAccountUsage(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    // 查找账号
    const account = await AccountDB.getById(id as string)
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: '账号不存在'
      })
    }
    
    if (!account.credentials.accessToken) {
      return res.status(400).json({
        success: false,
        error: '账号没有 Access Token'
      })
    }
    
    console.log(`[Sync] Syncing usage for: ${account.email}`)

    // ✅ 主动检测 Token 格式，错误格式提前刷新
    const { validateAccessToken } = await import('../utils/token-validator')
    const validation = validateAccessToken(account.credentials.accessToken)

    let currentAccessToken = account.credentials.accessToken

    // 如果 Token 格式错误且有刷新凭证，主动刷新
    if (!validation.valid && account.credentials.refreshToken && account.credentials.clientId) {
      console.log(`[Sync] ⚠️  检测到错误的 Token 格式 (${validation.type})，主动刷新...`)
      console.log(`[Sync] 问题: ${validation.issue}`)

      const region = account.credentials.region || 'us-east-1'
      const url = `https://oidc.${region}.amazonaws.com/token`

      try {
        const refreshResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: account.credentials.clientId,
            clientSecret: account.credentialet,
            refreshToken: account.credentials.refreshToken,
            grantType: 'refresh_token'
          })
        })

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json() as OidcTokenResponse
          console.log(`[Sync] ✅ Token 刷新成功，长度: ${refreshData.accessToken.length}`)

          // 验证新 Token
          const newValidation = validateAccessToken(refreshData.accessToken)
          if (newValidation.valid) {
            console.log(`[Sync] ✅ 新 Token 格式正确 (${newValidation.type})`)
          } else {
            console.log(`[Sync] ⚠️  新 Token 格式仍然异常: ${newValidation.issue}`)
          }

          // 更新数据库
          await AccountDB.updateAccessToken(id as string, refreshData.accessToken)
          currentAccessToken = refreshData.accessToken
        } else {
          console.log(`[Sync] ❌ Token 刷新失败: ${refreshResponse.status}`)
        }
      } catch (refreshError: any) {
        console.error(`[Sync] Token 刷新异常:`, refreshError.message)
      }
    }

    // 使用当前 Token（可能是刚刷新的）调用 API
    const { syncAccountUsage: syncUsage } = await import('../services/kiro-api.service')
    const result = await syncUsage(currentAccessToken, account.idp)

    if (!result.success) {
      // 如果还是 401 错误，再尝试刷新一次（兜底逻辑）
      if (result.error?.includes('401') && account.credentials.refreshToken && account.credentials.clientId && currentAccessToken === account.credentials.accessToken) {
        console.log(`[Sync] API 调用失败 401，再次尝试刷新 Token...`)
        
        // 刷新 Token
        const region = account.credentials.region || 'us-east-1'
        const url = `https://oidc.${region}.amazonaws.com/token`
        
        const refreshResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: account.credentials.clientId,
            clientSecret: account.credentials.clientSecret,
            refreshToken: account.credentials.refreshToken,
            grantType: 'refresh_token'
          })
        })
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json() as OidcTokenResponse
          
          // ✅ 只更新 access_token
          await AccountDB.updateAccessToken(id as string, refreshData.accessToken)
          
          // 用新 Token 重试同步
          const retryResult = await syncUsage(refreshData.accessToken, account.idp || 'BuilderId')
          
          if (retryResult.success && retryResult.data) {
            await AccountDB.updateExtendedInfo(id as string, retryResult.data)
            
            return res.json({
              success: true,
              message: '使用量同步成功（Token 已自动刷新）',
              data: retryResult.data
            })
          }
        }
      }
      
      return res.status(500).json({
        success: false,
        error: result.error || '同步失败'
      })
    }
    
    // 更新数据库
    if (result.data) {
      await AccountDB.updateExtendedInfo(id as string, result.data)
    }
    
    res.json({
      success: true,
      message: '使用量同步成功',
      data: result.data
    })
  } catch (error: any) {
    console.error('同步使用量失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 批量同步所有账号的使用量
 */
export async function syncAllAccountsUsage(req: Request, res: Response) {
  try {
    console.log('\n🔄 批量同步使用量...')
    
    const accounts = await AccountDB.getAll()
    const syncableAccounts = accounts.filter(acc => acc.credentials.accessToken)
    
    if (syncableAccounts.length === 0) {
      return res.json({
        success: true,
        message: '没有可同步的账号',
        successCount: 0,
        failedCount: 0
      })
    }
    
    console.log(`📊 可同步账号: ${syncableAccounts.length}`)
    
    const { syncAccountUsage: syncUsage } = await import('../services/kiro-api.service')
    
    let successCount = 0
    let failedCount = 0
    const details: Array<{ email: string; success: boolean; error?: string }> = []
    
    // 并发同步（限制并发数为 5）
    const concurrency = 5
    for (let i = 0; i < syncableAccounts.length; i += concurrency) {
      const batch = syncableAccounts.slice(i, i + concurrency)
      
      const results = await Promise.allSettled(
        batch.map(async (account) => {
          const result = await syncUsage(account.credentials.accessToken, account.idp)
          
          if (result.success && result.data) {
            await AccountDB.updateExtendedInfo(account.id, result.data)
            return { email: account.email, success: true }
          } else {
            return { email: account.email, success: false, error: result.error }
          }
        })
      )
      
      results.forEach((result, index) => {
        const account = batch[index]
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++
          details.push({ email: account.email, success: true })
          console.log(`  ✅ ${account.email}`)
        } else {
          failedCount++
          const error = result.status === 'rejected' ? result.reason.message : result.value.error
          details.push({ email: account.email, success: false, error })
          console.log(`  ❌ ${account.email}: ${error}`)
        }
      })
    }
    
    console.log(`\n✅ 同步完成: 成功 ${successCount} 个，失败 ${failedCount} 个\n`)
    
    res.json({
      success: true,
      message: `同步完成：成功 ${successCount} 个，失败 ${failedCount} 个`,
      successCount,
      failedCount,
      details
    })
  } catch (error: any) {
    console.error('批量同步失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取账号统计（按状态分类）
 */
export async function getAccountStatsByStatus(req: Request, res: Response) {
  try {
    const accounts = await AccountDB.getAll()
    
    const stats = {
      total: accounts.length,
      pending: accounts.filter(a => a.status === 'pending').length,
      active: accounts.filter(a => a.status === 'active').length,
      assigned: accounts.filter(a => a.status === 'assigned').length,
      expired: accounts.filter(a => a.status === 'expired').length,
      with_token: accounts.filter(a => a.credentials.accessToken).length,
      available: accounts.filter(a => a.status === 'active' && a.credentials.accessToken && !a.deviceId).length
    }
    
    res.json({
      success: true,
      stats
    })
  } catch (error: any) {
    console.error('获取统计失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 重置账号错误状态
 */
export async function resetAccountError(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    const account = await AccountDB.getById(id as string)
    if (!account) {
      return res.status(404).json({
        success: false,
        error: '账号不存在'
      })
    }
    
    // 重置错误状态
    await AccountDB.update(id as string, {
      ...account,
      lastError: undefined,
      consecutiveFailures: 0,
      lastCheckedAt: Date.now()
    })
    
    console.log(`✅ 已重置账号错误状态: ${account.email}`)
    
    res.json({
      success: true,
      message: '错误状态已重置',
      account: {
        id: account.id,
        email: account.email
      }
    })
  } catch (error: any) {
    console.error('重置错误状态失败:', error)
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
    const { accountIds } = req.body as { accountIds: string[] }
    
    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供账号ID列表'
      })
    }
    
    console.log(`\n🔄 批量重置错误状态: ${accountIds.length} 个账号`)
    
    let successCount = 0
    let failedCount = 0
    
    for (const id of accountIds) {
      try {
        const account = await AccountDB.getById(id)
        if (!account) {
          failedCount++
          continue
        }
        
        await AccountDB.update(id, {
          ...account,
          lastError: undefined,
          consecutiveFailures: 0,
          lastCheckedAt: Date.now()
        })
        
        successCount++
        console.log(`  ✅ ${account.email}`)
      } catch (e) {
        failedCount++
        console.log(`  ❌ ${id}`)
      }
    }
    
    console.log(`\n✅ 重置完成: 成功 ${successCount} 个，失败 ${failedCount} 个\n`)
    
    res.json({
      success: true,
      message: `重置完成：成功 ${successCount} 个，失败 ${failedCount} 个`,
      successCount,
      failedCount
    })
  } catch (error: any) {
    console.error('批量重置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
