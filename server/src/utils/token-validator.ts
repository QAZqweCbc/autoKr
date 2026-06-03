/**
 * Token 验证工具
 * 确保存储的是正确格式的 AWS SSO Access Token
 */

export interface TokenValidationResult {
  valid: boolean
  type: 'aws-sso' | 'jwt' | 'unknown' | 'invalid'
  length: number
  issue?: string
  suggestion?: string
}

/**
 * 验证 Access Token 格式
 */
export function validateAccessToken(token: string | undefined): TokenValidationResult {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      type: 'invalid',
      length: 0,
      issue: 'Token 为空或类型错误',
      suggestion: '请提供有效的 Access Token'
    }
  }

  const length = token.length

  // AWS SSO Access Token 格式检查
  if (token.startsWith('aoa')) {
    if (length >= 200 && length <= 350) {
      return {
        valid: true,
        type: 'aws-sso',
        length
      }
    } else {
      return {
        valid: false,
        type: 'aws-sso',
        length,
        issue: `AWS SSO Token 长度异常 (${length} 字符)`,
        suggestion: '正常长度应在 200-350 之间'
      }
    }
  }

  // JWT Token 检查
  if (token.startsWith('eyJ') || token.includes('.')) {
    return {
      valid: false,
      type: 'jwt',
      length,
      issue: '这是 JWT Token，不是 AWS SSO Access Token',
      suggestion: '请使用 SSO 设备授权获取的 accessToken（以 aoa 开头）'
    }
  }

  // 占位符或测试数据
  if (token === 'complete_token' || token.length < 50) {
    return {
      valid: false,
      type: 'invalid',
      length,
      issue: '这是占位符或无效的 Token',
      suggestion: '请重新提交或刷新 Token'
    }
  }

  // 未知格式
  return {
    valid: false,
    type: 'unknown',
    length,
    issue: `无法识别的 Token 格式 (长度: ${length})`,
    suggestion: '请确认 Token 来源和格式'
  }
}

/**
 * 记录 Token 验证详情（用于调试）
 */
export function logTokenValidation(
  context: string,
  token: string | undefined,
  validation: TokenValidationResult
): void {
  const prefix = validation.valid ? '✅' : '❌'

  console.log(`\n${prefix} [Token Validation] ${context}`)
  console.log(`   类型: ${validation.type}`)
  console.log(`   长度: ${validation.length} 字符`)

  if (token && token.length > 0) {
    const start = token.substring(0, Math.min(50, token.length))
    const end = token.length > 50 ? token.substring(token.length - 30) : ''
    console.log(`   开头: ${start}${token.length > 50 ? '...' : ''}`)
    if (end) {
      console.log(`   结尾: ...${end}`)
    }
  }

  if (validation.issue) {
    console.log(`   ⚠️  问题: ${validation.issue}`)
  }
  if (validation.suggestion) {
    console.log(`   💡 建议: ${validation.suggestion}`)
  }
  console.log('')
}

/**
 * 断言 Token 有效性，无效时抛出错误
 */
export function assertValidToken(token: string | undefined, context: string): void {
  const validation = validateAccessToken(token)

  if (!validation.valid) {
    logTokenValidation(context, token, validation)
    throw new Error(
      `Invalid Access Token in ${context}: ${validation.issue || 'Unknown error'}`
    )
  }
}
