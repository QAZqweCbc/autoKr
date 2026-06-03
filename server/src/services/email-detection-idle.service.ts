/**
 * 邮箱检测服务 - IMAP IDLE 优化版
 * 使用 IMAP IDLE 实时监听邮件，替代轮询机制
 */

import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { getEmailConfig } from './email-config-manager.service'
import { MySQLAccountDBNew as MySQLAccountDB } from './mysql-account.service'
import { withTransaction } from '../utils/transaction.util'
import { logger } from '../utils/logger'

// 配置
const TARGET_SUBJECT = process.env.EMAIL_DETECTION_TARGET_SUBJECT || 'Response Required: Your Kiro Account'
const SIGNAL_SENDER = process.env.EMAIL_DETECTION_SIGNAL_SENDER || 'Amazon Web Services'
const RECONNECT_DELAY = 5000 // 断线重连延迟（毫秒）
const MAX_RECONNECT_ATTEMPTS = 5

let imapClient: Imap | null = null
let isConnected = false
let reconnectAttempts = 0
let reconnectTimer: NodeJS.Timeout | null = null

export interface DetectionResult {
  checked: boolean
  amazonEmailsFound: number
  targetEmailsFound: numbDeleted: number
  errors: string[]
  details: Array<{
    email: string
    accountId?: string
    success: boolean
    error?: string
  }>
}

/**
 * 处理新邮件
 */
async function handleNewMail(seqno: number): Promise<void> {
  if (!imapClient) {
    logger.warn('IMAP 客户端未初始化')
    return
  }

  try {
    logger.info(`📬 收到新邮件通知 (seqno: ${seqno})`)

    const fetch = imapClient.fetch(seqno, {
      bodies: [) => {
        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf8')
        })

        stream.once('end', async () => {
          try {
            const parsed = await simpleParser(buffer)


            }

            logger.info(`🔔 收到 Amazon Web Services 邮件`)
            logger.info(`   主题: ${parsed.subject}`)
            logger.info(`   发件人: ${from}`)

            // 检查标题
            const subject = parsed.subject || ''
            if (!subject.includes(TARGET_SUBJECT)) {
              logger.debug(`标题不匹配，跳过: ${subject}`)

           // 可选：删除非目标 Amazon 邮件，避免重复检测
              if (process.env.EMAIL_DELETE_NON_TARGET === 'true') {
                await deleteEmailBySeqno(seqno)
                logger.info(`🗑️  已删除非目标 Amazon 邮件`)
              }

              return
            }

            logger.info(`🎯 匹配目标邮件，开始处理...`)

            // 从收件人提取账号邮箱
            const accountEmail = parsed.to?.text?.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)?.[1]

            if (!accountEmail) {
              logger.warn(`无法从邮件中提取账号邮箱`)
              return
            }

            logger.info(`📧 提取账号邮箱: ${accountEmail}`)

                 await deleteEmailBySeqno(seqno)
              logger.info(`✅ 已删除邮件 (账号不存在)`)
              return
            }

            logger.info(`🗑️  删除账号: ${accountEmail} (ID: ${account.id})`)

            // 使用事务删除账号并记录日志
            await withTransaction(async (connection) => {
              await connection.execute('DELETE FROM accounts WHERE id = ?', [account.id])

              const now = Date.now()
              await connection.execute(
                `INSERT INTO account_deletion_logs
                 (account_id, email, deletion_reason, detected_email, email_subject, email_from,
                 unt.id,
                 mail_response_required',
                  parsed.to?.text || '',
                  subject,
                  from,
                  parsed.date?.getTime() || now,
                  now,
                  now,
                  JSON.stringify({
                    emailText: parsed.text?.substring(0, 500),
                    targetSubject: TARGET_SUBJECT
                : ${accountEmail}`)

          } catch (error: any) {
            logger.error('处理邮件内容失败:', error.message)
          }
        })
      })

      msg.once('attributes', (attrs) => {
        attributes = attrs
      })
    })

    fetch.once('error', (err) => {
      logger.error('获取邮件失败:', err.message)
    })

  } catch (error: any) {
    logger.error('处理新邮件失败:', error.message)
  }
}

/**
 * 删除邮件（通过序号）
 */
async function deleteEmailBySeqno(seqno: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!imapClient) {
      reject(new Error('IMAP 客户端未初始化'))
      return
    }

    imapClient.addFlags(seqno, ['\\Deleted'], (err) => {
      if (err) {
        reject(err)
        return
      }

      imapClient!.expunge((expungeErr) => {
        if (expungeErr) {
          reject(expungeErr)
          return
        }
        resolve()
      })
    })
  })
}

/**
 * 连接到 IMAP 服务器
 */
async function connectImap(): Promise<void> {
  const emailConfig = await getEmailConfig(true)

  if (!emailConfig || !emailConfig.qqEmail || !emailConfig.authCode) {
    throw new Error('邮箱配置不完整')
  }

  // 创建 IMAP 客户端
  imapClient = new Imap({
    user: emailConfig.qqEmail,
    password: emailConfig.authCode,
    host: 'imap.qq.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    keepalive: {
      interval: 10000,  // 每 10 秒发送心跳
      idleInterval: 300000,  // IDLE 模式下每 5 分钟刷新
      forceNoop: true
    }
  })

  return new Promise((resolve, reject) => {
    imapClient!.once('ready', () => {
      logger.info('✅ IMAP 连接成功')
      isConnected = true
      reconnectAttempts = 0

      // 打开收件箱
      imapClient!.openBox('INBOX'f (err) {
          logger.error('打开收件箱失败:', err.message)
          reject(err)
          return
        }

        logger.info('📬 收件箱已打开，开始 IDLE 监听...')

        // 监听新邮件
        imapClient!.on('mail', (numNewMsgs) => {
          logger.info(`📩 检测到 ${numNewMsgs} 封新邮件`)
          // 获取最新邮件
          fetchLatestEmails(numNewMsgs)
        })

        // 进入 IDLE 模式
        startIdle()

        resolve()
      })
    })

    imapClient!.once('error', (err) => {
      logger.error('IMAP 连接错误:', err.message)
      isConnected = false
      reject(err)

      // 尝试重连
      scheduleReconnect()
    })

    imapClient!.once('end', () => {
      logger.warn('IMAP 连接已关闭')
      isConnected = false

      // 尝试重连
      scheduleReconnect()
    })

    imapClient!.connect()
  })
}

/**
 * 进入 IDLE 模式
 *.debug('⏸️  进入 IDLE 模式')
  } catch (error: any) {
    logger.error('进入 IDLE 模式失败:', error.message)
  }
}

/**
 * 退出 IDLE 模式
 */
function stopIdle(): void {
  if (!imapClient || !isConnected) {
    return
  }

  try {
    imapClient.idle((err) => {
      if (err) {
        logger.error('退出 IDLE 模式失败:', err.message)
      }
    })
  } catch (error: any) {
    logger.error('退出 IDLE 模式失败:', error.message)
  }
}

/**
 * 获取最新邮件
 */
function fetchLatestEmails(count: number): void {
  if (!imapClient || !isConnected) {
    return
  }

  // 退出 IDLE 模式
  stopIdle()

  // 搜索未读邮件
  imapClient.search(['UNSEEN'], (err, results) => {
    if (err) {
      logger.error('搜索邮件失败:', err.message)
      // 重新进入 IDLE 模式
      startIdle()
      return
    }

    if (results.length === 0) {
      logger.debug('没有未读邮件')
      // 重新进入 IDLE 模式
      startIdle()
      return
    }

    logger.info(`📧 找到 ${results.length} 封未读邮件`)

    // 处理每封邮件
    results.forEach((seqno) => {
      handleNewMail(seqno)
    })

    // 重新进入 IDLE 模式
    setTimeout(() => startIdle(), 1000)
  })
}

/**
 * 安排重连
 */
function scheduleReconnect(): void {
  if (reconnectTimer) {
    return
  }

  reconnectAttempts++

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    logger.error(`❌ IMAP 重连失败，已达最大重试次数 (${MAX_RECONNECT_ATTEMPTS})`)
    return
  }

  const delay = RECONNECT_DELAY * reconnectAttempts
  logger.info(`🔄 ${delay}ms 后尝试重连 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    try {
      await connectImap()
    } catch (error: any) {
      logger.error('重连失败:', error.message)
    }
  }, delay)
}

/**
 * 启动邮箱检测调度器（IMAP IDLE 模式）
 */
export async function startEmailDetectionScheduler(): Promise<void> {
  const enabled = process.env.EMAIL_DETECTION_ENABLED !== 'false'

  if (!enabled) {
    logger.info('⏸️  邮箱检测未启用')
    return
  }

  logger.info('🔄 启动邮箱检测调度器 (IMAP IDLE 模式)...')
  logger.info(`   目标发件人: ${SIGNAL_SENDER}`)
  logger.info(`   目标标题: ${TARGET_SUBJECT}`)

  try {
    await connectImap()
    logger.info('✅ 邮箱检测调度器已启动')
  } catch (error: any) {
    logger.error('启动邮箱检测调度器失败止邮箱检测调度器
 */
export function stopEmailDetectionScheduler(): void {
  if   }

  if (imapClient) {
    try {
      imapClient.end()
      logger.info('⏹️  邮箱检测调度器已停止')
    } catch (error: any) {
      logger.error('停止邮箱检测调度器失败:', error.message)
    }
    imapClient = null
  }

  isConnected = false
}

/**
 * 手动触发检测（兼容旧接口）
 */
export async function triggerDetection(): Promise<DetectionResult> {
  logger.info('🔧 IMAP IDLE 模式不支持手动触发，邮件会自动实时处理')

  return {
    checked: false,
    amazonEmailsFound: 0,
    targetEmailsFound: 0,
    accountsDeleted: 0,
    emailsDeleted: 0,
    errors: ['IMAP IDLE 模式不支持手动触发'],
    details: []
  }
}
