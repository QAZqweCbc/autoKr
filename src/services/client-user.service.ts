/**
 * 普通用户数据库服务
 */

import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcrypt'
import { getPool } from './mysql.service'
import { ClientUser, ClientUserCreateDTO } from '../models/client-user.model'

/**
 * 创建用户
 */
export async function createClientUser(dto: ClientUserCreateDTO): Promise<ClientUser> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    // 检查用户名是否已存在
    const [existingUsername] = await connection.execute(
      'SELECT id FROM client_users WHERE username = ?',
      [dto.username]
    )
    if ((existingUsername as any[]).length > 0) {
      throw new Error('用户名已存在')
    }
    
    // 检查邮箱是否已存在
    const [existingEmail] = await connection.execute(
      'SELECT id FROM client_users WHERE email = ?',
      [dto.email]
    )
    if ((existingEmail as any[]).length > 0) {
      throw new Error('邮箱已被注册')
    }
    
    // 加密密码
    const passwordHash = await bcrypt.hash(dto.password, 10)

    const user: ClientUser = {
      id: uuidv4(),
      username: dto.username,
      email: dto.email,
      password_hash: passwordHash,
      status: 'active',
      max_tokens: 2,
      created_at: Date.now(),
      registration_status: 'in_progress',
      pending_delete: false,
      registration_started_at: Date.now()
    }

    await connection.execute(
      `INSERT INTO client_users (id, username, email, password_hash, status, max_tokens, created_at, registration_status, pending_delete, registration_started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.username, user.email, user.password_hash, user.status, user.max_tokens, user.created_at, user.registration_status, user.pending_delete, user.registration_started_at]
    )

    return user
  } finally {
    connection.release()
  }
}

/**
 * 通过邮箱查找用户
 */
export async function findClientUserByEmail(email: string): Promise<ClientUser | null> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM client_users WHERE email = ?',
      [email]
    )
    
    const users = rows as ClientUser[]
    return users.length > 0 ? users[0] : null
  } finally {
    connection.release()
  }
}

/**
 * 通过ID查找用户
 */
export async function findClientUserById(id: string): Promise<ClientUser | null> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM client_users WHERE id = ?',
      [id]
    )
    
    const users = rows as ClientUser[]
    return users.length > 0 ? users[0] : null
  } finally {
    connection.release()
  }
}

/**
 * 验证密码
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * 更新最后登录时间
 */
export async function updateLastLogin(userId: string): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    await connection.execute(
      'UPDATE client_users SET last_login_at = ? WHERE id = ?',
      [Date.now(), userId]
    )
  } finally {
    connection.release()
  }
}

/**
 * 获取所有用户（管理员用）
 */
export async function getAllClientUsers(): Promise<ClientUser[]> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM client_users ORDER BY created_at DESC'
    )
    
    return rows as ClientUser[]
  } finally {
    connection.release()
  }
}

/**
 * 更新用户配额
 */
export async function updateClientUserQuota(userId: string, maxTokens: number): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    await connection.execute(
      'UPDATE client_users SET max_tokens = ? WHERE id = ?',
      [maxTokens, userId]
    )
  } finally {
    connection.release()
  }
}

/**
 * 更新用户状态
 */
export async function updateClientUserStatus(
  userId: string, 
  status: 'active' | 'suspended' | 'banned'
): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    await connection.execute(
      'UPDATE client_users SET status = ? WHERE id = ?',
      [status, userId]
    )
  } finally {
    connection.release()
  }
}

/**
 * 通用更新用户信息
 */
export async function updateClientUser(
  userId: string,
  updates: { max_tokens?: number; status?: 'active' | 'suspended' | 'banned' }
): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    const fields: string[] = []
    const values: any[] = []

    if (updates.max_tokens !== undefined) {
      fields.push('max_tokens = ?')
      values.push(updates.max_tokens)
    }

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }

    if (fields.length > 0) {
      values.push(userId)
      await connection.execute(
        `UPDATE client_users SET ${fields.join(', ')} WHERE id = ?`,
        values
      )
    }
  } finally {
    connection.release()
  }
}

/**
 * 标记注册完成，并检查是否需要执行预删除
 * @returns {Promise<boolean>} 返回是否需要删除该用户
 */
export async function markRegistrationCompleted(email: string): Promise<boolean> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    // 查询用户的预删除状态
    const [rows] = await connection.execute(
      'SELECT id, pending_delete FROM client_users WHERE email = ?',
      [email]
    )

    const users = rows as any[]
    if (users.length === 0) {
      return false
    }

    const user = users[0]
    const shouldDelete = user.pending_delete === 1 || user.pending_delete === true

    // 更新注册状态为完成
    await connection.execute(
      'UPDATE client_users SET registration_status = ? WHERE email = ?',
      ['completed', email]
    )

    // 如果标记了预删除，立即删除
    if (shouldDelete) {
      console.log(`⚠️  检测到预删除标记，: ${email}`)
      await connection.execute('DELETE FROM client_users WHERE email = ?', [email])
      console.log(`✅ 已删除预标记用户: ${email}`)
    }

    return shouldDelete
  } finally {
    connection.release()
  }
}

/**
 * 删除用户（带注册状态检查）
 * @returns {Promise<{deleted: boolean, pending: boolean, message: string}>}
 */
export async function deleteClientUser(email: string): Promise<{
  deleted: boolean
  pending: boolean
  message: string
}> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    // 查询用户
    const [rows] = await connection.execute(
      'SELECT id, registration_status, pending_delete FROM client_users WHERE email = ?',
      [email]
    )

    const users = rows as any[]
    if (users.length === 0) {
      return {
        deleted: false,
        pending: false,
        message: '用户不存在'
      }
    }

    const user = users[0]
    const registrationStatus = user.registration_status || 'completed'

    if (registrationStatus === 'completed') {
      // 注册已完成，直接删除
      await connection.execute('DELETE FROM client_users WHERE email = ?', [email])
      return {
        deleted: true,
        pending: false,
        message: '用户已删除'
      }
    } else {
      // 注册未完成，标记为预删除
      await connection.execute(
        'UPDATE client_users SET pending_delete = TRUE WHERE email = ?',
        [email]
      )
      return {
        deleted: false,
        pending: true,
        message: `用户注册未完成(${registrationStatus})，已标记为预删除，将在注册完成后自动删除`
      }
    }
  } finally {
    connection.release()
  }
}
