import axios from 'axios'
import type {
  BrowserConfig,
  BrowserDetectResult,
  BrowserConfigResponse,
  BrowserTestResponse,
  BrowserDetectResponse,
  ApiResponse
} from '../types'

// ==================== API Client ====================
const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

// ==================== API Functions ====================
export const getBrowserConfig = async (): Promise<BrowserConfigResponse> => {
  const { data } = await api.get<BrowserConfigResponse>('/config/browser')
  return data
}

export const saveBrowserConfig = async (config: BrowserConfig): Promise<ApiResponse> => {
  const { data } = await api.put<ApiResponse>('/config/browser', config)
  return data
}

export const testBrowserConfig = async (): Promise<BrowserTestResponse> => {
  const { data } = await api.post<BrowserTestResponse>('/config/browser/test')
  return data
}

export const detectBrowsers = async (): Promise<BrowserDetectResponse> => {
  const { data } = await api.get<BrowserDetectResponse>('/config/browser/detect')
  return data
}

// ==================== Type Exports ====================
export type { BrowserConfig, BrowserDetectResult }
