/**
 * 配置数据模型
 */

export interface EmailConfig {
  qqEmail?: string
  authCode?: string
  domains?: string
  // 别名功能
  useAlias?: boolean
  aliasType?: 'gmail' | 'qq'
  gmailBase?: string
  gmailAppPassword?: string
  qqAliases?: string
}

export interface ProxyConfig {
  enabled: boolean
  url?: string
}

export interface BrowserConfig {
  type: 'chrome' | 'edge' | 'firefox' | 'brave' | 'opera'
  path?: string
  headless: boolean
  show_window: boolean
}

export interface ServerConfig {
  email?: EmailConfig
  proxy?: ProxyConfig
  browser?: BrowserConfig
  max_concurrent?: number
}
