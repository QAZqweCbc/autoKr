/**
 * 数据库配置控制器
 */

import { Request, Response } from 'express'
import {
  loadDatabaseConfig,
  saveDatabaseConfig,
  getMaskedConfig,
  validateDatabaseConfig,
  getConfigSource,
  DatabaseConfig
} from '../services/database-config.service'
import { updateDbEnvVars } from '../services/setup.service'

/**
 * 获取数据库配置
 */
export function getDatabaseConfig(req: Request, res: Response) {
  try {
    const config = loadDatabaseConfig()
    const maskedConfig = getMaskedConfig(config)
    const source = getConfigSource()
    
    res.json({
      success: true,
      config: maskedConfig,
      source: source,
      message: '配置已加载'
    })
  } catch (error: any) {
    console.error('获取数据库配置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 更新数据库配置
 */
export async function updateDatabaseConfig(req: Request, res: Response) {
  try {
    const newConfig = req.body as DatabaseConfig
    
    // 加载当前配置
    const currentConfig = loadDatabaseConfig()
    
    // 如果密码是脱敏的（******），使用原密码
    if (newConfig.mysql.password === '******') {
      newConfig.mysql.password = currentConfig.mysql.password
    }
    if (newConfig.redis.password === '******') {
      newConfig.redis.password = currentConfig.redis.password || ''
    }
    
    // 验证配置
    const validation = validateDatabaseConfig(newConfig)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: '配置验证失败',
        errors: validation.errors
      })
    }
    
    // 保存配置
    saveDatabaseConfig(newConfig)

    // 同步更新 .env 中的数据库环境变量，避免优先级冲突
    const envVars: Record<string, string> = {}
    if (newConfig.storage === 'mysql') {
      envVars.MYSQL_HOST = newConfig.mysql.host
      envVars.MYSQL_PORT = String(newConfig.mysql.port)
      envVars.MYSQL_USER = newConfig.mysql.user
      envVars.MYSQL_PASSWORD = newConfig.mysql.password
      envVars.MYSQL_DATABASE = newConfig.mysql.database
    }
    envVars.REDIS_HOST = newConfig.redis.host
    envVars.REDIS_PORT = String(newConfig.redis.port)
    envVars.REDIS_PASSWORD = newConfig.redis.password || ''
    envVars.REDIS_DB = String(newConfig.redis.db)
    updateDbEnvVars(envVars)
    
    // 🔥 热重载：如果存储模式改变，自动重新初始化数据库连接
    let reloadResult = {
      reloaded: false,
      oldStorage: currentConfig.storage,
      newStorage: newConfig.storage,
      error: undefined as string | undefined
    }
    
    if (currentConfig.storage !== newConfig.storage) {
      try {
        console.log(`\n🔄 检测到存储模式变更: ${currentConfig.storage} → ${newConfig.storage}`)
        console.log('正在热重载数据库连接...')
        
        // 动态导入以避免循环依赖
        const { reloadDatabase } = await import('../services/database.adapter')
        await reloadDatabase()
        
        reloadResult.reloaded = true
        console.log('✅ 数据库连接已热重载')
      } catch (error: any) {
        console.error('❌ 热重载失败:', error.message)
        reloadResult.error = error.message
      }
    }
    
    res.json({
      success: true,
      config: getMaskedConfig(newConfig),
      message: reloadResult.reloaded 
        ? '配置已保存并自动切换存储模式，无需重启服务器' 
        : '配置已保存',
      reload: reloadResult
    })
  } catch (error: any) {
    console.error('更新数据库配置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 测试数据库连接
 */
export async function testDatabaseConnection(req: Request, res: Response) {
  try {
    const { type, config } = req.body
    
    console.log(`🔍 测试 ${type} 连接:`, {
      host: config.host,
      port: config.port,
      user: config.user,
      database: config.database
    })
    
    if (type === 'mysql') {
      try {
        // 使用 require 而不是动态导入
        const mysql2 = require('mysql2/promise')
        
        console.log('📦 mysql2 已加载')
        
        const connection = await mysql2.createConnection({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          connectTimeout: 5000,
          waitForConnections: true,
          connectionLimit: 1,
          queueLimit: 0
        })
        
        console.log('✅ MySQL 连接已建立')
        
        await connection.ping()
        console.log('✅ Ping 成功')
        
        // 检查数据库是否存在
        const [databases] = await connection.query(
          'SHOW DATABASES LIKE ?',
          [config.database]
        ) as any
        
        const dbExists = databases.length > 0
        console.log(`📊 数据库 ${config.database} 存在: ${dbExists}`)
        
        await connection.end()
        
        res.json({
          success: true,
          message: dbExists 
            ? `MySQL 连接成功！数据库 ${config.database} 已存在` 
            : `MySQL 连接成功！数据库 ${config.database} 将在首次使用时自动创建`
        })
      } catch (error: any) {
        console.error('❌ MySQL 连接错误:', error)
        res.status(500).json({
          success: false,
          error: `MySQL 连接失败: ${error.message}`,
          details: error.code || error.errno
        })
      }
    } else if (type === 'redis') {
      try {
        const Redis = (await import('ioredis')).default

        const redis = new Redis({
          host: config.host,
          port: config.port,
          password: config.password || '',
          db: config.db || 0,
          connectTimeout: 5000,
          maxRetriesPerRequest: 0,
          retryStrategy: () => null,
          lazyConnect: true
        })

        await redis.connect()
        await redis.ping()
        await redis.disconnect()

        res.json({
          success: true,
          message: 'Redis ??????'
        })
      } catch (error: any) {
        console.error('Redis ????:', error)
        res.status(500).json({
          success: false,
          error: 'Redis ????: ' + error.message
        })
      }
    } else {
      res.status(400).json({
        success: false,
        error: '无效的连接类型'
      })
    }
  } catch (error: any) {
    console.error('❌ 连接测试失败:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

/**
 * 测试当前配置的数据库连接（使用配置文件中的真实密码）
 */
export async function testCurrentDatabaseConnection(req: Request, res: Response) {
  try {
    const { type } = req.body
    
    // 加载当前配置（包含真实密码）
    const config = loadDatabaseConfig()
    
    console.log(`🔍 测试当前 ${type} 配置`)
    
    if (type === 'mysql') {
      try {
        const mysql2 = require('mysql2/promise')
        
        console.log('📦 mysql2 已加载')
        console.log('🔐 使用配置文件中的密码')
        
        const connection = await mysql2.createConnection({
          host: config.mysql.host,
          port: config.mysql.port,
          user: config.mysql.user,
          password: config.mysql.password,
          connectTimeout: 5000,
          waitForConnections: true,
          connectionLimit: 1,
          queueLimit: 0
        })
        
        console.log('✅ MySQL 连接已建立')
        
        await connection.ping()
        console.log('✅ Ping 成功')
        
        // 检查数据库是否存在
        const [databases] = await connection.query(
          'SHOW DATABASES LIKE ?',
          [config.mysql.database]
        ) as any
        
        const dbExists = databases.length > 0
        console.log(`📊 数据库 ${config.mysql.database} 存在: ${dbExists}`)
        
        await connection.end()
        
        res.json({
          success: true,
          message: dbExists 
            ? `MySQL 连接成功！数据库 ${config.mysql.database} 已存在` 
            : `MySQL 连接成功！数据库 ${config.mysql.database} 将在首次使用时自动创建`
        })
      } catch (error: any) {
        console.error('❌ MySQL 连接错误:', error)
        res.status(500).json({
          success: false,
          error: `MySQL 连接失败: ${error.message}`,
          details: error.code || error.errno
        })
      }
    } else if (type === 'redis') {
      try {
        const Redis = (await import('ioredis')).default

        const redis = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password || '',
          db: config.redis.db || 0,
          connectTimeout: 5000,
          maxRetriesPerRequest: 0,
          retryStrategy: () => null,
          lazyConnect: true
        })

        await redis.connect()
        await redis.ping()
        await redis.disconnect()

        res.json({
          success: true,
          message: 'Redis ??????'
        })
      } catch (error: any) {
        console.error('Redis ????:', error)
        res.status(500).json({
          success: false,
          error: 'Redis ????: ' + error.message
        })
      }
    } else {
      res.status(400).json({
        success: false,
        error: '无效的连接类型'
      })
    }
  } catch (error: any) {
    console.error('连接测试失败:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
}
  }

/**
 * 获取数据库状态
 */
export function getDatabaseStatus(req: Request, res: Response) {
  try {
    const config = loadDatabaseConfig()
    const source = getConfigSource()

    res.json({
      success: true,
      status: {
        currentStorage: config.storage,
        configSource: source,
        mysqlConfigured: !!(config.mysql.host && config.mysql.user),
        redisConfigured: !!(config.redis.host)
      }
    })
  } catch (error: any) {
    console.error('获取数据库状态失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
