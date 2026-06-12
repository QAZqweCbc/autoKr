/**
 * 统一数据迁移服务
 * 确保 JSON 和 MySQL 存储模式使用相同的迁移逻辑
 */

import { logger } from '../utils/logger'

export interface MigrationStrategy {
  version: string
  description: string
  migrate: (data: any) => Promise<any>
}

/**
 * 数据迁移管理器
 */
export class DataMigration {
  private strategies: MigrationStrategy[] = []

  /**
   * 注册迁移策略
   */
  register(strategy: MigrationStrategy): void {
    this.strategies.push(strategy)
    // 按版本号排序
    this.strategies.sort((a, b) => a.version.localeCompare(b.version))
  }

  /**
   * 执行迁移
   */
  async migrate(data: any, fromVersion: string, toVersion: string): Promise<any> {
    const applicable = this.strategies.filter(s =>
      s.version > fromVersion && s.version <= toVersion
    )

    if (applicable.length === 0) {
      return data
    }

    let result = data
    for (const strategy of applicable) {
      try {
        logger.info(`Applying migration: ${strategy.version} - ${strategy.description}`)
        result = await strategy.migrate(result)
      } catch (error: any) {
        logger.error(`Migration failed: ${strategy.version}`, { error: error.message })
        throw new Error(`Migration ${strategy.version} failed: ${error.message}`)
      }
    }

    return result
  }

  /**
   * 获取所有已注册的迁移策略
   */
  getStrategies(): MigrationStrategy[] {
    return [...this.strategies]
  }

  /**
   * 获取最新版本号
   */
  getLatestVersion(): string {
    if (this.strategies.length === 0) {
      return '0.0.0'
    }
    return this.strategies[this.strategies.length - 1].version
  }
}

/**
 * 账号数据迁移实例
 */
export const accountMigration = new DataMigration()

// ==================== 注册迁移策略 ====================

/**
 * v1.0.0: 添加 ssoToken 字段
 */
accountMigration.register({
  version: '1.0.0',
  description: 'Add ssoToken field to credentials',
  migrate: async (account) => {
    if (!account.credentials) {
      account.credentials = {}
    }

    return {
      ...account,
      credentials: {
        ...account.credentials,
        ssoToken: account.credentials.ssoToken || null
      }
    }
  }
})

/**
 * v1.1.0: 添加订阅字段
 */
accountMigration.register({
  version: '1.1.0',
  description: 'Add subscription fields',
  migrate: async (account) => {
    return {
      ...account,
      subscription: account.subscription || {
        type: 'free',
        status: 'active',
        title: null,
        rawType: null,
        expiresAt: null,
        daysRemaining: null
      }
    }
  }
})

/**
 * v1.2.0: 添加使用量字段
 */
accountMigration.register({
  version: '1.2.0',
  description: 'Add usage tracking fields',
  migrate: async (account) => {
    return {
      ...account,
      usage: account.usage || {
        current: 0,
        limit: 0,
        percentUsed: 0,
        lastUpdated: null
      }
    }
  }
})

/**
 * v1.3.0: 添加账号状态字段
 */
accountMigration.register({
  version: '1.3.0',
  description: 'Add account status fields',
  migrate: async (account) => {
    return {
      ...account,
      status: account.status || 'active',
      lastError: account.lastError || null,
      consecutiveFailures: account.consecutiveFailures || 0,
      isActive: account.isActive !== undefined ? account.isActive : true
    }
  }
})

/**
 * 迁移单个账号到最新版本
 */
export async function migrateAccount(account: any): Promise<any> {
  const currentVersion = account._version || '0.0.0'
  const latestVersion = accountMigration.getLatestVersion()

  if (currentVersion === latestVersion) {
    return account
  }

  const migrated = await accountMigration.migrate(account, currentVersion, latestVersion)
  migrated._version = latestVersion

  return migrated
}

/**
 * 批量迁移账号
 */
export async function migrateAccounts(accounts: any[]): Promise<any[]> {
  return Promise.all(accounts.map(acc => migrateAccount(acc)))
}
