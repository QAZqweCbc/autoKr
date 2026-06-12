/**
 * 启动守护服务
 * 在服务启动时验证必要的配置和数据库连接
 * 修改后：不再阻塞服务器启动，改为返回守护结果供主服务判断
 */

import { existsSync, unlinkSync } from 'fs'
import path from 'path'
import { loadDatabaseConfig, DatabaseConfig } from './database-config.service'

const SETUP_COMPLETE_FILE = path.join(process.cwd(), '.setup-completed')

/**
 * 启动守护结果（不再抛错退出）
 */
export interface StartupGuardResult {
  setupCompleted: boolean
  mysqlOk: boolean
  mysqlError?: string
  redisOk: boolean
  redisError?: string
  configValid: boolean
  configError?: string
  needsSetup: boolean
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
 * 启动守护检查（非阻塞版本）
 * 不再抛错退出，而是返回结果对象供主服务判断
 * 如果配置未完成，仅返回 needsSetup=true，不阻止服务器启动
 * 如果数据库连接失败，仅记录警告，不删除 .setup-completed 标记
 */
export async function guardStartup(): Promise<StartupGuardResult> {
  console.log('\n🛡️  启动守护检查中...')

  // 1. 检查是否完成初始配置
  const setupCompleted = isSetupCompleted()
  if (!setupCompleted) {
    console.log('⚠️  系统尚未完成初始配置，请在 /setup 页面完成配置')
    return {
      setupCompleted: false,
      mysqlOk: false,
      redisOk: false,
      configValid: false,
      needsSetup: true
    }
  }

  console.log('✅ 配置完成标记已确认')

  // 2. 加载并验证数据库配置
  let configValid = true
  let configError: string | undefined
  let config: DatabaseConfig | null = null

  try {
    config = loadDatabaseConfig()
    validateDatabaseConfig(config)
    console.log(`✅ 数据库配置验证通过 (${config.storage.toUpperCase()})`)
  } catch (error: any) {
    configValid = false
    configError = error.message
    console.warn('⚠️  数据库配置验证失败:', error.message)
  }

  // 3. 测试 MySQL 连接（非阻塞）
  let mysqlOk = false
  let mysqlError: string | undefined
  let mysqlLatency: number | undefined

  if (config && config.storage === 'mysql') {
    try {
      const result = await testMySQLConnection(config)
      if (result.success) {
        mysqlOk = true
        mysqlLatency = result.latency
        console.log(`✅ MySQL 连接验证通过 (延迟: ${result.latency}ms)`)
      } else {
        mysqlError = result.error
        console.warn('⚠️  MySQL 连接测试失败:', result.error)
      }
    } catch (error: any) {
      mysqlError = error.message || 'MySQL 连接测试异常'
      console.warn('⚠️  MySQL 连接测试异常:', error.message)
    }
  } else {
    mysqlOk = true // 非 MySQL 模式
    console.log('ℹ️  跳过 MySQL 连接测试（非 MySQL 存储模式）')
  }

  // 4. 测试 Redis 连接（非阻塞，仅警告）
  let redisOk = false
  let redisError: string | undefined

  if (config && config.storage !== 'redis') {
    // Redis 作为缓存，可选
    try {
      const result = await testRedisConnection(config)
      if (result.success) {
        redisOk = true
        console.log(`✅ Redis 连接验证通过`)
      } else {
        redisError = result.error
        console.warn('⚠️  Redis 连接测试失败:', result.error)
      }
    } catch (error: any) {
      redisError = error.message || 'Redis 连接测试异常'
      console.warn('⚠️  Redis 连接测试异常:', error.message)
    }
  } else {
    redisOk = true // Redis 作为主存储时已在上面测试
    console.log('ℹ️  跳过 Redis 独立测试（Redis 为主存储模式）')
  }

  // 汇总结果
  const needsSetup = !setupCompleted || !configValid
  const allOk = setupCompleted && configValid && mysqlOk && redisOk

  if (allOk) {
    console.log('✅ 启动守护检查完成\n')
  } else if (!needsSetup) {
    console.log('⚠️  启动守护检查完成，部分连接不可用（不影响服务启动）\n')
  }

  return {
    setupCompleted,
    mysqlOk,
    mysqlError,
    redisOk,
    redisError,
    configValid,
    configError,
    needsSetup
  }
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
 * @throws 如果配置无效
 */
export function validateDatabaseConfig(config: DatabaseConfig): void {
  // 验证 MySQL 配置
  if (config.storage === 'mysql') {
    if (!config.mysql.host || config.mysql.host.trim() === '') {
      throw new Error('MySQL 配置错误: 主机地址不能为空')
    }

    if (!config.mysql.user || config.mysql.user.trim() === '') {
      throw new Error('MySQL 配置错误: 用户名不能为空')
    }

    if (!config.mysql.database || config.mysql.database.trim() === '') {
      throw new Error('MySQL 配置错误: 数据库名不能为空')
    }

    if (config.mysql.port < 1 || config.mysql.port > 65535) {
      throw new Error(`MySQL 配置错误: 端口号 ${config.mysql.port} 无效`)
    }
  }

  // 验证 Redis 配置
  if (config.storage === 'redis') {
    if (!config.redis.host || config.redis.host.trim() === '') {
      throw new Error('Redis 配置错误: 主机地址不能为空')
    }

    if (config.redis.port < 1 || config.redis.port > 65535) {
      throw new Error(`Redis 配置错误: 端口号 ${config.redis.port} 无效`)
    }

    if (config.redis.db < 0 || config.redis.db > 15) {
      throw new Error(`Redis 配置错误: 数据库编号 ${config.redis.db} 无效 (0-15)`)
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
      connectTimeout: 5000
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
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true
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
 * （修改后：此函数不再被 guardStartup 自动调用）
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
