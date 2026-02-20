/**
 * Token控制器
 * 处理用户Token申请和查询
 */

import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { TokenAllocationService } from '../../services/token-allocation.service'
import { findClientUserById } from '../../services/client-user.service'
import { MySQLAccountDB } from '../../services/mysql.service'
import { updateAccountUsage } from '../../utils/account-mapper'

/**
 * 提交Token申请
 * POST /api/tokens/request
 */
export async function requestToken(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id
    
    // 1. 查询用户信息
    const user = await findClientUserById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      })
    }
    
    // 2. 检查用户状态
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: '账户已被封禁或暂停'
      })
    }
    
    // 3. 检查当前活跃Token数量
    const activeCount = await TokenAllocationService.countActiveByUserId(userId)
    if (activeCount >= user.max_tokens) {
      return res.status(400).json({
        success: false,
        message: `已达到最大配额(${user.max_tokens}个)`
      })
    }
    
    // 4. 创建申请记录
    const allocation = {
      id: uuidv4(),
      user_id: userId,
      status: 'pending' as const,
      requested_at: Date.now()
    }
    
    await TokenAllocationService.create(allocation)
    
    // 5. 触发自动审批
    const { processAutoApproval } = await import('../../services/auto-approval.service')
    const approvalResult = await processAutoApproval(allocation.id)
    
    if (approvalResult.approved) {
      // 自动审批通过
      return res.json({
        success: true,
        allocation_id: allocation.id,
        message: '申请已自动审批通过',
        auto_approved: true
      })
    } else if (approvalResult.needsGeneration) {
      // 账号生成中
      return res.json({
        success: true,
        allocation_id: allocation.id,
        message: '账号构建中，请稍候...',
        generating: true
      })
    } else {
      // 需要人工审批
      return res.json({
        success: true,
        allocation_id: allocation.id,
        message: '申请已提交，等待管理员审批'
      })
    }
  } catch (error: any) {
    console.error('[Token Request] Error:', error)
    res.status(500).json({
      success: false,
      message: '申请失败',
      error: error.message
    })
  }
}

/**
 * 查看我的申请
 * GET /api/tokens/my-requests
 */
export async function getMyRequests(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id
    
    const requests = await TokenAllocationService.getByUserId(userId)
    
    res.json({
      success: true,
      requests
    })
  } catch (error: any) {
    console.error('[Get My Requests] Error:', error)
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    })
  }
}

/**
 * 查看我的Token
 * GET /api/tokens/my-tokens
 */
export async function getMyTokens(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id
    
    // 1. 查询用户信息
    const user = await findClientUserById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      })
    }
    
    // 2. 查询活跃的分配记录
    const allocations = await TokenAllocationService.getByUserId(userId, 'active')
    
    // 3. 获取账户详情
    const tokens = await Promise.all(
      allocations.map(async (allocation) => {
        if (!allocation.account_id) {
          return null
        }
        
        const account = await MySQLAccountDB.getById(allocation.account_id)
        if (!account) {
          return null
        }
        
        return {
          allocation_id: allocation.id,
          account: {
            // 基本信息
            id: account.id,
            email: account.email,
            nickname: account.nickname,
            userId: account.userId,
            idp: account.idp,
            
            // 完整的凭证信息（刷新必需）
            credentials: account.credentials,
            
            // 完整的订阅信息
            subscription: account.subscription,
            
            // 完整的使用量信息
            usage: account.usage,
            
            // 其他信息
            status: account.status,
            lastCheckedAt: account.lastCheckedAt,
            createdAt: account.createdAt
          },
          status: allocation.status,
          allocated_at: allocation.approved_at
        }
      })
    )
    
    // 过滤掉null值
    const validTokens = tokens.filter(t => t !== null)
    
    res.json({
      success: true,
      tokens: validTokens,
      quota: {
        used: validTokens.length,
        max: user.max_tokens
      }
    })
  } catch (error: any) {
    console.error('[Get My Tokens] Error:', error)
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    })
  }
}

/**
 * 请求释放Token
 * POST /api/tokens/:id/request-revoke
 */
export async function requestRevoke(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id
    const { id } = req.params
    const { reason } = req.body
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供释放理由'
      })
    }
    
    // 1. 验证分配记录归属
    const allocation = await TokenAllocationService.getById(id)
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: '分配记录不存在'
      })
    }
    
    if (allocation.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '无权操作此Token'
      })
    }
    
    if (allocation.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: '只能释放活跃的Token'
      })
    }
    
    // 2. 保存释放理由
    await TokenAllocationService.update(id, {
      revoke_reason: reason
    })
    
    // 3. 触发自动审批
    const { processRevokeAutoApproval } = await import('../../services/auto-approval.service')
    const approvalResult = await processRevokeAutoApproval(id, reason)
    
    if (approvalResult.approved) {
      return res.json({
        success: true,
        message: '释放申请已自动审批通过',
        auto_approved: true
      })
    } else {
      return res.json({
        success: true,
        message: '释放申请已提交，等待管理员审批'
      })
    }
  } catch (error: any) {
    console.error('[Request Revoke] Error:', error)
    res.status(500).json({
      success: false,
      message: '提交失败',
      error: error.message
    })
  }
}

/**
 * 刷新Token额度
 * POST /api/tokens/refresh/:accountId
 */
export async function refreshToken(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id
    const { accountId } = req.params
    
    // 1. 验证账户归属
    const allocations = await TokenAllocationService.getByUserId(userId, 'active')
    const allocation = allocations.find(a => a.account_id === accountId)
    
    if (!allocation) {
      return res.status(403).json({
        success: false,
        message: '无权访问此账户'
      })
    }
    
    // 2. 查询账户信息
    const account = await MySQLAccountDB.getById(accountId)
    if (!account) {
      return res.status(404).json({
        success: false,
        message: '账户不存在'
      })
    }
    
    console.log(`\n📊 [Auth Service] 客户端请求刷新账号: ${account.email}`)
    
    let currentAccessToken = account.credentials.accessToken
    let needRefresh = false
    
    // 3. 检查Token是否即将过期（提前5分钟）
    const now = Date.now()
    const expiresAt = account.credentials.expiresAt || 0
    const expiresIn = expiresAt - now
    const REFRESH_THRESHOLD = 5 * 60 * 1000 // 5分钟
    
    if (expiresIn < REFRESH_THRESHOLD) {
      needRefresh = true
      console.log(`⏰ [Auth Service] Token即将过期（剩余${Math.floor(expiresIn / 1000)}秒），需要刷新`)
      
      // 检查是否有OAuth凭证
      if (!account.credentials.refreshToken || !account.credentials.clientId) {
        return res.status(400).json({
          success: false,
          message: '该账号缺少OAuth凭证，无法自动刷新',
          needReimport: true
        })
      }
      
      // 刷新Token
      try {
        const region = account.credentials.region || 'us-east-1'
        const url = `https://oidc.${region}.amazonaws.com/token`
        
        console.log(`🔄 [Auth Service] 正在刷新Token...`)
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            clientId: account.credentials.clientId,
            clientSecret: account.credentials.clientSecret,
            refreshToken: account.credentials.refreshToken,
            grantType: 'refresh_token'
          })
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ [Auth Service] Token刷新失败: ${response.status}`)
          
          return res.status(response.status).json({
            success: false,
            message: `Token刷新失败: HTTP ${response.status}`,
            details: errorText,
            needReimport: response.status === 401
          })
        }
        
        const data = await response.json()
        currentAccessToken = data.accessToken
        
        // 更新Token到数据库
        await MySQLAccountDB.updateAccessToken(accountId, data.accessToken)
        
        // 如果返回了新的refresh_token，也更新它
        if (data.refreshToken && data.refreshToken !== account.credentials.refreshToken) {
          await MySQLAccountDB.updateOAuthCredentials(accountId, {
            refresh_token: data.refreshToken
          })
        }
        
        console.log(`✅ [Auth Service] Token刷新成功`)
        
      } catch (error: any) {
        console.error(`❌ [Auth Service] Token刷新异常:`, error)
        return res.status(500).json({
          success: false,
          message: `Token刷新失败: ${error.message}`
        })
      }
    } else {
      console.log(`✓ [Auth Service] Token有效（剩余${Math.floor(expiresIn / 1000)}秒）`)
    }
    
    // 4. 检查上次同步时间（5分钟内返回缓存）
    const lastSync = account.lastCheckedAt || 0
    const fiveMinutes = 5 * 60 * 1000
    
    if (now - lastSync < fiveMinutes && !needRefresh) {
      console.log(`📦 [Auth Service] 返回缓存数据（${Math.floor((now - lastSync) / 1000)}秒前）`)
      return res.json({
        success: true,
        refreshed: false,
        account: {
          id: account.id,
          usage_percent: account.usage.percentUsed,
          usage_current: account.usage.current,
          usage_limit: account.usage.limit,
          subscription_type: account.subscription.type,
          last_sync_at: account.lastCheckedAt
        },
        is_available: account.usage.percentUsed < 85,
        cached: true
      })
    }
    
    // 5. 调用AWS API同步最新数据
    console.log(`📡 [Auth Service] 正在同步使用量...`)
    const { syncAccountUsage } = await import('../../services/kiro-api.service')
    const syncResult = await syncAccountUsage(
      currentAccessToken,
      account.idp
    )
    
    if (!syncResult.success || !syncResult.data) {
      console.warn(`⚠️ [Auth Service] 使用量同步失败: ${syncResult.error}`)
      
      // 即使同步失败，也返回现有数据
      return res.json({
        success: true,
        refreshed: needRefresh,
        syncFailed: true,
        syncError: syncResult.error,
        account: {
          id: account.id,
          usage_percent: account.usage.percentUsed,
          usage_current: account.usage.current,
          usage_limit: account.usage.limit,
          subscription_type: account.subscription.type,
          last_sync_at: account.lastCheckedAt
        },
        is_available: account.usage.percentUsed < 85,
        cached: false
      })
    }
    
    // 6. 更新账户数据
    const updatedAccount = updateAccountUsage(account, syncResult.data)
    await MySQLAccountDB.update(updatedAccount.id, updatedAccount)
    
    console.log(`✅ [Auth Service] 使用量同步成功`)
    
    // 7. 返回最新数据
    res.json({
      success: true,
      refreshed: needRefresh,
      account: {
        id: updatedAccount.id,
        usage_percent: updatedAccount.usage.percentUsed,
        usage_current: updatedAccount.usage.current,
        usage_limit: updatedAccount.usage.limit,
        subscription_type: updatedAccount.subscription.type,
        last_sync_at: updatedAccount.lastCheckedAt
      },
      is_available: updatedAccount.usage.percentUsed < 85,
      cached: false
    })
  } catch (error: any) {
    console.error('[Refresh Token] Error:', error)
    res.status(500).json({
      success: false,
      message: '刷新失败',
      error: error.message
    })
  }
}
