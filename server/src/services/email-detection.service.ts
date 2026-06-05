/**
 * 邮箱检测服务
 * 检测Amazon Web Services邮件并自动删除对应账号
 */

import { checkAmazonEmails, deleteEmail } from './email.service'
import { getEmailConfig } from './email-config-manager.service'
import { MySQLAccountDB } from './mysql-account.service'
import { logAccountDeletion } from './account-deletion-log.service'
import { withTransaction } from '../utils/transaction.util'
import { getPool } from './mysql.service'
import { logger } from '../utils/logger'

let detectionTimer: NodeJS.Timeout | null = null
let isDetecting = false

// 配置
const SIGNAL_CHECK_INTERVAL = parseInt(process.env.EMAIL_DETECTION_INTERVAL || '5') * 60 * 1000 // 默认5分钟
const TARGET_SUBJECT = process.env.EMAIL_DETECTION_TARGET_SUBJECT || 'Response Required: Your Kiro Account'
const SIGNAL_SENDER = process.env.EMAIL_DETECTION_SIGNAL_SENDER || 'Amazon Web Services'

export interface DetectionResult {
  checked: boolean
  amazonEmailsFound: number
  targetEmailsFound: number
  accountsDeleted: number
  emailsDeleted: number
  errors: string[]
  details: Array<{
    email: string
    accountId?: string
    success: boolean
    error?: string
  }>
}

/**
 * 检查是否有Amazon邮件信号
 */
async function checkForAmazonSignal(includeRead: boolean = false): Promise<boolean> {
  try {
    const emailConfig = await getEmailConfig(true)

    if (!emailConfig || !emailConfig.qqEmail || !emailConfig.authCode) {
      logger.warn('邮箱配置不完整，跳过检测')
      return false
    }

    logger.debug('🔍 检查Amazon邮件信号...')
    const amazonEmails = await checkAmazonEmails(emailConfig.qqEmail, emailConfig.authCode, includeRead)

    if (amazonEmails.length > 0) {
      logger.info(`🔔 检测到 ${amazonEmails.length} 封Amazon Web Services邮件`)
      return true
    } else {
      logger.debug('⏭️  未检测到Amazon Web Services邮件，跳过本次检测')
      return false
    }
  } catch (error: any) {
    logger.error('检查Amazon邮件信号失败:', error.message)
    return false
  }
}

/**
 * 检测并删除账号
 */
async function detectAndDeleteAccounts(includeRead: boolean = false): Promise<DetectionResult> {
  const result: DetectionResult = {
    checked: true,
    amazonEmailsFound: 0,
    targetEmailsFound: 0,
    accountsDeleted: 0,
    emailsDeleted: 0,
    errors: [],
    details: []
  }

  try {
    const emailConfig = await getEmailConfig(true)

    if (!emailConfig || !emailConfig.qqEmail || !emailConfig.authCode) {
      result.errors.push('邮箱配置不完整')
      return result
    }

    // 获取所有Amazon邮件
    logger.info('📧 获取Amazon邮件列表...')
    const amazonEmails = await checkAmazonEmails(emailConfig.qqEmail, emailConfig.authCode, includeRead)
    result.amazonEmailsFound = amazonEmails.length

    if (amazonEmails.length === 0) {
      logger.info('未找到Amazon邮件')
      return result
    }

    // 过滤目标邮件
    const targetEmails = amazonEmails.filter(email =>
      email.subject.includes(TARGET_SUBJECT)
    )
    result.targetEmailsFound = targetEmails.length

    if (targetEmails.length === 0) {
      logger.info(`未找到标题包含 "${TARGET_SUBJECT}" 的邮件`)

      // 🆕 清理非目标 Amazon 邮件，避免重复检测
      const shouldCleanup = process.env.EMAIL_CLEANUP_NON_TARGET !== 'false'

      if (shouldCleanup && amazonEmails.length > 0) {
        logger.info(`🧹 清理 ${amazonEmails.length} 封非目标 Amazon 邮件...`)

        for (const email of amazonEmails) {
          try {
            await deleteEmail(emailConfig.qqEmail, emailConfig.authCode, email.uid)
            result.emailsDeleted++
            logger.info(`✅ 已删除非目标邮件: ${email.subject}`)
          } catch (error: any) {
            logger.warn(`删除邮件失败 (UID: ${email.uid}):`, error.message)
            result.errors.push(`删除邮件失败: ${error.message}`)
          }
        }
      }

      return result
    }

    logger.info(`🎯 找到 ${targetEmails.length} 封目标邮件，开始处理...`)

    // 处理每封目标邮件
    for (const email of targetEmails) {
      try {
        // 从邮件的To字段中提取账号邮箱（收件人就是账号邮箱）
        const accountEmail = email.to?.trim()

        if (!accountEmail) {
          logger.warn(`无法从邮件中提取收件人邮箱: ${email.subject}`)
          result.details.push({
            email: email.from,
            success: false,
            error: '无法提取收件人邮箱'
          })
          result.errors.push(`无法从邮件提取收件人邮箱: ${email.subject}`)
          continue
        }

        logger.info(`📧 从邮件To字段提取账号邮箱: ${accountEmail}`)

        // 查找账号
        const account = await MySQLAccountDB.getByEmail(accountEmail)

        if (!account) {
          logger.warn(`MySQL中未找到账号: ${accountEmail}，直接删除邮件`)

          // 直接删除邮件（账号可能已被删除或不存在）
          try {
            await deleteEmail(emailConfig.qqEmail, emailConfig.authCode, email.uid)
            result.emailsDeleted++
            logger.info(`✅ 已删除邮件 UID: ${email.uid} (账号不存在)`)
          } catch (emailError: any) {
            logger.warn(`删除邮件失败 (UID: ${email.uid}):`, emailError.message)
            result.errors.push(`删除邮件失败: ${emailError.message}`)
          }

          result.details.push({
            email: accountEmail,
            success: true,
            error: '账号不存在，已删除邮件'
          })
          continue
        }

        logger.info(`🗑️  删除账号: ${accountEmail} (ID: ${account.id})`)

        // 使用事务删除账号并记录日志
        await withTransaction(async (connection) => {
          // 删除账号
          await connection.execute('DELETE FROM accounts WHERE id = ?', [account.id])

          // 记录删除日志
          const now = Date.now()
          await connection.execute(
            `INSERT INTO account_deletion_logs
             (account_id, email, deletion_reason, detected_email, email_subject, email_from,
              email_date, email_uid, detected_at, deleted_at, details)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              account.id,
              accountEmail,
              'email_response_required',
              emailConfig.qqEmail,
              email.subject,
              email.from,
              email.date.getTime(),
              email.uid,
              now,
              now,
              JSON.stringify({
                emailText: email.text?.substring(0, 500), // 只保存前500字符
                targetSubject: TARGET_SUBJECT
              })
            ]
          )
        }, 'deleteAccountWithLog')

        result.accountsDeleted++

        // 删除邮件
        try {
          await deleteEmail(emailConfig.qqEmail, emailConfig.authCode, email.uid)
          result.emailsDeleted++
          logger.info(`✅ 已删除邮件 UID: ${email.uid}`)
        } catch (emailError: any) {
          logger.warn(`删除邮件失败 (UID: ${email.uid}):`, emailError.message)
          result.errors.push(`删除邮件失败: ${emailError.message}`)
        }

        result.details.push({
          email: accountEmail,
          accountId: account.id,
          success: true
        })

        logger.info(`✅ 成功处理账号: ${accountEmail}`)

      } catch (error: any) {
        logger.error(`处理邮件失败:`, error.message)
        result.errors.push(`处理邮件失败: ${error.message}`)
        result.details.push({
          email: email.from,
          success: false,
          error: error.message
        })
      }
    }

    logger.info(`📊 检测完成: 删除 ${result.accountsDeleted} 个账号, ${result.emailsDeleted} 封邮件`)

  } catch (error: any) {
    logger.error('邮箱检测失败:', error.message)
    result.errors.push(error.message)
  }

  return result
}

/**
提取账号邮箱
 */
function extractAccountEmail(content: string): string | null {
  if (!content || content.trim().length === 0) {
    logger.debug('邮件内容为空')
    return null
  }

  // 尝试匹配邮箱地址 - 改进的正则表达式
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = content.match(emailRegex)

  if (matches && matches.length > 0) {
    logger.debug(`找到 ${matches.length} 个邮箱: ${matches.join(', ')}`)
    // 过滤掉Amazon的邮箱，返回第一个非Amazon的邮箱
    const accountEmail = matches.find(email => !email.toLowerCase().includes('amazon'))
    if (accountEmail) {
      return accountEmail
    }
    // 如果没有找到非Amazon的邮箱，返回第一个
    return matches[0]
  }

  logger.debug(`未找到邮箱地址，内容预览: ${content.substring(0, 100)}`)
  return null
}

/**
 * 信号检测循环
 */
async function signalCheckLoop() {
  if (isDetecting) {
    logger.debug('检测任务正在进行中，跳过本次')
    return
  }

  isDetecting = true

  try {
    // 第一阶段：信号检测
    const hasAmazonEmail = await checkForAmazonSignal()

    if (hasAmazonEmail) {
      // 第二阶段：详细检测和删除
      const result = await detectAndDeleteAccounts()

      if (result.accountsDeleted > 0 || result.errors.length > 0) {
        logger.info('检测结果:', {
          amazonEmailsFound: result.amazonEmailsFound,
          targetEmailsFound: result.targetEmailsFound,
          accountsDeleted: result.accountsDeleted,
          emailsDeleted: result.emailsDeleted,
          errors: result.errors.length
        })
      }
    }
  } catch (error: any) {
    logger.error('邮箱检测循环失败:', error.message)
  } finally {
    isDetecting = false
  }
}

/**
 * 启动邮箱检测调度器
 */
export function startEmailDetectionScheduler(): void {
  const enabled = process.env.EMAIL_DETECTION_ENABLED !== 'false'

  if (!enabled) {
    logger.info('⏸️  邮箱检测未启用')
    return
  }

  logger.info('🔄 启动邮箱检测调度器...')
  logger.info(`   检测间隔: ${SIGNAL_CHECK_INTERVAL / 60000} 分钟`)
  logger.info(`   目标发件人: ${SIGNAL_SENDER}`)
  logger.info(`   目标标题: ${TARGET_SUBJECT}`)

  // 清除旧的定时器
  if (detectionTimer) {
    clearInterval(detectionTimer)
  }

  // 立即执行一次
  signalCheckLoop()

  // 设置定时器
  detectionTimer = setInterval(signalCheckLoop, SIGNAL_CHECK_INTERVAL)

  logger.info('✅ 邮箱检测调度器已启动')
}

/**
 * 停止邮箱检测调度器
 */
export function stopEmailDetectionScheduler(): void {
  if (detectionTimer) {
    clearInterval(detectionTimer)
    detectionTimer = null
    logger.info('⏹️  邮箱检测调度器已停止')
  }
}

/**
 * 手动触发检测（用于测试或手动触发）
 * @param includeRead 是否包含已读邮件（默认true - 手动触发时检查所有邮件）
 */
export async function triggerDetection(includeRead: boolean = true): Promise<DetectionResult> {
  logger.info('🔧 手动触发邮箱检测...')

  const hasSignal = await checkForAmazonSignal(includeRead)

  if (!hasSignal) {
    return {
      checked: true,
      amazonEmailsFound: 0,
      targetEmailsFound: 0,
      accountsDeleted: 0,
      emailsDeleted: 0,
      errors: [],
      details: []
    }
  }

  return await detectAndDeleteAccounts(includeRead)
}
