import axios from './axios'

// 类型定义
export interface PendingRequest {
  id: string
  username: string
  email: string
  requested_at: number
}

export interface User {
  id: string
  username: string
  email: string
  status: 'active' | 'suspended' | 'banned'
  max_tokens: number
  created_at: number
  last_login_at?: number
}

export interface TokenAllocation {
  id: string
  username: string
  email: string
  account_email: string
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'revoked'
  requested_at: number
  usage_current?: number
  usage_limit?: number
  usage_percent?: number
}

export interface AccountStats {
  total: number
  available: number
  assigned: number
  unavailable: number
  tokens: {
    total: number
    used: number
    available: number
    usagePercent: number
  }
}

export interface AccountDetail {
  id: string
  email: string
  usage_current: number
  usage_limit: number
  usage_percent: number
  subscription_type: string
  subscription_status: string
  is_available: boolean
  allocation_status: 'available' | 'assigned' | 'unavailable'
  assigned_to?: string
  assigned_username?: string
  created_at: number
}

// API函数
export const adminApi = {
  // 管理员登录
  login(email: string, password: string) {
    return axios.post('/admin/login', { email, password })
  },

  // 获取待审批申请
  getPendingRequests() {
    return axios.get<{ success: boolean; requests: PendingRequest[] }>('/admin/requests/pending')
  },

  // 批准申请
  approveRequest(id: string) {
    return axios.post(`/admin/requests/${id}/approve`)
  },

  // 拒绝申请
  rejectRequest(id: string, reason: string) {
    return axios.post(`/admin/requests/${id}/reject`, { reason })
  },

  // 获取用户列表
  getUsers() {
    return axios.get<{ success: boolean; users: User[] }>('/admin/users')
  },

  // 更新用户配额
  updateUserQuota(userId: string, maxTokens: number) {
    return axios.put(`/admin/users/${userId}/quota`, { max_tokens: maxTokens })
  },

  // 更新用户状态
  updateUserStatus(userId: string, status: string) {
    return axios.put(`/admin/users/${userId}/status`, { status })
  },

  // 获取Token分配记录
  getAllocations() {
    return axios.get<{ success: boolean; allocations: TokenAllocation[] }>('/admin/allocations')
  },

  // 释放Token
  revokeAllocation(id: string) {
    return axios.post(`/admin/allocations/${id}/revoke`)
  },

  // 获取账户统计
  getAccountStats() {
    return axios.get<{ success: boolean; stats: AccountStats }>('/admin/accounts/stats')
  },

  // 获取账户详细列表
  getAccountDetails() {
    return axios.get<{ success: boolean; accounts: AccountDetail[] }>('/admin/accounts/details')
  },

  // 分配账号给用户
  assignAccount(userId: string, accountEmail: string) {
    return axios.post<{ success: boolean; message: string }>('/admin/accounts/assign', {
      user_id: userId,
      account_email: accountEmail
    })
  }
}
