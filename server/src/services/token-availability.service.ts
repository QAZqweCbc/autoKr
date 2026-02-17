/**
 * Token可用性检测服务
 * 检测账户是否可用并选择最佳账户
 */

import { Account } from '../models/account.model'
import { MySQLAccountDB } from './mysql.service'
import { syncAccountUsage } from './kiro-api.service'
import { updateAccountUsage } from '../utils/account-mapper'

/**
 * 检测账户是否可用
 * 条件：
 * 1. usage.percentUsed < 85%
 * 2. 必须有订阅 (subscription.type存在)
 * 3. 必须有usage.limit
 * 4. 必须有credentials.accessToken
 */
export function isAccountAvailable(account: Account): boolean {
  // 条件1: 使用率 < 85%
  if (account.usage.percentUsed >= 85) {
    return false
  }
  
  // 条件2: 必须有订阅
  if (!account.subscription.type) {
    return false
  }
  
  // 条件3: 必须有额度限制
  if (!account.usage.limit || account.usage.limit === 0) {
    return false
  }
  
  // 条件4: 必须有access_token
  if (!account.credentials.accessToken) {
    return false
  }
  
  return true
}

/**
 * 选择注册时间最早的可用账户
 * 返回null表示没有可用账户
 */
export async function selectAvailableAccount(): Promise<Account | null> {
  // 1. 查询所有active状态的账户
  const accounts = await MySQLAccountDB.getAll()
  
  // 2. 过滤可用账户
  const availableAccounts = accounts.filter(acc => 
    acc.status === 'active' && isAccountAvailable(acc)
  )
  
  if (availableAccounts.length === 0) {
    return null
  }
  
  // 3. 按createdAt升序排序（最早的在前）
  availableAccounts.sort((a, b) => {
    const timeA = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime()
    const timeB = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime()
    return timeA - timeB
  })
  
  // 4. 返回第一个（注册时间最早）
  return availableAccounts[0]
}

/**
 * 实时检测账户可用性
 * 调用AWS API获取最新数据并更新数据库
 */
export async function checkAccountAvailability(account: Account): Promise<{
  available: boolean
  account: Account
  error?: string
}> {
  try {
    // 调用AWS API同步最新数据
    const syncResult = await syncAccountUsage(
      account.credentials.accessToken,
      account.idp
    )
    
    if (!syncResult.success || !syncResult.data) {
      return {
        available: false,
        account,
        error: syncResult.error || '同步失败'
      }
    }
    
    // 更新账户数据
    const updatedAccount = updateAccountUsage(account, syncResult.data)
    await MySQLAccountDB.update(updatedAccount.id, updatedAccount)
    
    // 重新检查可用性
    const available = isAccountAvailable(updatedAccount)
    
    return {
      available,
      account: updatedAccount
    }
  } catch (error: any) {
    return {
      available: false,
      account,
      error: error.message
    }
  }
}
