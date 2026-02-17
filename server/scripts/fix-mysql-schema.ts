/**
 * 修复MySQL表结构 - 添加缺失的client_secret字段
 */

import mysql from 'mysql2/promise'
import { loadConfig } from '../src/services/config.service'

async function fixSchema() {
  const config = loadConfig()
  
  if (!config.mysql) {
    console.error('❌ MySQL配置缺失')
    process.exit(1)
  }
  
  console.log('\n📦 连接到MySQL...')
  const connection = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database
  })
  
  try {
    console.log('✅ 连接成功')
    
    // 检查client_secret字段是否存在
    console.log('\n🔍 检查client_secret字段...')
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'accounts' 
       AND COLUMN_NAME = 'client_secret'`
    )
    
    if ((columns as any[]).length === 0) {
      console.log('⚠️  client_secret字段不存在，正在添加...')
      await connection.execute(
        `ALTER TABLE accounts ADD COLUMN client_secret TEXT COMMENT 'OAuth客户端密钥'`
      )
      console.log('✅ client_secret字段添加成功')
    } else {
      console.log('✅ client_secret字段已存在')
    }
    
    // 显示所有OAuth相关字段
    console.log('\n📋 OAuth相关字段列表:')
    const [fields] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'accounts' 
       AND COLUMN_NAME IN ('client_id', 'client_secret', 'refresh_token', 'region', 'sso_token')
       ORDER BY ORDINAL_POSITION`
    )
    console.table(fields)
    
    console.log('\n✅ 表结构修复完成')
  } catch (error) {
    console.error('\n❌ 修复失败:', error)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

fixSchema().catch(console.error)
