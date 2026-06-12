/**

 * 邮箱配置类型定义

 * 共享接口，供 email-config.service.ts 和 email-config-manager.service.ts 共同使用

 */



export interface EmailConfig {

  id?: string

  qqEmail?: string

  authCode?: string           // 加密存储



  domains?: string

  useAlias?: boolean

  aliasType?: 'gmail' | 'qq'

  gmailBase?: string

  gmailAppPassword?: string   // 加密存储

  qqAliases?: string



  smtpHost?: string

  smtpPort?: number

  smtpSecure?: boolean

  smtpUser?: string

  smtpPassword?: string       // 加密存储

  smtpFrom?: string



  createdAt?: Date

  updatedAt?: Date

}



export interface EmailConfigSummary {

  qqEmail?: string

  authCode?: string

  domains?: string

  useAlias?: boolean

  aliasType?: 'gmail' | 'qq'

  gmailBase?: string

  gmailAppPassword?: string

  qqAliases?: string

}