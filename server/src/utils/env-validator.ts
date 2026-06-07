/**
 * 环境变量校验工具
 * 在应用启动前检查必要的数据库密码环境变量是否已设置
 */

import { loadDatabaseConfig } from '../services/database-config.service'

/**
 * 环境变量校验结果
 */
export interface EnvValidationResult {
  success: boolean
  missing: string[]
  message?: string
}

/**
 * 校验数据库密码
 *
 * 校验规则：
 * 1. MySQL 密码（config/database.config.json 中 mysql.password 或环境变量 DB_PASSWORD）不为空
 * 2. Redis 密码（config/database.config.json 中 redis.password 或环境变量 REDIS_PASSWORD）不为空
 *
 * 配置来源优先级：环境变量 > JSON 文件 > 默认值
 * 注意：Setup Wizard 会将数据库配置写入 config/database.config.json，
 *       此校验从统一配置源读取，不再直接依赖 .env 文件
 *
 * @returns EnvValidationResult - 返回校验结果（不直接退出）
 */
export function validateDatabaseEnv(): EnvValidationResult {
  const config = loadDatabaseConfig()

  const mysqlPassword = config.mysql.password || ''
  const redisPassword = config.redis.password || ''

  const missing: string[] = []

  // 检查 MySQL 密码
  if (!mysqlPassword || mysqlPassword.trim() === '') {
    missing.push('MySQL 密码（请在 /setup 配置或设置 DB_PASSWORD 环境变量）')
  }

  // 检查 Redis 密码
  if (!redisPassword || redisPassword.trim() === '') {
    missing.push('Redis 密码（请在 /setup 配置或设置 REDIS_PASSWORD 环境变量）')
  }

  // 如果有缺失的环境变量，返回结果
  if (missing.length > 0) {
    console.error('')
    console.error('='.repeat(60))
    console.error('❌ 数据库密码未设置')
    console.error('='.repeat(60))
    console.error('')
    console.error('发现以下必需项缺失：')
    console.error('')
    for (const item of missing) {
      console.error('  - ' + item)
    }
    console.error('')
    console.error('处理方式：')
    console.error('  1. 启动服务后访问 /setup 完成初始化配置')
    console.error('  2. 或在 .env 文件中设置 DB_PASSWORD / REDIS_PASSWORD')
    console.error('  3. 或在 config/database.config.json 中设置密码')
    console.error('='.repeat(60))
    console.error('')
    return { success: false, missing, message: '数据库密码未设置' }
  }

  return { success: true, missing: [] }
}



