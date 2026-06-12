export interface Account {
  id: string
  email: string
  password: string
  region?: string
  created_at: string
}

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

export interface EmailConfig {
  qqEmail: string
  authCode: string
  domains: string
  useAlias?: boolean
  aliasType?: 'gmail' | 'qq'
  gmailBase?: string
  gmailAppPassword?: string
  qqAliases?: string
}

// ==================== Browser Config Types ====================
export type BrowserType = 'chrome' | 'firefox'

export interface BrowserConfig {
  browserType: BrowserType
  browserPath: string  // Empty string for built-in browser
  headless: boolean
  showWindow: boolean
  args: string[]
  delayMin: number
  delayMax: number
}

export interface BrowserDetectResult {
  name: string
  type: BrowserType
  path: string
  version?: string
}

export interface EnvironmentInfo {
  isLinux: boolean
  platform: string
  hasDisplay?: boolean
  isRoot?: boolean
}

// ==================== API Response Types ====================
export interface ApiResponse<T = void> {
  success: boolean
  data?: T
  error?: string
  errors?: string[]
}

export interface BrowserConfigResponse {
  success: boolean
  config?: BrowserConfig
  envInfo?: EnvironmentInfo
}

export interface BrowserTestResult {
  browserVersion?: string
  launchTime?: number
}

export interface BrowserTestResponse {
  success: boolean
  result?: BrowserTestResult
  error?: string
  suggestions?: string[]
}

export interface BrowserDetectResponse {
  success: boolean
  browsers: BrowserDetectResult[]
  count?: number
  error?: string
}
