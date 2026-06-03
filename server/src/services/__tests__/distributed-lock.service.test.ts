/**
 * 分布式锁服务单元测试
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  FileDistributedLock,
  LockManagerFactory,
  withLock,
  DEFAULT_LOCK_CONFIG
} from '../distributed-lock.service'
import * as fs from 'fort * as path from 'path'
import * as os from 'os'

describe('FileDistributedLock', () => {
  let lock: FileDistributedLock
  let lockFilePath: string

  beforeEach(() => {
    lock = new FileDistributedLock({
      key: 'test_lock',
      ttl: 5000,
      retryDelay: 100,
      retryTimes: 3
    })
    lockFilePath = path.join(os.tmpdir(), 'test_lock.lock')

    // 清理可能存在的锁文件
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath)
    }
  })

  afterEach(async () => {
    // 释放锁并清理
    await lock.release()
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath)
    }
  })

  describe('获取锁', () => {
    it('应该成功获取锁', async () => {
      const acquired = awaquire()
      expect(acquired).toBe(true)
      expect(fs.existsSync(lockFilePath)).toBe(true)
    })

    it('锁文件应该包含正确的信息', async () => {
      await lock.acquire()

      const content = fs.readFileSync(lockFilePath, 'utf-8')
      const lockData = JSON.parse(content)

      expect(lockData).toHaveProperty('value')
      expect(lockData).toHaveProperty('timestamp')
      expect(lockData).toHaveProperty('pid')
      expect(lockData).toHaveProperty('hostname')
      expect(lockData.pid).toBe(process.pid)
    })

    it('已被占用的锁应该获取失败', async () => {
      const lock1 = new FileDistributedLock({
        key: 'test_lock',
        ttl: 5000,
        retryDelay: 100,
        retryTimes: 1
      })
      const lock2 = new FileDistributedLock({
        key: 'test_lock',
        ttl: 5000,
        retryDelay: 100,
        retryTimes: 1
      })

      const acquired1 = await lock1.acquire()
      expect(acquired1).toBe(true)

      const acquired2 = await lock2.acquire()
      expect(acquired2).toBe(false)

      await lock1.release()
    })

    it('过期的锁应该可以被重新获取', async () => {
      const lock1 = new FileDistributedLock({
        key: 'test_lock',
        ttl: 100, // 100ms 过期
        retryDelay: 100,
        retryTimes: 1
      })
      const lock2 = new FileDistributedLock({
        key: 'test_lock',
        ttl: 5000,
        retryDelay: 100,
        retryTimes: 1
      })

      await lock1.acquire()

      // 等待锁过期
      await new Promise(resolve => setTimeout(resolve, 150))

      const acquired2 = await lock2.acquire()
      expect(acquired2).toBe(true)

      await lock2.release()
    })

    it('应该支持重试', async () => {
      const lock1 = new FileDistributedLock({
        key: 'test_lock',
        ttl: 200,
        retryDelay: 50,
        retryTimes: 3
      })
      const lock2 = new FileDistributedLock({
        key: 'test_lock',
        ttl: 5000,
        retryDelay: 100,
        retryTimes: 3
      })

      await lock1.acquire()

      // lock2 会重试，第一次失败，等待后重试成功
      setTimeout(async () => {
        await lock1.release()
      }, 150)

      const acquired2 = await lock2.acquire()
      expect(acquired2).toBe(true)

      await lock2.release()
    })
  })

  describe('释放锁', () => {
    it('应该成功释放锁', async () => {
      await lock.acquire()
      await lock.release()

      expect(fs.existsSync(lockFilePath)).toBe(false)
    })

    it('未获取锁时释放应该不报错', async () => {
      await expect(lock.release()).resolves.not.toThrow()
    })

    it('只能释放自己的锁', async () => {
      const lock1 = new FileDistributedLock({
        key: 'test_lock',
        ttl: 5000,
        retryDelay: 100,
        retryTimes: 1
      })
lock2 = new FileDistributedLock({
        key:ck',
        ttl: 5000,
        retryDelay: 100,
        retryTimes: 1
      })

      await lock1.acquire()

      // lock2 尝试释放 lock1 的锁（不应成功）
      await lock2.release()

      // 锁文件应该仍然存在
      expect(fs.existsSync(lockFilePath)).toBe(true)

      await lock1.release()
    })
  })

  describe('延长锁', () => {
    it('应该成功延长锁的有效期', async () => {
      await lock.acquire()

      const extended = await lock.extend(10000)
      expect(extended).toBe(true)
    })

    it('未获取锁时延长应该失败', async () => {
      const extended = await lock.extend(10000)
      expect(extended).toBe(false)
    })

    it('只能延长自己的锁', async () => {
      const lock1 = new FileDistributedLock({
        key: 'test_lock',
        ttl: 5000,
        retryDelay: 100,
        retryTimes: 1
      })
      const lock2 = new FileDistributedLock({
        key: 'test_lock',
        ttl: 5000,
        retryDelay: 100,
        retryTimes: 1
      })

      await lock1.acquire()

      // lock2 尝试延长 lock1 的锁（应该失败）
      const extended = await lock2.extend(10000)
      expect(extended).toBe(false)

      await lock1.release()
    })
  })

  describe('检查锁状态', () => {
    it('未获取锁时 isLocked 应该返回 false', async () => {
      const locked = await lock.isLocked()
      expect(locked).toBe(false)
    })

    it('已获取锁时 isLocked 应该返回 true', async () => {
      await lock.acquire()

      const locked = await lock.isLocked()
      expect(locked).toBe(true)
    })

    it('过期的锁 isLocked 应该返回 false', async () => {
      const shortLock = new FileDistributedLock({
        key: 'test_lock',
        ttl: 100,
        retryDelay: 100,
        retryTimes: 1
      })

      await shortLock.acquire()

      // 等待锁过期
      await new Promise(resolve => setTimeout(resolve, 150))

      const locked = await shortLock.isLocked()
      expect(locked).toBe(false)

      await shortLock.release()
    })
  })

  describe('获取 TTL', () => {
    it('未获取锁时 TTL 应该为 0', async () => {
      const ttl = await lock.getTTL()
      expect(ttl).toBe(0)
    })

    it('已获取锁时应该返回剩余时间', async () => {
      await lock.acquire()

      const ttl = await lock.getTTL()
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(5000)
    })

    it('过期的锁 TTL 应该为 0', async () => {
      const shortLock = new FileDistributedLock({
        key: 'test_lock',
        ttl: 100,
        retryDelay: 100,
        retryTimes: 1
      })

      await shortLock.acquire()

      // 等待锁过期
      await new Promise(resolve => setTimeout(resolve, 150))

      const ttl = await shortLock.getTTL()
      expect(ttl).toBe(0)

      await shortLock.release()
    })
  })
})

describe('LockManagerFactory', () => {
  describe('createLock', () => {
    it('没有 Redis 时应该创建文件锁', () => {
      const lock = LockManagerFactory.createLock({
        key: 'test_lock'
      })

      expect(lock).toBeInstanceOf(FileDistributedLock)
    })

    it('应该使用自定义配置', () => {
      const lock = LockManagerFactory.createLock({
        key: 'custom_lock',
        ttl: 10000,
        retryDelay: 500,
        retryTimes: 5
      })

      expect(lock).toBeDefined()
    })
  })
})

describe('withLock 工具函数', () => {
  let lock: FileDistributedLock
  let lockFilePath: string

  beforeEach(() => {
    lock = new FileDistributedLock({
      key: 'test_lock',
      ttl: 5000,
      retryDelay: 100,
      retryTimes: 1
    })
    lockFilePath = path.join(os.tmpdir(), 'test_lock.lock')

    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath)
    }
  })

  afterEach(() => {
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath)
    }
  })

  it('应该在任务执行前获取锁', async () => {
    let executed = false

    await withLock(lock, async () => {
      executed = true
      expect(fs.existsSync(lockFilePath)).toBe(true)
    })

    expect(executed).toBe(true)
  })

  it('应该在任务执行后释放锁', async () => {
    await withLock(lock, async () => {
      // 任务执行
    })

    expect(fs.existsSync(lockFilePath)).toBe(false)
  })

  it('应该返回任务的返回值', async () => {
    const result = await withLock(lock, async () => {
      return 'success'
    })

    expect(result).toBe('success')
  })

  it('任务抛出错误时应该释放锁', async () => {
    await expect(
      withLock(lock, async () => {
        throw new Error('Task failed')
      })
    ).rejects.toThrow('Task failed')

    expect(fs.existsSync(lockFilePath)).toBe(false)
  })

  it('获取锁失败时应该返回 null', async () => {
    const lock1 = new FileDistributedLock({
      key: 'test_lock',
      ttl: 5000,
      retryDelay: 100,
      retryTimes: 1
    })
    const lock2 = new FileDistributedLock({
      key: 'test_lock',
      ttl: 5000,
      retryDelay: 100,
      retryTimes: 1
    })

    await lock1.acquire()

    const result = await withLock(lock2, async () => {
      return 'should not execute'
    })

    expect(result).toBeNull()

    await lock1.release()
  })

  it('应该支持异步任务', async () => {
    const result = await withLock(lock, async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return 'async result'
    })

    expect(result).toBe('async result')
  })
})

describe('默认配置', () => {
  it('应该使用合理的默认值', () => {
    expect(DEFAULT_LOCK_CONFIG.key).toBe('token_refresh_lock')
    expect(DEFAULT_LOCK_CONFIG.ttl).toBe(600000) // 10分钟
    expect(DEFAULT_LOCK_CONFIG.retryDelay).toBe(1000) // 1秒
    expect(DEFAULT_LOCK_CONFIG.retryTimes).toBe(3)
  })
})

describe('并发场景测试', () => {
  it('多个实例同时获取锁，只有一个成功', async () => {
    const locks = Array.from({ length: 5 }, () =>
      new FileDistributedLock({
        key: 'test_lock',
        ttl: 5000,
        retryDelay: 50,
        retryTimes: 1
      })
    )

    const results = await Promise.all(
      locks.map(lock => lock.acquire())
    )

    const successCount = results.filter(r => r === true).length
    expect(successCount).toBe(1)

    // 清理
    for (const lock of locks) {
      await lock.release()
    }
  })

  it('顺序获取锁应该都成功', async () => {
    const lock1 = new FileDistributedLock({
      key: 'test_lock',
      ttl: 5000,
      retryDelay: 100,
      retryTimes: 1
    })
    const lock2 = new FileDistributedLock({
      key: 'test_lock',
      ttl: 5000,
      retryDelay: 100,
      retryTimes: 1
    })

    const acquired1 = await lock1.acquire()
    expect(acquired1).toBe(true)

    await lock1.release()

    const acquired2 = await lock2.acquire()
    expect(acquired2).toBe(true)

    await lock2.release()
  })
})
