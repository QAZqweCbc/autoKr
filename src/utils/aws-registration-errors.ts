const AWS_TRANSIENT_REQUEST_ERROR_PATTERNS = [
  'ERR-837',
  'Sorry, there was an error processing your request',
  'error processing your request',
  'Please try again',
  '抱歉，处理您的请求时出错',
  '处理您的请求时出错',
  '请重试'
]

export const AWS_TRANSIENT_ERROR_CLOSE_SELECTORS = [
  'button[aria-label="Close alert"]',
  'button[title="Close alert"]',
  'button[aria-label="Close"]',
  'button[aria-label="Dismiss"]',
  'button[aria-label="关闭"]',
  '.awsui_dismiss button',
  'button[class*="dismiss"]'
]

export function isAwsTransientRequestError(text?: string | null): boolean {
  if (!text) return false

  const normalizedText = text.replace(/\s+/g, ' ').trim().toLowerCase()

  return AWS_TRANSIENT_REQUEST_ERROR_PATTERNS.some(pattern =>
    normalizedText.includes(pattern.toLowerCase())
  )
}

export function summarizeAwsTransientRequestError(text?: string | null): string {
  if (!text) return 'AWS 返回临时请求处理错误'

  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const errorCode = normalizedText.match(/ERR-\d+/i)?.[0]

  if (errorCode) {
    return `AWS 返回临时请求处理错误 (${errorCode})`
  }

  return 'AWS 返回临时请求处理错误'
}
