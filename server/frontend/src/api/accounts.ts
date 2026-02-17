import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export interface Account {
  // 基本信息
  id: string
  email: string
  password: string
  nickname?: string
  idp?: string
  user_id?: string
  visitor_id?: string
  status: string
  
  // 认证凭证
  access_token?: string
  csrf_token?: string
  refresh_token?: string
  sso_token?: string
  client_id?: string
  client_secret?: string
  region?: string
  expires_at?: number
  auth_method?: string
  provider?: string
  
  // 订阅信息
  subscription_type?: string
  subscription_title?: string
  subscription_raw_type?: string
  subscription_expires_at?: number
  subscription_days_remaining?: number
  days_remaining?: number           // 兼容旧字段名
  upgrade_capability?: string
  overage_capability?: string
  management_target?: string
  
  // 使用量信息
  usage_current?: number
  usage_limit?: number
  usage_percent?: number
  usage_last_updated?: number
  base_limit?: number
  base_current?: number
  free_trial_limit?: number
  free_trial_current?: number
  free_trial_expiry?: string
  usage_bonuses?: any[]
  next_reset_date?: string
  
  // 资源详情
  resource_type?: string
  resource_display_name?: string
  resource_display_name_plural?: string
  resource_currency?: string
  resource_unit?: string
  overage_rate?: number
  overage_cap?: number
  overage_enabled?: boolean
  
  // 分组和标签
  group_id?: string
  tags?: string[]
  
  // 状态追踪
  last_error?: string
  consecutive_failures?: number
  is_active?: boolean
  
  // 分配信息
  device_id?: string
  assigned_at?: number
  owner_user_id?: string
  
  // 时间戳
  created_at: number
  createdAt?: number                // 兼容旧字段名
  updatedAt?: number                // 兼容旧字段名
  last_used_at?: number
  last_checked_at?: number
}

export const getAccounts = async () => {
  const { data } = await api.get<{
    success: boolean
    accounts: Account[]
  }>('/accounts')
  return data
}

export const exportAccounts = async (format: 'json' | 'csv') => {
  const { data } = await api.post('/accounts/export', 
    { format },
    { responseType: 'blob' }
  )
  return data
}
