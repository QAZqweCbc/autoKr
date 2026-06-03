/**
 * 客户端使用量查询控制器
 * 客户端请求账号额度，Server负责检查并刷新Token（如需要）
 */

import { Request, Response } from 'express'
import { AccountDB } from '../services/database.adapter'
import { OidcTokenResponse } from '../models/token.model'
import { syncAccountUsage } from '../services/kiro-api.service'
import { emitAccountUpdate } from '../websocket/socket.handler'

/**
 * 客户端请求账号使用量
 * 流程：
 * 1. 检查Token是否过期（提前5分钟判断）
 * 2. 如果过期，先刷新Token
 * 3. 同步最新使用量
 * 4. 返回完整的账号信息给客户端
 */
export async function getAccountUsage(req: Request, res: Response) {
  try {
    // 禁用缓存，确保每次都返回最新数据
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    
    const { id } = req.params
    
    // 1. 查找账号
    const account = await AccountDB.getById(id as string)
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: '账号不存在'
      })
    }
    
    console.log(`\n📊 [Client Usage] 客户端请求账号额度: ${account.email}`)
    
    let currentAccessToken = account.credentials.accessToken
    let needRefresh = false
    
    // 2. 检查Token是否即将过期（提前5分钟）
    const now = Date.now()
    const expiresAt = account.credentials.expiresAt || 0
    const expiresIn = expiresAt - now
    const REFRESH_THRESHOLD = 5 * 60 * 1000 // 5分钟
    
    if (expiresIn < REFRESH_THRESHOLD) {
      needRefresh = true
      console.log(`⏰ [Client Usage] Token即将过期（剩余${Math.floor(expiresIn / 1000)}秒），需要刷新`)
      
      // 检查是否有OAuth凭证
      if (!account.credentials.refreshToken || !account.credentials.clientId) {
        return res.status(400).json({
          success: false,
          error: '该账号缺少OAuth凭证，无法自动刷新',
          needReimport: true
        })
      }
      
      // 3. 刷新Token（复用现有逻辑）
      try {
        const region = account.credentials.region || 'us-east-1'
        const url = `https://oidc.${region}.amazonaws.com/token`
        
        console.log(`🔄 [Client Usage] 正在刷新Token...`)
        
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
          console.error(`❌ [Client Usage] Token刷新失败: ${response.status}`)
          
          return res.status(response.status).json({
            success: false,
            error: `Token刷新失败: HTTP ${response.status}`,
            details: errorText,
            needReimport: response.status === 401
          })
        }
        
        const data = await response.json() as OidcTokenResponse
        currentAccessToken = data.accessToken
        
        // 更新Token到数据库
        await AccountDB.updateAccessToken(id as string, data.accessToken)
        
        // 如果返回了新的refresh_token，也更新它和 access_token
        if (data.refreshToken && data.refreshToken !== account.credentials.refreshToken) {
          await AccountDB.updateOAuthCredentials(id as string, {
            access_token: data.accessToken,
            refresh_token: data.refreshToken
          })
        }
        
        console.log(`✅ [Client Usage] Token刷新成功`)
        
      } catch (error: any) {
        console.error(`❌ [Client Usage] Token刷新异常:`, error)
        return res.status(500).json({
          success: false,
          error: `Token刷新失败: ${error.message}`
        })
      }
    } else {
      console.log(`✓ [Client Usage] Token有效（剩余${Math.floor(expiresIn / 1000)}秒）`)
    }
    
    // 4. 同步使用量信息
    console.log(`📡 [Client Usage] 正在同步使用量...`)
    const syncResult = await syncAccountUsage(currentAccessToken, account.idp || 'BuilderId')
    
    if (syncResult.success && syncResult.data) {
      // 更新数据库
      await AccountDB.updateExtendedInfo(id as string, syncResult.data)
      
      // 重置错误计数器
      await AccountDB.update(id as string, {
        ...account,
        consecutiveFailures: 0,
        lastError: undefined,
        lastCheckedAt: Date.now()
      })
      
      console.log(`✅ [Client Usage] 使用量同步成功`)
      
      // 发送WebSocket通知，通知所有客户端账户数据已更新
      emitAccountUpdate()
      
      // 5. 返回完整的账号信息给客户端
      const updatedAccount = await AccountDB.getById(id as string)
      
      res.json({
        success: true,
        refreshed: needRefresh,
        account: {
          id: updatedAccount!.id,
          email: updatedAccount!.email,
          
          // 认证信息
          access_token: currentAccessToken,
          expires_at: updatedAccount!.credentials.expiresAt,
          
          // 使用量信息（总计）
          usage_current: updatedAccount!.usage.current,
          usage_limit: updatedAccount!.usage.limit,
          usage_percent: updatedAccount!.usage.percentUsed,
          
          // 基础额度
          base_limit: updatedAccount!.usage.baseLimit,
          base_current: updatedAccount!.usage.baseCurrent,
          
          // 免费试用额度
          free_trial_limit: updatedAccount!.usage.freeTrialLimit,
          free_trial_current: updatedAccount!.usage.freeTrialCurrent,
          free_trial_expiry: updatedAccount!.usage.freeTrialExpiry,
          
          // 下次重置日期
          next_reset_date: updatedAccount!.usage.nextResetDate,
          
          // 订阅信息
          subscription_type: updatedAccount!.subscription.type,
          subscription_title: updatedAccount!.subscription.title,
          subscription_status: updatedAccount!.subscription.rawType,
          days_remaining: updatedAccount!.subscription.daysRemaining,
          
          // 资源详情
          resource_display_name: updatedAccount!.usage.resourceDetail?.displayName,
          resource_unit: updatedAccount!.usage.resourceDetail?.unit,
          
          // 时间戳
          last_checked_at: Date.now(),
          last_sync_at: updatedAccount!.usage.lastUpdated
        }
      })
      
    } else {
      console.warn(`⚠️ [Client Usage] 使用量同步失败: ${syncResult.error}`)
      
      // 即使同步失败，也返回现有数据
      res.json({
        success: true,
        refreshed: needRefresh,
        syncFailed: true,
        syncError: syncResult.error,
        account: {
          id: account.id,
          email: account.email,
          access_token: currentAccessToken,
          expires_at: account.credentials.expiresAt,
          usage_current: account.usage.current,
          usage_limit: account.usage.limit,
          usage_percent: account.usage.percentUsed,
          subscription_type: account.subscription.type,
          subscription_title: account.subscription.title,
          last_checked_at: Date.now()
        }
      })
    }
    
  } catch (error: any) {
    console.error('❌ [Client Usage] 获取账号使用量失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
