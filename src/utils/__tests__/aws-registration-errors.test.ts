import { describe, expect, it } from '@jest/globals'
import {
  AWS_TRANSIENT_ERROR_CLOSE_SELECTORS,
  isAwsTransientRequestError,
  summarizeAwsTransientRequestError
} from '../aws-registration-errors'

describe('aws-registration-errors', () => {
  it('识别 AWS ERR-837 临时处理错误', () => {
    const text = 'Error ERR-837 - Sorry, there was an error processing your request. Please try again.'

    expect(isAwsTransientRequestError(text)).toBe(true)
  })

  it('识别中文重试提示', () => {
    expect(isAwsTransientRequestError('抱歉，处理您的请求时出错，请重试')).toBe(true)
  })

  it('忽略普通页面文本', () => {
    expect(isAwsTransientRequestError('Enter your name Continue')).toBe(false)
  })

  it('生成包含错误码的摘要', () => {
    const summary = summarizeAwsTransientRequestError(
      'Error ERR-837 - Sorry, there was an error processing your request. Please try again.'
    )

    expect(summary).toContain('ERR-837')
    expect(summary).toContain('AWS 返回临时请求处理错误')
  })

  it('包含 AWS 错误提示的 Close alert 关闭按钮选择器', () => {
    expect(AWS_TRANSIENT_ERROR_CLOSE_SELECTORS).toContain('button[aria-label="Close alert"]')
    expect(AWS_TRANSIENT_ERROR_CLOSE_SELECTORS).toContain('button[title="Close alert"]')
  })
})
