import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export const submitToken = async (email: string, ssoToken: string) => {
  const { data } = await api.post<{
    success: boolean
    message?: string
    error?: string
  }>('/token/submit', {
    email,
    x_amz_sso_authn: ssoToken
  })
  return data
}

export const refreshToken = async (accountId: string) => {
  const { data } = await api.post<{
    success: boolean
    message?: string
    error?: string
    account?: {
      email: string
      login_url: string
    }
  }>(`/token/${accountId}/refresh`)
  return data
}
