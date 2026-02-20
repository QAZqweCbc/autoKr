/**
 * 数据库迁移：为token_allocations表添加revoke_reason字段
 */

import { getPool } from '../services/mysql.service'

export async function migrateAddRevokeReason() {
  const pool = getPool()
  if (!pool) {
    console.log('⚠️ MySQL未初始化，跳过迁移')
    return
  }
  
  const connection = await pool.getConnection()
  
  try {
    console.log('🔄 开始迁移：添加revoke_reason字段...')
    
    // 检查字段是否已存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'token_allocations' 
       AND COLUMN_NAME = 'revoke_reason'`
    )
    
    if ((columns as any[]).length > 0) {
      console.log('✅ revoke_reason字段已存在，跳过迁移')
      return
    }
    
    // 添加字段
    await connection.execute(
      `ALTER TABLE token_allocations 
       ADD COLUMN revoke_reason TEXT COMMENT '释放理由' AFTER revoked_by`
    )
    
    console.log('✅ 迁移完成：revoke_reason字段已添加')
  } catch (error: any) {
    console.error('❌ 迁移失败:', error.message)
    throw error
  } finally {
    connection.release()
  }
}
