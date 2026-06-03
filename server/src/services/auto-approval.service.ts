/**
 * 自动审批服务
 * 处理申请和释放的自动审批逻辑
 */

import { TokenAllocationService } from './token-allocation.service'
import { findClientUserById } from './client-user.service'
import { selectAvailableAccount } from './token-availability.service'
import { MySQLAccountDBNew as MySQLAccountDB } from './mysql-account.service'
import { triggerAccountGeneration, getAccountPoolStatus } from './account-pool.service'
import { emitSystemMessage, emitAdminRefreshRequests, emitAdminRefreshRevokeRequests, emitAdminRefreshAllocations } from '../websocket/socket.handler'

/**
 * 自动审批结果
 */
export interface AutoApprovalResult {
  approved: boolean
  reason: string
  accountId?: string
  needsGeneration?: boolean
  generationTaskIds?: string[]
}

/**
 * 处理申请的自动审批
 * 规则：用户已分配账号 ≤ 2 时自动通过
 */
export async function processAutoApproval(allocationId: string): Promise<AutoApprovalResult> {
  console.log(`🤖 开始自动审批流程: ${allocationId}`)
  
  try {
    // 1. 查询申请记录
    const allocation = await TokenAllocationService.getById(allocationId)
    if (!allocation) {
      return {
        approved: false,
        reason: '申请不存在'
      }
    }
    
    if (allocation.status !== 'pending') {
      return {
        approved: false,
        reason: '申请已处理'
      }
    }
    
    // 2. 查询用户信息
    const user = await findClientUserById(allocation.user_id)
    if (!user) {
      return {
        approved: false,
        reason: '用户不存在'
      }
    }
    
    // 3. 检查用户当前已分配账号数量
    const activeCount = await TokenAllocationService.countActiveByUserId(allocation.user_id)
    console.log(`📊 用户 ${user.username} 当前已分配账号数: ${activeCount}`)
    
    // 规则：已分配账号 > 2，不自动审批
    if (activeCount > 2) {
      console.log(`❌ 用户已分配账号数 (${activeCount}) > 2，不符合自动审批条件`)
      return {
        approved: false,
        reason: `用户已分配账号数 (${activeCount}) 超过限制 (2)，需人工审批`
      }
    }
    
    // 4. 检查用户配额
    if (activeCount >= user.max_tokens) {
      return {
        approved: false,
        reason: `用户已达最大配额 (${user.max_tokens})`
      }
    }
    
    // 5. 选择可用账号
    const account = await selectAvailableAccount()
    
    if (account) {
      // 有可用账号，立即分配
      console.log(`✅ 找到可用账号: ${account.email}`)
      
      await TokenAllocationService.update(allocationId, {
        account_id: account.id,
        status: 'active',
        approved_at: Date.now(),
        approved_by: 'system_auto'
      })
      
      await MySQLAccountDB.update(account.id, {
        status: 'assigned'
      })
      
      console.log(`✅ 自动审批通过，账号已分配: ${account.email}`)
      emitSystemMessage(`用户 ${user.username} 的申请已自动审批通过`, 'info')
      emitAdminRefreshRequests()
      emitAdminRefreshAllocations()
      
      return {
        approved: true,
        reason: '自动审批通过',
        accountId: account.id
      }
    } else {
      // 无可用账号，触发生成
      console.log(`⚠️ 暂无可用账号，触发账号生成流程`)
      
      // 检查账号池状态
      const poolStatus = await getAccountPoolStatus()
      const needCount = Math.max(1, poolStatus.deficit)
      
      // 触发生成任务
      const taskIds = await triggerAccountGeneration(needCount)
      
      // 通知用户
      emitSystemMessage(
        `用户 ${user.username} 的申请正在处理中，账号构建中，请稍候...`,
        'info'
      )
      emitAdminRefreshRequests()
      
      console.log(`🔄 已触发 ${needCount} 个账号生成任务，申请保持pending状态`)
      
      return {
        approved: false,
        reason: '账号构建中，请稍候',
        needsGeneration: true,
        generationTaskIds: taskIds
      }
    }
  } catch (error: any) {
    console.error(`❌ 自动审批失败:`, error)
    return {
      approved: false,
      reason: `自动审批异常: ${error.message}`
    }
  }
}

/**
 * 处理释放申请的自动审批
 * 规则：理由包含关键词（封禁、不可用、额度已满等）时自动通过
 */
export async function processRevokeAutoApproval(
  allocationId: string,
  reason: string
): Promise<AutoApprovalResult> {
  console.log(`🤖 开始释放自动审批流程: ${allocationId}`)
  console.log(`📝 释放理由: ${reason}`)
  
  // 关键词列表（中英文）
  const autoApproveKeywords = [
    '封禁', 'banned', 'ban',
    '不可用', 'unavailable', 'not available',
    '额度已满', 'quota', 'full', 'limit',
    '过期', 'expired', 'expire'
  ]
  
  // 检查是否包含关键词
  const reasonLower = reason.toLowerCase()
  const matched = autoApproveKeywords.some(keyword => 
    reasonLower.includes(keyword.toLowerCase())
  )
  
  if (matched) {
    console.log(`✅ 释放理由包含自动审批关键词，自动通过`)
    
    try {
      // 查询分配记录
      const allocation = await TokenAllocationService.getById(allocationId)
      if (!allocation) {
        return {
          approved: false,
          reason: '分配记录不存在'
        }
      }
      
      if (allocation.status !== 'active') {
        return {
          approved: false,
          reason: '只能释放活跃的Token'
        }
      }
      
      // 更新分配记录
      await TokenAllocationService.update(allocationId, {
        status: 'revoked',
        revoked_at: Date.now(),
        revoked_by: 'system_auto'
      })
      
      // 释放账号
      if (allocation.account_id) {
        await MySQLAccountDB.update(allocation.account_id, {
          status: 'active'
        })
      }
      
      console.log(`✅ 释放自动审批通过`)
      emitSystemMessage(`Token释放申请已自动审批通过 (理由: ${reason})`, 'info')
      emitAdminRefreshRevokeRequests()
      emitAdminRefreshAllocations()
      
      return {
        approved: true,
        reason: '自动审批通过',
        accountId: allocation.account_id
      }
    } catch (error: any) {
      console.error(`❌ 释放自动审批失败:`, error)
      return {
        approved: false,
        reason: `自动审批异常: ${error.message}`
      }
    }
  } else {
    console.log(`❌ 释放理由不包含自动审批关键词，需人工审批`)
    return {
      approved: false,
      reason: '需人工审批'
    }
  }
}

/**
 * 监听账号生成完成事件，自动分配给等待的用户
 */
export async function handleAccountGenerationComplete(accountId: string): Promise<void> {
  console.log(`🎉 账号生成完成: ${accountId}，检查待处理申请`)
  
  try {
    // 查询所有pending状态的申请（按时间排序）
    const pendingRequests = await TokenAllocationService.getPendingRequests()
    
    if (pendingRequests.length === 0) {
      console.log(`✅ 无待处理申请`)
      return
    }
    
    // 为第一个pending申请分配账号
    const firstRequest = pendingRequests[0]
    console.log(`📤 为用户 ${firstRequest.username} 分配新生成的账号`)
    
    // 触发自动审批（此时应该有可用账号了）
    const result = await processAutoApproval(firstRequest.id)
    
    if (result.approved) {
      console.log(`✅ 账号已自动分配给用户 ${firstRequest.username}`)
    } else {
      console.log(`⚠️ 自动分配失败: ${result.reason}`)
    }
  } catch (error: any) {
    console.error(`❌ 处理账号生成完成事件失败:`, error)
  }
}
