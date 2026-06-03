/**
 * 指数退避服务
 * 失败后延长重试间隔，避免频繁重试导致 API 限流或账号锁定
 */

import { Account } from '../models/account.model'

/**
 * 退避策略配置
 */
export interface BackoffConfig {
  initialDelay: number      // 初始延迟（毫秒）
  maxDelay: number          // 最大延迟（毫秒）
  multiplier: number        // 延迟倍数
  maxRetries: number        // 最大重试次数
  resetAfter: number        // 成功后多久重置退避状态（毫秒）
}

/**
 * 默认退避配置
 */
export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  initialDelay: 60_000,      // 1 分钟
  maxDelay: 3600_000,        // 1 小时
  multiplier: 2,             // 每次失败延迟翻倍
  maxRetries: 5,             // 最多重试 5 次
  resetAfter: 3600_000       // 成功后 1 小时重置
}

/**
 * 账号退避状态
 */
export interface BackoffState {
  accountId: string
  consecutiveFailures: number
  lastFailureAt: number
  nextRetryAt: number
  currentDelay: number
  lastSuccessAt?: number
}

/**
 * 退避管理器
 */
export class ExponentialBackoffManager {
  private states: Map<string, BackoffState> = new Map()
  private config: BackoffConfig

  constructor(config: Partial<BackoffConfig> = {}) {
    this.config = { ...DEFAULT_BACKOFF_CONFIG, ...config }
  }

  /**
   * 记录失败，更新退避状态
   */
  recordFailure(accountId: string): BackoffState {
    const now = Date.now()
    const existing = this.states.get(accountId)

    let state: BackoffState

    if (existing) {
      // 检查是否需要重置（成功后一段时间）
      if (
        existing.lastSuccessAt &&
        now - existing.lastSuccessAt > this.config.resetAfter
      ) {
        // 重置退避状态
        state = this.createInitialState(accountId, now)
      } else {
        // 增加失败计数，计算下次延迟
        const failures = existing.consecutiveFailures + 1
        const delay = Math.min(
          existing.currentDelay * this.config.multiplier,
          this.config.maxDelay
        )

        state = {
          accountId,
          consecutiveFailures: failures,
          lastFailureAt: now,
          nextRetryAt: now + delay,
          currentDelay: delay,
          lastSuccessAt: existing.lastSuccessAt
        }
      }
    } else {
      // 首次失败
      state = this.createInitialState(accountId, now)
    }

    this.states.set(accountId, state)
    return state
  }

  /**
   * 记录成功，重置退避状态
   */
  recordSuccess(accountId: string): void {
    const now = Date.now()
    const existing = this.states.get(accountId)

    if (existing) {
      // 保留状态但标记成功时间
      existing.lastSuccessAt = now
      existing.consecutiveFailures = 0
      existing.currentDelay = this.config.initialDelay
    } else {
      // 创建新状态
      this.states.set(accountId, {
        accountId,
        consecutiveFailures: 0,
        lastFailureAt: 0,
        nextRetryAt: 0,
        currentDelay: this.config.initialDelay,
        lastSuccessAt: now
      })
    }
  }

  /**
   * 检查账号是否可以重试
   */
  canRetry(accountId: string): boolean {
    const state = this.states.get(accountId)

    if (!state) {
      return true
    }

    const now = Date.now()

    // 检查是否超过最大重试次数
    if (state.consecutiveFailures >= this.config.maxRetries) {
      return false
    }

    // 检查是否到达重试时间
    return now >= state.nextRetryAt
  }

  /**
   * 获取账号的退避状态
   */
  getState(accountId: string): BackoffState | null {
    return this.states.get(accountId) || null
  }

  /**
   * 获取下次重试时间（毫秒）
   */
  getNextRetryDelay(accountId: string): number {
    const state = this.states.get(accountId)

    if (!state) {
      return 0
    }

    const now = Date.now()
    const delay = state.nextRetryAt - now

    return Math.max(0, delay)
  }

  /**
   * 过滤出可以重试的账号
   */
  filterRetryableAccounts(accounts: Account[]): {
    retryable: Account[]
    blocked: Array<{ account: Account; reason: string; retryAfter: number }>
  } {
    const retryable: Account[] = []
    const blocked: Array<{ account: Account; reason: string; retryAfter: number }> = []

    for (const account of accounts) {
      const state = this.states.get(account.id)

      if (!state) {
        // 无退避状态，可以重试
        retryable.push(account)
        continue
      }

      const now = Date.now()

      // 检查是否超过最大重试次数
      if (state.consecutiveFailures >= this.config.maxRetries) {
        blocked.push({
          account,
          reason: `已达最大重试次数 (${this.config.maxRetries})`,
          retryAfter: 0
        })
        continue
      }

      // 检查是否到达重试时间
      if (now < state.nextRetryAt) {
        const retryAfter = Math.ceil((state.nextRetryAt - now) / 1000 / 60)
        blocked.push({
          account,
          reason: `退避中，${retryAfter} 分钟后重试`,
          retryAfter: state.nextRetryAt - now
        })
        continue
      }

      // 可以重试
      retryable.push(account)
    }

    return { retryable, blocked }
  }

  /**
   * 清理过期的退避状态
   */
  cleanup(): number {
    const now = Date.now()
    const expiry = this.config.resetAfter * 2 // 重置时间的 2 倍后清理
    let count = 0

    for (const [accountId, state] of this.states.entries()) {
      if (
        state.lastSuccessAt &&
        now - state.lastSuccessAt > expiry
      ) {
        this.states.delete(accountId)
        count++
      }
    }

    return count
  }

  /**
   * 重置特定账号的退避状态
   */
  reset(accountId: string): boolean {
    return this.states.delete(accountId)
  }

  /**
   * 重置所有退避状态
   */
  resetAll(): void {
    this.states.clear()
  }

  /**
   * 获取所有退避状态统计
   */
  getStats(): {
    total: number
    inBackoff: number
    maxRetriesReached: number
    canRetry: number
  } {
    const now = Date.now()
    let inBackoff = 0
    let maxRetriesReached = 0
    let canRetry = 0

    for (const state of this.states.values()) {
      if (state.consecutiveFailures >= this.config.maxRetries) {
        maxRetriesReached++
      } else if (now < state.nextRetryAt) {
        inBackoff++
      } else {
        canRetry++
      }
    }

    return {
      total: this.states.size,
      inBackoff,
      maxRetriesReached,
      canRetry
    }
  }

  /**
   * 创建初始退避状态
   */
  private createInitialState(accountId: string, now: number): BackoffState {
    return {
      accountId,
      consecutiveFailures: 1,
      lastFailureAt: now,
      nextRetryAt: now + this.config.initialDelay,
      currentDelay: this.config.initialDelay
    }
  }
}

/**
 * 全局退避管理器实例
 */
export const backoffManager = new ExponentialBackoffManager()

/**
 * 工具函数：记录失败
 */
export function recordRefreshFailure(accountId: string): BackoffState {
  return backoffManager.recordFailure(accountId)
}

/**
 * 工具函数：记录成功
 */
export function recordRefreshSuccess(accountId: string): void {
  backoffManager.recordSuccess(accountId)
}

/**
 * 工具函数：检查是否可以重试
 */
export function canRetryRefresh(accountId: string): boolean {
  return backoffManager.canRetry(accountId)
}

/**
 * 工具函数：过滤可重试账号
 */
export function filterRetryableAccounts(accounts: Account[]): {
  retryable: Account[]
  blocked: Array<{ account: Account; reason: string; retryAfter: number }>
} {
  return backoffManager.filterRetryableAccounts(accounts)
}
