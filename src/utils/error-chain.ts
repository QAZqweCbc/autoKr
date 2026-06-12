/**
 * 错误链聚合工具
 * 用于保留完整的错误历史，避免嵌套异常导致错误信息丢失
 */

export interface RefreshAttempt {
  strategy: string
  error: Error
  timestamp: number
  statusCode?: number
}

/**
 * Token 刷新错误链
 * 记录所有刷新策略的尝试和失败原因
 */
export class RefreshErrorChain extends Error {
  public readonly attempts: RefreshAttempt[] = []

  constructor(message: string = 'All refresh strategies failed') {
    super(message)
    this.name = 'RefreshErrorChain'
    Object.setPrototypeOf(this, RefreshErrorChain.prototype)
  }

  addAttempt(strategy: string, error: Error, statusCode?: number): void {
    this.attempts.push({
      strategy,
      error,
      timestamp: Date.now(),
      statusCode
    })
    this.message = `All ${this.attempts.length} refresh strategies failed`
  }

  getFullTrace(): string {
    if (this.attempts.length === 0) {
      return 'No refresh attempts recorded'
    }

    return this.attempts
      .map((attempt, index) => {
        const statusInfo = attempt.statusCode ? ` (HTTP ${attempt.statusCode})` : ''
        return `  ${index + 1}. [${attempt.strategy}]${statusInfo}: ${attempt.error.message}`
      })
      .join('\n')
  }

  getSummary(): string {
    if (this.attempts.length === 0) {
      return 'No refresh attempts'
    }
    const lastAttempt = this.attempts[this.attempts.length - 1]
    return `Failed after ${this.attempts.length} attempts. Last: [${lastAttempt.strategy}] ${lastAttempt.error.message}`
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      attempts: this.attempts.map(a => ({
        strategy: a.strategy,
        error: a.error.message,
        statusCode: a.statusCode,
        timestamp: a.timestamp
      })),
      summary: this.getSummary()
    }
  }

  hasAttempts(): boolean {
    return this.attempts.length > 0
  }

  getAttemptCount(): number {
    return this.attempts.length
  }

  getLastError(): Error | null {
    if (this.attempts.length === 0) {
      return null
    }
    return this.attempts[this.attempts.length - 1].error
  }
}
