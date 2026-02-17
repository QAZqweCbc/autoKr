/**
 * 邮箱服务
 * 处理邮箱连接和邮件获取
 */

import Imap from 'imap'
import { simpleParser } from 'mailparser'

interface EmailMessage {
  subject: string
  from: string
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

          fetch.on('message', (msg) => {
            msg.on('body', (stream: any) => {
              simpleParser(stream as any, (err, parsed) => {
                if (err) {
                  console.error('解析邮件失败:', err)
                } else {
                  messages.push({
                    subject: parsed.subject || '',
                    from: parsed.from?.text || '',
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
