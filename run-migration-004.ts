/**
 * 运行数据库迁移 004 - Token 自动刷新优化字段
 */

import { initMySQL, closeMySQL, getPool } from './src/services/mysql.service'
import { loadDatabaseConfig } from './src/services/database-config.service'
import * as fs from 'fs'
import * as path from 'path'

async function runMigration() {
  console.log('\n🚀 运行数据库迁移 004...\n')
  
  try {
    // 加载数据库配置
    const dbConfig = loadDatabaseConfig()
    
    // 初始化数据库连接
    await initMySQL(dbConfig.mysql)
    
    const pool = getPool()
    const connection = await pool.getConnection()
    
    try {
      // 读取迁移脚本
      const migrationPath = path.join(__dirname, 'migrations', '004-add-refresh-optimization-fields.sql')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
      
      console.log('📄 迁移脚本内容：')
      console.log('─'.repeat(60))
      console.log(migrationSQL)
      console.log('─'.repeat(60))
      console.log()
      
      // 分割 SQL 语句（按分号分割，忽略注释和空行）
      const statements = migrationSQL
        .split('\n')
        .filter(line => {
          const trimmed = line.trim()
          return trimmed.length > 0 && 
                 !trimmed.startsWith('--') && 
                 trimmed !== 'COMMIT;'
        })
        .join('\n')
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)
      
      console.log(`📝 共 ${statements.length} 条 SQL 语句\n`)
      
      // 执行每条语句
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        console.log(`${i + 1}. 执行: ${statement.substring(0, 80)}...`)
        
        try {
          await connection.execute(statement)
          console.log('   ✅ 成功\n')
        } catch (error: any) {
          // 如果是"已存在"的错误，忽略它
          if (error.code === 'ER_DUP_FIELDNAME' || 
              error.code === 'ER_DUP_KEYNAME' ||
              error.message.includes('Duplicate column name') ||
              error.message.includes('Duplicate key name')) {
            console.log('   ⚠️  已存在，跳过\n')
          } else {
            console.error('   ❌ 失败:', error.message)
            throw error
          }
        }
      }
      
      console.log('✅ 迁移完成！\n')
      
    } finally {
      connection.release()
    }
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
    process.exit(1)
  } finally {
    await closeMySQL()
  }
}

// 运行迁移
runMigration()
