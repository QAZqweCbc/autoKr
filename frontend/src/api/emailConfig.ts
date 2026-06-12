import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export interface EmailConfig {
  qqEmail: string
  authCode: string
  domains: string
  useAlias?: boolean
  aliasType?: 'gmail' | 'qq'
  gmailBase?: string
  gmailAppPassword?: string
  qqAliases?: string
}

export const getEmailConfig = async () => {
  const { data } = await api.get<{
    success: boolean
    config?: EmailConfig
  }>('/config/email')
  return data
}

export const saveEmailConfig = async (config: EmailConfig) => {
  const { data } = await api.put<{
    success: boolean
    error?: string
  }>('/config/email', config)
  return data
}

export const testEmailConnection = async () => {
  const { data } = await api.post<{
    success: boolean
    message?: string
    error?: string
    suggestions?: string[]
    data?: {
      email: string
      unreadCount: number
      recentMessages?: Array<{
        subject: string
        from: string
        date: string
      }>
    }
  }>('/config/email/test')
  return data
}
