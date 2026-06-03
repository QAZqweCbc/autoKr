/**
 * 优先级队列服务
 * 根据 Token 过期时间排序，优先刷新即将过期的账号
 */

import { Account } from '../models/account.model'

/**
 * 优先级队列项
 */
interface PriorityQueueItem {
  account: Account
  priority: number  // 数值越小优先级越高
  expiresAt: number
}

/**
 * 优先级队列（最小堆实现）
 */
export class TokenRefreshPriorityQueue {
  private heap: PriorityQueueItem[] = []

  /**
   * 获取队列大小
   */
  get size(): number {
    return this.heap.length
  }

  /**
   * 队列是否为空
   */
  isEmpty(): boolean {
    return this.heap.length === 0
  }

  /**
   * 添加账号到队列
   */
  enqueue(account: Account): void {
    const priority = this.calculatePriority(account)
    const item: PriorityQueueItem = {
      account,
      priority,
      expiresAt: account.credentials.expiresAt || 0
    }

    this.heap.push(item)
    this.bubbleUp(this.heap.length - 1)
  }

  /**
   * 批量添加账号
   */
  enqueueBatch(accounts: Account[]): void {
    for (const account of accounts) {
      this.enqueue(account)
    }
  }

  /**
   * 取出优先级最高的账号
   */
  dequeue(): Account | null {
    if (this.isEmpty()) {
      return null
    }

    const root = this.heap[0]
    const last = this.heap.pop()!

    if (this.heap.length > 0) {
      this.heap[0] = last
      this.bubbleDown(0)
    }

    return root.account
  }

  /**
   * 批量取出指定数量的账号
   */
  dequeueBatch(count: number): Account[] {
    const result: Account[] = []

    for (let i = 0; i < count && !this.isEmpty(); i++) {
      const account = this.dequeue()
      if (account) {
        result.push(account)
      }
    }

    return result
  }

  /**
   * 查看优先级最高的账号（不移除）
   */
  peek(): Account | null {
    return this.isEmpty() ? null : this.heap[0].account
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.heap = []
  }

  /**
   * 获取所有账号（按优先级排序）
   */
  toArray(): Account[] {
    return [...this.heap]
      .sort((a, b) => a.priority - b.priority)
      .map(item => item.account)
  }

  /**
   * 计算账号的优先级
   *
   * 优先级计算规则：
   * 1. 已过期的账号优先级最高（负数）
   * 2. 未过期的账号按剩余时间排序（剩余时间越短优先级越高）
   * 3. 没有过期时间的账号优先级最低
   */
  private calculatePriority(account: Account): number {
    const now = Date.now()
    const expiresAt = account.credentials.expiresAt

    if (!expiresAt) {
      // 没有过期时间，优先级最低
      return Number.MAX_SAFE_INTEGER
    }

    const timeUntilExpiry = expiresAt - now

    if (timeUntilExpiry <= 0) {
      // 已过期，优先级最高（转换为负数）
      return timeUntilExpiry
    }

    // 未过期，按剩余时间排序
    return timeUntilExpiry
  }

  /**
   * 向上调整堆（用于插入）
   */
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)

      if (this.heap[index].priority >= this.heap[parentIndex].priority) {
        break
      }

      this.swap(index, parentIndex)
      index = parentIndex
    }
  }

  /**
   * 向下调整堆（用于删除）
   */
  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1
      const rightChild = 2 * index + 2
      let smallest = index

      if (
        leftChild < this.heap.length &&
        this.heap[leftChild].priority < this.heap[smallest].priority
      ) {
        smallest = leftChild
      }

      if (
        rightChild < this.heap.length &&
        this.heap[rightChild].priority < this.heap[smallest].priority
      ) {
        smallest = rightChild
      }

      if (smallest === index) {
        break
      }

      this.swap(index, smallest)
      index = smallest
    }
  }

  /**
   * 交换两个元素
   */
  private swap(i: number, j: number): void {
    const temp = this.heap[i]
    this.heap[i] = this.heap[j]
    this.heap[j] = temp
  }

  /**
   * 获取队列统计信息
   */
  getStats(): {
    total: number
    expired: number
    expiringSoon: number
    healthy: number
  } {
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    let expired = 0
    let expiringSoon = 0
    let healthy = 0

    for (const item of this.heap) {
      const expiresAt = item.expiresAt

      if (!expiresAt) {
        continue
      }

      const timeUntilExpiry = expiresAt - now

      if (timeUntilExpiry <= 0) {
        expired++
      } else if (timeUntilExpiry <= fiveMinutes) {
        expiringSoon++
      } else {
        healthy++
      }
    }

    return {
      total: this.heap.length,
      expired,
      expiringSoon,
      healthy
    }
  }
}

/**
 * 创建刷新优先级队列
 */
export function createRefreshPriorityQueue(accounts: Account[]): TokenRefreshPriorityQueue {
  const queue = new TokenRefreshPriorityQueue()
  queue.enqueueBatch(accounts)
  return queue
}

/**
 * 按优先级排序账号（工具函数）
 */
export function sortAccountsByPriority(accounts: Account[]): Account[] {
  const queue = createRefreshPriorityQueue(accounts)
  return queue.toArray()
}
