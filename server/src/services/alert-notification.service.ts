/**
 * 告警通知服务
 * 负责将告警信息通过多种渠道发送给用户
 * 
 * 支持的通知渠道：
 * 1. 控制台日志输出（默认启用）
 * 2. WebSocket 推送（可选）
 * 3. 邮件通知（可选）
 * 4. Webhook 通知（可选）
 */

import { Alert, AlertLevel } from '../models/health-status.model'
import { loadConfig } from './config.service'
import { emitRefreshAlert } from '../websocket/socket.handler'

/**
 * 告警通知配置
 */
interface AlertNotificationConfig {
  enableConsoleLog: boolean           // 是否启用控制台日志（默认 true）
  enableWebSocket: boolean            // 是否启用 WebSocket（默认 false）
  enableEmail: boolean                // 是否启用邮件（默认 false）
  enableWebhook: boolean              // 是否启用 Webhook（默认 false）
  minLevel?: AlertLevel               // 最小通知级别（默认 INFO）
}

/**
 * 获取告警通知配置
 */
function getNotificationConfig(): AlertNotificationConfig {
  const config = loadConfig()
  const autoRefresh = config.autoRefresh
  
  return {
    enableConsoleLog: true,  // 控制台日志始终启用
    enableWebSocket: autoRefresh?.enableWebSocket ?? false,
    enableEmail: false,  // 邮件功能暂未实现
    enableWebhook: false,  // Webhook 功能暂未实现
    minLevel: 'INFO'  // 默认通知所有级别
  }
}

/**
 * 检查告警级别是否应该通知
 */
function shouldNotify(alert: Alert, minLevel: AlertLevel): boolean {
  const levelPriority: Record<AlertLevel, number> = {
    'ERROR': 3,
    'WARNING': 2,
    'INFO': 1
  }
  
  return levelPriority[alert.level] >= levelPriority[minLevel]
}

/**
 * 格式化告警为控制台输出
 */
function formatAlertForConsole(alert: Alert): string {
  const icon = alert.level === 'ERROR' ? '❌' : alert.level === 'WARNING' ? '⚠️' : 'ℹ️'
  const timestamp = new Date(alert.timestamp).toLocaleString('zh-CN')
  
  let output = `${icon} [${alert.level}] ${alert.message}`
  output += `\n   时间: ${timestamp}`
  
  if (alert.details) {
    output += `\n   详情: ${JSON.stringify(alert.details, null, 2).split('\n').join('\n   ')}`
  }
  
  return output
}

/**
 * 通过控制台日志发送告警
 */
function sendConsoleAlert(alert: Alert) {
  const formatted = formatAlertForConsole(alert)
  
  // 根据级别使用不同的日志方法
  switch (alert.level) {
    case 'ERROR':
      console.error(`\n🚨 告警通知:\n${formatted}\n`)
      break
    case 'WARNING':
      console.warn(`\n⚠️  告警通知:\n${formatted}\n`)
      break
    case 'INFO':
      console.info(`\n📢 告警通知:\n${formatted}\n`)
      break
  }
}

/**
 * 通过 WebSocket 发送告警
 */
function sendWebSocketAlert(alert: Alert) {
  try {
    emitRefreshAlert({
      level: alert.level,
      message: alert.message,
      timestamp: alert.timestamp
    })
    
    console.log(`✅ 已通过 WebSocket 发送告警: [${alert.level}] ${alert.message}`)
  } catch (error: any) {
    console.error(`❌ WebSocket 告警发送失败:`, error.message)
  }
}

/**
 * 通过邮件发送告警（占位符，待实现）
 */
function sendEmailAlert(alert: Alert) {
  // TODO: 实现邮件通知
  console.log(`📧 [占位符] 邮件告警: [${alert.level}] ${alert.message}`)
}

/**
 * 通过 Webhook 发送告警（占位符，待实现）
 */
function sendWebhookAlert(alert: Alert) {
  // TODO: 实现 Webhook 通知
  console.log(`🔗 [占位符] Webhook 告警: [${alert.level}] ${alert.message}`)
}

/**
 * 发送单个告警通知
 */
export function sendAlert(alert: Alert) {
  const config = getNotificationConfig()
  
  // 检查是否应该通知
  if (!shouldNotify(alert, config.minLevel || 'INFO')) {
    return
  }
  
  // 1. 控制台日志（始终启用）
  if (config.enableConsoleLog) {
    sendConsoleAlert(alert)
  }
  
  // 2. WebSocket 推送（可选）
  if (config.enableWebSocket) {
    sendWebSocketAlert(alert)
  }
  
  // 3. 邮件通知（可选，待实现）
  if (config.enableEmail) {
    sendEmailAlert(alert)
  }
  
  // 4. Webhook 通知（可选，待实现）
  if (config.enableWebhook) {
    sendWebhookAlert(alert)
  }
}

/**
 * 批量发送告警通知
 */
export function sendAlerts(alerts: Alert[]) {
  if (alerts.length === 0) {
    return
  }
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🚨 告警通知 - 共 ${alerts.length} 条`)
  console.log('='.repeat(60))
  
  alerts.forEach((alert, index) => {
    console.log(`\n[${index + 1}/${alerts.length}]`)
    sendAlert(alert)
  })
  
  console.log('='.repeat(60) + '\n')
}

/**
 * 发送告警摘要（简化版，只显示统计信息）
 */
export function sendAlertSummary(alerts: Alert[]) {
  if (alerts.length === 0) {
    console.log('✅ 无告警')
    return
  }
  
  const errorCount = alerts.filter(a => a.level === 'ERROR').length
  const warningCount = alerts.filter(a => a.level === 'WARNING').length
  const infoCount = alerts.filter(a => a.level === 'INFO').length
  
  console.log(`\n⚠️  告警摘要: 共 ${alerts.length} 条`)
  if (errorCount > 0) console.log(`   ❌ ERROR: ${errorCount} 条`)
  if (warningCount > 0) console.log(`   ⚠️  WARNING: ${warningCount} 条`)
  if (infoCount > 0) console.log(`   ℹ️  INFO: ${infoCount} 条`)
  
  // 只显示 ERROR 和 WARNING 的消息
  const criticalAlerts = alerts.filter(a => a.level === 'ERROR' || a.level === 'WARNING')
  if (criticalAlerts.length > 0) {
    console.log(`\n   关键告警:`)
    criticalAlerts.forEach((alert, index) => {
      const icon = alert.level === 'ERROR' ? '❌' : '⚠️'
      console.log(`   ${index + 1}. ${icon} ${alert.message}`)
    })
  }
  
  console.log()
}
