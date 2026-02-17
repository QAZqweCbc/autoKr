/**
 * Token分配数据模型
 */

export interface TokenAllocation {
  id: string
  user_id: string
  account_id?: string
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'revoked'
  requested_at: number
  approved_at?: number
  approved_by?: string
  reject_reason?: string
  revoked_at?: number
  revoked_by?: string
}

export interface TokenAllocationCreateDTO {
  user_id: string
}

export interface TokenAllocationApproveDTO {
  approved_by: string
}

export interface TokenAllocationRejectDTO {
  reject_reason: string
  rejected_by: string
}

export interface TokenAllocationWithAccount extends TokenAllocation {
  account?: {
    id: string
    email: string
    access_token: string
    refresh_token?: string
    client_id?: string
    region?: string
    usage_percent?: number
    usage_current?: number
    usage_limit?: number
    subscription_type?: string
    subscription_title?: string
  }
}
