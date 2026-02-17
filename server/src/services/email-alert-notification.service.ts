/**
 * 邮件告警通知服务（占位符实现）
 * 
 * 这是一个占位符实现，用于未来集成邮件告警通知功能。
 * 当前版本仅记录日志，不发送实际邮件。
 * 
 * 功能说明：
 * - 通过 SMTP 发送告警邮件
 * - 支持自定义邮件模板
 * - 支持批量发送和单独发送
 * - 支持告警级别过滤
 * 
 * 实现指南：
 * 1. 安装 nodemailer: npm install nodemailer @types/nodemailer
 * 2. 配置 SMTP 服务器信息（使用现有的 email-config.service.ts）
 * 3. 实现邮件模板系统
 * 4. 实现发送逻辑和错误处理
 * 5. 在 alert-notification.service.ts 中集成此服务
 * 
 * @see server/docs/email-alert-notification.md 详细实现文档
 */

import { Alert, AlertLevel } from '../models/health-status.model'
import { getEmailConfig, EmailConfig } from './email-config.service'

/**
 * 邮件告警配置
 */
export interface EmailAlertConfig {
  enabled: boolean                    // 是否启用邮件告警
  recipients: string[]                // 收件人列表
  minLevel: AlertLevel                // 最小告警级别（只发送此级别及以上的告警）
  batchMode: boolean                  // 是否批量发送（true: 合并多个告警到一封邮件）
  batchInterval: number               // 批量发送间隔（分钟）
  maxRetries: number                  // 最大重试次数
}

/**
 * 邮件模板数据
 */
interface EmailTemplateData {
  alert: Alert
  timestamp: string
  levelColor: string
  levelIcon: string
}

/**
 * 获取邮件告警配置
 * 
 * TODO: 将此配置集成到主配置文件中
 */
function getEmailAlertConfig(): EmailAlertConfig {
  return {
    enabled: false,                   // 默认禁用
    recipients: [],                   // 需要配置收件人
    minLevel: 'WARNING',              // 默认只发送 WARNING 和 ERROR
    batchMode: false,                 // 默认单独发送
    batchInterval: 5,                 // 默认 5 分钟
    maxRetries: 3                     // 默认重试 3 次
  }
}

/**
 * 检查是否应该发送邮件告警
 */
function shouldSendEmail(alert: Alert, config: EmailAlertConfig): boolean {
  if (!config.enabled) {
    return false
  }
  
  if (config.recipients.length === 0) {
    console.warn('⚠️  邮件告警已启用但未配置收件人')
    return false
  }
  
  const levelPriority: Record<AlertLevel, number> = {
    'ERROR': 3,
    'WARNING': 2,
    'INFO': 1
  }
  
  return levelPriority[alert.level] >= levelPriority[config.minLevel]
}

/**
 * 生成告警邮件主题
 */
function generateEmailSubject(alert: Alert): string {
  const prefix = alert.level === 'ERROR' ? '🚨' : alert.level === 'WARNING' ? '⚠️' : 'ℹ️'
  return `${prefix} [${alert.level}] Kiro Server 告警通知`
}

/**
 * 生成告警邮件 HTML 内容
 * 
 * TODO: 实现更美观的 HTML 模板
 * 可以使用模板引擎（如 Handlebars）或 React Email
 */
function generateEmailHTML(alert: Alert): string {
  const levelColor = alert.level === 'ERROR' ? '#dc3545' : 
                     alert.level === 'WARNING' ? '#ffc107' : '#17a2b8'
  
  const levelIcon = alert.level === 'ERROR' ? '❌' : 
                    alert.level === 'WARNING' ? '⚠️' : 'ℹ️'
  
  const timestamp = new Date(alert.timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .alert-container {
      border: 2px solid ${levelColor};
      border-radius: 8px;
      padding: 20px;
      background-color: #f8f9fa;
    }
    .alert-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #dee2e6;
    }
    .alert-icon {
      font-size: 32px;
      margin-right: 10px;
    }
    .alert-level {
      font-size: 24px;
      font-weight: bold;
      color: ${levelColor};
    }
    .alert-message {
      font-size: 16px;
      margin: 15px 0;
      padding: 15px;
      background-color: white;
      border-radius: 4px;
    }
    .alert-details {
      margin-top: 15px;
      padding: 15px;
      background-color: white;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      overflow-x: auto;
    }
    .alert-timestamp {
      margin-top: 15px;
      font-size: 14px;
      color: #6c757d;
      text-align: right;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #dee2e6;
      font-size: 12px;
      color: #6c757d;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="alert-container">
    <div class="alert-header">
      <div class="alert-icon">${levelIcon}</div>
      <div class="alert-level">${alert.level}</div>
    </div>
    
    <div class="alert-message">
      <strong>告警信息：</strong><br>
      ${alert.message}
    </div>
    
    ${alert.details ? `
    <div class="alert-details">
      <strong>详细信息：</strong><br>
      <pre>${JSON.stringify(alert.details, null, 2)}</pre>
    </div>
    ` : ''}
    
    <div class="alert-timestamp">
      发生时间：${timestamp}
    </div>
  </div>
  
  <div class="footer">
    <p>此邮件由 Kiro Server 自动发送，请勿回复。</p>
    <p>如需停止接收告警邮件，请联系系统管理员。</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * 生成批量告警邮件 HTML 内容
 */
function generateBatchEmailHTML(alerts: Alert[]): string {
  const errorCount = alerts.filter(a => a.level === 'ERROR').length
  const warningCount = alerts.filter(a => a.level === 'WARNING').length
  const infoCount = alerts.filter(a => a.level === 'INFO').length
  
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  
  const alertsHTML = alerts.map((alert, index) => {
    const levelColor = alert.level === 'ERROR' ? '#dc3545' : 
                       alert.level === 'WARNING' ? '#ffc107' : '#17a2b8'
    const levelIcon = alert.level === 'ERROR' ? '❌' : 
                      alert.level === 'WARNING' ? '⚠️' : 'ℹ️'
    const alertTime = new Date(alert.timestamp).toLocaleTimeString('zh-CN')
    
    return `
    <div class="alert-item" style="margin-bottom: 15px; padding: 15px; background-color: white; border-left: 4px solid ${levelColor}; border-radius: 4px;">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 20px; margin-right: 8px;">${levelIcon}</span>
        <strong style="color: ${levelColor};">${alert.level}</strong>
        <span style="margin-left: auto; font-size: 12px; color: #6c757d;">${alertTime}</span>
      </div>
      <div style="margin-left: 28px;">
        ${alert.message}
        ${alert.details ? `<pre style="margin-top: 8px; font-size: 12px; background-color: #f8f9fa; padding: 8px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(alert.details, null, 2)}</pre>` : ''}
      </div>
    </div>
    `
  }).join('')
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .summary {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .summary-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .summary-stats {
      display: flex;
      gap: 20px;
    }
    .stat-item {
      padding: 10px 15px;
      background-color: white;
      border-radius: 4px;
      text-align: center;
    }
    .stat-number {
      font-size: 24px;
      font-weight: bold;
    }
    .stat-label {
      font-size: 12px;
      color: #6c757d;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #dee2e6;
      font-size: 12px;
      color: #6c757d;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="summary">
    <div class="summary-title">📊 告警汇总</div>
    <div class="summary-stats">
      ${errorCount > 0 ? `
      <div class="stat-item">
        <div class="stat-number" style="color: #dc3545;">${errorCount}</div>
        <div class="stat-label">错误</div>
      </div>
      ` : ''}
      ${warningCount > 0 ? `
      <div class="stat-item">
        <div class="stat-number" style="color: #ffc107;">${warningCount}</div>
        <div class="stat-label">警告</div>
      </div>
      ` : ''}
      ${infoCount > 0 ? `
      <div class="stat-item">
        <div class="stat-number" style="color: #17a2b8;">${infoCount}</div>
        <div class="stat-label">信息</div>
      </div>
      ` : ''}
      <div class="stat-item">
        <div class="stat-number">${alerts.length}</div>
        <div class="stat-label">总计</div>
      </div>
    </div>
  </div>
  
  <div class="alerts-list">
    ${alertsHTML}
  </div>
  
  <div class="footer">
    <p>汇总时间：${timestamp}</p>
    <p>此邮件由 Kiro Server 自动发送，请勿回复。</p>
    <p>如需停止接收告警邮件，请联系系统管理员。</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * 发送单个告警邮件（占位符实现）
 * 
 * TODO: 实现实际的邮件发送逻辑
 * 
 * 实现步骤：
 * 1. 使用 nodemailer 创建传输器
 * 2. 从 email-config.service 获取 SMTP 配置
 * 3. 生成邮件内容（HTML + 纯文本）
 * 4. 发送邮件并处理错误
 * 5. 实现重试机制
 * 
 * @example
 * ```typescript
 * import nodemailer from 'nodemailer'
 * 
 * const emailConfig = await getEmailConfig()
 * const transporter = nodemailer.createTransport({
 *   host: emailConfig.smtpHost,
 *   port: emailConfig.smtpPort,
 *   secure: emailConfig.smtpSecure,
 *   auth: {
 *     user: emailConfig.smtpUser,
 *     pass: emailConfig.smtpPassword
 *   }
 * })
 * 
 * await transporter.sendMail({
 *   from: emailConfig.smtpFrom,
 *   to: recipients.join(', '),
 *   subject: generateEmailSubject(alert),
 *   html: generateEmailHTML(alert),
 *   text: alert.message
 * })
 * ```
 */
export async function sendAlertEmail(alert: Alert): Promise<boolean> {
  const config = getEmailAlertConfig()
  
  // 检查是否应该发送
  if (!shouldSendEmail(alert, config)) {
    return false
  }
  
  // 占位符实现：仅记录日志
  console.log(`\n📧 [占位符] 邮件告警通知`)
  console.log(`   收件人: ${config.recipients.join(', ')}`)
  console.log(`   主题: ${generateEmailSubject(alert)}`)
  console.log(`   级别: ${alert.level}`)
  console.log(`   消息: ${alert.message}`)
  console.log(`   时间: ${new Date(alert.timestamp).toLocaleString('zh-CN')}`)
  
  // TODO: 实现实际的邮件发送
  // const emailConfig = await getEmailConfig()
  // if (!emailConfig || !emailConfig.smtpHost) {
  //   console.error('❌ SMTP 配置未设置')
  //   return false
  // }
  // 
  // try {
  //   const transporter = nodemailer.createTransport({ ... })
  //   await transporter.sendMail({ ... })
  //   console.log('✅ 告警邮件发送成功')
  //   return true
  // } catch (error) {
  //   console.error('❌ 告警邮件发送失败:', error)
  //   return false
  // }
  
  return true
}

/**
 * 批量发送告警邮件（占位符实现）
 * 
 * TODO: 实现批量发送逻辑
 * 
 * 实现步骤：
 * 1. 将多个告警合并到一封邮件
 * 2. 生成汇总邮件内容
 * 3. 发送邮件
 */
export async function sendBatchAlertEmail(alerts: Alert[]): Promise<boolean> {
  if (alerts.length === 0) {
    return false
  }
  
  const config = getEmailAlertConfig()
  
  if (!config.enabled || config.recipients.length === 0) {
    return false
  }
  
  // 过滤符合级别要求的告警
  const filteredAlerts = alerts.filter(alert => shouldSendEmail(alert, config))
  
  if (filteredAlerts.length === 0) {
    return false
  }
  
  // 占位符实现：仅记录日志
  console.log(`\n📧 [占位符] 批量邮件告警通知`)
  console.log(`   收件人: ${config.recipients.join(', ')}`)
  console.log(`   主题: 🚨 Kiro Server 告警汇总 (${filteredAlerts.length} 条)`)
  console.log(`   告警数量: ${filteredAlerts.length}`)
  console.log(`   - ERROR: ${filteredAlerts.filter(a => a.level === 'ERROR').length}`)
  console.log(`   - WARNING: ${filteredAlerts.filter(a => a.level === 'WARNING').length}`)
  console.log(`   - INFO: ${filteredAlerts.filter(a => a.level === 'INFO').length}`)
  
  // TODO: 实现实际的批量邮件发送
  
  return true
}

/**
 * 测试邮件告警配置
 * 
 * TODO: 实现配置测试功能
 * 
 * 发送一封测试邮件以验证 SMTP 配置是否正确
 */
export async function testEmailAlertConfig(): Promise<{
  success: boolean
  message: string
}> {
  const config = getEmailAlertConfig()
  
  if (!config.enabled) {
    return {
      success: false,
      message: '邮件告警未启用'
    }
  }
  
  if (config.recipients.length === 0) {
    return {
      success: false,
      message: '未配置收件人'
    }
  }
  
  // TODO: 实现实际的测试邮件发送
  // const emailConfig = await getEmailConfig()
  // if (!emailConfig || !emailConfig.smtpHost) {
  //   return { success: false, message: 'SMTP 配置未设置' }
  // }
  // 
  // try {
  //   const transporter = nodemailer.createTransport({ ... })
  //   await transporter.sendMail({
  //     from: emailConfig.smtpFrom,
  //     to: config.recipients[0],
  //     subject: '🧪 Kiro Server 邮件告警测试',
  //     html: '<p>这是一封测试邮件，用于验证邮件告警配置是否正确。</p>',
  //     text: '这是一封测试邮件，用于验证邮件告警配置是否正确。'
  //   })
  //   return { success: true, message: '测试邮件发送成功' }
  // } catch (error: any) {
  //   return { success: false, message: `测试失败: ${error.message}` }
  // }
  
  return {
    success: false,
    message: '邮件告警功能尚未实现（占位符）'
  }
}
