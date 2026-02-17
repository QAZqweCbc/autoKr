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
export function updateDatabaseConfig(req: Request, res: Response) {
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
    
    res.json({
      success: true,
      config: getMaskedConfig(newConfig),
      message: '配置已保存，请重启服务器使配置生效'
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
        const { initRedis, closeRedis } = await import('../services/redis.service')
        
        console.log('📦 Redis 服务已加载')
        
        await initRedis(config)
        console.log('✅ Redis 连接已建立')
        
        await closeRedis()
        console.log('✅ Redis 连接已关闭')
        
        res.json({
          success: true,
          message: 'Redis 连接测试成功'
        })
      } catch (error: any) {
        console.error('❌ Redis 连接错误:', error)
        res.status(500).json({
          success: false,
          error: `Redis 连接失败: ${error.message}`
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
        const { initRedis, closeRedis } = await import('../services/redis.service')
        
        console.log('📦 Redis 服务已加载')
        console.log('🔐 使用配置文件中的密码')
        
        await initRedis(config.redis)
        console.log('✅ Redis 连接已建立')
        
        await closeRedis()
        console.log('✅ Redis 连接已关闭')
        
        res.json({
          success: true,
          message: 'Redis 连接测试成功'
        })
      } catch (error: any) {
        console.error('❌ Redis 连接错误:', error)
        res.status(500).json({
          success: false,
          error: `Redis 连接失败: ${error.message}`
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
