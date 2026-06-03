/**
 * 自动刷新核心逻辑（带优化）
 * 包含：分布式锁、优先级队列、指数退避
 */

import { Account } from '../models/account.model'
import { AccountDB } from './database.adapter'
import {
  emitRefreshStart,
  emitRefreshAccount,
  emitRefreshComplete
} from '../websocket/socket.handler'
import { RefreshLogger } from './refresh-logger.service'
import { createRefreshPriorityQueue } from './priority-queue.service'
import {
  backoffManager,
  recordRefreshFailure,
  recordRefreshSuccess,
  filterRetryableAccounts
} from './exponential-backoff.service'

/**
 * 刷新详情
 */
export interface RefreshDetail {
  accountId: string
  email: string
  success: boolean
  error?: string
  duration: number
  skipped?: boolean
  skipReason?: string
  syncSuccess?: boolean
  syncError?: string
}

/**
 * 刷新结果
 */
export interface RefreshResult {
  totalAccounts: number
  successCount: number
  failedCount: number
  skippedCount: number
  duration: number
  details: RefreshDetail[]
}

/**
 * 执行带优化的刷新流程
 */
export async function performRefreshWithOptimizations(
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

  const { shouldSkipAccount, needsRefresh } = await import('./auto-refresh-optimized.service')

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

  const { batchRefreshAccountsWithBackoff } = await import('./auto-refresh-optimized.service')
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
