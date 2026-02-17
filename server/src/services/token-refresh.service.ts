/**
 * Token 刷新服务 - 支持 IdC 和社交登录
 */

import axios from 'axios'

export interface TokenRefreshResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  error?: string
}

const KIRO_AUTH_ENDPOINT = 'https://prod.us-east-1.auth.desktop.kiro.dev'

/**
 * 刷新 Token（根据 authMethod 自动选择刷新方式）
 */
export async function refreshToken(
  refreshToken: string,
  authMethod: 'IdC' | 'social' = 'IdC',
  clientId?: string,
  clientSecret?: string,
  region?: string
): Promise<TokenRefreshResult> {
  try {
    if (authMethod === 'social') {
      // 社交登录：使用 Kiro API 刷新
      return await refreshSocialToken(refreshToken)
    } else {
      // IdC 登录：使用 AWS OIDC 刷新
      if (!clientId || !clientSecret) {
        return {
          success: false,
          error: 'IdC 刷新需要 clientId 和 clientSecret'
        }
      }
      return await refreshIdCToken(refreshToken, clientId, clientSecret, region || 'us-east-1')
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    }
  }
}

/**
 * 社交登录 Token 刷新
 */
async function refreshSocialToken(refreshToken: string): Promise<TokenRefreshResult> {
  const response = await axios.post(
    `${KIRO_AUTH_ENDPOINT}/refreshToken`,
    { refreshToken },
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'kiro-account-manager/1.0.0'
      },
      timeout: 30000
    }
  )
  
  if (!response.data.accessToken) {
    return {
      success: false,
      error: '刷新响应中缺少 accessToken'
    }
  }
  
  return {
    success: true,
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
    expiresIn: response.data.expiresIn || 3600
  }
}

/**
 * IdC (AWS OIDC) Token 刷新
 */
async function refreshIdCToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  region: string
): Promise<TokenRefreshResult> {
  const url = `https://oidc.${region}.amazonaws.com/token`
  
  const response = await axios.post(
    url,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    }
  )
  
  if (!response.data.access_token) {
    return {
      success: false,
      error: '刷新响应中缺少 access_token'
    }
  }
  
  return {
    success: true,
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in || 3600
  }
}
