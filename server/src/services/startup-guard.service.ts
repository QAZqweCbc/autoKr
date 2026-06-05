/**
 * 启动守护服务
 * 在服务启动时验证必要的配置和数据库连接
 */

import { existsSync, unlinkSync } from 'fs'
import path from 'path'
import { loadDatabaseConfig, DatabaseConfig } from './database-config.service'

const SETUP_COMPLETE_FILE = path.join(process.cwd(), '.setup-completed')

/**
 * 启动守护错误类
 */
export class StartupGuardError extends Error {
  constructor(
    message: string,
    public code: 'SETUP_NOT_COMPLETED' | 'INVALID_CONFIG' | 'CONNECTION_FAILED'
  ) {
    super(message)
    this.name = 'StartupGuardError'
  }
}

/**
 * 数据库连接验证结果
 */
export interface ConnectionTestResult {
  success: boolean
  error?: string
  latency?: number
}

/**
 * 启动守护执行
 * 检查配置完整性并验证数据库连接
 * @throws {StartupGuardError} 如果检查失败
 */
export async function guardStartup(): Promise<void> {
  console.log('\n🛡️  启动守护检查中...')

  // 1. 检查是否完成初始配置
  if (!isSetupCompleted()) {
    throw new StartupGuardError(
      '系统尚未完成初始配置，请访问 /setup 页面完成配置',
      'SETUP_NOT_COMPLETED'
    )
  }

  console.log('✅ 配置完成标记已确认')

  // 2. 加载并验证数据库配置
  const config = loadDatabaseConfig()
  validateDatabaseConfig(config)

  console.log(`✅ 数据库配置验证通过 (${config.storage.toUpperCase()})`)

  // 3. 测试数据库连接
  try {
    const result = await verifyDatabaseConnection(config)

    if (!result.success) {
      console.error('❌ 数据库连接测试失败:', result.error)

      // 连接失败时清除配置标记，要求重新配置
      clearSetupFlag()

      throw new StartupGuardError(
        `数据库连接失败: ${result.error}\n配置标记已清除，请重新配置`,
        'CONNECTION_FAILED'
      )
    }

    console.log(`✅ 数据库连接验证通过 (延迟: ${result.latency}ms)`)
  } catch (error: any) {
    // 如果不是 StartupGuardError，包装后重新抛出
    if (!(error instanceof StartupGuardError)) {
      clearSetupFlag()
      throw new StartupGuardError(
        `数据库连接测试异常: ${error.message}`,
        'CONNECTION_FAILED'
      )
    }
    throw error
  }

  console.log('✅ 启动守护检查完成\n')
}

/**
 * 检查是否已完成配置
 * @returns true 如果 .setup-completed 文件存在
 */
export function isSetupCompleted(): boolean {
  return existsSync(SETUP_COMPLETE_FILE)
}

/**
 * 验证数据库配置的有效性
 * @param config 数据库配置
 * @throws {StartupGuardError} 如果配置无效
 */
export function validateDatabaseConfig(config: DatabaseConfig): void {
  // 验证 MySQL 配置
  if (config.storage === 'mysql') {
    if (!config.mysql.host || config.mysql.host.trim() === '') {
      throw new StartupGuardError(
        'MySQL 配置错误: 主机地址不能为空',
        'INVALID_CONFIG'
      )
    }

    if (!config.mysql.user || config.mysql.user.trim() === '') {
      throw new StartupGuardError(
        'MySQL 配置错误: 用户名不能为空',
        'INVALID_CONFIG'
      )
    }

    if (!config.mysql.database || config.mysql.database.trim() === '') {
      throw new StartupGuardError(
        'MySQL 配置错误: 数据库名不能为空',
        'INVALID_CONFIG'
      )
    }

    if (config.mysql.port < 1 || config.mysql.port > 65535) {
      throw new StartupGuardError(
        `MySQL 配置错误: 端口号 ${config.mysql.port} 无效`,
        'INVALID_CONFIG'
      )
    }
  }

  // 验证 Redis 配置
  if (config.storage === 'redis') {
    if (!config.redis.host || config.redis.host.trim() === '') {
      throw new StartupGuardError(
        'Redis 配置错误: 主机地址不能为空',
        'INVALID_CONFIG'
      )
    }

    if (config.redis.port < 1 || config.redis.port > 65535) {
      throw new StartupGuardError(
        `Redis 配置错误: 端口号 ${config.redis.port} 无效`,
        'INVALID_CONFIG'
      )
    }

    if (config.redis.db < 0 || config.redis.db > 15) {
      throw new StartupGuardError(
        `Redis 配置错误: 数据库编号 ${config.redis.db} 无效 (0-15)`,
        'INVALID_CONFIG'
      )
    }
  }
}

/**
 * 验证数据库连接
 * 仅测试连接可用性，不执行初始化
 * @param config 数据库配置
 * @returns 连接测试结果
 */
export async function verifyDatabaseConnection(
  config: DatabaseConfig
): Promise<ConnectionTestResult> {
  try {
    if (config.storage === 'mysql') {
      return await testMySQLConnection(config)
    } else if (config.storage === 'redis') {
      return await testRedisConnection(config)
    } else {
      return {
        success: false,
        error: '不支持的存储类型: ' + config.storage
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '未知错误'
    }
  }
}

/**
 * 测试 MySQL 连接
 * 仅执行 PING 测试，不创建表
 */
async function testMySQLConnection(config: DatabaseConfig): Promise<ConnectionTestResult> {
  const startTime = Date.now()

  try {
    const mysql = await import('mysql2/promise')

    // 创建临时连接（不指定数据库）
    const connection = await mysql.createConnection({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      connectTimeout: 10000 // 10秒超时
    })

    // 执行 PING 测试
    await connection.ping()

    // 检查数据库是否存在
    const [rows] = await connection.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [config.mysql.database]
    )

    await connection.end()

    const latency = Date.now() - startTime

    // 如果数据库不存在，返回警告但不失败
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn(`⚠️  数据库 "${config.mysql.database}" 不存在，将在初始化时创建`)
    }

    return {
      success: true,
      latency
    }
  } catch (error: any) {
    const latency = Date.now() - startTime

    // 解析 MySQL 错误
    let errorMessage = error.message

    if (error.code === 'ECONNREFUSED') {
      errorMessage = `无法连接到 MySQL 服务器 (${config.mysql.host}:${config.mysql.port})`
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = `MySQL 认证失败 (用户: ${config.mysql.user})`
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = '连接超时，请检查网络或防火墙设置'
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = `无法解析主机名: ${config.mysql.host}`
    }

    return {
      success: false,
      error: errorMessage,
      latency
    }
  }
}

/**
 * 测试 Redis 连接
 * 仅执行 PING 测试
 */
async function testRedisConnection(config: DatabaseConfig): Promise<ConnectionTestResult> {
  const startTime = Date.now()

  try {
    const Redis = (await import('ioredis')).default

    // 创建临时连接
    const redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db || 0,
      connectTimeout: 10000, // 10秒超时
      maxRetriesPerRequest: 1, // 仅重试一次
      retryStrategy: () => null, // 不自动重连
      lazyConnect: true // 延迟连接，手动控制
    })

    // 建立连接
    await redis.connect()

    // 执行 PING 测试
    const pong = await redis.ping()

    if (pong !== 'PONG') {
      await redis.disconnect()
      return {
        success: false,
        error: `Redis PING 返回意外结果: ${pong}`
      }
    }

    // 断开连接
    await redis.disconnect()

    const latency = Date.now() - startTime

    return {
      success: true,
      latency
    }
  } catch (error: any) {
    const latency = Date.now() - startTime

    // 解析 Redis 错误
    let errorMessage = error.message

    if (error.code === 'ECONNREFUSED') {
      errorMessage = `无法连接到 Redis 服务器 (${config.redis.host}:${config.redis.port})`
    } else if (error.message.includes('invalid password')) {
      errorMessage = 'Redis 认证失败，请检查密码'
    } else if (error.message.includes('WRONGPASS')) {
      errorMessage = 'Redis 密码错误'
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = '连接超时，请检查网络或防火墙设置'
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = `无法解析主机名: ${config.redis.host}`
    }

    return {
      success: false,
      error: errorMessage,
      latency
    }
  }
}

/**
 * 清除配置完成标记
 * 在数据库连接失败时调用，强制重新配置
 */
export function clearSetupFlag(): void {
  try {
    if (existsSync(SETUP_COMPLETE_FILE)) {
      unlinkSync(SETUP_COMPLETE_FILE)
      console.log('⚠️  配置标记已清除')
    }
  } catch (error: any) {
    console.error('❌ 清除配置标记失败:', error.message)
  }
}

/**
 * 获取配置文件路径
 * 用于测试和调试
 */
export function getSetupFilePath(): string {
  return SETUP_COMPLETE_FILE
}
