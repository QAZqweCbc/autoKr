/**
 * Token 自动刷新服务
 * 定期检查并刷新即将过期的账号 Token
 */

import { loadConfig } from './config.service'
import { AccountDB } from './database.adapter'
import axios from 'axios'

let refreshTimer: NodeJS.Timeout | null = null
let isRefreshing = false

/**
 * 启动自动刷新调度器
 */
export function startAutoRefreshScheduler() {
  console.log('🔄 启动 Token 自动刷新调度器...')
  
  // 加载配置
  const config = loadConfig()
  const autoRefresh = config.autoRefresh
  
  if (!autoRefresh || !autoRefresh.enabled) {
    console.log('⏸️  自动刷新未启用')
    return
  }
  
  console.log(`✅ 自动刷新已启用，间隔: ${autoRefresh.interval} 分钟，并发: ${autoRefresh.concurrency}`)
  
  // 清除旧的定时器
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  
  // 设置新的定时器
  const intervalMs = autoRefresh.interval * 60 * 1000
  refreshTimer = setInterval(async () => {
    if (!isRefreshing) {
      await performAutoRefresh()
    }
  }, intervalMs)
  
  // 立即执行一次（可选）
  // performAutoRefresh()
}

/**
 * 停止自动刷新调度器
 */
export function stopAutoRefreshScheduler() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
    console.log('⏹️  自动刷新调度器已停止')
  }
}

/**
 * 重新加载调度器（配置更新时调用）
 */
export function reloadScheduler() {
  console.log('🔄 重新加载自动刷新调度器...')
  stopAutoRefreshScheduler()
  startAutoRefreshScheduler()
}

/**
 * 执行自动刷新
 */
async function performAutoRefresh() {
  if (isRefreshing) {
    console.log('⏳ 上次刷新尚未完成，跳过本次刷新')
    return
  }
  
  isRefreshing = true
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔄 开始自动刷新 Token - ${new Date().toLocaleString('zh-CN')}`)
  console.log('='.repeat(60))
  
  try {
    const config = loadConfig()
    const concurrency = config.autoRefresh?.concurrency || 10
    
    // 获取所有有 OAuth 凭证的账号
    const accounts = await AccountDB.getAll()
    const refreshableAccounts = accounts.filter(
      acc => acc.credentials.refreshToken && acc.credentials.clientId && acc.credentials.clientSecret
    )
    
    console.log(`📊 总账号数: ${accounts.length}`)
    console.log(`✅ 可刷新账号: ${refreshableAccounts.length}`)
    console.log(`🚀 并发数: ${concurrency}`)
    
    if (refreshableAccounts.length === 0) {
      console.log('⚠️  没有可刷新的账号')
      return
    }
    
    // 分批刷新
    let successCount = 0
    let failedCount = 0
    
    for (let i = 0; i < refreshableAccounts.length; i += concurrency) {
      const batch = refreshableAccounts.slice(i, i + concurrency)
      console.log(`\n📦 处理批次 ${Math.floor(i / concurrency) + 1}/${Math.ceil(refreshableAccounts.length / concurrency)} (${batch.length} 个账号)`)
      
      const results = await Promise.allSettled(
        batch.map(account => refreshAccountToken(account.id))
      )
      
      results.forEach((result, index) => {
        const account = batch[index]
        if (result.status === 'fulfilled' && result.value) {
          successCount++
          console.log(`  ✅ ${account.email} - 刷新成功`)
        } else {
          failedCount++
          const reason = result.status === 'rejected' ? result.reason : '未知错误'
          console.log(`  ❌ ${account.email} - 刷新失败: ${reason}`)
        }
      })
    }
    
    // 更新最后刷新时间
    config.autoRefresh!.lastRefreshTime = new Date().toISOString()
    const { saveConfig } = await import('./config.service')
    saveConfig(config)
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`✅ 自动刷新完成`)
    console.log(`   成功: ${successCount} 个`)
    console.log(`   失败: ${failedCount} 个`)
    console.log('='.repeat(60) + '\n')
  } catch (error: any) {
    console.error('❌ 自动刷新失败:', error.message)
  } finally {
    isRefreshing = false
  }
}

/**
 * 刷新单个账号的 Token
 */
async function refreshAccountToken(accountId: string): Promise<boolean> {
  try {
    const account = await AccountDB.getById(accountId)
    if (!account) {
      throw new Error('账号不存在')
    }
    
    if (!account.credentials.refreshToken || !account.credentials.clientId || !account.credentials.clientSecret) {
      throw new Error('缺少 OAuth 凭证')
    }
    
    // 调用 AWS SSO Token 刷新 API
    const response = await axios.post(
      'https://oidc.us-east-1.amazonaws.com/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: account.credentials.clientId,
        client_secret: account.credentials.clientSecret,
        refresh_token: account.credentials.refreshToken
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    )
    
    if (!response.data.access_token) {
      throw new Error('刷新响应中缺少 access_token')
    }
    
    // 更新账号的 Token
    const expiresIn = response.data.expires_in || 3600
    const expiresAt = Date.now() + expiresIn * 1000
    
    // ✅ 只更新 access_token，保留原始的 sso_token
    await AccountDB.updateAccessToken(accountId, response.data.access_token)
    
    // 如果返回了新的 refresh_token，也更新它
    if (response.data.refresh_token && response.data.refresh_token !== account.credentials.refreshToken) {
      await AccountDB.updateOAuthCredentials(accountId, {
        refresh_token: response.data.refresh_token
      })
    }
    
    return true
  } catch (error: any) {
    throw new Error(error.response?.data?.error || error.message)
  }
}

/**
 * 手动刷新所有账号
 */
export async function refreshAllAccounts(): Promise<{
  success: number
  failed: number
  details: Array<{ email: string; success: boolean; error?: string }>
}> {
  const config = loadConfig()
  const concurrency = config.autoRefresh?.concurrency || 10
  
  // 获取所有有 OAuth 凭证的账号
  const accounts = await AccountDB.getAll()
  const refreshableAccounts = accounts.filter(
    acc => acc.credentials.refreshToken && acc.credentials.clientId && acc.credentials.clientSecret
  )
  
  if (refreshableAccounts.length === 0) {
    return { success: 0, failed: 0, details: [] }
  }
  
  let successCount = 0
  let failedCount = 0
  const details: Array<{ email: string; success: boolean; error?: string }> = []
  
  // 分批刷新
  for (let i = 0; i < refreshableAccounts.length; i += concurrency) {
    const batch = refreshableAccounts.slice(i, i + concurrency)
    
    const results = await Promise.allSettled(
      batch.map(account => refreshAccountToken(account.id))
    )
    
    results.forEach((result, index) => {
      const account = batch[index]
      if (result.status === 'fulfilled' && result.value) {
        successCount++
        details.push({ email: account.email, success: true })
      } else {
        failedCount++
        const error = result.status === 'rejected' ? result.reason.message : '未知错误'
        details.push({ email: account.email, success: false, error })
      }
    })
  }
  
  // 更新最后刷新时间
  config.autoRefresh = config.autoRefresh || {
    enabled: false,
    interval: 30,
    concurrency: 10,
    lastRefreshTime: null
  }
  config.autoRefresh.lastRefreshTime = new Date().toISOString()
  const { saveConfig } = await import('./config.service')
  saveConfig(config)
  
  return { success: successCount, failed: failedCount, details }
}
