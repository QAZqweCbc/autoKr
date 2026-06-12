/**
 * 邮箱配置迁移脚本
 * 将 JSON 文件中的邮箱配置迁移到 MySQL（加密存储）
 */

import { loadConfig } from '../services/config.service'
import { loadDatabaseConfig } from '../services/database-config.service'
import { initMySQL } from '../services/mysql.service'
import { saveEmailConfig } from '../services/email-config.service'

async function migrateEmailConfig() {
  console.log('\n🔄 开始迁移邮箱配置...\n')
  
  try {
    // 1. 加载 JSON 配置
    console.log('📖 读取 JSON 配置文件...')
    const config = loadConfig()
    
    if (!config.email) {
      console.log('⚠️  JSON 配置中没有邮箱配置，无需迁移')
      return
    }
    
    console.log('✅ 找到邮箱配置:')
    console.log(`   邮箱: ${config.email.qqEmail}`)
    console.log(`   授权码: ${config.email.authCode?.substring(0, 4)}****`)
    console.log(`   域名: ${config.email.domains}`)
    
    // 2. 初始化 MySQL
    const dbConfig = loadDatabaseConfig()
    if (dbConfig.storage !== 'mysql' || !dbConfig.mysql) {
      console.error('❌ 未配置 MySQL，无法迁移')
      return
    }
    
    console.log('\n📦 连接 MySQL...')
    await initMySQL(dbConfig.mysql)
    
    // 3. 保存到 MySQL（自动加密）
    console.log('\n💾 保存到 MySQL（加密存储）...')
    await saveEmailConfig({
      id: 'default',
      qqEmail: config.email.qqEmail,
      authCode: config.email.authCode,
      domains: config.email.domains,
      useAlias: config.email.useAlias,
      aliasType: config.email.aliasType,
      gmailBase: config.email.gmailBase,
      gmailAppPassword: config.email.gmailAppPassword,
      qqAliases: config.email.qqAliases
    })
    
    console.log('✅ 迁移成功！')
    console.log('\n📝 说明:')
    console.log('   - 邮箱配置已加密保存到 MySQL')
    console.log('   - JSON 文件中的配置仍然保留（可手动删除）')
    console.log('   - 现在可以正常使用注册和检测功能了')
    
  } catch (error: any) {
    console.error('\n❌ 迁移失败:', error.message)
    console.error(error.stack)
  } finally {
    process.exit(0)
  }
}

// 运行迁移
migrateEmailConfig()
