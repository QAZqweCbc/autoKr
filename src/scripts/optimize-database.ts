/**
 * 数据库性能优化脚本
 * 添加额外的索引以提升查询性能
 */

import { initDatabase, closeDatabase } from '../services/database.adapter'
import { getPool } from '../services/mysql.service'

async function optimizeDatabase() {
  console.log('🔧 开始数据库性能优化...\n')
  
  try {
    // 初始化数据库连接
    await initDatabase()
    const pool = getPool()
    const connection = await pool.getConnection()
    
    try {
      // 1. 为token_allocations表添加复合索引
      console.log('📊 优化 token_allocations 表...')
      
      await connection.execute(`
        CREATE INDEX IF NOT EXISTS idx_user_status 
        ON token_allocations(user_id, status)
      `).catch(() => console.log('   索引 idx_user_status 已存在'))
      
      await connection.execute(`
        CREATE INDEX IF NOT EXISTS idx_status_requested 
        ON token_allocations(status, requested_at)
      `).catch(() => console.log('   索引 idx_status_requested 已存在'))
      
      console.log('✅ token_allocations 表优化完成\n')
      
      // 2. 为client_users表添加复合索引
      console.log('📊 优化 client_users 表...')
      
      await connection.execute(`
        CREATE INDEX IF NOT EXISTS idx_status_created 
        ON client_users(status, created_at)
      `).catch(() => console.log('   索引 idx_status_created 已存在'))
      
      console.log('✅ client_users 表优化完成\n')
      
      // 3. 为accounts表添加复合索引（用于Token可用性查询）
      console.log('📊 优化 accounts 表...')
      
      await connection.execute(`
        CREATE INDEX IF NOT EXISTS idx_status_usage 
        ON accounts(status, usage_percent, subscription_status)
      `).catch(() => console.log('   索引 idx_status_usage 已存在'))
      
      await connection.execute(`
        CREATE INDEX IF NOT EXISTS idx_subscription 
        ON accounts(subscription_status, subscription_type)
      `).catch(() => console.log('   索引 idx_subscription 已存在'))
      
      await connection.execute(`
        CREATE INDEX IF NOT EXISTS idx_created_status 
        ON accounts(created_at, status)
      `).catch(() => console.log('   索引 idx_created_status 已存在'))
      
      console.log('✅ accounts 表优化完成\n')
      
      // 4. 为verification_codes表添加复合索引
      console.log('📊 优化 verification_codes 表...')
      
      await connection.execute(`
        CREATE INDEX IF NOT EXISTS idx_email_expires 
        ON verification_codes(email, expires_at, used)
      `).catch(() => console.log('   索引 idx_email_expires 已存在'))
      
      console.log('✅ verification_codes 表优化完成\n')
      
      // 5. 为audit_logs表添加复合索引
      console.log('📊 优化 audit_logs 表...')
      
      await connection.execute(`
        CREATE INDEX IF NOT EXISTS idx_user_action_time 
        ON audit_logs(user_id, action, created_at)
      `).catch(() => console.log('   索引 idx_user_action_time 已存在'))
      
      await connection.execute(`
        CREATE INDEX IF NOT EXISTS idx_resource_time 
        ON audit_logs(resource_type, resource_id, created_at)
      `).catch(() => console.log('   索引 idx_resource_time 已存在'))
      
      console.log('✅ audit_logs 表优化完成\n')
      
      // 6. 分析表统计信息
      console.log('📊 更新表统计信息...')
      const tables = [
        'client_users',
        'token_allocations',
        'verification_codes',
        'accounts',
        'audit_logs'
      ]
      
      for (const table of tables) {
        await connection.execute(`ANALYZE TABLE ${table}`)
        console.log(`   ✓ ${table}`)
      }
      
      console.log('✅ 统计信息更新完成\n')
      
      // 7. 显示索引信息
      console.log('📋 当前索引概览:\n')
      
      for (const table of tables) {
        const [indexes] = await connection.execute(
          `SHOW INDEX FROM ${table}`
        )
        console.log(`${table}:`)
        const indexNames = new Set()
        for (const idx of indexes as any[]) {
          if (!indexNames.has(idx.Key_name)) {
            indexNames.add(idx.Key_name)
            console.log(`   - ${idx.Key_name} (${idx.Column_name})`)
          }
        }
        console.log('')
      }
      
      console.log('✅ 数据库优化完成！')
      
    } finally {
      connection.release()
    }
    
  } catch (error: any) {
    console.error('❌ 优化失败:', error.message)
    process.exit(1)
  } finally {
    await closeDatabase()
  }
}

// 执行优化
optimizeDatabase()
