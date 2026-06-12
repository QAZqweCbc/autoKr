/**
 * 指数退避服务单元测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  ExponentialBackoffManager,
  backoffManager,
  recordRefreshFailure,
  recordRefreshSuccess,
  canRetryRefresh,
  filterRetryableAccounts,
  DEFAULT_BACKOFF_CONFIG
} from '../exponential-backoff.service'
import { Account } from '../../models/account.model'

// 模拟账号数据
function createMockAccount(id: string, email: string): Account {
  return {
    id,
    email,
    idp: 'test',
    status: 'active',
    credentials: {
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      expiresAt: Date.now() + 3600000,
      region: 'us-east-1',
      authMethod: 'IdC'
    },
    createdAt: Date.now(),
    lastCheckedAt: Date.now()
  } as Account
}

describe('ExponentialBackoffManager', () => {
  let manager: ExponentialBackoffManager

  beforeEach(() => {
    // 每次测试前创建新的管理器实例
    manager = new ExponentialBackoffManager({
      initialDelay: 1000,
      maxDelay: 10000,
      multiplier: 2,
      maxRetries: 3,
      resetAfter: 5000
    })
  })

  describe('失败记录', () => {
    it('应该正确记录首次失败', () => {
      const state = manager.recordFailure('account1')

      expect(state.accountId).toBe('account1')
      expect(state.consecutiveFailures).toBe(1)
      expect(state.currentDelay).toBe(1000) // initialDelay
    })

    it('应该递增失败计数', () => {
      manager.recordFailure('account1')
      const state = manager.recordFailure('account1')

      expect(state.consecutiveFailures).toBe(2)
      expect(state.currentDelay).toBe(2000) // 1000 * 2
    })

    it('应该按倍数增加延迟', () => {
      manager.recordFailure('account1')
      manager.recordFailure('account1')
      const state = manager.recordFailure('account1')

      expect(state.consecutiveFailures).toBe(3)
      expect(state.currentDelay).toBe(4000) // 1000 * 2 * 2
    })

    it('延迟不应超过最大值', () => {
      for (let i = 0; i < 10; i++) {
        manager.recordFailure('account1')
      }

      const state = manager.getState('account1')
      expect(state?.currentDelay).toBeLessThanOrEqual(10000)
    })

    it('应该设置正确的下次重试时间', () => {
      const before = Date.now()
      const state = manager.recordFailure('account1')
      const after = Date.now()

      expect(state.nextRetryAt).toBeGreaterThanOrEqual(before + 1000)
      expect(state.nextRetryAt).toBeLessThanOrEqual(after + 1000 + 100) // 容许100ms误差
    })
  })

  describe('成功记录', () => {
    it('应该重置失败计数', () => {
      manager.recordFailure('account1')
      manager.recordFailure('account1')
      manager.recordSuccess('account1')

      const state = manager.getState('account1')
      expect(state?.consecutiveFailures).toBe(0)
    })

    it('应该重置延迟为初始值', () => {
      manager.recordFailure('account1')
      manager.recordFailure('account1')
      manager.recordSuccess('account1')

      const state = manager.getState('account1')
      expect(state?.currentDelay).toBe(1000) // 恢复到 initialDelay
    })

    it('应该记录成功时间', () => {
      const before = Date.now()
      manager.recordSuccess('account1')
      const after = Date.now()

      const state = manager.getState('account1')
      expect(state?.lastSuccessAt).toBeGreaterThanOrEqual(before)
      expect(state?.lastSuccessAt).toBeLessThanOrEqual(after)
    })
  })

  describe('重试检查', () => {
    it('无状态的账号应该可以重试', () => {
      expect(manager.canRetry('new-account')).toBe(true)
    })

    it('未到重试时间应该不能重试', () => {
      manager.recordFailure('account1')
      expect(manager.canRetry('account1')).toBe(false)
    })

    it('到达重试时间应该可以重试', async () => {
      manager.recordFailure('account1')

      // 等待重试时间过去
      await new Promise(resolve => setTimeout(resolve, 1100))

      expect(manager.canRetry('account1')).toBe(true)
    })

    it('达到最大重试次数应该不能重试', () => {
      for (let i = 0; i < 3; i++) {
        manager.recordFailure('account1')
      }

      expect(manager.canRetry('account1')).toBe(false)
    })
  })

  describe('过滤可重试账号', () => {
    it('应该正确过滤可重试和被阻塞的账号', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com'),
        createMockAccount('2', 'b@example.com'),
        createMockAccount('3', 'c@example.com')
      ]

      // account1 和 account2 有失败记录
      manager.recordFailure('1')
      manager.recordFailure('2')

      const { retryable, blocked } = manager.filterRetryableAccounts(accounts)

      expect(retryable.length).toBe(1)
      expect(retryable[0].id).toBe('3') // 无失败记录

      expect(blocked.length).toBe(2)
    })

    it('达到最大重试次数的账号应该被标记', () => {
      const accounts = [createMockAccount('1', 'a@example.com')]

      // 失败3次（达到最大重试）
      for (let i = 0; i < 3; i++) {
        manager.recordFailure('1')
      }

      const { retryable, blocked } = manager.filterRetryableAccounts(accounts)

      expect(retryable.length).toBe(0)
      expect(blocked.length).toBe(1)
      expect(blocked[0].reason).toContain('最大重试次数')
    })

    it('退避中的账号应该包含重试时间', () => {
      const accounts = [createMockAccount('1', 'a@example.com')]

    ilure('1')

      const { blocked } = manager.filterRetryableAccounts(accounts)

      expect(blocked.length).toBe(1)
     (blocked[0].retryAfter).toBeGreaterThan(0)
      expect(blocked[0].reason).toContain('分钟后重试')
    })
  })

  describe('获取下次重试延迟', () => {
    it('无状态账号应该返回0', () => {
      const delay = manager.getNextRetryDelay('new-account')
      expect(delay).toBe(0)
    })

    it('应该返回正确的剩余延迟', () => {
      manager.recordFailure('account1')

      const delay = manager.getNextRetryDelay('account1')
      expect(delay).toBeGreaterThan(0)
      expect(delay).toBeLessThanOrEqual(1000)
    })

    it('延迟不应为负数', async () => {
      manager.recordFailure('account1')

      // 等待超过重试时间
      await new Promise(resolve => setTimeout(resolve, 1100))

      const delay = manager.getNextRetryDelay('account1')
      expect(delay).toBe(0)
    })
  })

  describe('状态管理', () => {
    it('应该正确获取账号状态', () => {
      manager.recordFailure('account1')

      const state = manager.getState('account1')
      expect(state).not.toBeNull()
      expect(state?.accountId).toBe('account1')
    })

    it('不存在的账号应该返回null', () => {
      const state = manager.getState('non-existent')
      expect(state).toBeNull()
    })

    it('应该正确重置单个账号', () => {
      manager.recordFailure('account1')
      const reset = manager.reset('account1')

      expect(reset).toBe(true)
      expect(manager.getState('account1')).toBeNull()
    })

    it('应该正确重置所有账号', () => {
      manager.recordFailure('account1')
      manager.recordFailure('account2')
      manager.resetAll()

      expect(manager.getState('account1')).toBeNull()
      expect(manager.getState('account2')).toBeNull()
    })
  })

  describe('统计信息', () => {
    it('应该正确统计各状态数量', async () => {
      // account1: 退避中
      manager.recordFailure('account1')

      // account2: 达到最大重试
      for (let i = 0; i < 3; i++) {
        manager.recordFailure('account2')
      }

      // account3: 可重试（等待时间已过）
      manager.recordFailure('account3')
      await new Promise(resolve => setTimeout(resolve, 1100))

      const stats = manager.getStats()
      expect(stats.total).toBe(3)
      expect(stats.inBackoff).toBe(1)
      expect(stats.maxRetriesReached).toBe(1)
      expect(stats.canRetry).toBe(1)
    })

    it('空管理器统计应该全部为0', () => {
      const stats = manager.getStats()
      expect(stats.total).toBe(0)
      expect(stats.inBackoff).toBe(0)
      expect(stats.maxRetriesReached).toBe(0)
      expect(stats.canRetry).toBe(0)
    })
  })

  describe('清理过期状态', () => {
    it('应该清理过期的成功状态', async () => {
      manager.recordSuccess('account1')

      // 等待超过 resetAfter * 2
      await new Promise(resolve => setTimeout(resolve, 11000))

      const cleaned = manager.cleanup()
      expect(cleaned).toBeGreaterThan(0)
      expect(manager.getState('account1')).toBeNull()
    })

    it('不应清理未过期的状态', () => {
      manager.recordSuccess('account1')

      const cleaned = manager.cleanup()
      expect(cleaned).toBe(0)
      expect(manager.getState('account1')).not.toBeNull()
    })
  })

  describe('重置后重新失败', () => {
    it('成功后一段时间失败应该重置退避状态', async () => {
      // 失败2次
      manager.recordFailure('account1')
      manager.recordFailure('account1')

      // 成功
      manager.recordSuccess('account1')

      // 等待超过 resetAfter
      await new Promise(resolve => setTimeout(resolve, 5100))

      // 再次失败应该从初始状态开始
      const state = manager.recordFailure('account1')
      expect(state.consecutiveFailures).toBe(1)
      expect(state.currentDelay).toBe(1000) // 恢复到 initialDelay
    })
  })
})

describe('全局工具函数', () => {
  beforeEach(() => {
    // 重置全局管理器
    backoffManager.resetAll()
  })

  describe('recordRefreshFailure', () => {
    it('应该记录失败到全局管理器', () => {
      const state = recordRefreshFailure('account1')
      expect(state.consecutiveFailures).toBe(1)
    })
  })

  describe('recordRefreshSuccess', () => {
    it('应该记录成功到全局管理器', () => {
      recordRefreshFailure('account1')
      recordRefreshSuccess('account1')

      const state = backoffManager.getState('account1')
      expect(state?.consecutiveFailures).toBe(0)
    })
  })

  describe('canRetryRefresh', () => {
    it('应该检查全局管理器状态', () => {
      expect(canRetryRefresh('new-account')).toBe(true)

      recordRefreshFailure('account1')
      expect(canRetryRefresh('account1')).toBe(false)
    })
  })

  describe('filterRetryableAccounts', () => {
    it('应该使用全局管理器过滤账号', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com'),
        createMockAccount('2', 'b@example.com')
      ]

      recordRefreshFailure('1')

      const { retryable, blocked } = filterRetryableAccounts(accounts)
      expect(retryable.length).toBe(1)
      expect(blocked.length).toBe(1)
    })
  })
})

describe('默认配置', () => {
  it('应该使用合理的默认值', () => {
    expect(DEFAULT_BACKOFF_CONFIG.initialDelay).toBe(60000) // 1分钟
    expect(DEFAULT_BACKOFF_CONFIG.maxDelay).toBe(3600000) // 1小时
    expect(DEFAULT_BACKOFF_CONFIG.multiplier).toBe(2)
    expect(DEFAULT_BACKOFF_CONFIG.maxRetries).toBe(5)
    expect(DEFAULT_BACKOFF_CONFIG.resetAfter).toBe(3600000) // 1小时
  })
})
