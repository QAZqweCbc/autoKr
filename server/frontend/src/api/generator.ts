import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export interface GeneratedAccount {
  email: string
  password: string
  name?: string
}

export interface GenerateRequest {
  count: number
  email_length?: number
  password_length: number
  use_random_name: boolean
}

export const generateAccounts = async (data: GenerateRequest) => {
  const { data: response } = await api.post<{
    success: boolean
    accounts: GeneratedAccount[]
    count: number
    error?: string
  }>('/generator', data)
  return response
}

export const getEmailConfig = async () => {
  const { data } = await api.get<{
    success: boolean
    config?: {
      domains: string
      qqEmail?: string
      authCode?: string
      useAlias?: boolean
      aliasType?: 'gmail' | 'qq'
      gmailBase?: string
      gmailAppPassword?: string
    }
  }>('/config/email')
  return data
}
