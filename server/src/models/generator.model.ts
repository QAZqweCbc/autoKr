/**
 * 账号生成器数据模型
 */

export interface GenerateAccountDTO {
  count: number
  email_domain?: string  // 已废弃，保留向后兼容
  email_domains?: string[]  // 新增：支持多个域名
  email_length?: number  // 新增：邮箱前缀长度
  password_length?: number
  use_random_name?: boolean
}

export interface GeneratedAccount {
  email: string
  password: string
  name?: string
}

export interface GenerateResult {
  success: boolean
  accounts: GeneratedAccount[]
  count: number
}
