/**
 * 日志去重聚合工具
 * 自动合并相同的重复日志
 */

interface LogEntry {
  message: string
  count: number
  firstTime: Date
  lastTime: Date
}

class DedupLogger {
  private logs: Map<string, LogEntry> = new Map()
  private flushInterval: NodeJS.Timeout | null = null
  private flushDelayMs = 2000 // 2秒后输出聚合日志

  constructor() {
    this.startFlusher()
  }

  /**
   * 记录日志
   */
  log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const key = `${level}:${message}`

    if (this.logs.has(key)) {
      const entry = this.logs.get(key)!
      entry.count++
      entry.lastTime = new Date()
    } else {
      this.logs.set(key, {
        message,
        count: 1,
        firstTime: new Date(),
        lastTime: new Date()
      })
    }
  }

  /**
   * 启动定时刷新器
   */
  private startFlusher() {
    this.flushInterval = setInterval(() => {
      this.flush()
    }, this.flushDelayMs)
  }

  /**
   * 输出聚合的日志
   */
  private flush() {
    if (this.logs.size === 0) return

    const output: string[] = []

    for (const [key, entry] of this.logs) {
      const [level] = key.split(':') as ['info' | 'warn' | 'error']
      const prefix = this.getPrefix(level)

      if (entry.count === 1) {
        output.push(`${prefix} ${entry.message}`)
      } else {
        // 显示重复次数
        output.push(
          `${prefix} [×${entry.count}] ${entry.message} (最后时间: ${entry.lastTime.toLocaleTimeString()})`
        )
      }
    }

    // 输出所有日志
    if (output.length > 0) {
      console.log(output.join('\n'))
    }

    // 清空缓冲区
    this.logs.clear()
  }

  /**
   * 获取日志前缀
   */
  private getPrefix(level: 'info' | 'warn' | 'error'): string {
    const timestamp = new Date().toLocaleTimeString()
    switch (level) {
      case 'warn':
        return `[${timestamp}] ⚠️`
      case 'error':
        return `[${timestamp}] ❌`
      default:
        return `[${timestamp}] ℹ️`
    }
  }

  /**
   * 立即刷新
   */
  flushNow() {
    this.flush()
  }

  /**
   * 销毁
   */
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush()
  }
}

export const dedupLogger = new DedupLogger()
