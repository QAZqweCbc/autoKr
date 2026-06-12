/**
 * 数据库事务工具
 * 提供事务保护的数据库操作
 */

import { PoolConnection } from 'mysql2/promise'
import { getPool } from '../services/mysql.service'
import { logger } from './logger'

/**
 * 执行事务操作
 * 
 * @param operation 事务操作函数
 * @param context 操作上下文（用于日志）
 * @returns 操作结果
 * 
 * @example
 * ```typescript
 * const result = await withTransaction(async (connection) => {
 *   await connection.execute('INSERT INTO accounts ...')
 *   await connection.execute('INSERT INTO tags ...')
 *   return { success: true }
 * }, 'createAccount')
 * ```
 */
export async function withTransaction<T>(
  operation: (connection: PoolConnection) => Promise<T>,
  context: string
): Promise<T> {
  const pool = getPool()
  const connection = await pool.getConnection()
  
  try {
    // 开始事务
    await connection.beginTransaction()
    logger.debug(`Transaction started: ${context}`)
    
    // 执行操作
    const result = await operation(connection)
    
    // 提交事务
    await connection.commit()
    logger.debug(`Transaction committed: ${context}`)
    
    return result
  } catch (error: any) {
    // 回滚事务
    try {
      await connection.rollback()
      logger.warn(`Transaction rolled back: ${context}`, { error: error.message })
    } catch (rollbackError: any) {
      logger.error(`Transaction rollback failed: ${context}`, { 
        error: error.message,
        rollbackError: rollbackError.message 
      })
    }
    
    // 重新抛出原始错误
    throw error
  } finally {
    // 释放连接
    connection.release()
  }
}

/**
 * 批量执行事务操作
 * 
 * @param operations 操作数组
 * @param context 操作上下文
 * @returns 所有操作的结果数组
 * 
 * @example
 * ```typescript
 * const results = await withBatchTransaction([
 *   (conn) => conn.execute('INSERT INTO accounts ...'),
 *   (conn) => conn.execute('INSERT INTO tags ...'),
 *   (conn) => conn.execute('UPDATE stats ...')
 * ], 'batchCreateAccounts')
 * ```
 */
export async function withBatchTransaction<T>(
  operations: Array<(connection: PoolConnection) => Promise<T>>,
  context: string
): Promise<T[]> {
  return withTransaction(async (connection) => {
    const results: T[] = []
    
    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await operations[i](connection)
        results.push(result)
      } catch (error: any) {
        logger.error(`Batch operation ${i + 1}/${operations.length} failed in ${context}`, {
          error: error.message
        })
        throw error
      }
    }
    
    return results
  }, context)
}

/**
 * 执行带重试的事务操作
 * 
 * @param operation 事务操作函数
 * @param context 操作上下文
 * @param maxRetries 最大重试次数（默认3次）
 * @param retryDelay 重试延迟（毫秒，默认1000ms）
 * @returns 操作结果
 */
export async function withTransactionRetry<T>(
  operation: (connection: PoolConnection) => Promise<T>,
  context: string,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(operation, `${context} (attempt ${attempt}/${maxRetries})`)
    } catch (error: any) {
      lastError = error
      
      // 检查是否是可重试的错误
      const isRetryable = isRetryableError(error)
      
      if (!isRetryable || attempt === maxRetries) {
        logger.error(`Transaction failed after ${attempt} attempts: ${context}`, {
          error: error.message,
          isRetryable
        })
        throw error
      }
      
      // 等待后重试
      logger.warn(`Transaction attempt ${attempt} failed, retrying in ${retryDelay}ms: ${context}`, {
        error: error.message
      })
      await sleep(retryDelay)
      
      // 指数退避
      retryDelay *= 2
    }
  }
  
  throw lastError
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: any): boolean {
  const retryableErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ER_LOCK_DEADLOCK',
    'ER_LOCK_WAIT_TIMEOUT'
  ]
  
  return retryableErrors.some(code => 
    error.code === code || error.message?.includes(code)
  )
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 检查是否在事务中
 */
export function isInTransaction(connection: PoolConnection): boolean {
  // MySQL2 没有直接的方法检查事务状态
  // 这里返回 true 表示假设在事务中
  return true
}
