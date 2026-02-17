import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000 // 检测可能需要更长时间
})

export interface CheckResult {
  ip: string
  location: {
    country: string
    region: string
    city: string
    isp: string
  }
  aws: {
    accessible: boolean
    latency: number
    level: 'normal' | 'captcha' | 'rate_limit' | 'blocked'
  }
  qqEmail: {
    accessible: boolean
    latency: number
  }
  reputation: {
    score: number
    blacklist: string[]
  }
  verdict: 'safe' | 'warning' | 'risky' | 'blocked'
  suggestion: string
}

export interface CheckRecord {
  timestamp: string
  proxyUrl?: string
  result: CheckResult
}

export const startCheck = async (proxyUrl?: string) => {
  const { data } = await api.post<{
    success: boolean
    result?: CheckResult
    logs?: string[]
    error?: string
  }>('/check/ip', { proxyUrl })
  return data
}

export const getCheckRecords = async (limit = 20) => {
  const { data } = await api.get<{
    success: boolean
    records: CheckRecord[]
  }>(`/check/records?limit=${limit}`)
  return data
}

export const getCheckStats = async () => {
  const { data } = await api.get<{
    success: boolean
    stats: {
      total: number
      safe: number
      warning: number
      risky: number
      blocked: number
    }
  }>('/check/stats')
  return data
}

export const clearCheckHistory = async () => {
  const { data } = await api.delete<{
    success: boolean
    error?: string
  }>('/check/records')
  return data
}
