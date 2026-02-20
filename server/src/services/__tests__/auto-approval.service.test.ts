/**
 * 自动审批服务测试
 */

import { processAutoApproval, processRevokeAutoApproval } from '../auto-approval.service'
import { TokenAllocationService } from '../token-allocation.service'
import { findClientUserById } from '../client-user.service'
import { selectAvailableAccount } from '../token-availability.service'
import { MySQLAccountDB } from '../mysql.service'

// Mock 依赖
jest.mock('../token-allocation.service')
jest.mock('../client-user.service')
jest.mock('../token-availability.service')
jest.mock('../mysql.service')
jest.mock('../../websocket/socket.handler')

describe('AutoApprovalService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('processAutoApproval', () => {
    it('应该在用户已分配账号 ≤ 2 时自动通过', async () => {
      // Arrange
      const mockAllocation = {
        id: 'alloc-1',
        user_id: 'user-1',
        status: 'pending'
      }
      
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        max_tokens: 5
      }
      
      const mockAccount = {
        id: 'account-1',
        email: 'test@example.com'
      }

      ;(TokenAllocationService.getById as jest.Mock).mockResolvedValue(mockAllocation)
      ;(findClientUserById as jest.Mock).mockResolvedValue(mockUser)
      ;(TokenAllocationService.countActiveByUserId as jest.Mock).mockResolvedValue(2)
      ;(selectAvailableAccount as jest.Mock).mockResolvedValue(mockAccount)
      ;(TokenAllocationService.update as jest.Mock).mockResolvedValue(undefined)
      ;(MySQLAccountDB.update as jest.Mock).mockResolvedValue(undefined)

      // Act
      const result = await processAutoApproval('alloc-1')

      // Assert
      expect(result.approved).toBe(true)
      expect(result.accountId).toBe('account-1')
      expect(TokenAllocationService.update).toHaveBeenCalledWith(
        'alloc-1',
        expect.objectContaining({
          account_id: 'account-1',
          status: 'active',
          approved_by: 'system_auto'
        })
      )
    })

    it('应该在用户已分配账号 > 2 时拒绝自动审批', async () => {
      // Arrange
      const mockAllocation = {
        id: 'alloc-1',
        user_id: 'user-1',
        status: 'pending'
      }
      
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        max_tokens: 5
      }

      ;(TokenAllocationService.getById as jest.Mock).mockResolvedValue(mockAllocation)
      ;(findClientUserById as jest.Mock).mockResolvedValue(mockUser)
      ;(TokenAllocationService.countActiveByUserId as jest.Mock).mockResolvedValue(3)

      // Act
      const result = await processAutoApproval('alloc-1')

      // Assert
      expect(result.approved).toBe(false)
      expect(result.reason).toContain('超过限制')
    })

    it('应该在用户达到最大配额时拒绝', async () => {
      // Arrange
      const mockAllocation = {
        id: 'alloc-1',
        user_id: 'user-1',
        status: 'pending'
      }
      
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        max_tokens: 2
      }

      ;(TokenAllocationService.getById as jest.Mock).mockResolvedValue(mockAllocation)
      ;(findClientUserById as jest.Mock).mockResolvedValue(mockUser)
      ;(TokenAllocationService.countActiveByUserId as jest.Mock).mockResolvedValue(2)

      // Act
      const result = await processAutoApproval('alloc-1')

      // Assert
      expect(result.approved).toBe(false)
      expect(result.reason).toContain('最大配额')
    })

    it('应该在申请不存在时返回错误', async () => {
      // Arrange
      ;(TokenAllocationService.getById as jest.Mock).mockResolvedValue(null)

      // Act
      const result = await processAutoApproval('non-existent')

      // Assert
      expect(result.approved).toBe(false)
      expect(result.reason).toBe('申请不存在')
    })
  })

  describe('processRevokeAutoApproval', () => {
    it('应该在理由包含关键词时自动通过释放', async () => {
      // Arrange
      const mockAllocation = {
        id: 'alloc-1',
        account_id: 'account-1',
        status: 'active'
      }

      ;(TokenAllocationService.getById as jest.Mock).mockResolvedValue(mockAllocation)
      ;(TokenAllocationService.update as jest.Mock).mockResolvedValue(undefined)
      ;(MySQLAccountDB.update as jest.Mock).mockResolvedValue(undefined)

      // Act
      const result = await processRevokeAutoApproval('alloc-1', '账号被封禁')

      // Assert
      expect(result.approved).toBe(true)
      expect(TokenAllocationService.update).toHaveBeenCalledWith(
        'alloc-1',
        expect.objectContaining({
          status: 'revoked',
          revoked_by: 'system_auto'
        })
      )
    })

    it('应该在理由不包含关键词时拒绝自动审批', async () => {
      // Act
      const result = await processRevokeAutoApproval('alloc-1', '不想用了')

      // Assert
      expect(result.approved).toBe(false)
      expect(result.reason).toBe('需人工审批')
    })

    it('应该识别英文关键词', async () => {
      // Arrange
      const mockAllocation = {
        id: 'alloc-1',
        account_id: 'account-1',
        status: 'active'
      }

      ;(TokenAllocationService.getById as jest.Mock).mockResolvedValue(mockAllocation)
      ;(TokenAllocationService.update as jest.Mock).mockResolvedValue(undefined)
      ;(MySQLAccountDB.update as jest.Mock).mockResolvedValue(undefined)

      // Act
      const result = await processRevokeAutoApproval('alloc-1', 'Account is banned')

      // Assert
      expect(result.approved).toBe(true)
    })
  })
})
