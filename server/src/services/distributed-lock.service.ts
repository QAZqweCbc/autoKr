/**
 * 分布式锁服务
 * 防止多实例部署时重复刷新 Token
 *
 * 支持两种实现：
 * 1. Redis 分布式锁（推荐，多实例环境）
 * 2. 文件锁（单实例环境）
 */

import Redis from 'ioredis'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * 锁配置
 */
export interface LockConfig {
  key: string           // 锁的键名
  ttl: number          // 锁的过期时间（毫秒）
  retryDelay: number   // 获取锁失败后的重试延迟（毫秒）
  retryTimes: number   // 最大重试次数
}

/**
 * 默认锁配置
 */
export const DEFAULT_LOCK_CONFIG: LockConfig = {
  key: 'token_refresh_lock',
  ttl: 600_000,        // 10 分钟（足够完成一次刷新）
  retryDelay: 1000,    // 1 秒
  retryTimes: 3        // 最多重试 3 次
}

/**
 * 锁接口
 */
export interface DistributedLock {
  /**
   * 获取锁
   */
  acquire(): Promise<boolean>

  /**
   * 释放锁
   */
  release(): Promise<void>

  /**
   * 延长锁的过期时间
   */
  extend(ttl: number): Promise<boolean>

  /**
   * 检查锁是否存在
   */
  isLocked(): Promise<boolean>

  /**
   * 获取锁的剩余时间（毫秒）
   */
  getTTL(): Promise<number>
}

/**
 * Redis 分布式锁实现
 */
export class RedisDistributedLock implements DistributedLock {
  private redis: Redis
  private config: LockConfig
  private lockValue: string
  private isAcquired: boolean = false

  constructor(redis: Redis, config: Partial<LockConfig> = {}) {
    this.redis = redis
    this.config = { ...DEFAULT_LOCK_CONFIG, ...config }
    this.lockValue = this.generateLockValue()
  }

  async acquire(): Promise<boolean> {
    for (let i = 0; i <= this.config.retryTimes; i++) {
      try {
        // 使用 SET NX EX 原子操作
        const result = await this.redis.set(
          this.config.key,
          this.lockValue,
          'PX',
          this.config.ttl,
          'NX'
        )

        if (result === 'OK') {
          this.isAcquired = true
          console.log(`🔒 [Redis Lock] 获取锁成功: ${this.config.key}`)
          return true
        }

        // 获取锁失败，等待重试
        if (i < this.config.retryTimes) {
          console.log(
            `⏳ [Redis Lock] 获取锁失败，${this.config.retryDelay}ms 后重试 (${i + 1}/${this.config.retryTimes})`
          )
          await this.sleep(this.config.retryDelay)
        }
      } catch (error: any) {
        console.error(`❌ [Redis Lock] 获取锁异常:`, error.message)
        throw error
      }
    }

    console.log(`❌ [Redis Lock] 获取锁失败，已达最大重试次数`)
    return false
  }

  async release(): Promise<void> {
    if (!this.isAcquired) {
      return
    }

    try {
      // 使用 Lua 脚本确保只删除自己的锁
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `

      const result = await this.redis.eval(script, 1, this.config.key, this.lockValue)

      if (result === 1) {
        console.log(`🔓 [Redis Lock] 释放锁成功: ${this.config.key}`)
        this.isAcquired = false
      } else {
        console.warn(`⚠️  [Redis Lock] 锁已被其他实例持有或已过期`)
      }
    } catch (error: any) {
      console.error(`❌ [Redis Lock] 释放锁异常:`, error.message)
      throw error
    }
  }

  async extend(ttl: number): Promise<boolean> {
    if (!this.isAcquired) {
      return false
    }

    try {
      // 使用 Lua 脚本确保只延长自己的锁
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `

      const result = await this.redis.eval(
        script,
        1,
        this.config.key,
        this.lockValue,
        ttl.toString()
      )

      if (result === 1) {
        console.log(`⏰ [Redis Lock] 延长锁成功: ${ttl}ms`)
        return true
      } else {
        console.warn(`⚠️  [Redis Lock] 锁已被其他实例持有或已过期`)
        return false
      }
    } catch (error: any) {
      console.error(`❌ [Redis Lock] 延长锁异常:`, error.message)
      return false
    }
  }

  async isLocked(): Promise<boolean> {
    try {
      const value = await this.redis.get(this.config.key)
      return value !== null
    } catch (error: any) {
      console.error(`❌ [Redis Lock] 检查锁状态异常:`, error.message)
      return false
    }
  }

  async getTTL(): Promise<number> {
    try {
      const ttl = await this.redis.pttl(this.config.key)
      return ttl > 0 ? ttl : 0
    } catch (error: any) {
      console.error(`❌ [Redis Lock] 获取锁TTL异常:`, error.message)
      return 0
    }
  }

  private generateLockValue(): string {
    // 使用主机名 + 进程ID + 随机数生成唯一值
    return `${os.hostname()}-${process.pid}-${Date.now()}-${Math.random()}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * 文件锁实现（单实例环境）
 */
export class FileDistributedLock implements DistributedLock {
  private config: LockConfig
  private lockFilePath: string
  private lockValue: string
  private isAcquired: boolean = false
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<LockConfig> = {}) {
    this.config = { ...DEFAULT_LOCK_CONFIG, ...config }
    this.lockFilePath = path.join(os.tmpdir(), `${this.config.key}.lock`)
    this.lockValue = this.generateLockValue()
  }

  async acquire(): Promise<boolean> {
    for (let i = 0; i <= this.config.retryTimes; i++) {
      try {
        // 检查锁文件是否存在
        if (fs.existsSync(this.lockFilePath)) {
          // 读取锁文件内容
          const lockData = this.readLockFile()

          if (lockData) {
            // 检查锁是否过期
            if (Date.now() - lockData.timestamp < this.config.ttl) {
              // 锁未过期，获取失败
              if (i < this.config.retryTimes) {
                console.log(
                  `⏳ [File Lock] 获取锁失败，${this.config.retryDelay}ms 后重试 (${i + 1}/${this.config.retryTimes})`
                )
                await this.sleep(this.config.retryDelay)
                continue
              } else {
                console.log(`❌ [File Lock] 获取锁失败，已达最大重试次数`)
                return false
              }
            } else {
              // 锁已过期，删除旧锁
              console.log(`🧹 [File Lock] 清理过期锁`)
              fs.unlinkSync(this.lockFilePath)
            }
          }
        }

        // 创建锁文件
        const lockData = {
          value: this.lockValue,
          timestamp: Date.now(),
          pid: process.pid,
          hostname: os.hostname()
        }

        fs.writeFileSync(this.lockFilePath, JSON.stringify(lockData), 'utf-8')

        this.isAcquired = true
        console.log(`🔒 [File Lock] 获取锁成功: ${this.lockFilePath}`)

        // 启动自动清理定时器
        this.startCleanupTimer()

        return true
      } catch (error: any) {
        console.error(`❌ [File Lock] 获取锁异常:`, error.message)
        throw error
      }
    }

    return false
  }

  async release(): Promise<void> {
    if (!this.isAcquired) {
      return
    }

    try {
      // 停止清理定时器
      this.stopCleanupTimer()

      // 检查锁文件是否是自己的
      if (fs.existsSync(this.lockFilePath)) {
        const lockData = this.readLockFile()

        if (lockData && lockData.value === this.lockValue) {
          fs.unlinkSync(this.lockFilePath)
          console.log(`🔓 [File Lock] 释放锁成功: ${this.lockFilePath}`)
          this.isAcquired = false
        } else {
          console.warn(`⚠️  [File Lock] 锁已被其他实例持有`)
        }
      }
    } catch (error: any) {
      console.error(`❌ [File Lock] 释放锁异常:`, error.message)
      throw error
    }
  }

  async extend(ttl: number): Promise<boolean> {
    if (!this.isAcquired) {
      return false
    }

    try {
      if (fs.existsSync(this.lockFilePath)) {
        const lockData = this.readLockFile()

        if (lockData && lockData.value === this.lockValue) {
          // 更新时间戳
          lockData.timestamp = Date.now()
          fs.writeFileSync(this.lockFilePath, JSON.stringify(lockData), 'utf-8')
          console.log(`⏰ [File Lock] 延长锁成功`)
          return true
        }
      }

      return false
    } catch (error: any) {
      console.error(`❌ [File Lock] 延长锁异常:`, error.message)
      return false
    }
  }

  async isLocked(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.lockFilePath)) {
        return false
      }

      const lockData = this.readLockFile()

      if (!lockData) {
        return false
      }

      // 检查锁是否过期
      return Date.now() - lockData.timestamp < this.config.ttl
    } catch (error: any) {
      console.error(`❌ [File Lock] 检查锁状态异常:`, error.message)
      return false
    }
  }

  async getTTL(): Promise<number> {
    try {
      if (!fs.existsSync(this.lockFilePath)) {
        return 0
      }

      const lockData = this.readLockFile()

      if (!lockData) {
        return 0
      }

      const elapsed = Date.now() - lockData.timestamp
      const remaining = this.config.ttl - elapsed

      return Math.max(0, remaining)
    } catch (error: any) {
      console.error(`❌ [File Lock] 获取锁TTL异常:`, error.message)
      return 0
    }
  }

  private readLockFile(): { value: string; timestamp: number; pid: number; hostname: string } | null {
    try {
      const content = fs.readFileSync(this.lockFilePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  private generateLockValue(): string {
    return `${os.hostname()}-${process.pid}-${Date.now()}-${Math.random()}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private startCleanupTimer(): void {
    // 定时延长锁（防止长时间任务导致锁过期）
    this.cleanupTimer = setInterval(() => {
      this.extend(this.config.ttl)
    }, this.config.ttl / 2)
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

/**
 * 锁管理器工厂
 */
export class LockManagerFactory {
  private static redisClient: Redis | null = null

  /**
   * 设置 Redis 客户端
   */
  static setRedisClient(redis: Redis): void {
    this.redisClient = redis
  }

  /**
   * 创建分布式锁
   */
  static createLock(config: Partial<LockConfig> = {}): DistributedLock {
    if (this.redisClient) {
      // 使用 Redis 锁
      console.log('📡 [Lock Manager] 使用 Redis 分布式锁')
      return new RedisDistributedLock(this.redisClient, config)
    } else {
      // 使用文件锁
      console.log('📁 [Lock Manager] 使用文件锁（单实例模式）')
      return new FileDistributedLock(config)
    }
  }
}

/**
 * 工具函数：使用锁执行任务
 */
export async function withLock<T>(
  lock: DistributedLock,
  task: () => Promise<T>
): Promise<T | null> {
  const acquired = await lock.acquire()

  if (!acquired) {
    console.log('❌ [Lock] 未能获取锁，放弃执行任务')
    return null
  }

  try {
    console.log('✅ [Lock] 已获取锁，开始执行任务')
    const result = await task()
    return result
  } finally {
    await lock.release()
    console.log('🔓 [Lock] 任务完成，已释放锁')
  }
}
