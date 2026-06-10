/**
 * 普通用户数据模型
 */

export interface ClientUser {
  id: string
  username: string
  email: string
  password_hash: string
  status: 'active' | 'suspended' | 'banned'
  max_tokens: number
  created_at: number
  last_login_at?: number
  registration_status?: 'pending' | 'in_progress' | 'completed'
  pending_delete?: boolean
  registration_started_at?: number
}

export interface ClientUserCreateDTO {
  username: string
  email: string
  password: string
}

export interface ClientUserLoginDTO {
  email: string
  password: string
}

export interface ClientUserResponse {
  id: string
  username: string
  email: string
  status: string
  max_tokens: number
  created_at: number
  last_login_at?: number
}
