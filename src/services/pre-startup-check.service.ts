/**
 * 预启动自检服务
 * 在程序启动前执行数据库连接测试
 */

import { loadDatabaseConfig, DatabaseConfig } from './database-config.service'

interface PreStartupCheckResult {
  shouldStart: boolean
  warnings: string[]
  errors: string[]
}

/**
 * 测试 MySQL 连接
 */
async function testMySQLConnection(config: DatabaseConfig['mysql']): Promise<{ success: boolean; error?: string }> {
  try {
    // 动态导入 mysql2 避免启动时加载失败
    const mysql = await import('mysql2/promise')

    console.log('\n📦 [预检] 测试 MySQL 连接...')
    console.log(`   主机: ${config.host}:${config.port}`)
    console.log(`   数据库: ${config.database}`)

    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      connectTimeout: 5000 // 5秒超时
    })

    // 测试连接
    await connection.ping()

    // 检查数据库是否存在
    const [rows] = await connection.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [config.database]
    )

    await connection.end()

    const dbExists = Array.isArray(rows) && rows.length > 0

    if (!dbExists) {
      return {
        success: false,
        error: `数据库 ${config.database} 不存在`
      }
    }

    console.log('✅ [预检] MySQL 连接成功')
    return { success: true }
  } catch (error: any) {
    console.log('❌ [预检] MySQL 连接失败')
    return {
      success: false,
      error: error.message || 'MySQL 连接失败'
    }
  }
}

/**
 * 测试 Redis 连接
 */
async function testRedisConnection(config: DatabaseConfig['redis']): Promise<{ success: boolean; error?: string }> {
  try {
    const Redis = (await import('ioredis')).default

    console.log('\n📦 [预检] 测试 Redis 连接...')
    console.log(`   主机: ${config.host}:${config.port}`)

    const redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password || undefined,
      db: config.db || 0,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null // 不重试
    })

    // 等待连接或超时
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        redis.disconnect()
        reject(new Error('连接超时'))
      }, 5000)

      redis.once('ready', () => {
        clearTimeout(timeout)
        resolve()
      })

      redis.once('error', (err) => {
        clearTimeout(timeout)
        redis.disconnect()
        reject(err)
      })
    })

    // 测试 ping
    await redis.ping()
    await redis.quit()

    console.log('✅ [预检] Redis 连接成功')
    return { success: true }
  } catch (error: any) {
    console.log('❌ [预检] Redis 连接失败')
    return {
      success: false,
      error: error.message || 'Redis 连接失败'
    }
  }
}

/**
 * 执行预启动检查
 */
export async function performPreStartupCheck(): Promise<PreStartupCheckResult> {
  console.log('\n' + '='.repeat(60))
  console.log('🔍 执行预启动数据库检查...')
  console.log('='.repeat(60))

  const result: PreStartupCheckResult = {
    shouldStart: true,
    warnings: [],
    errors: []
  }

  try {
    // 加载配置
    const config = loadDatabaseConfig()
    const configuredStorage = config.storage

    console.log(`📋 配置的存储模式: ${configuredStorage.toUpperCase()}`)

    // 测试 MySQL
    if (configuredStorage === 'mysql') {
      if (!config.mysql.host || !config.mysql.user) {
        result.shouldStart = false
        result.errors.push('MySQL 配置不完整')
        console.log('❌ [预检] MySQL 配置不完整')
        return result
      }

      const mysqlTest = await testMySQLConnection(config.mysql)

      if (!mysqlTest.success) {
        result.shouldStart = false
        result.errors.push(`MySQL 连接失败: ${mysqlTest.error}`)
        console.log('❌ [预检] MySQL 连接失败')
        console.log(`   原因: ${mysqlTest.error}`)
        return result
      }

      // MySQL 连接成功
      console.log('✅ [预检] MySQL 连接成功')

      // 检查 Redis（可选）
      if (config.redis.host && config.redis.host.trim() !== '') {
        const redisTest = await testRedisConnection(config.redis)
        if (!redisTest.success) {
          result.warnings.push(`Redis 连接失败: ${redisTest.error}，将不使用缓存`)
          console.log('⚠️  [预检] Redis 连接失败，将不使用缓存')
        } else {
          console.log('✅ [预检] Redis 连接成功，将启用缓存')
        }
      }

      return result
    }

    // 测试 Redis（作为主存储）
    if (configuredStorage === 'redis') {
      if (!config.redis.host || config.redis.host.trim() === '') {
        result.shouldStart = false
        result.errors.push('Redis 配置不完整')
        console.log('❌ [预检] Redis 配置不完整')
        return result
      }

      const redisTest = await testRedisConnection(config.redis)

      if (!redisTest.success) {
        result.shouldStart = false
        result.errors.push(`Redis 连接失败: ${redisTest.error}`)
        console.log('❌ [预检] Redis 连接失败')
        console.log(`   原因: ${redisTest.error}`)
        return result
      }

      console.log('✅ [预检] Redis 连接成功')
      return result
    }

    // 未知存储类型
    result.shouldStart = false
    result.errors.push(`未知的存储类型: ${configuredStorage}`)
    console.log(`❌ [预检] 未知的存储类型: ${configuredStorage}`)
    return result
  } catch (error: any) {
    console.error('❌ [预检] 检查过程出错:', error.message)
    result.shouldStart = false
    result.errors.push(`预检查失败: ${error.message}`)
    return result
  } finally {
    console.log('='.repeat(60))
    if (result.shouldStart) {
      console.log('✅ [预检] 检查通过')
    } else {
      console.log('❌ [预检] 检查失败')
    }
    if (result.warnings.length > 0) {
      console.log('⚠️  警告信息:')
      result.warnings.forEach(w => console.log(`   - ${w}`))
    }
    if (result.errors.length > 0) {
      console.log('❌ 错误信息:')
      result.errors.forEach(e => console.log(`   - ${e}`))
    }
    console.log('='.repeat(60) + '\n')
  }
}
