/**
 * Token 自动刷新服务 - 优化版
 * 
 * 核心优化：
 * 1. 智能过期检测 - 只刷新即将过期的 Token
 * 2. 账号状态管理 - 跳过已知失败的账号
 * 3. 刷新后同步 - 自动同步账号信息和检测封禁
 * 4. 详细日志 - 记录刷新历史和性能指标
 */

import { loadConfig } from './config.service'
import { AccountDB } from './database.adapter'
import { Account } from '../models/account.model'
import axios from 'axios'
import { 
  createRefreshLogger, 
  formatRefreshLog, 
  generateLogSummary,
  RefreshLogger 
} from './refresh-logger.service'
import { getHealthStatus } from './health-check.service'
import { sendAlertSummary } from './alert-notification.service'
import {
  emitRefreshStart,
  emitRefreshAccount,
  emitRefreshComplete
} from '../websocket/socket.handler'
import { RefreshErrorChain } from '../utils/error-chain'
import {
  KIRO_AUTH_ENDPOINT,
  REFRESH_CONFIG,
  TIMEOUT_CONFIG
} from '../config/constants'
// 新增：导入优化服务
import { LockManagerFactory, withLock } from './distributed-lock.service'
import { createRefreshPriorityQueue } from './priority-queue.service'
import {
  backoffManager,
  recordRefreshFailure,
  recordRefreshSuccess,
  filterRetryableAccounts
} from './exponential-backoff.service'

// 常量配置（使用全局配置）
const TOKEN_REFRESH_BEFORE_EXPIRY = REFRESH_CONFIG.TOKEN_EXPIRY_BUFFER
const BATCH_DELAY = REFRESH_CONFIG.BATCH_DELAY
const MAX_CONSECUTIVE_FAILURES = 3 // 最大连续失败次数

let refreshTimer: NodeJS.Timeout | null = null
let isRefreshing = false

/**
 * 刷新详情
 */
interface RefreshDetail {
  accountId: string
  email: string
  success: boolean
  error?: string
  duration: number
  skipped?: boolean
  skipReason?: string
  syncSuccess?: boolean      // 同步是否成功
  syncError?: string         // 同步错误信息
}

/**
 * 刷新结果
 */
interface RefreshResult {
  totalAccounts: number
  successCount: number
  failedCount: number
  skippedCount: number
  duration: number
  details: RefreshDetail[]
}

/**
 * 启动自动刷新调度器
 */
export function startAutoRefreshScheduler() {
  console.log('🔄 启动 Token 自动刷新调度器（优化版）...')
  
  const config = loadConfig()
  const autoRefresh = config.autoRefresh
  
  if (!autoRefresh || !autoRefresh.enabled) {
    console.log('⏸️  自动刷新未启用')
    return
  }
  
  console.log(`✅ 自动刷新已启用`)
  console.log(`   刷新间隔: ${autoRefresh.interval} 分钟`)
  console.log(`   并发数: ${autoRefresh.concurrency}`)
  console.log(`   过期前刷新: ${TOKEN_REFRESH_BEFORE_EXPIRY / 60000} 分钟`)
  
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
 * @param oldConfig 可选的旧配置，用于对比变更
 */
export function reloadScheduler(oldConfig?: any) {
  console.log('\n' + '='.repeat(60))
  console.log('🔄 配置热更新触发')
  console.log('='.repeat(60))
  
  // 如果没有提供旧配置，尝试从当前配置获取
  const previousConfig = oldConfig || loadConfig()
  const oldAutoRefresh = previousConfig.autoRefresh
  
  console.log('📋 当前配置:')
  if (oldAutoRefresh) {
    console.log(`   启用状态: ${oldAutoRefresh.enabled ? '✅ 已启用' : '⏸️  已禁用'}`)
    console.log(`   刷新间隔: ${oldAutoRefresh.interval} 分钟`)
    console.log(`   并发数: ${oldAutoRefresh.concurrency}`)
    console.log(`   过期前刷新: ${oldAutoRefresh.refreshBeforeExpiry ?? 5} 分钟`)
  }
  
  console.log('\n🔄 正在重启调度器...')
  stopAutoRefreshScheduler()
  
  // 重新加载配置
  const newConfig = loadConfig()
  const newAutoRefresh = newConfig.autoRefresh
  
  // 检测配置变更
  const changes: string[] = []
  if (oldAutoRefresh && newAutoRefresh) {
    if (oldAutoRefresh.enabled !== newAutoRefresh.enabled) {
      changes.push(`启用状态: ${oldAutoRefresh.enabled ? '已启用' : '已禁用'} → ${newAutoRefresh.enabled ? '已启用' : '已禁用'}`)
    }
    if (oldAutoRefresh.interval !== newAutoRefresh.interval) {
      changes.push(`刷新间隔: ${oldAutoRefresh.interval} → ${newAutoRefresh.interval} 分钟`)
    }
    if (oldAutoRefresh.concurrency !== newAutoRefresh.concurrency) {
      changes.push(`并发数: ${oldAutoRefresh.concurrency} → ${newAutoRefresh.concurrency}`)
    }
    const oldRefreshBefore = oldAutoRefresh.refreshBeforeExpiry ?? 5
    const newRefreshBefore = newAutoRefresh.refreshBeforeExpiry ?? 5
    if (oldRefreshBefore !== newRefreshBefore) {
      changes.push(`过期前刷新: ${oldRefreshBefore} → ${newRefreshBefore} 分钟`)
    }
    const oldMaxFailures = oldAutoRefresh.maxConsecutiveFailures ?? 3
    const newMaxFailures = newAutoRefresh.maxConsecutiveFailures ?? 3
    if (oldMaxFailures !== newMaxFailures) {
      changes.push(`最大连续失败: ${oldMaxFailures} → ${newMaxFailures} 次`)
    }
    const oldRetention = oldAutoRefresh.logRetentionDays ?? 30
    const newRetention = newAutoRefresh.logRetentionDays ?? 30
    if (oldRetention !== newRetention) {
      changes.push(`日志保留: ${oldRetention} → ${newRetention} 天`)
    }
  }
  
  if (changes.length > 0) {
    console.log('\n📝 配置变更:')
    changes.forEach(change => console.log(`   - ${change}`))
  } else {
    console.log('\n📝 配置无变更（可能是首次启动或重启）')
  }
  
  startAutoRefreshScheduler()
  
  console.log('\n✅ 调度器重启完成')
  console.log(`   变更时间: ${new Date().toLocaleString('zh-CN')}`)
  console.log('='.repeat(60) + '\n')
}

/**
 * 执行自动刷新
 */
async function performAutoRefresh(): Promise<RefreshResult> {
  if (isRefreshing) {
    console.log('⏳ 上次刷新尚未完成，跳过本次刷新')
    return {
      totalAccounts: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      duration: 0,
      details: []
    }
  }

  isRefreshing = true
  const startTime = Date.now()

  // 创建日志记录器
  const logger = createRefreshLogger()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔄 开始智能刷新 Token - ${new Date().toLocaleString('zh-CN')}`)
  console.log('='.repeat(60))

  try {
    const config = loadConfig()
    const concurrency = config.autoRefresh?.concurrency || 10
    const enableWebSocket = config.autoRefresh?.enableWebSocket ?? false

    // 🆕 新增：分布式锁配置
    const lockConfig = config.autoRefresh?.distributedLock || { enabled: false }
    const backoffConfig = config.autoRefresh?.exponentialBackoff || { enabled: false }
    const priorityQueueConfig = config.autoRefresh?.priorityQueue || { enabled: false }

    // 🆕 新增：使用分布式锁防止多实例重复刷新
    if (lockConfig.enabled) {
      console.log('🔒 尝试获取分布式锁...')
      const lock = LockManagerFactory.createLock({
        key: 'token_refresh_lock',
        ttl: lockConfig.ttl || 600_000,
        retryDelay: lockConfig.retryDelay || 1000,
        retryTimes: lockConfig.retryTimes || 3
      })

      const result = await withLock(lock, async () => {
        return await performRefreshWithOptimizations(
          config,
          concurrency,
          enableWebSocket,
          backoffConfig,
          priorityQueueConfig,
          logger,
          startTime
        )
      })

      if (!result) {
        console.log('❌ 未能获取锁，其他实例正在刷新')
        return {
          totalAccounts: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          duration: Date.now() - startTime,
          details: []
        }
      }

      return result
    } else {
      // 不使用分布式锁，直接执行
      return await performRefreshWithOptimizations(
        config,
        concurrency,
        enableWebSocket,
        backoffConfig,
        priorityQueueConfig,
        logger,
        startTime
      )
    }
    
    // 获取所有账号
    const allAccounts = await AccountDB.getAll()
    console.log(`📊 总账号数: ${allAccounts.length}`)
    
    // 设置日志记录器的总账号数
    logger.setTotalAccounts(allAccounts.length)
    
    // 发送刷新开始事件
    if (enableWebSocket) {
      emitRefreshStart({
        timestamp: startTime,
        totalAccounts: allAccounts.length
      })
      console.log('📡 已发送 refresh:start 事件')
    }
    
    // 第一步：过滤出有 OAuth 凭证的账号
    const accountsWithCredentials = allAccounts.filter(
      acc => acc.credentials.refreshToken && acc.credentials.clientId && acc.credentials.clientSecret
    )
    console.log(`🔑 有OAuth凭证: ${accountsWithCredentials.length}`)
    
    // 第二步：智能过期检测 - 只选择需要刷新的账号
    const accountsNeedRefresh: Account[] = []
    const accountsSkipped: Array<{ account: Account; reason: string }> = []
    const accountsNotExpired: Account[] = []
    
    for (const account of accountsWithCredentials) {
      // 检查是否应该跳过（封禁、失败等）
      const skipCheck = shouldSkipAccount(account)
      if (skipCheck.skip) {
        accountsSkipped.push({ account, reason: skipCheck.reason! })
        continue
      }
      
      // 检查是否需要刷新（智能过期检测）
      if (needsRefresh(account)) {
        accountsNeedRefresh.push(account)
      } else {
        accountsNotExpired.push(account)
      }
    }
    
    console.log(`✅ 需要刷新: ${accountsNeedRefresh.length}`)
    console.log(`⏭️  跳过账号: ${accountsSkipped.length}`)
    console.log(`⏰ 未过期: ${accountsNotExpired.length}`)
    
    // 打印跳过原因统计
    if (accountsSkipped.length > 0) {
      const skipReasons = accountsSkipped.reduce((acc, { reason }) => {
        acc[reason] = (acc[reason] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      console.log(`   跳过原因:`)
      Object.entries(skipReasons).forEach(([reason, count]) => {
        console.log(`     - ${reason}: ${count} 个`)
      })
    }
    
    // 打印未过期账号的过期时间信息
    if (accountsNotExpired.length > 0 && accountsNotExpired.length <= 5) {
      console.log(`   未过期账号示例:`)
      accountsNotExpired.slice(0, 5).forEach(acc => {
        const expiresAt = acc.credentials.expiresAt
        if (expiresAt) {
          const timeUntilExpiry = expiresAt - Date.now()
          const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000)
          console.log(`     - ${acc.email}: 还有 ${minutesUntilExpiry} 分钟过期`)
        }
      })
    }
    
    if (accountsNeedRefresh.length === 0) {
      console.log('✨ 没有需要刷新的账号')
      console.log('='.repeat(60) + '\n')
      
      // 记录跳过的账号到日志
      logger.logAccountRefreshBatch(accountsSkipped.map(({ account, reason }) => ({
        accountId: account.id,
        email: account.email,
        success: false,
        duration: 0,
        skipped: true,
        skipReason: reason
      })))
      
      // 完成日志记录
      const refreshLog = await logger.finalize()
      console.log(formatRefreshLog(refreshLog))
      
      // 发送刷新完成事件（即使没有刷新任何账号）
      if (enableWebSocket) {
        emitRefreshComplete({
          timestamp: Date.now(),
          successCount: 0,
          failedCount: 0,
          skippedCount: accountsSkipped.length,
          duration: Date.now() - startTime
        })
        console.log('📡 已发送 refresh:complete 事件')
      }
      
      return {
        totalAccounts: allAccounts.length,
        successCount: 0,
        failedCount: 0,
        skippedCount: accountsSkipped.length,
        duration: Date.now() - startTime,
        details: accountsSkipped.map(({ account, reason }) => ({
          accountId: account.id,
          email: account.email,
          success: false,
          duration: 0,
          skipped: true,
          skipReason: reason
        }))
      }
    }
    
    // 第三步：批量刷新
    console.log(`\n🚀 开始批量刷新 (并发: ${concurrency})`)
    const result = await batchRefreshAccounts(accountsNeedRefresh, concurrency, logger, enableWebSocket)
    
    // 合并跳过的账号到结果中
    result.details.push(...accountsSkipped.map(({ account, reason }) => ({
      accountId: account.id,
      email: account.email,
      success: false,
      duration: 0,
      skipped: true,
      skipReason: reason
    })))
    result.skippedCount = accountsSkipped.length
    result.totalAccounts = allAccounts.length
    result.duration = Date.now() - startTime
    
    // 记录跳过的账号到日志
    logger.logAccountRefreshBatch(accountsSkipped.map(({ account, reason }) => ({
      accountId: account.id,
      email: account.email,
      success: false,
      duration: 0,
      skipped: true,
      skipReason: reason
    })))
    
    // 完成日志记录
    const refreshLog = await logger.finalize()
    
    // 发送刷新完成事件
    if (enableWebSocket) {
      emitRefreshComplete({
        timestamp: Date.now(),
        successCount: result.successCount,
        failedCount: result.failedCount,
        skippedCount: result.skippedCount,
        duration: result.duration
      })
      console.log('📡 已发送 refresh:complete 事件')
    }
    
    // 更新最后刷新时间
    config.autoRefresh!.lastRefreshTime = new Date().toISOString()
    const { saveConfig } = await import('./config.service')
    saveConfig(config)
    
    // 统计同步结果
    const syncSuccessCount = result.details.filter(d => d.syncSuccess).length
    const syncFailedCount = result.details.filter(d => d.syncError && !d.skipped).length
    const syncBannedCount = result.details.filter(d => 
      d.syncError && (
        d.syncError.includes('AccountSuspendedException') || 
        d.syncError.includes('UnauthorizedException')
      )
    ).length
    
    // 打印总结
    console.log(`\n${'='.repeat(60)}`)
    console.log(`✅ 智能刷新完成`)
    console.log(`   总账号: ${result.totalAccounts} 个`)
    console.log(`   需要刷新: ${accountsNeedRefresh.length} 个`)
    console.log(`   Token 刷新成功: ${result.successCount} 个`)
    console.log(`   Token 刷新失败: ${result.failedCount} 个`)
    console.log(`   跳过: ${result.skippedCount} 个`)
    if (result.successCount > 0) {
      console.log(`   信息同步成功: ${syncSuccessCount} 个`)
      if (syncFailedCount > 0) {
        console.log(`   信息同步失败: ${syncFailedCount} 个 (其中封禁: ${syncBannedCount} 个)`)
      }
    }
    console.log(`   总耗时: ${(result.duration / 1000).toFixed(2)} 秒`)
    console.log(`   平均耗时: ${accountsNeedRefresh.length > 0 ? ((result.duration / accountsNeedRefresh.length) / 1000).toFixed(2) : 0} 秒/账号`)
    console.log('='.repeat(60) + '\n')
    
    // 打印日志摘要
    console.log(`📊 ${generateLogSummary(refreshLog)}\n`)
    
    // 执行日志清理
    await cleanupOldLogs(config)
    
    // 检查健康状态并发送告警通知
    await checkHealthAndSendAlerts()
    
    return result
  } catch (error: any) {
    console.error('❌ 自动刷新失败:', error.message)
    throw error
  } finally {
    isRefreshing = false
  }
}

/**
 * 检查账号是否需要刷新
 */
function needsRefresh(account: Account): boolean {
  const now = Date.now()
  const expiresAt = account.credentials.expiresAt
  
  // 没有过期时间，需要刷新以获取过期时间
  if (!expiresAt) {
    return true
  }
  
  // 检查是否即将过期
  const timeUntilExpiry = expiresAt - now
  return timeUntilExpiry <= TOKEN_REFRESH_BEFORE_EXPIRY
}

/**
 * 检查是否应该跳过账号
 *
 * 关键原则：只跳过明确已封禁的账号，不根据失败次数永久跳过
 * 因为失败可能是临时网络问题，需要通过实际检查来确认账号状态
 */
function shouldSkipAccount(account: Account): { skip: boolean; reason?: string } {
  // 1. 跳过缺少必要凭证的账号（无法刷新）
  if (!account.credentials.refreshToken ||
      !account.credentials.clientId ||
      !account.credentials.clientSecret) {
    return { skip: true, reason: '缺少OAuth凭证' }
  }

  // 2. 检查是否明确标记为已封禁
  const lastError = account.lastError || ''

  // 方式1: 检查确定的封禁错误
  if (lastError.includes('AccountSuspendedException') ||
      lastError.includes('UnauthorizedException')) {
    return { skip: true, reason: '账号已封禁（确认）' }
  }

  // 方式2: 检查HTTP状态码423（Locked）
  if (lastError.includes('423') || lastError.includes('Locked')) {
    return { skip: true, reason: '账号已锁定（确认）' }
  }

  // 方式3: 检查常见的封禁错误消息
  const bannedKeywords = [
    'suspended',
    'banned',
    'locked',
    'disabled',
    'account is not active',
    'account has been suspended'
  ]

  const lowerError = lastError.toLowerCase()
  for (const keyword of bannedKeywords) {
    if (lowerError.includes(keyword)) {
      return { skip: true, reason: `账号已封禁（${keyword}）` }
    }
  }

  // 3. ❌ 移除：不再根据连续失败次数永久跳过
  // 原因：失败可能是临时网络问题、API限流等，不代表账号被封
  // 改进：使用指数退避延长重试间隔，但不永久放弃

  // 所有其他情况都不跳过，允许重试
  return { skip: false }
}

/**
 * 批量刷新账号（带指数退避）
 */
export async function batchRefreshAccountsWithBackoff(
  accounts: Account[],
  concurrency: number,
  logger: RefreshLogger,
  enableWebSocket: boolean,
  backoffEnabled: boolean = false
): Promise<RefreshResult> {
  let successCount = 0
  let failedCount = 0
  const details: RefreshDetail[] = []

  // 分批处理
  for (let i = 0; i < accounts.length; i += concurrency) {
    const batch = accounts.slice(i, i + concurrency)
    const batchNum = Math.floor(i / concurrency) + 1
    const totalBatches = Math.ceil(accounts.length / concurrency)

    console.log(`\n📦 处理批次 ${batchNum}/${totalBatches} (${batch.length} 个账号)`)

    const results = await Promise.allSettled(
      batch.map(account => refreshSingleAccount(account))
    )

    results.forEach((result, index) => {
      const account = batch[index]

      if (result.status === 'fulfilled') {
        const detail = result.value
        details.push(detail)

        // 🆕 记录到指数退避管理器
        if (backoffEnabled) {
          if (detail.success) {
            recordRefreshSuccess(account.id)
          } else {
            const backoffState = recordRefreshFailure(account.id)
            console.log(
              `  📊 [Backoff] ${account.email} - 失败 ${backoffState.consecutiveFailures} 次，` +
              `下次重试: ${new Date(backoffState.nextRetryAt).toLocaleString('zh-CN')}`
            )
          }
        }

        // 记录到日志
        logger.logAccountRefresh(detail)

        // 发送账号刷新完成事件
        if (enableWebSocket) {
          emitRefreshAccount({
            accountId: detail.accountId,
            email: detail.email,
            success: detail.success,
            error: detail.error,
            duration: detail.duration,
            skipped: detail.skipped,
            skipReason: detail.skipReason
          })
        }

        if (detail.success) {
          successCount++
          console.log(`  ✅ [Token] ${account.email} - ${(detail.duration / 1000).toFixed(2)}s`)

          // 检查同步结果
          if (detail.syncSuccess) {
            console.log(`     ✅ [Sync] 信息同步成功`)
          } else if (detail.syncError) {
            if (detail.syncError.includes('AccountSuspendedException') ||
                detail.syncError.includes('UnauthorizedException')) {
              console.error(`     🚫 [Sync] 账号已封禁: ${detail.syncError}`)
            } else {
              console.warn(`     ⚠️  [Sync] 信息同步失败: ${detail.syncError}`)
            }
          }
        } else {
          failedCount++
          console.log(`  ❌ [Token] ${account.email} - ${detail.error}`)
        }
      } else {
        failedCount++
        const error = result.reason?.message || '未知错误'
        const detail: RefreshDetail = {
          accountId: account.id,
          email: account.email,
          success: false,
          error,
          duration: 0
        }
        details.push(detail)

        // 🆕 记录到指数退避管理器
        if (backoffEnabled) {
          const backoffState = recordRefreshFailure(account.id)
          console.log(
            `  📊 [Backoff] ${account.email} - 失败 ${backoffState.consecutiveFailures} 次，` +
            `下次重试: ${new Date(backoffState.nextRetryAt).toLocaleString('zh-CN')}`
          )
        }

        // 记录到日志
        logger.logAccountRefresh(detail)

        // 发送账号刷新完成事件
        if (enableWebSocket) {
          emitRefreshAccount({
            accountId: detail.accountId,
            email: detail.email,
            success: false,
            error: detail.error,
            duration: 0
          })
        }

        console.log(`  ❌ [Token] ${account.email} - ${error}`)
      }
    })

    // 批次间延迟，避免 API 限流
    if (i + concurrency < accounts.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
    }
  }

  return {
    totalAccounts: 0, // 将在外部设置
    successCount,
    failedCount,
    skippedCount: 0, // 将在外部设置
    duration: 0, // 将在外部设置
    details
  }
}

/**
 * 批量刷新账号（原有函数，保持兼容性）
 */
async function batchRefreshAccounts(
  accounts: Account[],
  concurrency: number,
  logger: RefreshLogger,
  enableWebSocket: boolean
): Promise<RefreshResult> {
  let successCount = 0
  let failedCount = 0
  const details: RefreshDetail[] = []
  
  // 分批处理
  for (let i = 0; i < accounts.length; i += concurrency) {
    const batch = accounts.slice(i, i + concurrency)
    const batchNum = Math.floor(i / concurrency) + 1
    const totalBatches = Math.ceil(accounts.length / concurrency)
    
    console.log(`\n📦 处理批次 ${batchNum}/${totalBatches} (${batch.length} 个账号)`)
    
    const results = await Promise.allSettled(
      batch.map(account => refreshSingleAccount(account))
    )
    
    results.forEach((result, index) => {
      const account = batch[index]
      
      if (result.status === 'fulfilled') {
        const detail = result.value
        details.push(detail)
        
        // 记录到日志
        logger.logAccountRefresh(detail)
        
        // 发送账号刷新完成事件
        if (enableWebSocket) {
          emitRefreshAccount({
            accountId: detail.accountId,
            email: detail.email,
            success: detail.success,
            error: detail.error,
            duration: detail.duration,
            skipped: detail.skipped,
            skipReason: detail.skipReason
          })
        }
        
        if (detail.success) {
          successCount++
          // Token 刷新成功
          console.log(`  ✅ [Token] ${account.email} - ${(detail.duration / 1000).toFixed(2)}s`)
          
          // 检查同步结果
          if (detail.syncSuccess) {
            console.log(`     ✅ [Sync] 信息同步成功`)
          } else if (detail.syncError) {
            if (detail.syncError.includes('AccountSuspendedException') || 
                detail.syncError.includes('UnauthorizedException')) {
              console.error(`     🚫 [Sync] 账号已封禁: ${detail.syncError}`)
            } else {
              console.warn(`     ⚠️  [Sync] 信息同步失败: ${detail.syncError}`)
            }
          }
        } else {
          failedCount++
          console.log(`  ❌ [Token] ${account.email} - ${detail.error}`)
        }
      } else {
        failedCount++
        const error = result.reason?.message || '未知错误'
        const detail: RefreshDetail = {
          accountId: account.id,
          email: account.email,
          success: false,
          error,
          duration: 0
        }
        details.push(detail)
        
        // 记录到日志
        logger.logAccountRefresh(detail)
        
        // 发送账号刷新完成事件
        if (enableWebSocket) {
          emitRefreshAccount({
            accountId: detail.accountId,
            email: detail.email,
            success: false,
            error: detail.error,
            duration: 0
          })
        }
        
        console.log(`  ❌ [Token] ${account.email} - ${error}`)
      }
    })
    
    // 批次间延迟，避免 API 限流
    if (i + concurrency < accounts.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
    }
  }
  
  return {
    totalAccounts: 0, // 将在外部设置
    successCount,
    failedCount,
    skippedCount: 0, // 将在外部设置
    duration: 0, // 将在外部设置
    details
  }
}

/**
 * 刷新单个账号的 Token
 */
async function refreshSingleAccount(account: Account): Promise<RefreshDetail> {
  const startTime = Date.now()

  try {
    // 第一步：刷新 Token（根据 authMethod 选择刷新方式）
    let newAccessToken: string
    let newRefreshToken: string | undefined
    let expiresIn: number

    const authMethod = account.credentials.authMethod || 'IdC'

    if (authMethod === 'social') {
      // 社交登录：使用 Kiro API 刷新
      console.log(`  🔑 [Token] ${account.email} - 使用社交登录刷新`)

      try {
        const response = await axios.post(
          `${KIRO_AUTH_ENDPOINT}/refreshToken`,
          { refreshToken: account.credentials.refreshToken },
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'kiro-account-manager/1.0.0'
            },
            timeout: 30000
          }
        )

        if (!response.data.accessToken) {
          throw new Error('刷新响应中缺少 accessToken')
        }

        newAccessToken = response.data.accessToken
        newRefreshToken = response.data.refreshToken
        expiresIn = response.data.expiresIn || 3600
      } catch (firstError: any) {
        // 🆕 使用扁平化策略模式处理刷新失败
        // 如果第一次刷新失败（401错误），尝试降级策略
        if (firstError.response?.status !== 401) {
          // 非 401 错误，直接抛出
          throw firstError
        }

        console.log(`  🔄 [Retry] ${account.email} - RefreshToken 已失效，尝试降级策略...`)

        // 创建错误链记录所有尝试
        const errorChain = new RefreshErrorChain('All refresh strategies failed')
        errorChain.addAttempt('Kiro API (社交登录)', firstError, firstError.response?.status)

        // 定义降级刷新策略
        const fallbackStrategies = [
          {
            name: 'AWS OIDC (IdC登录)',
            condition: () => account.credentials.clientId && account.credentials.clientSecret && account.credentials.refreshToken,
            execute: async () => {
              const region = account.credentials.region || 'us-east-1'
              const url = `https://oidc.${region}.amazonaws.com/token`

              const response = await axios.post(
                url,
                {
                  clientId: account.credentials.clientId,
                  clientSecret: account.credentials.clientSecret,
                  refreshToken: account.credentials.refreshToken,
                  grantType: 'refresh_token'
                },
                {
                  headers: { 'Content-Type': 'application/json' },
                  timeout: 30000
                }
              )

              if (!response.data.accessToken) {
                throw new Error('AWS OIDC 刷新失败：响应中缺少 accessToken')
              }

              return {
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
                expiresIn: response.data.expiresIn || 3600
              }
            }
          },
          {
            name: 'SSO Token 重新认证',
            condition: () => !!account.credentials.ssoToken,
            execute: async () => {
              // 第一步：使用 SSO Token 重新获取 RefreshToken
              const reAuthResponse = await axios.post(
                `${KIRO_AUTH_ENDPOINT}/refreshToken`,
                { refreshToken: account.credentials.ssoToken },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'kiro-account-manager/1.0.0'
                  },
                  timeout: 30000
                }
              )

              if (!reAuthResponse.data.accessToken || !reAuthResponse.data.refreshToken) {
                throw new Error('重新获取 Token 失败：响应中缺少必要字段')
              }

              // 更新 RefreshToken
              const newRefreshTokenFromReAuth = reAuthResponse.data.refreshToken
              const newAccessTokenFromReAuth = reAuthResponse.data.accessToken
              await AccountDB.updateOAuthCredentials(account.id, {
                access_token: newAccessTokenFromReAuth,
                refresh_token: newRefreshTokenFromReAuth
              })

              // 第二步：使用新的 RefreshToken 再次尝试刷新
              const retryResponse = await axios.post(
                `${KIRO_AUTH_ENDPOINT}/refreshToken`,
                { refreshToken: newRefreshTokenFromReAuth },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'kiro-account-manager/1.0.0'
                  },
                  timeout: 30000
                }
              )

              if (!retryResponse.data.accessToken) {
                throw new Error('重试刷新失败：响应中缺少 accessToken')
              }

              return {
                accessToken: retryResponse.data.accessToken,
                refreshToken: retryResponse.data.refreshToken,
                expiresIn: retryResponse.data.expiresIn || 3600
              }
            }
          }
        ]

        // 执行降级策略
        for (const strategy of fallbackStrategies) {
          if (!strategy.condition()) {
            console.log(`  ⏭️  [Retry] ${account.email} - 跳过 ${strategy.name}（条件不满足）`)
            continue
          }

          try {
            console.log(`  🔄 [Retry] ${account.email} - 尝试 ${strategy.name}...`)
            const result = await strategy.execute()

            newAccessToken = result.accessToken
            newRefreshToken = result.refreshToken
            expiresIn = result.expiresIn

            console.log(`  ✅ [Retry] ${account.email} - ${strategy.name} 成功`)

            // 更新 Token
            if (newRefreshToken && newRefreshToken !== account.credentials.refreshToken) {
              await AccountDB.updateOAuthCredentials(account.id, {
                access_token: newAccessToken,
                refresh_token: newRefreshToken
              })
              console.log(`  ✅ [Retry] ${account.email} - Token 已更新`)
            }

            // 策略成功，跳出循环
            break

          } catch (error: any) {
            console.error(`  ❌ [Retry] ${account.email} - ${strategy.name} 失败: ${error.message}`)
            errorChain.addAttempt(strategy.name, error, error.response?.status)
          }
        }

        // 如果所有策略都失败，抛出错误链
        if (!newAccessToken) {
          console.error(`  ❌ [Retry] ${account.email} - 所有刷新策略都失败`)
          console.error(`  📋 错误详情:\n${errorChain.getFullTrace()}`)
          throw errorChain
        }
      }
    } else {
      // IdC 登录：使用 AWS OIDC 刷新
      console.log(`  🔑 [Token] ${account.email} - 使用 IdC 刷新`)
      const region = account.credentials.region || 'us-east-1'
      const url = `https://oidc.${region}.amazonaws.com/token`

      const response = await axios.post(
        url,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: account.credentials.clientId!,
          client_secret: account.credentials.clientSecret!,
          refresh_token: account.credentials.refreshToken!
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

      newAccessToken = response.data.access_token
      newRefreshToken = response.data.refresh_token
      expiresIn = response.data.expires_in || 3600
    }

    const expiresAt = Date.now() + expiresIn * 1000

    // Token 刷新成功，准备返回结果
    const result: RefreshDetail = {
      accountId: account.id,
      email: account.email,
      success: true,
      duration: Date.now() - startTime,
      syncSuccess: false
    }

    // 第二步：同步账号信息（检测封禁状态）
    // 注意：同步失败不影响 Token 刷新的成功状态
    let syncError: string | undefined
    let isAccountSuspended = false
    try {
      const { syncAccountUsage } = await import('./kiro-api.service')
      const syncResult = await syncAccountUsage(newAccessToken, account.idp)

      if (syncResult.success && syncResult.data) {
        // 同步成功
        result.syncSuccess = true
        await AccountDB.updateExtendedInfo(account.id, syncResult.data)
      } else {
        // 同步失败
        syncError = syncResult.error
        isAccountSuspended = syncResult.isAccountSuspended || false
        result.syncError = syncError
      }
    } catch (e: any) {
      // 同步异常
      syncError = e.message
      isAccountSuspended = e.isAccountSuspended === true ||
                          e.message?.includes('AccountSuspendedException') ||
                          e.statusCode === 423
      result.syncError = syncError
    }

    // 第三步：更新数据库
    await AccountDB.updateAccessToken(account.id, newAccessToken)

    // 更新 access_token 和 refresh_token
    await AccountDB.updateOAuthCredentials(account.id, {
      access_token: newAccessToken,
      refresh_token: newRefreshToken
    })

    // 更新过期时间和状态
    // 关键逻辑：Token 刷新成功时，只有检测到封禁才记录错误状态
    await AccountDB.update(account.id, {
      ...account,
      credentials: {
        ...account.credentials,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken || account.credentials.refreshToken,
        expiresAt
      },
      // 只有封禁时才记录错误状态，普通同步失败不影响
      lastError: isAccountSuspended ? `AccountSuspendedException: ${syncError}` : undefined,
      consecutiveFailures: isAccountSuspended ? (account.consecutiveFailures || 0) + 1 : 0,
      lastCheckedAt: Date.now()
    })

    return result
  } catch (error: any) {
    // Token 刷新失败 - 这是真正的失败
    const errorMessage = error.response?.data?.error || error.message
    const consecutiveFailures = (account.consecutiveFailures || 0) + 1

    await AccountDB.update(account.id, {
      ...account,
      lastError: errorMessage,
      consecutiveFailures,
      lastCheckedAt: Date.now()
    })

    return {
      accountId: account.id,
      email: account.email,
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime
    }
  }
}



/**
 * 手动刷新所有账号（兼容旧接口）
 */
export async function refreshAllAccounts(): Promise<{
  success: number
  failed: number
  details: Array<{ email: string; success: boolean; error?: string }>
}> {
  console.log('\n🔄 手动触发批量刷新...')
  
  const result = await performAutoRefresh()
  
  return {
    success: result.successCount,
    failed: result.failedCount,
    details: result.details.map(d => ({
      email: d.email,
      success: d.success,
      error: d.error || (d.skipped ? `跳过: ${d.skipReason}` : undefined)
    }))
  }
}

/**
 * 重置账号错误状态
 */
export async function resetAccountError(accountId: string): Promise<boolean> {
  try {
    const account = await AccountDB.getById(accountId)
    if (!account) {
      return false
    }
    
    await AccountDB.update(accountId, {
      ...account,
      lastError: undefined,
      consecutiveFailures: 0,
      lastCheckedAt: Date.now()
    })
    
    console.log(`✅ 已重置账号错误状态: ${account.email}`)
    return true
  } catch (error: any) {
    console.error(`❌ 重置账号错误状态失败:`, error.message)
    return false
  }
}

/**
 * 批量重置账号错误状态
 */
export async function resetAccountErrors(accountIds: string[]): Promise<number> {
  let count = 0
  
  for (const id of accountIds) {
    const success = await resetAccountError(id)
    if (success) {
      count++
    }
  }
  
  return count
}

/**
 * 清理旧日志
 */
async function cleanupOldLogs(config: any): Promise<void> {
  try {
    const retentionDays = config.autoRefresh?.logRetentionDays || 30
    
    console.log(`🧹 开始清理 ${retentionDays} 天前的旧日志...`)
    
    const { getRefreshLogStorage } = await import('./refresh-log-storage.service')
    const storage = getRefreshLogStorage()
    
    const deletedCount = await storage.cleanup(retentionDays)
    
    if (deletedCount > 0) {
      console.log(`✅ 已清理 ${deletedCount} 条旧日志`)
    } else {
      console.log(`✅ 无需清理，所有日志都在保留期内`)
    }
  } catch (error: any) {
    console.error('❌ 清理日志失败:', error.message)
    // 清理失败不影响主流程，只记录错误
  }
}

/**
 * 检查健康状态并发送告警通知
 */
async function checkHealthAndSendAlerts(): Promise<void> {
  try {
    const config = loadConfig()
    const enableAlerts = config.autoRefresh?.enableAlerts ?? true
    
    if (!enableAlerts) {
      console.log('⏸️  告警通知已禁用')
      return
    }
    
    console.log('🏥 检查系统健康状态...')
    
    // 获取健康状态（不发送通知，我们手动控制）
    const healthStatus = await getHealthStatus(false)
    
    // 如果有告警，发送告警摘要
    if (healthStatus.alerts.length > 0) {
      sendAlertSummary(healthStatus.alerts)
    } else {
      console.log('✅ 系统健康，无告警\n')
    }
  } catch (error: any) {
    console.error('❌ 健康检查失败:', error.message)
    // 健康检查失败不影响主流程
  }
}
/**
 * 执行带优化的刷新流程
 */
async function performRefreshWithOptimizations(
  config: any,
  concurrency: number,
  enableWebSocket: boolean,
  backoffConfig: any,
  priorityQueueConfig: any,
  logger: RefreshLogger,
  startTime: number
): Promise<RefreshResult> {
  // 获取所有账号
  const allAccounts = await AccountDB.getAll()
  console.log(`📊 总账号数: ${allAccounts.length}`)

  // 设置日志记录器的总账号数
  logger.setTotalAccounts(allAccounts.length)

  // 发送刷新开始事件
  if (enableWebSocket) {
    emitRefreshStart({
      timestamp: startTime,
      totalAccounts: allAccounts.length
    })
    console.log('📡 已发送 refresh:start 事件')
  }

  // 第一步：过滤出有 OAuth 凭证的账号
  const accountsWithCredentials = allAccounts.filter(
    acc => acc.credentials.refreshToken && acc.credentials.clientId && acc.credentials.clientSecret
  )
  console.log(`🔑 有OAuth凭证: ${accountsWithCredentials.length}`)

  // 第二步：智能过期检测 - 只选择需要刷新的账号
  const accountsNeedRefresh: Account[] = []
  const accountsSkipped: Array<{ account: Account; reason: string }> = []
  const accountsNotExpired: Account[] = []

  // Directly call same-file functions (no import needed)

  for (const account of accountsWithCredentials) {
    // 检查是否应该跳过（封禁等）
    const skipCheck = shouldSkipAccount(account)
    if (skipCheck.skip) {
      accountsSkipped.push({ account, reason: skipCheck.reason! })
      continue
    }

    // 检查是否需要刷新（智能过期检测）
    if (needsRefresh(account)) {
      accountsNeedRefresh.push(account)
    } else {
      accountsNotExpired.push(account)
    }
  }

  console.log(`✅ 需要刷新: ${accountsNeedRefresh.length}`)
  console.log(`⏭️  跳过账号: ${accountsSkipped.length}`)
  console.log(`⏰ 未过期: ${accountsNotExpired.length}`)

  // 🆕 第三步：指数退避过滤
  let finalAccountsToRefresh = accountsNeedRefresh
  let backoffBlocked: Array<{ account: Account; reason: string; retryAfter: number }> = []

  if (backoffConfig.enabled) {
    console.log('\n📊 应用指数退避策略...')

    const { retryable, blocked } = filterRetryableAccounts(accountsNeedRefresh)

    finalAccountsToRefresh = retryable
    backoffBlocked = blocked

    console.log(`✅ 可重试: ${retryable.length}`)
    console.log(`⏸️  退避中: ${blocked.length}`)

    // 打印退避统计
    const backoffStats = backoffManager.getStats()
    console.log(`   退避统计:`)
    console.log(`     - 总计: ${backoffStats.total} 个`)
    console.log(`     - 退避中: ${backoffStats.inBackoff} 个`)
    console.log(`     - 达到最大重试: ${backoffStats.maxRetriesReached} 个`)
    console.log(`     - 可重试: ${backoffStats.canRetry} 个`)
  }

  // 🆕 第四步：优先级队列排序
  if (priorityQueueConfig.enabled && finalAccountsToRefresh.length > 0) {
    console.log('\n🎯 应用优先级队列排序...')

    const priorityQueue = createRefreshPriorityQueue(finalAccountsToRefresh)
    const stats = priorityQueue.getStats()

    console.log(`   优先级统计:`)
    console.log(`     - 总计: ${stats.total} 个`)
    console.log(`     - 已过期: ${stats.expired} 个`)
    console.log(`     - 即将过期: ${stats.expiringSoon} 个`)
    console.log(`     - 健康: ${stats.healthy} 个`)

    // 按优先级重新排序
    finalAccountsToRefresh = priorityQueue.toArray()
    console.log(`✅ 已按过期时间排序，优先刷新即将过期的 Token`)
  }

  // 合并所有跳过的账号
  accountsSkipped.push(...backoffBlocked.map(({ account, reason }) => ({
    account,
    reason
  })))

  if (finalAccountsToRefresh.length === 0) {
    console.log('✨ 没有需要刷新的账号')
    console.log('='.repeat(60) + '\n')

    // 记录跳过的账号到日志
    logger.logAccountRefreshBatch(accountsSkipped.map(({ account, reason }) => ({
      accountId: account.id,
      email: account.email,
      success: false,
      duration: 0,
      skipped: true,
      skipReason: reason
    })))

    // 完成日志记录
    const refreshLog = await logger.finalize()

    // 发送刷新完成事件
    if (enableWebSocket) {
      emitRefreshComplete({
        timestamp: Date.now(),
        successCount: 0,
        failedCount: 0,
        skippedCount: accountsSkipped.length,
        duration: Date.now() - startTime
      })
      console.log('📡 已发送 refresh:complete 事件')
    }

    return {
      totalAccounts: allAccounts.length,
      successCount: 0,
      failedCount: 0,
      skippedCount: accountsSkipped.length,
      duration: Date.now() - startTime,
      details: accountsSkipped.map(({ account, reason }) => ({
        accountId: account.id,
        email: account.email,
        success: false,
        duration: 0,
        skipped: true,
        skipReason: reason
      }))
    }
  }

  // 第五步：批量刷新
  console.log(`\n🚀 开始批量刷新 (并发: ${concurrency})`)

  // Directly call same-file function (no import needed)
  const result = await batchRefreshAccountsWithBackoff(
    finalAccountsToRefresh,
    concurrency,
    logger,
    enableWebSocket,
    backoffConfig.enabled
  )

  // 合并跳过的账号到结果中
  result.details.push(...accountsSkipped.map(({ account, reason }) => ({
    accountId: account.id,
    email: account.email,
    success: false,
    duration: 0,
    skipped: true,
    skipReason: reason
  })))
  result.skippedCount = accountsSkipped.length
  result.totalAccounts = allAccounts.length
  result.duration = Date.now() - startTime

  // 记录跳过的账号到日志
  logger.logAccountRefreshBatch(accountsSkipped.map(({ account, reason }) => ({
    accountId: account.id,
    email: account.email,
    success: false,
    duration: 0,
    skipped: true,
    skipReason: reason
  })))

  // 完成日志记录
  await logger.finalize()

  // 发送刷新完成事件
  if (enableWebSocket) {
    emitRefreshComplete({
      timestamp: Date.now(),
      successCount: result.successCount,
      failedCount: result.failedCount,
      skippedCount: result.skippedCount,
      duration: result.duration
    })
    console.log('📡 已发送 refresh:complete 事件')
  }

  return result
}
