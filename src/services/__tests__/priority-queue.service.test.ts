/**
 * 优先级队列服务单元测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  TokenRefreshPriorityQueue,
  createRefreshPriorityQueue,
  sortAccountsByPriority
} from '../priority-queue.service'
import { Account } from '../../models/account.model'

// 模拟账号数据
function createMockAccount(id: string, email: string, expiresAt?: number): Account {
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
      expiresAt,
      region: 'us-east-1',
      authMethod: 'IdC'
    },
    createdAt: Date.now(),
    lastCheckedAt: Date.now()
  } as Account
}

describe('TokenRefreshPriorityQueue', () => {
  let queue: TokenRefreshPriorityQueue
  const now = Date.now()

  beforeEach(() => {
    queue = new TokenRefreshPriorityQueue()
  })

  describe('基本操作', () => {
    it('应该初始化为空队列', () => {
      expect(queue.size).toBe(0)
      expect(queue.isEmpty()).toBe(true)
    })

    it('应该正确添加单个账号', () => {
      const account = createMockAccount('1', 'test@example.com', now + 3600000)
      queue.enqueue(account)

      expect(queue.size).toBe(1)
      expect(queue.isEmpty()).toBe(false)
    })

    it('应该正确取出账号', () => {
      const account = createMockAccount('1', 'test@example.com', now + 3600000)
      queue.enqueue(account)

      const dequeued = queue.dequeue()
      expect(dequeued).toEqual(account)
      expect(queue.size).toBe(0)
    })

    it('空队列 dequeue 应该返回 null', () => {
      const dequeued = queue.dequeue()
      expect(dequeued).toBeNull()
    })

    it('应该支持 peek 操作（不移除）', () => {
      const account = createMockAccount('1', 'test@example.com', now + 3600000)
      queue.enqueue(account)

      const peeked = queue.peek()
      expect(peeked).toEqual(account)
      expect(queue.size).toBe(1) // 队列大小不变
    })
  })

  describe('优先级排序', () => {
    it('应该优先返回已过期的账号', () => {
      const expired = createMockAccount('1', 'expired@example.com', now - 1000)
      const notExpired = createMockAccount('2', 'notexpired@example.com', now + 3600000)

      queue.enqueue(notExpired)
      queue.enqueue(expired)

      const first = queue.dequeue()
      expect(first?.id).toBe('1') // 已过期的优先
    })

    it('应该优先返回即将过期的账号', () => {
      const expiringSoon = createMockAccount('1', 'soon@example.com', now + 60000) // 1分钟后过期
      const expiringLater = createMockAccount('2', 'later@example.com', now + 3600000) // 1小时后过期

      queue.enqueue(expiringLater)
      queue.enqueue(expiringSoon)

      const first = queue.dequeue()
      expect(first?.id).toBe('1') // 即将过期的优先
    })

    it('应该正确排序多个账号', () => {

    it('应该正确排序多个账号', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com', now + 7200000), // 2小时后
        createMockAccount('2', 'b@example.com', now - 1000),     // 已过期
        createMockAccount('3', 'c@example.com', now + 60000),    // 1分钟后
        createMockAccount('4', 'd@example.com', now + 3600000),  // 1小时后
        createMockAccount('5', 'e@example.com', undefined)       // 无过期时间
      ]

      accounts.forEach(acc => queue.enqueue(acc))

      // 预期顺序：已过期 < 1分钟后 < 1小时后 < 2小时后 < 无过期时间
      expect(queue.dequeue()?.id).toBe('2') // 已过期
('4') // 1小时后
      expect(queue.dequeue()?.id).toBe('1') // 2小时后
      expect(queue.dequeue()?.id).toBe('5') // 无过期时间
    })

    it('无过期时间的账号应该排在最后', () => {
      const noExpiry = createMockAccount('1', 'no@example.com', undefined)
      const withExpiry = createMockAccount('2', 'with@example.com', now + 3600000)

      queue.enqueue(noExpiry)
      queue.enqueue(withExpiry)

      const first = queue.dequeue()
      expect(first?.id).toBe('2') // 有过期时间的优先
    })
  })

  describe('批量操作', () => {
    it('应该支持批量添加', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com', now + 3600000),
        createMockAccount('2', 'b@example.com', now + 7200000),
        createMockAccount('3', 'c@example.com', now + 60000)
      ]

      queue.enqueueBatch(accounts)
      expect(queue.size).toBe(3)
    })

    it('应该支持批量取出', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com', now + 60000),
        createMockAccount('2', 'b@example.com', now + 3600000),
        createMockAccount('3', 'c@example.com', now + 7200000)
      ]

      queue.enqueueBatch(accounts)

      const batch = queue.dequeueBatch(2)
      expect(batch.length).toBe(2)
      expect(batch[0].id).toBe('1') // 最先过期的
      expect(batch[1].id).toBe('2')
    })

    it('批量取出数量超过队列大小时应该返回所有账号', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com', now + 3600000),
        createMockAccount('2', 'b@example.com', now + 7200000)
      ]

      queue.enqueueBatch(accounts)

      const batch = queue.dequeueBatch(10)
      expect(batch.length).toBe(2)
      expect(queue.isEmpty()).toBe(true)
    })
  })

  describe('统计信息', () => {
    it('应该正确统计各状态账号数量', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com', now - 1000),      // 已过期
        createMockAccount('2', 'b@example.com', now + 60000),     // 即将过期（< 5分钟）
        createMockAccount('3', 'c@example.com', now + 3600000),   // 健康
        createMockAccount('4', 'd@example.com', now + 7200000),   // 健康
        createMockAccount('5', 'e@example.com', undefined)        // 无过期时间
      ]

      queue.enqueueBatch(accounts)

      const stats = queue.getStats()
      expect(stats.total).toBe(5)
      expect(stats.expired).toBe(1)
      expect(stats.expiringSoon).toBe(1)
      expect(stats.healthy).toBe(2)
    })

    it('空队列统计应该全部为0', () => {
      const stats = queue.getStats()
      expect(stats.total).toBe(0)
      expect(stats.expired).toBe(0)
      expect(stats.expiringSoon).toBe(0)
      expect(stats.healthy).toBe(0)
    })
  })

  describe('清空操作', () => {
    it('应该正确清空队列', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com', now + 3600000),
        createMockAccount('2', 'b@example.com', now + 7200000)
      ]

      queue.enqueueBatch(accounts)

      queue.clear()
      expect(queue.size).toBe(0)
      expect(queue.isEmpty()).toBe(true)
    })
  })

  describe('转换为数组', () => {
    it('应该返回按优先级排序的数组', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com', now + 7200000),
        createMockAccount('2', 'b@example.com', now + 60000),
        createMockAccount('3', 'c@example.com', now + 3600000)
      ]

      queue.enqueueBatch(accounts)

      const array = queue.toArray()
      expect(array.length).toBe(3)
      expect(array[0].id).toBe('2') // 最先过期
      expect(array[1].id).toBe('3')
      expect(array[2].id).toBe('1') // 最后过期
    })
  })
})

describe('工具函数', () => {
  const now = Date.now()

  describe('createRefreshPriorityQueue', () => {
    it('应该创建并填充队列', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com', now + 3600000),
        createMockAccount('2', 'b@example.com', now + 7200000)
      ]

      const queue = createRefreshPriorityQueue(accounts)
      expect(queue.size).toBe(2)
    })
  })

  describe('sortAccountsByPriority', () => {
    it('应该按优先级排序账号数组', () => {
      const accounts = [
        createMockAccount('1', 'a@example.com', now + 7200000),
        createMockAccount('2', 'b@example.com', now + 60000),
        createMockAccount('3', 'c@example.com', now + 3600000)
      ]

      const sorted = sortAccountsByPriority(accounts)
      expect(sorted[0].id).toBe('2') // 最先过期
      expect(sorted[1].id).toBe('3')
      expect(sorted[2].id).toBe('1') // 最后过期
    })

    it('应该处理空数组', () => {
      const sorted = sortAccountsByPriority([])
      expect(sorted.length).toBe(0)
    })
  })
})
