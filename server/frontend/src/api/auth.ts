/**
 * 认证相关 API
 */
import api from './axios'

export interface SendCodeRequest {
  email: string
  type: 'register' | 'login'
}

export interface RegisterRequest {
  email: string
  password: string
  code: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  success: boolean
  message?: string
  token?: string
  user?: {
    id: string
    email: string
    username: string
    status: string
    max_tokens: number
    created_at: number
  }
}

/**
 * 发送验证码
 */
export const sendCode = async (request: SendCodeRequest): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>('/auth/send-code', request)
  return data
}

/**
 * 用户注册
 */
export const register = async (request: RegisterRequest): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>('/auth/register', request)
  return data
}

/**
 * 用户登录
 */
export const login = async (request: LoginRequest): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>('/auth/login', request)
  return data
}

/**
 * Token 申请相关 API
 */
export interface TokenRequestDTO {
  reason?: string
}

export interface TokenResponse {
  success: boolean
  message?: string
  data?: {
    id: string
    user_id: string
    account_id?: string
    status: string
    requested_at: number
  }
}

/**
 * 申请 Token
 */
export const requestToken = async (request: TokenRequestDTO): Promise<TokenResponse> => {
  const { data } = await api.post<TokenResponse>('/tokens/request', request)
  return data
}

/**
 * 查看我的申请
 */
export const getMyRequests = async (): Promise<any> => {
  const { data } = await api.get('/tokens/my-requests')
  return data
}

/**
 * 查看我的 Token
 */
export const getMyTokens = async (): Promise<any> => {
  const { data } = await api.get('/tokens/my-tokens')
  return data
}

/**
 * 刷新 Token 额度
 */
export const refreshTokenQuota = async (accountId: string): Promise<any> => {
  const { data } = await api.post(`/tokens/refresh/${accountId}`)
  return data
}

/**
 * 请求释放 Token
 */
export const requestRevoke = async (allocationId: string): Promise<any> => {
  const { data } = await api.post(`/tokens/${allocationId}/request-revoke`)
  return data
}
