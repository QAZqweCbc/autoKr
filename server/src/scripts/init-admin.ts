/**
 * 初始化管理员账户
 * 创建默认管理员：admin@user.com / cbc123123
 */

import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { initDatabase, closeDatabase } from '../services/database.adapter'
import { getPool } from '../services/mysql.service'

async function initAdmin() {
  console.log('\n🔧 初始化管理员账户...\n')
  
  try {
    // 初始化数据库
    await initDatabase()
    
    const pool = getPool()
    const connection = await pool.getConnection()
    
    try {
      // 检查管理员是否已存在
      const [existing] = await connection.execute(
        'SELECT id FROM client_users WHERE email = ?',
        ['admin@user.com']
      )
      
      if ((existing as any[]).length > 0) {
        console.log('✅ 管理员账户已存在')
        return
      }
      
      // 创建管理员账户
      const passwordHash = await bcrypt.hash('cbc123123', 10)
      const adminId = uuidv4()
      
      await connection.execute(
        `INSERT INTO client_users (id, username, email, password_hash, status, max_tokens, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [adminId, 'admin', 'admin@user.com', passwordHash, 'active', 999, Date.now()]
      )
      
      console.log('✅ 管理员账户创建成功')
      console.log('\n📧 邮箱: admin@user.com')
      console.log('🔑 密码: cbc123123')
      console.log('\n⚠️  请在生产环境中修改默认密码！\n')
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('❌ 初始化失败:', error.message)
    process.exit(1)
  } finally {
    await closeDatabase()
  }
}

initAdmin()
