/**
 * 邮箱服务
 * 处理邮箱连接和邮件获取
 */

import Imap from 'imap'
import { simpleParser } from 'mailparser'

interface EmailMessage {
  uid: number
  subject: string
  from: string
  to?: string
  date: Date
  text?: string
  html?: string
}

/**
 * 获取QQ邮箱邮件
 */
export async function fetchQQEmail(
  email: string,
  authCode: string,
  searchCriteria: any[] = ['UNSEEN']
): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email,
      password: authCode,
      host: 'imap.qq.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    })

    const messages: EmailMessage[] = []

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) {
          imap.end()
          return reject(err)
        }

        imap.search(searchCriteria, (err, results) => {
          if (err) {
            imap.end()
            return reject(err)
          }

          if (!results || results.length === 0) {
            imap.end()
            return resolve([])
          }

          const fetch = imap.fetch(results, { bodies: '' })
          let processed = 0

          fetch.on('message', (msg, seqno) => {
            let uid = 0

            msg.once('attributes', (attrs) => {
              uid = attrs.uid
            })

            msg.on('body', (stream: any) => {
              simpleParser(stream as any, (err, parsed) => {
                if (err) {
                  console.error('解析邮件失败:', err)
                } else {
                  messages.push({
                    uid: uid,
                    subject: parsed.subject || '',
                    from: parsed.from?.text || '',
                    to: parsed.to?.text || '',
                    date: parsed.date || new Date(),
                    text: parsed.text,
                    html: parsed.html as string
                  })
                }
                processed++
              })
            })
          })

          fetch.once('error', (err) => {
            imap.end()
            reject(err)
          })

          fetch.once('end', () => {
            // 等待所有邮件解析完成
            const checkComplete = setInterval(() => {
              if (processed >= results.length) {
                clearInterval(checkComplete)
                imap.end()
                resolve(messages)
              }
            }, 100)
          })
        })
      })
    })

    imap.once('error', (err) => {
      reject(err)
    })

    imap.connect()
  })
}

/**
 * 测试邮箱连接
 */
export async function testEmailConnection(
  email: string,
  authCode: string
): Promise<{
  success: boolean
  unreadCount: number
  recentMessages: Array<{
    subject: string
    from: string
    date: Date
  }>
}> {
  try {
    const messages = await fetchQQEmail(email, authCode, ['UNSEEN'])

    return {
      success: true,
      unreadCount: messages.length,
      recentMessages: messages.slice(0, 5).map(msg => ({
        subject: msg.subject,
        from: msg.from,
        date: msg.date
      }))
    }
  } catch (error) {
    throw error
  }
}

/**
 * 删除邮件
 */
export async function deleteEmail(
  email: string,
  authCode: string,
  uid: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email,
      password: authCode,
      host: 'imap.qq.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    })

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          imap.end()
          return reject(err)
        }

        // 标记邮件为删除
        imap.addFlags(uid, '\\Deleted', (err) => {
          if (err) {
            imap.end()
            return reject(err)
          }

          // 永久删除
          imap.expunge((err) => {
            imap.end()
            if (err) {
              return reject(err)
            }
            resolve()
          })
        })
      })
    })

    imap.once('error', (err) => {
      reject(err)
    })

    imap.connect()
  })
}

/**
 * 检测Amazon Web Services邮件
 * 只检查未读邮件，避免重复处理历史邮件
 */
export async function checkAmazonEmails(
  email: string,
  authCode: string
): Promise<EmailMessage[]> {
  // 只获取未读邮件
  const unreadMessages = await fetchQQEmail(email, authCode, ['UNSEEN'])

  // 过滤Amazon Web Services邮件
  return unreadMessages.filter(msg => {
    const fromLower = msg.from.toLowerCase()
    return fromLower.includes('amazon web services')
  })
}
