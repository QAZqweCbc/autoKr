/**
 * 管理员控制器
 * 处理管理员登录、审批、用户管理等功能
 */

import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcrypt'
import { generateToken } from '../auth-service/services/jwt.service'
import { TokenAllocationService } from '../services/token-allocation.service'
import { 
  findClientUserByEmail,
  findClientUserById,
  getAllClientUsers,
  updateClientUser,
  updateLastLogin
} from '../services/client-user.service'
import { getPool } from '../services/mysql.service'
import { MySQLAccountDBNew as MySQLAccountDB } from '../services/mysql-account.service'
import { isAccountAvailable } from '../services/token-availability.service'
import { flatToAccount } from '../utils/account-mapper'

/**
 * 管理员登录
 * POST /api/admin/login
 */
export async function adminLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body
    
    // 验证必填字段
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '邮箱和密码不能为空'
      })
    }
    
    // 查询管理员账户（使用client_users表，但检查是否是admin@user.com）
    if (email !== 'admin@user.com') {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      })
    }
    
    const admin = await findClientUserByEmail(email)
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      })
    }
    
    // 验证密码
    const isValid = await bcrypt.compare(password, admin.password_hash)
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      })
    }
    
    // 生成JWT Token（添加role字段）
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      role: 'admin'
    })
    
    // 更新最后登录时间
    await updateLastLogin(admin.id)
    
    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: 'admin'
      }
    })
  } catch (error: any) {
    console.error('[Admin Login] Error:', error)
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message
    })
  }
}

/**
 * 查看待审批申请
 * GET /api/admin/requests/pending
 */
export async function getPendingRequests(req: Request, res: Response) {
  try {
    const requests = await TokenAllocationService.getPendingRequests()
    
    res.json({
      success: true,
      requests
    })
  } catch (error: any) {
    console.error('[Get Pending Requests] Error:', error)
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    })
  }
}

/**
 * 审批申请
 * POST /api/admin/requests/:id/approve
 */
export async function approveRequest(req: Request, res: Response) {
  const connection = await getPool().getConnection()

  try {
    const { id } = req.params
    const adminId = (req as any).user.id
    await connection.beginTransaction()
    
    // 1. 查询申请记录
    const [allocationRows] = await connection.execute(
      'SELECT * FROM token_allocations WHERE id = ? FOR UPDATE',
      [id]
    )
    const allocation = (allocationRows as any[])[0]
    if (!allocation) {
      await connection.rollback()
      return res.status(404).json({
        success: false,
        message: '申请不存在'
      })
    }
    
    if (allocation.status !== 'pending') {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: '申请已处理'
      })
    }
    
    // 2. 检查用户当前配额
    const [userRows] = await connection.execute(
      'SELECT id, max_tokens FROM client_users WHERE id = ? FOR UPDATE',
      [allocation.user_id]
    )
    const user = (userRows as any[])[0]
    if (!user) {
      await connection.rollback()
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      })
    }
    
    const [activeCountRows] = await connection.execute(
      'SELECT COUNT(*) as count FROM token_allocations WHERE user_id = ? AND status = ?',
      [allocation.user_id, 'active']
    )
    const activeCount = Number((activeCountRows as any[])[0]?.count || 0)
    if (activeCount >= user.max_tokens) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: `用户已达最大配额(${user.max_tokens}个)`
      })
    }
    
    // 3. 选择可用账户
    const [accountRows] = await connection.execute(
      "SELECT * FROM accounts WHERE status = 'active' ORDER BY created_at ASC FOR UPDATE"
    )
    const account = (accountRows as any[])
      .map(row => flatToAccount(row))
      .find(candidate => isAccountAvailable(candidate))
    if (!account) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: '暂无可用账户'
      })
    }
    
    // 4. 实时检测账户可用性（暂时跳过，避免 token 过期问题）
    // const checkResult = await checkAccountAvailability(account)
    // if (!checkResult.available) {
    //   return res.status(400).json({
    //     success: false,
    //     message: '账户检测后不可用',
    //     error: checkResult.error
    //   })
    // }
    
    // 5. 更新分配记录和账户状态
    const approvedAt = Date.now()

    await connection.execute(
      `UPDATE token_allocations
       SET account_id = ?, status = ?, approved_at = ?, approved_by = ?
       WHERE id = ?`,
      [account.id, 'active', approvedAt, adminId, id]
    )
    
    await connection.execute(
      'UPDATE accounts SET status = ? WHERE id = ?',
      ['assigned', account.id]
    )
    
    // 6. 返回结果
    await connection.commit()
    
    res.json({
      success: true,
      allocation: {
        ...allocation,
        account_id: account.id,
        status: 'active',
        approved_at: approvedAt,
        approved_by: adminId
      }
    })
  } catch (error: any) {
    try {
      await connection.rollback()
    } catch {
      // Ignore rollback failures and surface the original error.
    }
    console.error('[Approve Request] Error:', error)
    res.status(500).json({
      success: false,
      message: '审批失败',
      error: error.message
    })
  } finally {
    connection.release()
  }
}

/**
 * 拒绝申请
 * POST /api/admin/requests/:id/reject
 */
export async function rejectRequest(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { reason } = req.body
    const adminId = (req as any).user.id
    
    // 1. 查询申请记录
    const allocation = await TokenAllocationService.getById(id)
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: '申请不存在'
      })
    }
    
    if (allocation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '申请已处理'
      })
    }
    
    // 2. 更新分配记录
    await TokenAllocationService.update(id, {
      status: 'rejected',
      reject_reason: reason || '管理员拒绝',
      approved_at: Date.now(),
      approved_by: adminId
    })
    
    res.json({
      success: true
    })
  } catch (error: any) {
    console.error('[Reject Request] Error:', error)
    res.status(500).json({
      success: false,
      message: '拒绝失败',
      error: error.message
    })
  }
}

/**
 * 查看待审批的释放申请
 * GET /api/admin/revoke-requests/pending
 */
export async function getPendingRevokeRequests(req: Request, res: Response) {
  try {
    const requests = await TokenAllocationService.getPendingRevokeRequests()

    res.json({
      success: true,
      requests
    })
  } catch (error: any) {
    console.error('[Get Pending Revoke Requests] Error:', error)
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    })
  }
}

/**
 * 批准释放申请
 * POST /api/admin/revoke-requests/:id/approve
 */
export async function approveRevokeRequest(req: Request, res: Response) {
  try {
    const { id } = req.params
    const adminId = (req as any).user.id

    const allocation = await TokenAllocationService.getById(id)
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: '申请不存在'
      })
    }

    if (allocation.status !== 'active' || !allocation.revoke_reason) {
      return res.status(400).json({
        success: false,
        message: '无效的释放申请'
      })
    }

    await TokenAllocationService.update(id, {
      status: 'revoked',
      revoked_at: Date.now(),
      revoked_by: adminId
    })

    if (allocation.account_id) {
      await MySQLAccountDB.update(allocation.account_id, {
        status: 'active'
      })
    }

    res.json({
      success: true,
      message: '释放申请已批准'
    })
  } catch (error: any) {
    console.error('[Approve Revoke Request] Error:', error)
    res.status(500).json({
      success: false,
      message: '批准失败',
      error: error.message
    })
  }
}

/**
 * 拒绝释放申请
 * POST /api/admin/revoke-requests/:id/reject
 */
export async function rejectRevokeRequest(req: Request, res: Response) {
  try {
    const { id } = req.params

    const allocation = await TokenAllocationService.getById(id)
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: '申请不存在'
      })
    }

    if (allocation.status !== 'active' || !allocation.revoke_reason) {
      return res.status(400).json({
        success: false,
        message: '无效的释放申请'
      })
    }

    await TokenAllocationService.update(id, {
      revoke_reason: null
    })

    res.json({
      success: true,
      message: '释放申请已拒绝'
    })
  } catch (error: any) {
    console.error('[Reject Revoke Request] Error:', error)
    res.status(500).json({
      success: false,
      message: '拒绝失败',
      error: error.message
    })
  }
}

/**
 * 查看所有用户
 * GET /api/admin/users
 */
export async function getAllUsers(req: Request, res: Response) {
  try {
    const users = await getAllClientUsers()
    
    // 移除密码哈希
    const safeUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      status: user.status,
      max_tokens: user.max_tokens,
      created_at: user.created_at,
      last_login_at: user.last_login_at
    }))
    
    res.json({
      success: true,
      users: safeUsers
    })
  } catch (error: any) {
    console.error('[Get All Users] Error:', error)
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    })
  }
}

/**
 * 查看所有分配记录
 * GET /api/admin/allocations
 */
export async function getAllAllocations(req: Request, res: Response) {
  try {
    const allocations = await TokenAllocationService.getAll()
    
    res.json({
      success: true,
      allocations
    })
  } catch (error: any) {
    console.error('[Get All Allocations] Error:', error)
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    })
  }
}

/**
 * 释放Token
 * POST /api/admin/allocations/:id/revoke
 */
export async function revokeAllocation(req: Request, res: Response) {
  try {
    const { id } = req.params
    const adminId = (req as any).user.id
    
    // 1. 查询分配记录
    const allocation = await TokenAllocationService.getById(id)
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: '分配记录不存在'
      })
    }
    
    if (allocation.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: '只能释放活跃的Token'
      })
    }
    
    // 2. 更新分配记录
    await TokenAllocationService.update(id, {
      status: 'revoked',
      revoked_at: Date.now(),
      revoked_by: adminId
    })
    
    // 3. 更新账户状态（回到池中）
    if (allocation.account_id) {
      await MySQLAccountDB.update(allocation.account_id, {
        status: 'active'
      })
    }
    
    res.json({
      success: true,
      message: 'Token已释放'
    })
  } catch (error: any) {
    console.error('[Revoke Allocation] Error:', error)
    res.status(500).json({
      success: false,
      message: '释放失败',
      error: error.message
    })
  }
}

/**
 * 调整用户配额
 * PUT /api/admin/users/:id/quota
 */
export async function updateUserQuota(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { max_tokens } = req.body
    
    if (max_tokens === undefined || max_tokens === null || max_tokens < 0) {
      return res.status(400).json({
        success: false,
        message: '配额必须大于等于0'
      })
    }
    
    await updateClientUser(id, { max_tokens })
    
    res.json({
      success: true
    })
  } catch (error: any) {
    console.error('[Update User Quota] Error:', error)
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error.message
    })
  }
}

/**
 * 封禁/解封用户
 * PUT /api/admin/users/:id/status
 */
export async function updateUserStatus(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { status } = req.body
    
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态'
      })
    }
    
    await updateClientUser(id, { status })
    
    res.json({
      success: true
    })
  } catch (error: any) {
    console.error('[Update User Status] Error:', error)
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error.message
    })
  }
}

/**
 * 账户统计（简化版）
 * GET /api/admin/accounts/stats
 */
export async function getAccountStats(req: Request, res: Response) {
  try {
    const accounts = await MySQLAccountDB.getAll()

    // 统计账户状态
    const total = accounts.length
    const available = accounts.filter(a =>
      a.status === 'active' &&
      a.usage.percentUsed !== null &&
      a.usage.percentUsed !== undefined &&
      a.usage.percentUsed < 85 &&
      a.subscription.type
    ).length
    const assigned = accounts.filter(a => a.status === 'assigned').length
    const unavailable = total - available - assigned

    // 统计Token额度信息
    let totalTokens = 0
    let usedTokens = 0
    let availableTokens = 0

    accounts.forEach(account => {
      if (account.usage.limit && account.usage.current !== undefined && account.usage.current !== null) {
        totalTokens += account.usage.limit
        usedTokens += account.usage.current

        // 只有可用账户才计入可用额度
        if (account.status === 'active' &&
            account.usage.percentUsed !== null &&
            account.usage.percentUsed !== undefined &&
            account.usage.percentUsed < 85 &&
            account.subscription.type) {
          availableTokens += (account.usage.limit - account.usage.current)
        }
      }
    })

    res.json({
      success: true,
      stats: {
        total,
        available,
        assigned,
        unavailable,
        tokens: {
          total: totalTokens,
          used: usedTokens,
          available: availableTokens,
          usagePercent: totalTokens > 0 ? Math.round((usedTokens / totalTokens) * 100) : 0
        }
      }
    })
  } catch (error: any) {
    console.error('[Get Account Stats] Error:', error)
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    })
  }
}

/**
 * 获取账户详细列表
 * GET /api/admin/accounts/details
 */
export async function getAccountDetails(req: Request, res: Response) {
  try {
    const accounts = await MySQLAccountDB.getAll()
    const allocations = await TokenAllocationService.getAll()

    // 创建分配映射表
    const allocationMap = new Map()
    allocations.forEach(allocation => {
      if (allocation.status === 'active') {
        allocationMap.set(allocation.account_email, {
          username: allocation.username,
          user_email: allocation.email
        })
      }
    })

    // 构建详细列表
    const details = accounts.map(account => {
      const allocation = allocationMap.get(account.email)
      
      // 将usage.percentUsed转换为数字
      const usagePercent = account.usage.percentUsed !== null && account.usage.percentUsed !== undefined
        ? parseFloat(String(account.usage.percentUsed))
        : null
      
      // 判断可用状态
      const isAvailable = account.status === 'active' &&
        usagePercent !== null &&
        !isNaN(usagePercent) &&
        usagePercent < 85 &&
        account.usage.limit > 0 &&  // 必须有额度限制
        account.subscription.type  // 有订阅类型即可，不强制要求Active状态

      // 判断分配状态
      let allocationStatus: 'available' | 'assigned' | 'unavailable'
      if (allocation) {
        allocationStatus = 'assigned'
      } else if (isAvailable) {
        allocationStatus = 'available'
      } else {
        allocationStatus = 'unavailable'
      }

      return {
        id: account.id,
        email: account.email,
        usage_current: account.usage.current || 0,
        usage_limit: account.usage.limit || 0,
        usage_percent: usagePercent || 0,
        subscription_type: account.subscription.type || '',
        subscription_status: account.subscription.rawType || '',
        is_available: isAvailable,
        allocation_status: allocationStatus,
        assigned_to: allocation?.user_email,
        assigned_username: allocation?.username,
        created_at: account.createdAt
      }
    })

    // 按分配状态排序：已分配 > 可分配 > 不可分配
    details.sort((a, b) => {
      const order = { assigned: 0, available: 1, unavailable: 2 }
      return order[a.allocation_status] - order[b.allocation_status]
    })

    res.json({
      success: true,
      accounts: details
    })
  } catch (error: any) {
    console.error('[Get Account Details] Error:', error)
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    })
  }
}


/**
 * Token池统计
 * GET /api/admin/stats/pool
 */
export async function getPoolStats(req: Request, res: Response) {
  try {
    const accounts = await MySQLAccountDB.getAll()
    const users = await getAllClientUsers()
    const allocations = await TokenAllocationService.getAll()
    
    // 统计账户
    const totalAccounts = accounts.length
    const availableAccounts = accounts.filter(a => 
      a.status === 'active' && 
      a.usage.percentUsed && a.usage.percentUsed < 85 &&
      a.subscription.type
    ).length
    const assignedAccounts = accounts.filter(a => a.status === 'assigned').length
    const unavailableAccounts = totalAccounts - availableAccounts - assignedAccounts
    
    // 统计用户和申请
    const totalUsers = users.length
    const pendingRequests = allocations.filter(a => a.status === 'pending').length
    
    res.json({
      success: true,
      stats: {
        total_accounts: totalAccounts,
        available_accounts: availableAccounts,
        assigned_accounts: assignedAccounts,
        unavailable_accounts: unavailableAccounts,
        total_users: totalUsers,
        pending_requests: pendingRequests
      }
    })
  } catch (error: any) {
    console.error('[Get Pool Stats] Error:', error)
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    })
  }
}

/**
 * 批量刷新账户
 * POST /api/admin/accounts/refresh-all
 */
export async function refreshAllAccounts(req: Request, res: Response) {
  try {
    const accounts = await MySQLAccountDB.getAll()
    const { syncAccountUsage } = await import('../services/kiro-api.service')
    
    let refreshed = 0
    let failed = 0
    
    // 批量刷新（限制10个并发）
    const batchSize = 10
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (account) => {
          if (!account.credentials.accessToken) {
            failed++
            return
          }
          
          try {
            const result = await syncAccountUsage(
              account.credentials.accessToken,
              account.idp
            )
            
            if (result.success && result.data) {
              await MySQLAccountDB.updateExtendedInfo(account.id, result.data)
              refreshed++
            } else {
              failed++
            }
          } catch (error) {
            failed++
          }
        })
      )
    }
    
    res.json({
      success: true,
      refreshed,
      failed
    })
  } catch (error: any) {
    console.error('[Refresh All Accounts] Error:', error)
    res.status(500).json({
      success: false,
      message: '刷新失败',
      error: error.message
    })
  }
}

/**
 * 获取账号池状态
 * GET /api/admin/account-pool/status
 */
export async function getAccountPoolStatus(req: Request, res: Response) {
  try {
    const { getAccountPoolStatus: getStatus } = await import('../services/account-pool.service')
    const status = await getStatus()

    res.json({
      success: true,
      status
    })
  } catch (error: any) {
    console.error('[Get Account Pool Status] Error:', error)
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    })
  }
}

/**
 * 手动触发账号池补充
 * POST /api/admin/account-pool/replenish
 */
export async function replenishAccountPool(req: Request, res: Response) {
  try {
    const { checkAndReplenishPool } = await import('../services/account-pool.service')
    await checkAndReplenishPool()

    res.json({
      success: true,
      message: '账号池补充任务已触发'
    })
  } catch (error: any) {
    console.error('[Replenish Account Pool] Error:', error)
    res.status(500).json({
      success: false,
      message: '触发失败',
      error: error.message
    })
  }
}
