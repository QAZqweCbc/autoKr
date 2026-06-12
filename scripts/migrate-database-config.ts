/**
 * 数据库配置迁移脚本
 * 将旧的 data/config.json 中的数据库配置迁移到 config/database.config.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const OLD_CONFIG_FILE = path.join(__dirname, '../data/config.json')
const NEW_CONFIG_DIR = path.join(__dirname, '../config')
const NEW_CONFIG_FILE = path.join(NEW_CONFIG_DIR, 'database.config.json')

interface OldConfig {
  storage?: 'json' | 'mysql' | 'redis'
  mysql?: {
    host: string
    port: number
    user: string
    password: string
    database: string
  }
  redis?: {
    host: string
    port: number
    password?: string
    db?: number
  }
  [key: string]: any
}

interface NewDatabaseConfig {
  storage: 'json' | 'mysql' | 'redis'
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

function migrate() {
  console.log('🔄 开始迁移数据库配置...\n')
  
  // 检查旧配置文件是否存在
  if (!existsSync(OLD_CONFIG_FILE)) {
    console.log('❌ 旧配置文件不存在:', OLD_CONFIG_FILE)
    console.log('   无需迁移')
    return
  }
  
  // 读取旧配置
  console.log('📖 读取旧配置文件:', OLD_CONFIG_FILE)
  const oldConfigData = readFileSync(OLD_CONFIG_FILE, 'utf-8')
  const oldConfig: OldConfig = JSON.parse(oldConfigData)
  
  // 检查是否已经迁移过
  if (oldConfig.databaseConfigMigrated) {
    console.log('✅ 配置已经迁移过，跳过')
    return
  }
  
  // 检查是否有数据库配置
  if (!oldConfig.storage && !oldConfig.mysql && !oldConfig.redis) {
    console.log('ℹ️  旧配置中没有数据库配置，跳过迁移')
    return
  }
  
  // 提取数据库配置
  const newDatabaseConfig: NewDatabaseConfig = {
    storage: oldConfig.storage || 'json',
    mysql: oldConfig.mysql || {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'KrioServer'
    },
    redis: oldConfig.redis || {
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0
    }
  }
  
  console.log('\n📝 提取的数据库配置:')
  console.log('   存储类型:', newDatabaseConfig.storage)
  console.log('   MySQL:', `${newDatabaseConfig.mysql.host}:${newDatabaseConfig.mysql.port}`)
  console.log('   Redis:', `${newDatabaseConfig.redis.host}:${newDatabaseConfig.redis.port}`)
  
  // 确保新配置目录存在
  if (!existsSync(NEW_CONFIG_DIR)) {
    console.log('\n📁 创建配置目录:', NEW_CONFIG_DIR)
    mkdirSync(NEW_CONFIG_DIR, { recursive: true })
  }
  
  // 保存新配置
  console.log('\n💾 保存新配置文件:', NEW_CONFIG_FILE)
  writeFileSync(NEW_CONFIG_FILE, JSON.stringify(newDatabaseConfig, null, 2), 'utf-8')
  
  // 从旧配置中删除数据库配置
  console.log('\n🗑️  从旧配置中删除数据库配置')
  delete oldConfig.storage
  delete oldConfig.mysql
  delete oldConfig.redis
  oldConfig.databaseConfigMigrated = true
  
  // 保存更新后的旧配置
  console.log('💾 更新旧配置文件')
  writeFileSync(OLD_CONFIG_FILE, JSON.stringify(oldConfig, null, 2), 'utf-8')
  
  console.log('\n✅ 迁移完成！')
  console.log('\n📌 重要提示:')
  console.log('   1. 数据库配置已迁移到:', NEW_CONFIG_FILE)
  console.log('   2. 敏感信息（密码）建议使用环境变量')
  console.log('   3. 复制 .env.example 为 .env 并填入实际值')
  console.log('   4. 重启服务器使配置生效')
}

// 执行迁移
try {
  migrate()
} catch (error: any) {
  console.error('\n❌ 迁移失败:', error.message)
  process.exit(1)
}
