/**
 * 数据库配置服务
 * 支持环境变量、JSON文件和默认值的三级配置优先级
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const CONFIG_DIR = path.join(__dirname, '../../config')
const CONFIG_FILE = path.join(CONFIG_DIR, 'database.config.json')
const OLD_CONFIG_FILE = path.join(__dirname, '../../data/config.json')

export interface DatabaseConfig {
  storage: 'mysql' | 'redis'
  mysql: {
    host: string
    port: number
    user: string
    password: string
    database: string
  }
  redis: {
    host: string
    port: number
    password?: string
    db: number
  }
}

// 默认配置
const DEFAULT_CONFIG: DatabaseConfig = {
  storage: 'mysql',
  mysql: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'KrioServer'
  },
  redis: {
    host: 'localhost',
    port: 6379,
    password: '',
    db: 0
  }
}

/**
 * 从环境变量加载配置
 */
function loadFromEnv(): Partial<DatabaseConfig> {
  const config: Partial<DatabaseConfig> = {}
  
  // 存储类型
  if (process.env.DATABASE_STORAGE) {
    config.storage = process.env.DATABASE_STORAGE as 'mysql' | 'redis'
  }
  
  // MySQL 配置
  if (process.env.DB_PASSWORD || process.env.MYSQL_HOST || process.env.MYSQL_PORT || 
      process.env.MYSQL_USER || process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD) {
    config.mysql = {
      host: process.env.MYSQL_HOST || DEFAULT_CONFIG.mysql.host,
      port: parseInt(process.env.MYSQL_PORT || String(DEFAULT_CONFIG.mysql.port)),
      user: process.env.MYSQL_USER || DEFAULT_CONFIG.mysql.user,
      password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || DEFAULT_CONFIG.mysql.password,
      database: process.env.MYSQL_DATABASE || DEFAULT_CONFIG.mysql.database
    }
  }
  
  // Redis 配置
  if (process.env.REDIS_HOST || process.env.REDIS_PORT || process.env.REDIS_PASSWORD) {
    config.redis = {
      host: process.env.REDIS_HOST || DEFAULT_CONFIG.redis.host,
      port: parseInt(process.env.REDIS_PORT || String(DEFAULT_CONFIG.redis.port)),
      password: process.env.REDIS_PASSWORD || DEFAULT_CONFIG.redis.password,
      db: parseInt(process.env.REDIS_DB || String(DEFAULT_CONFIG.redis.db))
    }
  }
  
  return config
}

/**
 * 从 JSON 文件加载配置
 */
function loadFromFile(): Partial<DatabaseConfig> {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return {}
    }
    
    const data = readFileSync(CONFIG_FILE, 'utf-8')
    return JSON.parse(data) as DatabaseConfig
  } catch (error: any) {
    console.warn('⚠️  加载数据库配置文件失败:', error.message)
    return {}
  }
}

/**
 * 从旧配置文件迁移
 */
function migrateFromOldConfig(): boolean {
  try {
    if (!existsSync(OLD_CONFIG_FILE)) {
      return false
    }
    
    const oldData = readFileSync(OLD_CONFIG_FILE, 'utf-8')
    const oldConfig = JSON.parse(oldData)
    
    // 检查是否有数据库配置
    if (!oldConfig.storage && !oldConfig.mysql && !oldConfig.redis) {
      return false
    }
    
    // 提取数据库配置
    const dbConfig: DatabaseConfig = {
      storage: oldConfig.storage || 'mysql',
      mysql: oldConfig.mysql || DEFAULT_CONFIG.mysql,
      redis: oldConfig.redis || DEFAULT_CONFIG.redis
    }
    
    // 保存到新位置
    saveDatabaseConfig(dbConfig)
    
    // 从旧配置中删除数据库配置
    delete oldConfig.storage
    delete oldConfig.mysql
    delete oldConfig.redis
    oldConfig.databaseConfigMigrated = true
    
    writeFileSync(OLD_CONFIG_FILE, JSON.stringify(oldConfig, null, 2))
    
    console.log('✅ 数据库配置已从旧文件迁移')
    return true
  } catch (error: any) {
    console.error('❌ 迁移配置失败:', error.message)
    return false
  }
}

/**
 * 加载数据库配置
 * 优先级: 环境变量 > JSON文件 > 默认值
 */
export function loadDatabaseConfig(): DatabaseConfig {
  // 首次运行时尝试迁移
  if (!existsSync(CONFIG_FILE)) {
    migrateFromOldConfig()
  }

  // 加载配置（按优先级合并）
  const envConfig = loadFromEnv()
  const fileConfig = loadFromFile()


  // 字段级别的合并，而不是对象级别的合并
  const redisConfig = {
    ...DEFAULT_CONFIG.redis,
    ...fileConfig.redis,
    // 仅当环境变量明确提供时才覆盖
    ...(process.env.REDIS_HOST && { host: process.env.REDIS_HOST }),
    ...(process.env.REDIS_PORT && { port: parseInt(process.env.REDIS_PORT) }),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
    ...(process.env.REDIS_DB && { db: parseInt(process.env.REDIS_DB) })
  }

  const config: DatabaseConfig = {
    storage: envConfig.storage || fileConfig.storage || DEFAULT_CONFIG.storage,
    mysql: {
      ...DEFAULT_CONFIG.mysql,
      ...fileConfig.mysql,
      ...envConfig.mysql
    },
    redis: redisConfig
  }

  return config
}

/**
 * 保存数据库配置到文件
 */
export function saveDatabaseConfig(config: DatabaseConfig): void {
  try {
    // 确保目录存在
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true })
    }
    
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
    console.log('✅ 数据库配置已保存')
  } catch (error: any) {
    console.error('❌ 保存数据库配置失败:', error.message)
    throw error
  }
}

/**
 * 获取脱敏后的配置（用于前端显示）
 */
export function getMaskedConfig(config: DatabaseConfig): DatabaseConfig {
  return {
    ...config,
    mysql: {
      ...config.mysql,
      password: config.mysql.password ? '******' : ''
    },
    redis: {
      ...config.redis,
      password: config.redis.password ? '******' : ''
    }
  }
}

/**
 * 验证配置
 */
export function validateDatabaseConfig(config: DatabaseConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 验证存储类型
  if (!['mysql', 'redis'].includes(config.storage)) {
    errors.push('存储类型必须是 mysql 或 redis')
  }

  // 验证 MySQL 配置
  if (config.storage === 'mysql') {
    if (!config.mysql.host) errors.push('MySQL 主机地址不能为空')
    if (!config.mysql.user) errors.push('MySQL 用户名不能为空')
    if (!config.mysql.database) errors.push('MySQL 数据库名不能为空')
    if (config.mysql.port < 1 || config.mysql.port > 65535) {
      errors.push('MySQL 端口必须在 1-65535 之间')
    }
  }

  // 验证 Redis 配置
  if (config.storage === 'redis') {
    if (!config.redis.host) errors.push('Redis 主机地址不能为空')
    if (config.redis.port < 1 || config.redis.port > 65535) {
      errors.push('Redis 端口必须在 1-65535 之间')
    }
    if (config.redis.db < 0 || config.redis.db > 15) {
      errors.push('Redis 数据库编号必须在 0-15 之间')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 获取配置来源信息
 */
export function getConfigSource(): {
  storage: 'env' | 'file' | 'default'
  mysql: 'env' | 'file' | 'default'
  redis: 'env' | 'file' | 'default'
} {
  const envConfig = loadFromEnv()
  const fileConfig = loadFromFile()
  
  return {
    storage: process.env.DATABASE_STORAGE ? 'env' : 
             fileConfig.storage ? 'file' : 'default',
    mysql: envConfig.mysql ? 'env' : 
           fileConfig.mysql ? 'file' : 'default',
    redis: envConfig.redis ? 'env' : 
           fileConfig.redis ? 'file' : 'default'
  }
}
