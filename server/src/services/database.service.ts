/**
 * 数据库服务 - JSON 文件存储
 */

import path from 'path'
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { Task, TaskStats } from '../models/task.model'
import { Account, AccountStats } from '../models/account.model'

// 重新导出类型，供其他模块使用
export type { Task } from '../models/task.model'
export type { Account } from '../models/account.model'

const DATA_DIR = path.join(__dirname, '../../data')
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')

interface DataStore {
  tasks: Task[]
  accounts: Account[]
}

let dataStore: DataStore = {
  tasks: [],
  accounts: []
}

// 读取数据
function loadData() {
  try {
    if (existsSync(TASKS_FILE)) {
      const tasksData = readFileSync(TASKS_FILE, 'utf-8')
      dataStore.tasks = JSON.parse(tasksData)
    }
    if (existsSync(ACCOUNTS_FILE)) {
      const accountsData = readFileSync(ACCOUNTS_FILE, 'utf-8')
      const rawAccounts = JSON.parse(accountsData)
      
      // 迁移旧数据格式到新格式
      dataStore.accounts = rawAccounts.map((acc: any) => {
        // 如果已经是新格式，确保包含新的优化字段
        if (acc.credentials && acc.subscription && acc.usage) {
          return {
            ...acc,
            // 数据迁移：添加新的优化字段（如果不存在）
            lastError: acc.lastError,
            lastCheckedAt: acc.lastCheckedAt,
            consecutiveFailures: acc.consecutiveFailures ?? 0,
            // 确保 credentials.expiresAt 存在
            credentials: {
              ...acc.credentials,
              expiresAt: acc.credentials.expiresAt
            }
          }
        }
        
        // 否则从扁平化格式转换
        return {
          id: acc.id,
          email: acc.email,
          password: acc.password || '',
          nickname: acc.nickname,
          idp: acc.idp || 'BuilderId',
          userId: acc.user_id,
          visitorId: acc.visitor_id,
          
          credentials: {
            accessToken: acc.access_token || acc.x_amz_sso_authn || '',
            csrfToken: acc.csrf_token,
            refreshToken: acc.refresh_token,
            ssoToken: acc.x_amz_sso_authn,
            clientId: acc.client_id,
            clientSecret: acc.client_secret,
            region: acc.region || 'us-east-1',
            expiresAt: acc.expires_at,
            authMethod: acc.auth_method,
            provider: acc.provider
          },
          
          subscription: {
            type: acc.subscription_type || 'Free',
            title: acc.subscription_title,
            rawType: acc.subscription_raw_type,
            expiresAt: acc.subscription_expires_at || acc.expires_at,
            daysRemaining: acc.subscription_days_remaining || acc.days_remaining,
            upgradeCapability: acc.subscription_upgrade_capability || acc.upgrade_capability,
            overageCapability: acc.subscription_overage_capability || acc.overage_capability,
            managementTarget: acc.subscription_management_target || acc.management_target
          },
          
          usage: {
            current: acc.usage_current || 0,
            limit: acc.usage_limit || 0,
            percentUsed: acc.usage_percent_used || acc.usage_percent || 0,
            lastUpdated: acc.usage_last_updated || acc.last_sync_at || Date.now(),
            baseLimit: acc.usage_base_limit || acc.base_limit,
            baseCurrent: acc.usage_base_current || acc.base_current,
            freeTrialLimit: acc.usage_free_trial_limit || acc.free_trial_limit,
            freeTrialCurrent: acc.usage_free_trial_current || acc.free_trial_current,
            freeTrialExpiry: acc.usage_free_trial_expiry || acc.free_trial_expiry,
            bonuses: acc.usage_bonuses ? (typeof acc.usage_bonuses === 'string' ? JSON.parse(acc.usage_bonuses) : acc.usage_bonuses) : undefined,
            nextResetDate: acc.usage_next_reset_date || acc.next_reset_date,
            resourceDetail: {
              resourceType: acc.resource_type,
              displayName: acc.resource_display_name,
              displayNamePlural: acc.resource_display_name_plural,
              currency: acc.resource_currency,
              unit: acc.resource_unit,
              overageRate: acc.resource_overage_rate || acc.overage_rate,
              overageCap: acc.resource_overage_cap || acc.overage_cap,
              overageEnabled: acc.resource_overage_enabled || acc.overage_enabled
            }
          },
          
          groupId: acc.group_id,
          tags: acc.tags ? (typeof acc.tags === 'string' ? JSON.parse(acc.tags) : acc.tags) : undefined,
          ownerUserId: acc.owner_user_id,
          status: acc.status || 'pending',
          // 新增：错误状态管理字段（数据迁移）
          lastError: acc.last_error,
          lastCheckedAt: acc.last_checked_at || acc.last_sync_at,
          consecutiveFailures: acc.consecutive_failures ?? 0,
          isActive: acc.is_active,
          deviceId: acc.device_id,
          assignedAt: acc.assigned_at,
          createdAt: acc.created_at || Date.now(),
          lastUsedAt: acc.last_used_at
        }
      })
    }
  } catch (error: any) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ 加载数据文件失败')
    console.error('='.repeat(60))
    console.error(`错误: ${error.message}`)
    console.error('\n解决方法：')
    console.error(`  rm -f ${TASKS_FILE}`)
    console.error(`  rm -f ${ACCOUNTS_FILE}`)
    console.error('='.repeat(60) + '\n')
    throw error
  }
}

// 保存数据
function saveData() {
  try {
    writeFileSync(TASKS_FILE, JSON.stringify(dataStore.tasks, null, 2))
    writeFileSync(ACCOUNTS_FILE, JSON.stringify(dataStore.accounts, null, 2))
  } catch (error: any) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ 保存数据文件失败')
    console.error('='.repeat(60))
    console.error(`错误: ${error.message}`)
    console.error('\n解决方法：')
    console.error(`  df -h                    # 检查磁盘空间`)
    console.error(`  chmod 755 ${DATA_DIR}    # 修复权限`)
    console.error('='.repeat(60) + '\n')
    throw error
  }
}

// 初始化数据库
export function initDatabase() {
  try {
    // 确保数据目录存在
    if (!existsSync(DATA_DIR)) {
      console.log(`创建数据目录: ${DATA_DIR}`)
      mkdirSync(DATA_DIR, { recursive: true })
    }
    
    // 检查目录权限
    try {
      const testFile = path.join(DATA_DIR, '.test')
      writeFileSync(testFile, 'test')
      if (existsSync(testFile)) {
        unlinkSync(testFile)
      }
    } catch (permError: any) {
      console.error('\n' + '='.repeat(60))
      console.error('❌ 数据目录权限检查失败')
      console.error('='.repeat(60))
      console.error(`目录: ${DATA_DIR}`)
      console.error(`错误: ${permError.message}`)
      console.error('\n解决方法：')
      console.error(`  sudo chmod 755 ${DATA_DIR}`)
      console.error('='.repeat(60) + '\n')
      throw permError
    }
    
    // 加载现有数据
    loadData()
    
    console.log('✅ 数据库初始化完成')
    console.log(`   数据目录: ${DATA_DIR}`)
    console.log(`   任务数: ${dataStore.tasks.length}`)
    console.log(`   账号数: ${dataStore.accounts.length}`)
    
  } catch (error: any) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ 数据库初始化失败')
    console.error('='.repeat(60))
    console.error(`错误: ${error.message}`)
    console.error('\n解决方法：')
    console.error('  mkdir -p server/data')
    console.error('  chmod 755 server/data')
    console.error('='.repeat(60) + '\n')
    throw error
  }
}

// ==================== 任务操作 ====================

export const TaskDB = {
  create(task: Omit<Task, 'created_at' | 'updated_at'>): Task {
    const now = Date.now()
    const fullTask = { ...task, created_at: now, updated_at: now } as Task
    dataStore.tasks.push(fullTask)
    saveData()
    return fullTask
  },
  
  getById(id: string): Task | undefined {
    return dataStore.tasks.find(t => t.id === id)
  },
  
  getAll(status?: string): Task[] {
    if (status) {
      return dataStore.tasks.filter(t => t.status === status)
    }
    return [...dataStore.tasks].sort((a, b) => b.created_at - a.created_at)
  },
  
  updateStatus(id: string, status: Task['status'], error?: string) {
    const task = dataStore.tasks.find(t => t.id === id)
    if (task) {
      task.status = status
      task.error = error
      task.updated_at = Date.now()
      saveData()
    }
  },
  
  delete(id: string) {
    dataStore.tasks = dataStore.tasks.filter(t => t.id !== id)
    saveData()
  },
  
  getStats(): TaskStats {
    return {
      total: dataStore.tasks.length,
      pending: dataStore.tasks.filter(t => t.status === 'pending').length,
      running: dataStore.tasks.filter(t => t.status === 'running').length,
      success: dataStore.tasks.filter(t => t.status === 'success').length,
      failed: dataStore.tasks.filter(t => t.status === 'failed').length,
      paused: dataStore.tasks.filter(t => t.status === 'paused').length
    }
  }
}

// ==================== 账号操作 ====================

export const AccountDB = {
  create(account: Omit<Account, 'created_at'>): Account {
    const now = Date.now()
    const fullAccount = { ...account, created_at: now } as Account
    
    // 清理 undefined 值，避免 JSON 序列化问题
    const cleanAccount = JSON.parse(JSON.stringify(fullAccount, (key, value) => 
      value === undefined ? null : value
    ))
    
    // 检查是否已存在
    const existing = dataStore.accounts.find(a => a.email === cleanAccount.email)
    if (existing) {
      Object.assign(existing, cleanAccount)
    } else {
      dataStore.accounts.push(cleanAccount)
    }
    
    saveData()
    return cleanAccount
  },
  
  getById(id: string): Account | undefined {
    return dataStore.accounts.find(a => a.id === id)
  },
  
  getByEmail(email: string): Account | undefined {
    return dataStore.accounts.find(a => a.email === email)
  },
  
  getAll(): Account[] {
    return [...dataStore.accounts].sort((a, b) => b.createdAt - a.createdAt)
  },
  
  delete(id: string) {
    dataStore.accounts = dataStore.accounts.filter(a => a.id !== id)
    saveData()
  },
  
  getStats(): AccountStats {
    return {
      total: dataStore.accounts.length
    }
  },
  
  // 获取域名统计
  getDomainStats(): Array<{ domain: string; count: number }> {
    const domainMap = new Map<string, number>()
    
    dataStore.accounts.forEach(account => {
      const domain = account.email.split('@')[1]
      if (domain) {
        domainMap.set(domain, (domainMap.get(domain) || 0) + 1)
      }
    })
    
    return Array.from(domainMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
  },
  
  // 获取每日注册统计（最近N天）
  getDailyStats(days: number = 7): Array<{ date: string; total: number; domain: string }> {
    const now = Date.now()
    const daysAgo = now - (days * 24 * 60 * 60 * 1000)
    
    const dailyMap = new Map<string, Map<string, number>>()
    
    dataStore.accounts
      .filter(account => account.createdAt >= daysAgo)
      .forEach(account => {
        const date = new Date(account.createdAt).toISOString().split('T')[0]
        const domain = account.email.split('@')[1]
        
        if (!dailyMap.has(date)) {
          dailyMap.set(date, new Map())
        }
        
        const domainMap = dailyMap.get(date)!
        domainMap.set(domain, (domainMap.get(domain) || 0) + 1)
      })
    
    const result: Array<{ date: string; total: number; domain: string }> = []
    
    dailyMap.forEach((domainMap, date) => {
      domainMap.forEach((count, domain) => {
        result.push({ date, total: count, domain })
      })
    })
    
    return result.sort((a, b) => b.date.localeCompare(a.date))
  },
  
  updateToken(id: string, xAmzSsoAuthn: string) {
    const account = dataStore.accounts.find(a => a.id === id)
    if (account) {
      account.credentials.accessToken = xAmzSsoAuthn
      account.status = 'active'
      saveData()
    }
  },
  
  updateAccessToken(id: string, accessToken: string) {
    const account = dataStore.accounts.find(a => a.id === id)
    if (account) {
      account.credentials.accessToken = accessToken
      saveData()
    }
  },
  
  assignToDevice(id: string, deviceId: string, deviceName?: string) {
    const account = dataStore.accounts.find(a => a.id === id)
    if (account) {
      account.deviceId = deviceId
      account.status = 'assigned'
      account.assignedAt = Date.now()
      saveData()
    }
  },

  updateExtendedInfo(id: string, info: any) {
    const account = dataStore.accounts.find(a => a.id === id)
    if (account) {
      // 使用 updateAccountUsage 映射工具
      const { updateAccountUsage } = require('../utils/account-mapper')
      const updated = updateAccountUsage(account, info)
      Object.assign(account, updated)
      saveData()
    }
  },

  update(id: string, updates: Partial<Account>) {
    const account = dataStore.accounts.find(a => a.id === id)
    if (account) {
      Object.assign(account, updates)
      saveData()
    }
  },

  updateOAuthCredentials(id: string, credentials: {
    refresh_token?: string
    client_id?: string
    client_secret?: string
    region?: string
  }) {
    const account = dataStore.accounts.find(a => a.id === id)
    if (account) {
      if (credentials.refresh_token !== undefined) account.credentials.refreshToken = credentials.refresh_token
      if (credentials.client_id !== undefined) account.credentials.clientId = credentials.client_id
      if (credentials.client_secret !== undefined) account.credentials.clientSecret = credentials.client_secret
      if (credentials.region !== undefined) account.credentials.region = credentials.region
      saveData()
    }
  }
}
