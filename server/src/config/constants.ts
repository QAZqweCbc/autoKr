/**
 * 全局常量配置
 */

// Kiro API 端点
export const KIRO_API_BASE = 'https://app.kiro.dev/service/KiroWebPortalService/operation'
export const KIRO_AUTH_ENDPOINT = 'https://prod.us-east-1.auth.desktop.kiro.dev'

// AWS 端点
export const AWS_OIDC_BASE = (region: string = 'us-east-1') => `https://oidc.${region}.amazonaws.com`
export const AWS_PORTAL_BASE = 'https://portal.sso.us-east-1.amazonaws.com'
export const AWS_START_URL = 'https://view.awsapps.com/start'

// 默认配置
export const DEFAULT_REGION = 'us-east-1'
export const DEFAULT_IDP = 'BuilderId'

// CodeWhisperer 权限范围
export const CODEWHISPERER_SCOPES = [
  'codewhisperer:analysis',
  'codewhisperer:completions',
  'codewhisperer:conversations',
  'codewhisperer:taskassist',
  'codewhisperer:transformations'
]

// 刷新配置
export const REFRESH_CONFIG = {
  BATCH_DELAY: 2000,           // 批次间延迟（毫秒）
  CONCURRENT_LIMIT: 5,         // 并发限制
  RETRY_DELAY: 3000,           // 重试延迟（毫秒）
  MAX_RETRIES: 3,              // 最大重试次数
  TOKEN_EXPIRY_BUFFER: 300000  // Token 过期缓冲时间（5分钟）
}

// 超时配置
export const TIMEOUT_CONFIG = {
  API_REQUEST: 30000,          // API 请求超时（30秒）
  DEVICE_AUTH: 120000,         // 设备授权超时（2分钟）
  TOKEN_REFRESH: 30000         // Token 刷新超时（30秒）
}
