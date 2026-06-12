/**
 * 检测记录模型
 */

export interface CheckRecord {
  id: string
  timestamp: number
  proxyUrl?: string
  result: {
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
      level: string
      details?: string
    }
    qqEmail: {
      accessible: boolean
      latency: number
      error?: string
    }
    reputation: {
      score: number
      blacklist: string[]
      factors: {
        datacenter: boolean
        vpn: boolean
        residential: boolean
      }
    }
    verdict: 'safe' | 'warning' | 'risky' | 'blocked'
    suggestion: string
  }
}

export interface CheckRecordCreateDTO {
  proxyUrl?: string
  result: CheckRecord['result']
}

export interface CheckStats {
  total: number
  safe: number
  warning: number
  risky: number
  blocked: number
}
