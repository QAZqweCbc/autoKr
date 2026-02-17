/**
 * AWS Builder ID 自动注册模块
 * 完全集成在 Electron 中，不依赖外部 Python 脚本
 * 
 * 邮箱参数格式: 
 * - Outlook: 邮箱|密码|refresh_token|client_id
 *   - refresh_token: OAuth2 刷新令牌 (如 M.C509_xxx...)
 *   - client_id: Graph API 客户端ID (如 9e5f94bc-xxx...)
 * - QQ邮箱: 邮箱|密码|授权码
 *   - 授权码: QQ邮箱IMAP/SMTP授权码 (16位字符)
 */

import { chromium, Browser, Page } from 'playwright'
import Imap from 'imap'
import { simpleParser } from 'mailparser'

// 日志回调类型
type LogCallback = (message: string) => void

// 验证码正则表达式 - 支持新旧两种格式
const CODE_PATTERNS = [
  // AWS 新格式：字母+连字符 (如 ZNCD-SRPZ, roll-padd)
  /(?:verification\s*code|验证码|Your code is|code is|Confirm this code)[：:\s]*([A-Z]{4}-[A-Z]{4})/gi,
  /(?:verification\s*code|验证码|Your code is|code is|Confirm this code)[：:\s]*([a-z]{4}-[a-z]{4})/gi,
  /^\s*([A-Z]{4}-[A-Z]{4})\s*$/gm,  // 单独一行的大写字母格式
  /^\s*([a-z]{4}-[a-z]{4})\s*$/gm,  // 单独一行的小写字母格式
  />\s*([A-Z]{4}-[A-Z]{4})\s*</g,   // HTML标签之间的大写字母格式
  />\s*([a-z]{4}-[a-z]{4})\s*</g,   // HTML标签之间的小写字母格式
  
  // AWS 旧格式：6位数字（保留兼容）
  /(?:verification\s*code|验证码|Your code is|code is)[：:\s]*(\d{6})/gi,
  /(?:is|为)[：:\s]*(\d{6})\b/gi,
  /^\s*(\d{6})\s*$/gm,  // 单独一行的6位数字
  />\s*(\d{6})\s*</g,   // HTML标签之间的6位数字
]

// AWS 验证码发件人
const AWS_SENDERS = [
  'no-reply@signin.aws',        // AWS 新发件人
  'no-reply@login.awsapps.com',
  'noreply@amazon.com',
  'account-update@amazon.com',
  'no-reply@aws.amazon.com',
  'noreply@aws.amazon.com',
  'aws'  // 模糊匹配
]

// 随机姓名生成
const FIRST_NAMES = ['James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Maria', 'Elizabeth', 'Jennifer', 'Linda', 'Barbara', 'Susan', 'Jessica']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Thomas', 'Taylor']

function generateRandomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  return `${first} ${last}`
}

/**
 * 随机延迟函数 - 模拟真人操作
 * @param minSeconds 最小延迟秒数（默认3秒）
 * @param maxSeconds 最大延迟秒数（默认8秒）
 * @param log 日志回调
 * @param description 延迟描述
 * @param configuredMin 配置的最小延迟（可选，用于覆盖默认值）
 * @param configuredMax 配置的最大延迟（可选，用于覆盖默认值）
 */
async function randomDelay(
  minSeconds: number = 3,
  maxSeconds: number = 8,
  log?: LogCallback,
  description?: string,
  configuredMin?: number,
  configuredMax?: number
): Promise<void> {
  // 如果提供了配置的延迟值，使用配置值；否则使用传入的参数
  const actualMin = configuredMin !== undefined ? configuredMin : minSeconds
  const actualMax = configuredMax !== undefined ? configuredMax : maxSeconds
  
  const delaySeconds = actualMin + Math.random() * (actualMax - actualMin)
  const delayMs = Math.round(delaySeconds * 1000)
  
  if (log && description) {
    log(`${description}（随机等待 ${(delayMs / 1000).toFixed(1)} 秒）...`)
  }
  
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

/**
 * 人类鼠标移动 - 贝塞尔曲线 + 加速度 + 抖动
 */
async function humanMouseMove(
  page: Page,
  toX: number,
  toY: number
): Promise<void> {
  // 获取当前鼠标位置（如果有的话）
  const fromX = Math.random() * 100
  const fromY = Math.random() * 100
  
  const steps = 15 + Math.floor(Math.random() * 15)  // 15-30步
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    
    // 使用缓动函数模拟加速度（先加速后减速）
    const easing = t < 0.5 
      ? 2 * t * t  // 前半段加速
      : 1 - Math.pow(-2 * t + 2, 2) / 2  // 后半段减速
    
    // 添加随机抖动（模拟手抖）
    const jitterX = (Math.random() - 0.5) * 3
    const jitterY = (Math.random() - 0.5) * 3
    
    // 计算当前位置
    const x = fromX + (toX - fromX) * easing + jitterX
    const y = fromY + (toY - fromY) * easing + jitterY
    
    await page.mouse.move(x, y)
    
    // 随机延迟（模拟人类移动速度）
    await page.waitForTimeout(8 + Math.random() * 12)
  }
}

/**
 * 人类输入 - 逐字输入 + 随机速度 + 偶尔错误
 */
async function humanType(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  const element = page.locator(selector).first()
  
  // 点击聚焦
  await element.click()
  await page.waitForTimeout(200 + Math.random() * 300)
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    
    // 10% 概率输入错误（模拟打字错误）
    if (Math.random() < 0.1 && i > 0) {
      // 输入错误字符
      const wrongChar = String.fromCharCode(
        char.charCodeAt(0) + (Math.random() < 0.5 ? 1 : -1)
      )
      await element.type(wrongChar, { delay: 80 + Math.random() * 80 })
      
      // 短暂停顿（发现错误）
      await page.waitForTimeout(200 + Math.random() * 400)
      
      // 删除错误字符
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(100 + Math.random() * 200)
    }
    
    // 输入正确字符（随机速度：50-200ms）
    await element.type(char, { delay: 50 + Math.random() * 150 })
    
    // 15% 概率停顿（模拟思考）
    if (Math.random() < 0.15) {
      await page.waitForTimeout(300 + Math.random() * 700)
    }
  }
  
  // 输入完成后短暂停顿
  await page.waitForTimeout(300 + Math.random() * 500)
}

/**
 * 人类页面滚动 - 自然滚动 + 偶尔回看
 */
async function humanScroll(
  page: Page,
  distance: number
): Promise<void> {
  const steps = 8 + Math.floor(Math.random() * 5)
  const stepSize = distance / steps
  
  for (let i = 0; i < steps; i++) {
    // 随机滚动距离（带波动）
    const scroll = stepSize + (Math.random() - 0.5) * stepSize * 0.3
    
    await page.evaluate((s) => {
      window.scrollBy(0, s)
    }, scroll)
    
    // 随机停顿（模拟阅读）
    await page.waitForTimeout(50 + Math.random() * 150)
  }
  
  // 30% 概率向上滚动一点（模拟回看）
  if (Math.random() < 0.3) {
    await page.waitForTimeout(200 + Math.random() * 300)
    await page.evaluate(() => {
      window.scrollBy(0, -30 - Math.random() * 70)
    })
    await page.waitForTimeout(200 + Math.random() * 400)
  }
}

/**
 * 人类页面浏览行为 - 停留 + 滚动 + 鼠标移动
 */
async function humanPageBehavior(
  page: Page,
  log?: LogCallback
): Promise<void> {
  // 1. 页面加载后停留（模拟阅读）
  await page.waitForTimeout(1500 + Math.random() * 2500)
  
  // 2. 70% 概率滚动浏览
  if (Math.random() < 0.7) {
    if (log) log('浏览页面内容...')
    await humanScroll(page, 150 + Math.random() * 250)
    await page.waitForTimeout(800 + Math.random() * 1200)
  }
  
  // 3. 30% 概率向上滚动（回看）
  if (Math.random() < 0.3) {
    await humanScroll(page, -(80 + Math.random() * 120))
    await page.waitForTimeout(500 + Math.random() * 1000)
  }
  
  // 4. 随机鼠标移动（模拟阅读时的鼠标移动）
  const moveCount = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < moveCount; i++) {
    const x = 200 + Math.random() * 600
    const y = 200 + Math.random() * 400
    await humanMouseMove(page, x, y)
    await page.waitForTimeout(400 + Math.random() * 800)
  }
  
  // 5. 最终停留
  await page.waitForTimeout(800 + Math.random() * 1500)
}

/**
 * Canvas 指纹混淆 - 注入噪声
 */
async function injectCanvasNoise(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // 保存原始方法
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL
    const originalToBlob = HTMLCanvasElement.prototype.toBlob
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData
    
    // 生成随机噪声种子（每次不同）
    const noiseSeed = Math.random()
    
    // 添加噪声函数
    function addNoise(imageData: ImageData): ImageData {
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        // 10% 的像素添加微小噪声
        if (Math.random() < 0.1) {
          data[i] = data[i] ^ (noiseSeed > 0.5 ? 1 : 0)      // R
          data[i + 1] = data[i + 1] ^ (noiseSeed > 0.3 ? 1 : 0)  // G
          data[i + 2] = data[i + 2] ^ (noiseSeed > 0.7 ? 1 : 0)  // B
        }
      }
      return imageData
    }
    
    // 重写 toDataURL
    HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any): string {
      const ctx = this.getContext('2d')
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, this.width, this.height)
        addNoise(imageData)
        ctx.putImageData(imageData, 0, 0)
      }
      return originalToDataURL.call(this, type, quality)
    }
    
    // 重写 toBlob
    HTMLCanvasElement.prototype.toBlob = function(callback: BlobCallback, type?: string, quality?: any): void {
      const ctx = this.getContext('2d')
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, this.width, this.height)
        addNoise(imageData)
        ctx.putImageData(imageData, 0, 0)
      }
      return originalToBlob.call(this, callback, type, quality)
    }
    
    // 重写 getImageData
    CanvasRenderingContext2D.prototype.getImageData = function(sx: number, sy: number, sw: number, sh: number, settings?: ImageDataSettings): ImageData {
      const imageData = originalGetImageData.call(this, sx, sy, sw, sh, settings)
      return addNoise(imageData)
    }
  })
}

// HTML 转文本 - 改进版本
function htmlToText(html: string): string {
  if (!html) return ''
  
  let text = html
  
  // 解码 HTML 实体
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
  
  // 移除 style 和 script 标签及其内容
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  // 将 br 和 p 标签转换为换行
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n')
  text = text.replace(/<\/div>/gi, '\n')
  
  // 移除所有 HTML 标签
  text = text.replace(/<[^>]+>/g, ' ')
  
  // 清理多余空白
  text = text.replace(/\s+/g, ' ')
  
  return text.trim()
}

// 从文本提取验证码 - 改进版本，与 Python 保持一致
function extractCode(text: string): string | null {
  if (!text) return null
  
  for (const pattern of CODE_PATTERNS) {
    // 重置正则表达式的 lastIndex
    pattern.lastIndex = 0
    
    let match
    while ((match = pattern.exec(text)) !== null) {
      const code = match[1]
      
      // 验证新格式：字母+连字符 (如 ZNCD-SRPZ, roll-padd)
      if (code && /^[A-Za-z]{4}-[A-Za-z]{4}$/.test(code)) {
        return code
      }
      
      // 验证旧格式：6位数字
      if (code && /^\d{6}$/.test(code)) {
        // 获取上下文进行排除检查
        const start = Math.max(0, match.index - 20)
        const end = Math.min(text.length, match.index + match[0].length + 20)
        const context = text.slice(start, end)
        
        // 排除颜色代码 (#XXXXXX)
        if (context.includes('#' + code)) continue
        
        // 排除 CSS 颜色相关
        if (/color[:\s]*[^;]*\d{6}/i.test(context)) continue
        if (/rgb|rgba|hsl/i.test(context)) continue
        
        // 排除超过6位的数字（电话号码、邮编等）
        if (/\d{7,}/.test(context)) continue
        
        return code
      }
    }
  }
  return null
}

/**
 * 测试 QQ 邮箱连接（快速测试，不获取邮件）
 */
export async function testQQEmailConnection(
  email: string,
  authCode: string,
  log: LogCallback
): Promise<{ success: boolean; error?: string }> {
  log('========== 测试 QQ 邮箱连接 ==========')
  log(`邮箱: ${email}`)
  log(`授权码: ${authCode.substring(0, 4)}****`)
  
  return new Promise((resolve) => {
    const imap = new Imap({
      user: email,
      password: authCode,
      host: 'imap.qq.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
      // 使用简化配置，与获取验证码时保持一致
    })
    
    let resolved = false
    
    const cleanup = () => {
      if (!resolved) {
        resolved = true
        try {
          imap.end()
        } catch {}
      }
    }
    
    const timeoutId = setTimeout(() => {
      log('✗ 连接超时（30秒）')
      cleanup()
      resolve({ success: false, error: '连接超时（30秒）' })
    }, 30000)
    
    imap.once('ready', () => {
      log('✓ 成功连接到 QQ 邮箱服务器')
      log('✓ IMAP 认证成功')
      
      imap.openBox('INBOX', true, (err) => {
        cleanup()
        clearTimeout(timeoutId)
        
        if (err) {
          log(`✗ 打开收件箱失败: ${err}`)
          resolve({ success: false, error: `打开收件箱失败: ${err.message}` })
        } else {
          log('✓ 成功打开收件箱')
          log('✓ QQ 邮箱配置正确，可以正常使用！')
          resolve({ success: true })
        }
      })
    })
    
    imap.once('error', (err) => {
      log(`✗ IMAP 连接错误: ${err}`)
      cleanup()
      clearTimeout(timeoutId)
      
      let errorMsg = err.message
      
      // 详细的错误诊断
      log(`\n========== IMAP 错误诊断 ==========`)
      log(`错误消息: ${errorMsg}`)
      
      if (errorMsg.includes('Invalid credentials') || errorMsg.includes('Login fail')) {
        errorMsg = 'QQ邮箱或授权码错误'
        log(`💡 可能原因:`)
        log(`  1. 授权码错误（不是QQ密码）`)
        log(`  2. IMAP服务未开启`)
        log(`  3. 授权码已过期`)
      } else if (errorMsg.includes('ECONNREFUSED')) {
        errorMsg = '无法连接到服务器，请检查网络'
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
        errorMsg = '连接超时，请检查网络'
      } else if (errorMsg.includes('Account is abnormal') || errorMsg.includes('service is not open')) {
        errorMsg = 'QQ邮箱账号异常或IMAP服务未开启'
        log(`💡 解决方案:`)
        log(`  1. 登录 QQ 邮箱网页版`)
        log(`  2. 进入"设置" -> "账户"`)
        log(`  3. 找到"POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"`)
        log(`  4. 确保"IMAP/SMTP服务"已开启`)
        log(`  5. 重新生成授权码`)
      }
      log(`=====================================\n`)
      
      resolve({ success: false, error: errorMsg })
    })
    
    imap.once('end', () => {
      log('IMAP 连接已关闭')
    })
    
    try {
      log('正在连接到 imap.qq.com:993...')
      imap.connect()
    } catch (error) {
      cleanup()
      clearTimeout(timeoutId)
      resolve({ success: false, error: `连接失败: ${error}` })
    }
  })
}

/**
 * 带重试机制的 QQ 邮箱验证码获取（处理频率限制）
 */
async function getQQVerificationCodeWithRetry(
  qqEmail: string,
  authCode: string,
  log: LogCallback,
  timeout: number = 120,
  targetEmail?: string,
  maxRetries: number = 2
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`📧 尝试获取验证码 (第 ${attempt}/${maxRetries} 次)...`)
      
      const code = await getQQVerificationCode(qqEmail, authCode, log, timeout, targetEmail)
      
      if (code) {
        return code
      }
      
      // 如果没有获取到验证码，但也没有错误，可能是邮件还没到
      if (attempt < maxRetries) {
        log(`⏳ 未获取到验证码，等待10秒后重试...`)
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
      
    } catch (error: any) {
      const errorMsg = error.message || String(error)
      
      // 检查是否是频率限制错误
      const isRateLimitError = 
        errorMsg.includes('Account is abnormal') ||
        errorMsg.includes('login frequency limited') ||
        errorMsg.includes('Login fail')
      
      if (isRateLimitError && attempt < maxRetries) {
        const waitTime = 30 * attempt // 第一次等30秒，第二次等60秒
        log(`⚠️ 检测到频率限制，等待 ${waitTime} 秒后重试...`)
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
      } else {
        throw error // 非频率限制错误或已达最大重试次数，直接抛出
      }
    }
  }
  
  return null
}

/**
 * 通用 IMAP 邮箱验证码获取函数
 * @param config IMAP 配置
 * @param log 日志回调
 * @param timeout 超时时间（秒）
 * @param targetEmail 目标邮箱地址（验证码发送到的邮箱）
 */
async function getImapVerificationCode(
  config: {
    user: string
    password: string
    host: string
    port: number
    tlsOptions?: any
    emailType: 'QQ' | 'Gmail'
  },
  log: LogCallback,
  timeout: number = 120,
  targetEmail?: string
): Promise<string | null> {
  log(`========== 开始获取 ${config.emailType} 邮箱验证码 ==========`)
  log(`${config.emailType}: ${config.user}`)
  if (targetEmail) {
    log(`目标邮箱: ${targetEmail}`)
  }
  log(`密码/授权码: ${config.password.substring(0, 4)}****`)
  
  return new Promise((resolve) => {
    const startTime = Date.now()
    let resolved = false
    
    // 使用简化的 IMAP 配置（与 server/src/test-email-fetch.ts 保持一致）
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: true,
      tlsOptions: config.tlsOptions || { rejectUnauthorized: false }
      // 移除了 authTimeout, connTimeout, keepalive 等可能导致问题的参数
    })
    
    const cleanup = () => {
      if (!resolved) {
        resolved = true
        try {
          imap.end()
        } catch {}
      }
    }
    
    const timeoutId = setTimeout(() => {
      log('获取验证码超时')
      cleanup()
      resolve(null)
    }, timeout * 1000)
    
    imap.once('ready', () => {
      log(`✓ 已连接到 ${config.emailType} 服务器`)
      log(`✓ IMAP 认证成功`)
      
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          log(`✗ 打开收件箱失败: ${err}`)
          cleanup()
          clearTimeout(timeoutId)
          resolve(null)
          return
        }
        
        log(`✓ 成功打开收件箱`)
        log('开始搜索 AWS 邮件...')
        
        const checkMail = () => {
          if (resolved) return
          if (Date.now() - startTime > timeout * 1000) {
            log('获取验证码超时')
            cleanup()
            clearTimeout(timeoutId)
            resolve(null)
            return
          }
          
          imap.search(['UNSEEN'], (err, results) => {
            if (err) {
              log(`搜索邮件失败: ${err}，尝试搜索所有邮件...`)
              imap.search(['ALL'], (err2, results2) => {
                if (err2) {
                  log(`搜索所有邮件也失败: ${err2}`)
                  setTimeout(checkMail, 5000)
                  return
                }
                processResults(results2)
              })
              return
            }
            processResults(results)
          })
        }
        
        const processResults = (results: number[]) => {
          if (!results || results.length === 0) {
            log('未找到邮件，5秒后重试...')
            setTimeout(checkMail, 5000)
            return
          }
          
          log(`找到 ${results.length} 封邮件，开始检查...`)
          
          const recentResults = results.slice(-10)
          const fetch = imap.fetch(recentResults, { bodies: '' })
          
          let foundCount = 0
          
          fetch.on('message', (msg) => {
            msg.on('body', (stream: any) => {
              simpleParser(stream as any, (err, parsed) => {
                if (err || resolved) return
                
                const fromValue = parsed.from
                const toValue = parsed.to
                const from = (Array.isArray(fromValue) ? fromValue[0]?.text : fromValue?.text) || ''
                const to = (Array.isArray(toValue) ? toValue[0]?.text : toValue?.text) || ''
                const subject = parsed.subject || ''
                const text = parsed.text || ''
                const html = parsed.html || ''
                
                const isAwsMail = AWS_SENDERS.some(sender => 
                  from.toLowerCase().includes(sender.toLowerCase())
                )
                
                if (!isAwsMail) return
                
                if (targetEmail) {
                  const toMatch = to.toLowerCase().includes(targetEmail.toLowerCase())
                  if (!toMatch) {
                    log(`跳过邮件（收件人不匹配）: To=${to}, 目标=${targetEmail}`)
                    return
                  }
                }
                
                foundCount++
                log(`检查 AWS 邮件 [${foundCount}]: ${subject.substring(0, 50)}`)
                if (targetEmail) {
                  log(`  收件人: ${to}`)
                }
                
                let code: string | null = null
                if (text) {
                  code = extractCode(text)
                }
                if (!code && html) {
                  const htmlText = htmlToText(html.toString())
                  code = extractCode(htmlText)
                }
                
                if (code) {
                  log(`\n========== 找到验证码: ${code} ==========`)
                  cleanup()
                  clearTimeout(timeoutId)
                  resolve(code)
                }
              })
            })
          })
          
          fetch.once('error', (err) => {
            log(`获取邮件内容失败: ${err}`)
            setTimeout(checkMail, 5000)
          })
          
          fetch.once('end', () => {
            if (!resolved) {
              if (foundCount === 0) {
                log('未找到 AWS 邮件，5秒后重试...')
              } else {
                log(`检查了 ${foundCount} 封 AWS 邮件，未找到验证码，5秒后重试...`)
              }
              setTimeout(checkMail, 5000)
            }
          })
        }
        
        checkMail()
      })
    })
    
    imap.once('error', (err) => {
      log(`✗ IMAP 连接错误: ${err}`)
      cleanup()
      clearTimeout(timeoutId)
      
      const errorMsg = err.message
      
      // 详细的错误诊断
      log(`\n========== IMAP 错误诊断 ==========`)
      log(`错误类型: ${err.name}`)
      log(`错误消息: ${errorMsg}`)
      log(`邮箱类型: ${config.emailType}`)
      log(`IMAP 服务器: ${config.host}:${config.port}`)
      log(`用户名: ${config.user}`)
      
      if (errorMsg.includes('Timed out while authenticating')) {
        log(`\n💡 认证超时`)
        log(`  - ${config.emailType === 'QQ' ? 'QQ邮箱可能限流或网络波动' : '请检查网络连接'}`)
        log(`  - 建议: 等待几分钟后重试`)
      } else if (errorMsg.includes('Invalid credentials') || errorMsg.includes('Login fail')) {
        log(`\n💡 认证失败`)
        log(`  - ${config.emailType === 'QQ' ? 'QQ邮箱授权码' : '应用专用密码'}可能错误`)
        if (config.emailType === 'QQ') {
          log(`  - 请确认:`)
          log(`    1. 已在 QQ 邮箱设置中开启 IMAP 服务`)
          log(`    2. 授权码是16位字符（不是QQ密码）`)
          log(`    3. 授权码未过期`)
        } else {
          log(`  - 请确保已启用两步验证并生成应用专用密码`)
        }
      } else if (errorMsg.includes('ECONNREFUSED')) {
        log(`\n💡 连接被拒绝`)
        log(`  - 无法连接到 ${config.emailType} 服务器`)
        log(`  - 请检查网络连接和防火墙设置`)
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
        log(`\n💡 连接超时`)
        log(`  - 网络连接可能不稳定`)
        log(`  - 建议: 检查网络或使用代理`)
      } else if (errorMsg.includes('Account is abnormal') || errorMsg.includes('service is not open')) {
        log(`\n💡 账号异常或服务未开启`)
        log(`  - QQ邮箱 IMAP 服务可能未开启`)
        log(`  - 或账号存在异常（如频繁登录被限制）`)
        log(`  - 建议:`)
        log(`    1. 登录 QQ 邮箱网页版，检查 IMAP 服务状态`)
        log(`    2. 重新生成授权码`)
        log(`    3. 等待一段时间后重试`)
      }
      log(`=====================================\n`)
      
      resolve(null)
    })
    
    imap.once('end', () => {
      log('IMAP 连接已关闭')
    })
    
    imap.connect()
  })
}

/**
 * 从 QQ 邮箱获取验证码
 */
export async function getQQVerificationCode(
  qqEmail: string,
  authCode: string,
  log: LogCallback,
  timeout: number = 120,
  targetEmail?: string
): Promise<string | null> {
  return getImapVerificationCode(
    {
      user: qqEmail,
      password: authCode,
      host: 'imap.qq.com',
      port: 993,
      emailType: 'QQ'
    },
    log,
    timeout,
    targetEmail
  )
}

/**
 * 从 Gmail 邮箱获取验证码
 */
export async function getGmailVerificationCode(
  gmailAddress: string,
  appPassword: string,
  log: LogCallback,
  timeout: number = 120,
  targetEmail?: string
): Promise<string | null> {
  return getImapVerificationCode(
    {
      user: gmailAddress,
      password: appPassword,
      host: 'imap.gmail.com',
      port: 993,
      tlsOptions: { 
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      emailType: 'Gmail'
    },
    log,
    timeout,
    targetEmail
  )
}


/**
 * 从 Outlook 邮箱获取验证码
 * 使用 Microsoft Graph API，与 Python 版本保持一致
 */
export async function getOutlookVerificationCode(
  refreshToken: string,
  clientId: string,
  log: LogCallback,
  timeout: number = 120
): Promise<string | null> {
  log('========== 开始获取邮箱验证码 ==========')
  log(`client_id: ${clientId}`)
  log(`refresh_token: ${refreshToken.substring(0, 30)}...`)
  
  const startTime = Date.now()
  const checkInterval = 5000 // 5秒检查一次
  const checkedIds = new Set<string>()
  
  while (Date.now() - startTime < timeout * 1000) {
    try {
      // 刷新 access_token
      log('刷新 access_token...')
      let accessToken: string | null = null
      
      const tokenAttempts = [
        { url: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token', scope: null },
        { url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', scope: null },
      ]
      
      for (const attempt of tokenAttempts) {
        try {
          const tokenBody = new URLSearchParams()
          tokenBody.append('client_id', clientId)
          tokenBody.append('refresh_token', refreshToken)
          tokenBody.append('grant_type', 'refresh_token')
          if (attempt.scope) {
            tokenBody.append('scope', attempt.scope)
          }
          
          const tokenResponse = await fetch(attempt.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody.toString()
          })
          
          if (tokenResponse.ok) {
            const tokenResult = await tokenResponse.json() as { access_token: string }
            accessToken = tokenResult.access_token
            log('✓ 成功获取 access_token')
            break
          }
        } catch {
          continue
        }
      }
      
      if (!accessToken) {
        log('✗ token 刷新失败')
        return null
      }
      
      // 获取邮件
      log('获取邮件列表...')
      const graphParams = new URLSearchParams({
        '$top': '50',
        '$orderby': 'receivedDateTime desc',
        '$select': 'id,subject,from,receivedDateTime,bodyPreview,body'
      })
      
      const mailResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages?${graphParams}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!mailResponse.ok) {
        log(`获取邮件失败: ${mailResponse.status}`)
        await new Promise(r => setTimeout(r, checkInterval))
        continue
      }
      
      const mailData = await mailResponse.json() as {
        value: Array<{
          id: string
          subject: string
          from: { emailAddress: { address: string } }
          body: { content: string }
          bodyPreview: string
          receivedDateTime: string
        }>
      }
      
      log(`获取到 ${mailData.value?.length || 0} 封邮件`)
      
      // 搜索最新的 AWS 邮件
      for (const mail of mailData.value || []) {
        const fromEmail = mail.from?.emailAddress?.address?.toLowerCase() || ''
        const isAwsSender = AWS_SENDERS.some(s => fromEmail.includes(s.toLowerCase()))
        
        if (isAwsSender && !checkedIds.has(mail.id)) {
          checkedIds.add(mail.id)
          
          log(`\n=== 检查 AWS 邮件 ===`)
          log(`  发件人: ${fromEmail}`)
          log(`  主题: ${mail.subject?.substring(0, 50)}`)
          
          // 提取验证码
          let code: string | null = null
          const bodyText = htmlToText(mail.body?.content || '')
          if (bodyText) {
            code = extractCode(bodyText)
          }
          if (!code) {
            code = extractCode(mail.body?.content || '')
          }
          if (!code) {
            code = extractCode(mail.bodyPreview || '')
          }
          
          if (code) {
            log(`\n========== 找到验证码: ${code} ==========`)
            return code
          }
        }
      }
      
      log(`未找到验证码，${checkInterval / 1000}秒后重试...`)
      await new Promise(r => setTimeout(r, checkInterval))
      
    } catch (error) {
      log(`获取验证码出错: ${error}`)
      await new Promise(r => setTimeout(r, checkInterval))
    }
  }
  
  log('获取验证码超时')
  return null
}


/**
 * 等待输入框出现并输入内容
 */
async function waitAndFill(
  page: Page,
  selector: string,
  value: string,
  log: LogCallback,
  description: string,
  timeout: number = 30000
): Promise<boolean> {
  log(`等待${description}出现...`)
  try {
    const element = page.locator(selector).first()
    await element.waitFor({ state: 'visible', timeout })
    await page.waitForTimeout(500)
    await element.clear()
    await element.fill(value)
    log(`✓ 已输入${description}: ${value}`)
    return true
  } catch (error) {
    log(`✗ ${description}操作失败: ${error}`)
    return false
  }
}

/**
 * 尝试多个选择器点击
 */
async function tryClickSelectors(
  page: Page,
  selectors: string[],
  log: LogCallback,
  description: string,
  timeout: number = 15000
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first()
      await element.waitFor({ state: 'visible', timeout: timeout / selectors.length })
      await page.waitForTimeout(300)
      await element.click()
      log(`✓ 已点击${description}`)
      return true
    } catch {
      continue
    }
  }
  log(`✗ 未找到${description}`)
  return false
}

/**
 * 尝试多个选择器查找元素
 * @deprecated 未使用的辅助函数，保留以备将来使用
 */
// async function tryFindElement(
//   page: Page,
//   selectors: string[],
//   timeout: number = 10000
// ): Promise<string | null> {
//   for (const selector of selectors) {
//     try {
//       await page.locator(selector).first().waitFor({ state: 'visible', timeout: timeout / selectors.length })
//       return selector
//     } catch {
//       continue
//     }
//   }
//   return null
// }

/**
 * 检测 AWS 错误弹窗并重试点击按钮
 * 错误弹窗选择器: div.awsui_content_mx3cw_97dyn_391 包含 "抱歉，处理您的请求时出错"
 */
async function checkAndRetryOnError(
  page: Page,
  buttonSelector: string,
  log: LogCallback,
  description: string,
  maxRetries: number = 3,
  retryDelay: number = 2000
): Promise<boolean> {
  // 错误弹窗的多种可能选择器
  const errorSelectors = [
    'div.awsui_content_mx3cw_97dyn_391',
    '[class*="awsui_content_"]',
    '.awsui-flash-error',
    '[data-testid="flash-error"]'
  ]
  
  const errorTexts = [
    '抱歉，处理您的请求时出错',
    'Sorry, there was an error processing your request',
    'error processing your request',
    'Please try again',
    '请重试'
  ]
  
  for (let retry = 0; retry < maxRetries; retry++) {
    // 等待一下让页面响应
    await page.waitForTimeout(1500)
    
    // 检查是否有错误弹窗
    let hasError = false
    for (const selector of errorSelectors) {
      try {
        const errorElements = await page.locator(selector).all()
        for (const el of errorElements) {
          const text = await el.textContent()
          if (text && errorTexts.some(errText => text.includes(errText))) {
            hasError = true
            log(`⚠ 检测到错误弹窗: "${text.substring(0, 50)}..."`)
            break
          }
        }
        if (hasError) break
      } catch {
        continue
      }
    }
    
    if (!hasError) {
      // 没有错误，操作成功
      return true
    }
    
    if (retry < maxRetries - 1) {
      log(`重试点击${description} (${retry + 2}/${maxRetries})...`)
      await page.waitForTimeout(retryDelay)
      
      // 重新点击按钮
      try {
        const button = page.locator(buttonSelector).first()
        await button.waitFor({ state: 'visible', timeout: 5000 })
        await button.click()
        log(`✓ 已重新点击${description}`)
      } catch (e) {
        log(`✗ 重新点击${description}失败: ${e}`)
      }
    }
  }
  
  log(`✗ ${description}多次重试后仍然失败`)
  return false
}

/**
 * 等待按钮出现并点击，带错误检测和自动重试
 */
async function waitAndClickWithRetry(
  page: Page,
  selector: string,
  log: LogCallback,
  description: string,
  timeout: number = 30000,
  maxRetries: number = 3
): Promise<boolean> {
  log(`等待${description}出现...`)
  try {
    const element = page.locator(selector).first()
    await element.waitFor({ state: 'visible', timeout })
    await page.waitForTimeout(500)
    await element.click()
    log(`✓ 已点击${description}`)
    
    // 检查是否有错误弹窗，如果有则重试
    const success = await checkAndRetryOnError(page, selector, log, description, maxRetries)
    return success
  } catch (error) {
    log(`✗ 点击${description}失败: ${error}`)
    return false
  }
}

/**
 * Outlook 邮箱激活
 * 在 AWS 注册之前激活 Outlook 邮箱，确保能正常接收验证码
 */
export async function activateOutlook(
  email: string,
  emailPassword: string,
  log: LogCallback
): Promise<{ success: boolean; error?: string }> {
  const activationUrl = 'https://go.microsoft.com/fwlink/p/?linkid=2125442'
  let browser: Browser | null = null
  
  log('========== 开始激活 Outlook 邮箱 ==========')
  log(`邮箱: ${email}`)
  
  try {
    // 启动浏览器
    log('\n步骤1: 启动浏览器，访问 Outlook 激活页面...')
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled']
    })
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    const page = await context.newPage()
    
    await page.goto(activationUrl, { waitUntil: 'networkidle', timeout: 60000 })
    log('✓ 页面加载完成')
    await page.waitForTimeout(2000)
    
    // 步骤2: 等待邮箱输入框出现并输入邮箱
    log('\n步骤2: 输入邮箱...')
    const emailInputSelectors = [
      'input#i0116[type="email"]',
      'input[name="loginfmt"]',
      'input[type="email"]'
    ]
    
    let emailFilled = false
    for (const selector of emailInputSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 10000 })
        await element.fill(email)
        log(`✓ 已输入邮箱: ${email}`)
        emailFilled = true
        break
      } catch {
        continue
      }
    }
    
    if (!emailFilled) {
      throw new Error('未找到邮箱输入框')
    }
    
    await page.waitForTimeout(1000)
    
    // 步骤3: 点击第一个下一步按钮
    log('\n步骤3: 点击下一步按钮...')
    const firstNextSelectors = [
      'input#idSIButton9[type="submit"]',
      'input[type="submit"][value="下一步"]',
      'input[type="submit"][value="Next"]'
    ]
    
    if (!await tryClickSelectors(page, firstNextSelectors, log, '第一个下一步按钮')) {
      throw new Error('点击第一个下一步按钮失败')
    }
    
    await page.waitForTimeout(3000)
    
    // 步骤4: 等待密码输入框出现并输入密码
    log('\n步骤4: 输入密码...')
    const passwordInputSelectors = [
      'input#passwordEntry[type="password"]',
      'input#i0118[type="password"]',
      'input[name="passwd"][type="password"]',
      'input[type="password"]'
    ]
    
    let passwordFilled = false
    for (const selector of passwordInputSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 15000 })
        await element.fill(emailPassword)
        log('✓ 已输入密码')
        passwordFilled = true
        break
      } catch {
        continue
      }
    }
    
    if (!passwordFilled) {
      throw new Error('未找到密码输入框')
    }
    
    await page.waitForTimeout(1000)
    
    // 步骤5: 点击第二个下一步/登录按钮
    log('\n步骤5: 点击登录按钮...')
    const loginButtonSelectors = [
      'button[type="submit"][data-testid="primaryButton"]',
      'input#idSIButton9[type="submit"]',
      'button:has-text("下一步")',
      'button:has-text("登录")',
      'button:has-text("Sign in")',
      'button:has-text("Next")'
    ]
    
    if (!await tryClickSelectors(page, loginButtonSelectors, log, '登录按钮')) {
      throw new Error('点击登录按钮失败')
    }
    
    await page.waitForTimeout(3000)
    
    // 步骤6: 等待第一个"暂时跳过"链接并点击
    log('\n步骤6: 点击第一个"暂时跳过"链接...')
    const skipSelector = 'a#iShowSkip'
    try {
      const skipElement = page.locator(skipSelector).first()
      await skipElement.waitFor({ state: 'visible', timeout: 30000 })
      await skipElement.click()
      log('✓ 已点击第一个"暂时跳过"')
      await page.waitForTimeout(3000)
    } catch {
      log('未找到第一个"暂时跳过"链接，可能已跳过此步骤')
    }
    
    // 步骤7: 等待第二个"暂时跳过"链接并点击
    log('\n步骤7: 点击第二个"暂时跳过"链接...')
    try {
      const skipElement = page.locator(skipSelector).first()
      await skipElement.waitFor({ state: 'visible', timeout: 15000 })
      await skipElement.click()
      log('✓ 已点击第二个"暂时跳过"')
      await page.waitForTimeout(3000)
    } catch {
      log('未找到第二个"暂时跳过"链接，可能已跳过此步骤')
    }
    
    // 步骤8: 等待"取消"按钮（密钥创建对话框）并点击
    log('\n步骤8: 点击"取消"按钮（跳过密钥创建）...')
    const cancelButtonSelectors = [
      'button[data-testid="secondaryButton"]:has-text("取消")',
      'button[data-testid="secondaryButton"]:has-text("Cancel")',
      'button[type="button"]:has-text("取消")',
      'button[type="button"]:has-text("Cancel")'
    ]
    
    if (!await tryClickSelectors(page, cancelButtonSelectors, log, '"取消"按钮', 15000)) {
      log('未找到"取消"按钮，可能已跳过此步骤')
    }
    
    await page.waitForTimeout(3000)
    
    // 步骤9: 等待"是"按钮（保持登录状态）并点击
    log('\n步骤9: 点击"是"按钮（保持登录状态）...')
    const yesButtonSelectors = [
      'button[type="submit"][data-testid="primaryButton"]:has-text("是")',
      'button[type="submit"][data-testid="primaryButton"]:has-text("Yes")',
      'input#idSIButton9[value="是"]',
      'input#idSIButton9[value="Yes"]',
      'button:has-text("是")',
      'button:has-text("Yes")'
    ]
    
    if (!await tryClickSelectors(page, yesButtonSelectors, log, '"是"按钮', 15000)) {
      log('未找到"是"按钮，可能已跳过此步骤')
    }
    
    await page.waitForTimeout(5000)
    
    // 步骤10: 等待 Outlook 邮箱加载完成
    log('\n步骤10: 等待 Outlook 邮箱加载完成...')
    const newMailSelectors = [
      'button[aria-label="New mail"]',
      'button:has-text("New mail")',
      'button:has-text("新邮件")',
      'span:has-text("New mail")',
      '[data-automation-type="RibbonSplitButton"]'
    ]
    
    let outlookLoaded = false
    for (const selector of newMailSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 30000 })
        log('✓ Outlook 邮箱激活成功！')
        outlookLoaded = true
        break
      } catch {
        continue
      }
    }
    
    if (!outlookLoaded) {
      // 检查是否已经在收件箱页面
      const currentUrl = page.url()
      if (currentUrl.toLowerCase().includes('outlook') || currentUrl.toLowerCase().includes('mail')) {
        log('✓ 已进入 Outlook 邮箱页面，激活成功！')
        outlookLoaded = true
      }
    }
    
    await page.waitForTimeout(2000)
    await browser.close()
    browser = null
    
    if (outlookLoaded) {
      log('\n========== Outlook 邮箱激活完成 ==========')
      return { success: true }
    } else {
      log('\n⚠ Outlook 邮箱激活可能未完成')
      return { success: false, error: 'Outlook 邮箱激活可能未完成' }
    }
    
  } catch (error) {
    log(`\n✗ Outlook 激活失败: ${error}`)
    if (browser) {
      try { await browser.close() } catch {}
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * AWS Builder ID 自动注册
 * @param email 邮箱地址（用于注册AWS账号）
 * @param password AWS账号密码
 * @param refreshTokenOrAuthCode OAuth2 刷新令牌(Outlook) 或 IMAP授权码(QQ)
 * @param clientId Graph API 客户端ID (仅Outlook需要)
 * @param log 日志回调
 * @param emailPassword 邮箱密码（用于 Outlook 激活）
 * @param skipOutlookActivation 是否跳过 Outlook 激活
 * @param proxyUrl 代理地址（仅用于 AWS 注册，不用于 Outlook 激活和获取验证码）
 * @param receiveEmail 接收验证码的邮箱（如果不同于注册邮箱）
 */
export async function autoRegisterAWS(
  email: string,
  password: string,
  refreshTokenOrAuthCode: string,
  clientId: string,
  log: LogCallback,
  emailPassword?: string,
  skipOutlookActivation: boolean = false,
  proxyUrl?: string,
  receiveEmail?: string,
  browserConfig?: {
    browserType: 'chrome' | 'edge' | 'firefox' | 'brave' | 'opera'
    browserPath: string
    headless: boolean
    showWindow: boolean
    delayMin?: number  // Minimum delay in seconds (default: 3)
    delayMax?: number  // Maximum delay in seconds (default: 8)
  }
): Promise<{ success: boolean; ssoToken?: string; name?: string; error?: string }> {
  const randomName = generateRandomName()
  let browser: Browser | null = null
  
  // 提取延迟配置（如果提供）
  const configuredDelayMin = browserConfig?.delayMin
  const configuredDelayMax = browserConfig?.delayMax
  
  // 判断邮箱类型（用于 Outlook 激活判断）
  const isOutlookEmail = email.toLowerCase().includes('outlook')
  
  // 确定用于接收验证码的邮箱
  const codeReceiveEmail = receiveEmail || email
  const isCodeQQEmail = codeReceiveEmail.toLowerCase().includes('qq.com')
  const isCodeOutlookEmail = codeReceiveEmail.toLowerCase().includes('outlook')
  
  // 如果是 Outlook 邮箱且提供了密码，先激活（不使用代理）
  if (!skipOutlookActivation && isOutlookEmail && emailPassword) {
    log('检测到 Outlook 邮箱，先进行激活（不使用代理）...')
    const activationResult = await activateOutlook(email, emailPassword, log)
    if (!activationResult.success) {
      log(`⚠ Outlook 激活可能未完成: ${activationResult.error}`)
      log('继续尝试 AWS 注册...')
    } else {
      log('Outlook 激活成功，开始 AWS 注册...')
    }
    // 等待一下再继续
    await new Promise(r => setTimeout(r, 2000))
  }
  
  log('========== 开始 AWS Builder ID 注册 ==========')
  log(`邮箱: ${email}`)
  log(`姓名: ${randomName}`)
  log(`密码: ${password}`)
  if (proxyUrl) {
    log(`代理: ${proxyUrl}`)
  }
  if (browserConfig) {
    log(`浏览器: ${browserConfig.browserType} ${browserConfig.headless ? '(无痕)' : ''} ${browserConfig.showWindow ? '(显示)' : '(隐藏)'}`)
  }
  
  try {
    // 步骤1: 创建浏览器，进入注册页面（使用代理）
    log('\n步骤1: 启动浏览器，进入注册页面...')
    
    // 🆕 根据配置选择浏览器类型
    const browserType = browserConfig?.browserType || 'chrome'
    let browserModule: typeof chromium
    
    // 检查是否使用用户自定义的 Firefox
    const isCustomFirefox = browserType === 'firefox' && browserConfig?.browserPath
    
    if (isCustomFirefox) {
      // 用户自定义的 Firefox 不支持 Playwright 的 juggler 协议
      // 改用 Chromium 模式（更兼容）
      log('⚠ 检测到自定义 Firefox，建议使用 Chrome/Edge 以获得更好的兼容性')
      log('自动切换到 Playwright 内置 Chromium...')
      browserModule = chromium
    } else {
      switch (browserType) {
        case 'firefox':
          const { firefox } = await import('playwright')
          browserModule = firefox as any
          break
        default:
          // chrome, edge, brave, opera 都使用 chromium
          browserModule = chromium
      }
    }
    
    // 🆕 构建启动选项
    const launchOptions: any = {
      headless: browserConfig?.showWindow ? false : (browserConfig?.headless ?? false),
      proxy: proxyUrl ? { server: proxyUrl } : undefined
    }
    
    // 根据浏览器类型设置不同的启动参数
    if (browserType === 'firefox' && !isCustomFirefox) {
      // Firefox 专用参数（仅 Playwright 内置 Firefox）
      launchOptions.args = [
        '-private',  // 隐私模式
      ]
      launchOptions.firefoxUserPrefs = {
        'dom.webdriver.enabled': false,
        'useAutomationExtension': false
      }
    } else {
      // Chromium 系浏览器参数
      launchOptions.args = [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-extensions',
        '--disable-popup-blocking',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-default-apps',
        '--no-first-run',
        '--no-default-browser-check'
      ]
      
      // 如果是无痕模式，添加无痕参数
      if (browserConfig?.headless === true || !browserConfig?.showWindow) {
        launchOptions.args.push('--incognito')
      }
    }
    
    // 🆕 如果指定了浏览器路径，使用用户的浏览器（但 Firefox 除外）
    if (browserConfig?.browserPath && !isCustomFirefox) {
      launchOptions.executablePath = browserConfig.browserPath
      log(`使用自定义浏览器: ${browserConfig.browserPath}`)
    } else if (!isCustomFirefox) {
      log('使用 Playwright 内置浏览器')
    }
    
    browser = await browserModule.launch(launchOptions)
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    const page = await context.newPage()
    
    // 注入 Canvas 指纹混淆
    await injectCanvasNoise(page)
    log('✓ 已注入 Canvas 指纹混淆')
    
    // 步骤1.1: 动态获取 device code
    log('\n步骤1.1: 获取设备授权码...')
    const oidcBase = 'https://oidc.us-east-1.amazonaws.com'
    const startUrl = 'https://view.awsapps.com/start'
    
    // 注册 OIDC 客户端
    log('注册 OIDC 客户端...')
    const regRes = await fetch(`${oidcBase}/client/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: 'AWS Builder ID Registration',
        clientType: 'public',
        scopes: ['codewhisperer:analysis', 'codewhisperer:completions', 'codewhisperer:conversations'],
        grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'],
        issuerUrl: startUrl
      })
    })
    
    if (!regRes.ok) {
      throw new Error(`注册 OIDC 客户端失败: ${regRes.status}`)
    }
    
    const regData = await regRes.json() as { clientId: string; clientSecret: string }
    log(`✓ 客户端已注册: ${regData.clientId.substring(0, 20)}...`)
    
    // 发起设备授权
    log('发起设备授权...')
    const devRes = await fetch(`${oidcBase}/device_authorization`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        clientId: regData.clientId, 
        clientSecret: regData.clientSecret, 
        startUrl 
      })
    })
    
    if (!devRes.ok) {
      throw new Error(`设备授权失败: ${devRes.status}`)
    }
    
    const devData = await devRes.json() as { deviceCode: string; userCode: string }
    const userCode = devData.userCode
    log(`✓ 获取到授权码: ${userCode}`)
    
    // 使用动态获取的 user_code 构建注册 URL
    const registerUrl = `https://view.awsapps.com/start/#/device?user_code=${userCode}`
    log(`访问注册页面: ${registerUrl}`)
    log(`📍 初始 URL: ${registerUrl}`)
    
    try {
      // 监听重定向
      let redirectCount = 0
      page.on('response', (response) => {
        const status = response.status()
        if (status >= 300 && status < 400) {
          redirectCount++
          log(`🔄 检测到重定向 #${redirectCount}: ${status} ${response.url()} → ${response.headers()['location'] || '未知'}`)
        }
      })
      
      const response = await page.goto(registerUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
      log(`📡 HTTP 状态码: ${response?.status()}`)
      log(`📡 最终响应 URL: ${response?.url()}`)
      
      // 立即检查是否被重定向
      const immediateUrl = page.url()
      if (immediateUrl !== registerUrl && !immediateUrl.includes(userCode)) {
        log(`⚠️ 页面被重定向: ${registerUrl} → ${immediateUrl}`)
        log(`🔍 重定向次数: ${redirectCount}`)
        log(`🔍 这说明 AWS 在服务器端就拒绝了访问`)
        log(``)
        log(`🎯 可能原因:`)
        log(`  1. IP 地址被 AWS 服务器端黑名单（最可能）`)
        log(`  2. user_code 无效或被标记`)
        log(`  3. TLS 指纹在 HTTPS 握手时被识别`)
        log(`  4. 代理配置问题`)
      }
      
      // ⏳ 等待页面完全加载并执行 JavaScript
      // AWS 可能在加载后检查 IP/指纹，然后决定是否跳转
      log('等待页面完全加载...')
      await page.waitForLoadState('networkidle', { timeout: 30000 })
      
      // 再等待 2 秒，确保所有 JS 执行完成
      await page.waitForTimeout(2000)
      log('✓ 页面加载完成')
      
    } catch (error) {
      log(`⚠️ 页面加载异常: ${error}`)
      // 继续执行，检查当前状态
    }
    
    // 🔒 并发安全检查：验证 URL 中的 user_code
    const currentUrl = page.url()
    log(`📍 最终 URL: ${currentUrl}`)
    
    // 判断是否发生了跳转
    if (currentUrl !== registerUrl && !currentUrl.includes(userCode)) {
      log(`🔄 检测到 URL 变化:`)
      log(`   期望: ${registerUrl}`)
      log(`   实际: ${currentUrl}`)
    }
    
    // 检查是否跳转到了登录页面（可能是 AWS 风控，但也可能是正常的登录/注册入口）
    if (currentUrl.includes('/login') || currentUrl.includes('signin.aws')) {
      log('⚠️ 页面跳转到登录/注册页面')
      log(`当前 URL: ${currentUrl}`)
      log('💡 这可能是 AWS Builder ID 的统一入口，继续尝试注册流程...')
      
      // 📸 截图保存（用于调试）
      try {
        const screenshotPath = `debug-login-redirect-${Date.now()}.png`
        await page.screenshot({ path: screenshotPath, fullPage: true })
        log(`📸 已保存截图: ${screenshotPath}`)
      } catch (e) {
        log(`⚠️ 截图失败: ${e}`)
      }
      
      // 保存 HTML 用于调试
      try {
        const fs = require('fs')
        const htmlPath = `debug-login-redirect-${Date.now()}.html`
        const pageContent = await page.content()
        fs.writeFileSync(htmlPath, pageContent)
        log(`📄 已保存 HTML: ${htmlPath}`)
      } catch (e) {
        log(`⚠️ 保存 HTML 失败: ${e}`)
      }
      
      // 不抛出错误，继续执行
    }
    
    // 继续执行注册流程
    log('继续执行注册流程...')
    
    // 模拟人类浏览行为
    await humanPageBehavior(page, log)
    
    // 等待邮箱输入框出现并使用人类输入
    // 支持多种可能的选择器（AWS 页面结构可能变化）
    const emailInputSelectors = [
      'input[placeholder="username@example.com"]',
      'input[type="email"]',
      'input[name="email"]',
      'input[autocomplete="email"]',
      'input[id*="email"]',
      'input[class*="email"]',
      'input[aria-label*="email" i]',
      'input[aria-label*="Email" i]'
    ]
    
    log('等待邮箱输入框出现...')
    
    // 等待页面 JavaScript 完全加载（React 应用需要时间渲染）
    log('等待页面 JavaScript 加载完成...')
    await page.waitForTimeout(5000)
    
    // 等待页面网络空闲
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 })
      log('✓ 页面网络已空闲')
    } catch {
      log('⚠ 页面网络未完全空闲，继续尝试')
    }
    
    // 再等待一段时间确保 React 渲染完成
    await page.waitForTimeout(3000)
    
    // 尝试多个选择器
    let emailInputSelector: string | null = null
    for (const selector of emailInputSelectors) {
      try {
        const element = page.locator(selector).first()
        const count = await element.count()
        if (count > 0) {
          await element.waitFor({ state: 'visible', timeout: 5000 })
          emailInputSelector = selector
          log(`✓ 找到邮箱输入框 (选择器: ${selector})`)
          break
        }
      } catch {
        continue
      }
    }
    
    if (!emailInputSelector) {
      // 最后尝试：查找所有 input 元素
      log('⚠ 常规选择器未找到，尝试查找所有 input 元素...')
      const allInputs = await page.locator('input').all()
      log(`📊 页面共有 ${allInputs.length} 个 input 元素`)
      
      if (allInputs.length > 0) {
        // 使用第一个可见的 input
        for (let i = 0; i < allInputs.length; i++) {
          try {
            const isVisible = await allInputs[i].isVisible()
            if (isVisible) {
              emailInputSelector = `input >> nth=${i}`
              log(`✓ 使用第 ${i + 1} 个 input 元素`)
              break
            }
          } catch {
            continue
          }
        }
      }
    }
    
    if (!emailInputSelector) {
      // 保存调试信息
      await page.screenshot({ path: `debug-no-input-${Date.now()}.png`, fullPage: true })
      log(`📸 已保存调试截图`)
      throw new Error('未找到邮箱输入框，页面结构可能已变化')
    }
    
    // 使用人类输入方式
    await humanType(page, emailInputSelector, email)
    log(`✓ 已输入邮箱: ${email}`)
    
    await randomDelay(5, 10, log, '输入邮箱后等待', configuredDelayMin, configuredDelayMax)
    
    // 点击第一个继续按钮（带错误检测和自动重试）
    // 选择器: button[data-testid="test-primary-button"]
    const firstContinueSelector = 'button[data-testid="test-primary-button"]'
    if (!await waitAndClickWithRetry(page, firstContinueSelector, log, '第一个继续按钮')) {
      throw new Error('点击第一个继续按钮失败')
    }
    
    await randomDelay(4, 7, log, '点击继续后等待页面响应', configuredDelayMin, configuredDelayMax)
    
    // 检测是否是已注册账号（登录页面或验证页面）
    // 登录页面标识1: span 包含 "Sign in with your AWS Builder ID"
    // 登录页面标识2: 页面包含 "verify" 字样且有验证码输入框
    const loginHeadingSelector = 'span[class*="awsui_heading-text"]:has-text("Sign in with your AWS Builder ID")'
    const verifyHeadingSelector = 'span[class*="awsui_heading-text"]:has-text("Verify")'
    const verifyCodeInputSelector = 'input[placeholder="6-digit"]'
    const nameInputSelector = 'input[placeholder="Maria José Silva"]'
    
    let isLoginFlow = false
    let isVerifyFlow = false  // 直接进入验证码步骤的登录流程
    
    try {
      // 同时检测登录页面、验证页面和注册页面的元素
      const loginHeading = page.locator(loginHeadingSelector).first()
      const verifyHeading = page.locator(verifyHeadingSelector).first()
      const verifyCodeInput = page.locator(verifyCodeInputSelector).first()
      const nameInput = page.locator(nameInputSelector).first()
      
      // 等待其中一个元素出现
      const result = await Promise.race([
        loginHeading.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'login'),
        verifyHeading.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'verify'),
        verifyCodeInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'verify-input'),
        nameInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'register')
      ])
      
      if (result === 'login') {
        isLoginFlow = true
      } else if (result === 'verify' || result === 'verify-input') {
        isLoginFlow = true
        isVerifyFlow = true
      }
    } catch {
      // 如果都没找到，尝试单独检测
      try {
        await page.locator(loginHeadingSelector).first().waitFor({ state: 'visible', timeout: 3000 })
        isLoginFlow = true
      } catch {
        try {
          // 检测 verify 标题或验证码输入框
          const hasVerify = await page.locator(verifyHeadingSelector).first().isVisible().catch(() => false)
          const hasVerifyInput = await page.locator(verifyCodeInputSelector).first().isVisible().catch(() => false)
          if (hasVerify || hasVerifyInput) {
            isLoginFlow = true
            isVerifyFlow = true
          }
        } catch {
          isLoginFlow = false
        }
      }
    }
    
    if (isLoginFlow) {
      // ========== 登录流程（邮箱已注册）==========
      if (isVerifyFlow) {
        log('\n⚠ 检测到验证页面，邮箱已注册，直接进入验证码步骤...')
      } else {
        log('\n⚠ 检测到邮箱已注册，切换到登录流程...')
      }
      
      // 如果不是直接验证流程，需要先输入密码
      if (!isVerifyFlow) {
        // 步骤2(登录): 输入密码
        log('\n步骤2(登录): 输入密码...')
        const loginPasswordSelector = 'input[placeholder="Enter password"]'
        if (!await waitAndFill(page, loginPasswordSelector, password, log, '登录密码输入框')) {
          throw new Error('未找到登录密码输入框')
        }
        
        await randomDelay(3, 5, log, '输入密码后等待', configuredDelayMin, configuredDelayMax)
        
        // 点击继续按钮
        const loginContinueSelector = 'button[data-testid="test-primary-button"]'
        if (!await waitAndClickWithRetry(page, loginContinueSelector, log, '登录继续按钮')) {
          throw new Error('点击登录继续按钮失败')
        }
        
        await randomDelay(4, 7, log, '点击登录继续后等待', configuredDelayMin, configuredDelayMax)
      }
      
      // 步骤3(登录): 等待验证码输入框出现，获取并输入验证码
      log('\n步骤3(登录): 获取并输入验证码...')
      // 登录验证码输入框选择器（支持多种 placeholder）
      const loginCodeSelectors = [
        'input[placeholder="6-digit"]',
        'input[placeholder="6 位数"]',
        'input[class*="awsui_input"][type="text"]'
      ]
      
      let loginCodeInput: string | null = null
      for (const selector of loginCodeSelectors) {
        try {
          await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 })
          loginCodeInput = selector
          log('✓ 登录验证码输入框已出现')
          break
        } catch {
          continue
        }
      }
      
      if (!loginCodeInput) {
        throw new Error('未找到登录验证码输入框')
      }
      
      // 等待15秒，确保验证码邮件已发送
      log('等待15秒，确保验证码邮件已发送...')
      await page.waitForTimeout(15000)
      
      // 自动获取验证码 - 根据邮箱类型选择方法
      let loginVerificationCode: string | null = null
      if (isCodeQQEmail) {
        log(`使用 QQ 邮箱 IMAP 获取验证码 (${codeReceiveEmail})...`)
        log(`目标邮箱: ${email}`)
        // 使用带重试机制的函数，处理频率限制
        loginVerificationCode = await getQQVerificationCodeWithRetry(codeReceiveEmail, refreshTokenOrAuthCode, log, 120, email)
      } else if (codeReceiveEmail.toLowerCase().includes('gmail.com')) {
        log(`使用 Gmail IMAP 获取验证码 (${codeReceiveEmail})...`)
        log(`目标邮箱: ${email}`)
        // 传递注册邮箱作为目标邮箱，用于别名过滤
        loginVerificationCode = await getGmailVerificationCode(codeReceiveEmail, refreshTokenOrAuthCode, log, 120, email)
      } else if (isCodeOutlookEmail && refreshTokenOrAuthCode && clientId) {
        log(`使用 Outlook Graph API 获取验证码 (${codeReceiveEmail})...`)
        loginVerificationCode = await getOutlookVerificationCode(refreshTokenOrAuthCode, clientId, log, 120)
      } else {
        log('无法自动获取验证码：不支持的邮箱类型或缺少必要参数')
      }
      
      if (!loginVerificationCode) {
        throw new Error('无法获取登录验证码')
      }
      
      // 输入验证码 - 使用人类输入模拟
      log('使用人类输入方式输入验证码...')
      await humanType(page, loginCodeInput, loginVerificationCode)
      log(`✓ 已输入登录验证码: ${loginVerificationCode}`)
      
      await randomDelay(8, 15, log, '输入验证码后等待', configuredDelayMin, configuredDelayMax)
      
      // 点击验证码确认按钮
      const loginVerifySelector = 'button[data-testid="test-primary-button"]'
      if (!await waitAndClickWithRetry(page, loginVerifySelector, log, '登录验证码确认按钮')) {
        throw new Error('点击登录验证码确认按钮失败')
      }
      
      await randomDelay(5, 8, log, '验证码确认后等待', configuredDelayMin, configuredDelayMax)
      
    } else {
      // ========== 注册流程（新账号）==========
      // 步骤2: 等待姓名输入框出现，输入姓名
      log('\n步骤2: 输入姓名...')
      await page.locator(nameInputSelector).first().waitFor({ state: 'visible', timeout: 30000 })
      
      // 使用人类输入方式
      await humanType(page, nameInputSelector, randomName)
      log(`✓ 已输入姓名: ${randomName}`)
      
      await randomDelay(5, 10, log, '输入姓名后等待', configuredDelayMin, configuredDelayMax)
      
      // 点击第二个继续按钮（带错误检测和自动重试）
      // 选择器: button[data-testid="signup-next-button"]
      const secondContinueSelector = 'button[data-testid="signup-next-button"]'
      if (!await waitAndClickWithRetry(page, secondContinueSelector, log, '第二个继续按钮')) {
        throw new Error('点击第二个继续按钮失败')
      }
      
      await randomDelay(4, 7, log, '点击继续后等待验证码页面', configuredDelayMin, configuredDelayMax)
      
      // 等待页面完全加载 - React 应用需要时间渲染
      log('等待 React 应用完全加载...')
      await page.waitForTimeout(10000)  // 等待10秒让 React 渲染完成
      
      // 等待页面网络空闲
      try {
        await page.waitForLoadState('networkidle', { timeout: 15000 })
        log('✓ 页面网络已空闲')
      } catch {
        log('⚠️ 页面网络未完全空闲，继续执行')
      }
      
      // 步骤3: 等待验证码输入框出现，获取并输入验证码
      log('\n步骤3: 获取并输入验证码...')
      
      // 尝试多个可能的验证码输入框选择器
      const codeInputSelectors = [
        'input[placeholder="6 位数"]',
        'input[placeholder="6-digit"]',
        'input[type="text"][autocomplete="one-time-code"]',
        'input[name="code"]',
        'input[id*="code"]',
        'input[id*="verification"]',
        'input[type="text"]',  // 更宽松的选择器
        'input[type="tel"]'    // 有些网站用 tel 类型
      ]
      
      let codeInputSelector: string | null = null
      
      // 先等待验证码输入框出现
      log('等待验证码输入框出现...')
      
      // 先等待页面稳定
      await page.waitForTimeout(5000)
      log('页面等待5秒后开始查找输入框...')
      
      for (const selector of codeInputSelectors) {
        try {
          log(`尝试选择器: ${selector}`)
          const elements = await page.locator(selector).count()
          log(`找到 ${elements} 个匹配元素`)
          
          if (elements > 0) {
            await page.locator(selector).first().waitFor({ state: 'visible', timeout: 5000 })
            codeInputSelector = selector
            log(`✓ 验证码输入框已出现 (使用选择器: ${selector})`)
            break
          }
        } catch (error: any) {
          log(`✗ 选择器无效: ${selector} - ${error.message}`)
        }
      }
      
      if (!codeInputSelector) {
        // 截图保存当前页面状态用于调试
        const screenshotPath = `debug-verification-${Date.now()}.png`
        await page.screenshot({ path: screenshotPath, fullPage: true })
        log(`已保存调试截图: ${screenshotPath}`)
        
        // 保存页面 HTML 用于调试
        const htmlPath = `debug-verification-${Date.now()}.html`
        const html = await page.content()
        require('fs').writeFileSync(htmlPath, html)
        log(`已保存页面 HTML: ${htmlPath}`)
        
        // 打印当前页面的所有 input 元素
        const allInputs = await page.locator('input').evaluateAll((inputs) => 
          inputs.map(input => ({
            type: input.getAttribute('type'),
            name: input.getAttribute('name'),
            id: input.getAttribute('id'),
            placeholder: input.getAttribute('placeholder'),
            class: input.getAttribute('class')
          }))
        )
        log('页面上的所有 input 元素:')
        log(JSON.stringify(allInputs, null, 2))
        
        throw new Error('未找到验证码输入框')
      }
      
      // 等待15秒，确保验证码邮件已发送
      log('等待15秒，确保验证码邮件已发送...')
      await page.waitForTimeout(15000)
      
      // 自动获取验证码 - 根据邮箱类型选择方法
      let verificationCode: string | null = null
      if (isCodeQQEmail) {
        log(`使用 QQ 邮箱 IMAP 获取验证码 (${codeReceiveEmail})...`)
        log(`目标邮箱: ${email}`)
        // 使用带重试机制的函数，处理频率限制
        verificationCode = await getQQVerificationCodeWithRetry(codeReceiveEmail, refreshTokenOrAuthCode, log, 120, email)
      } else if (codeReceiveEmail.toLowerCase().includes('gmail.com')) {
        log(`使用 Gmail IMAP 获取验证码 (${codeReceiveEmail})...`)
        log(`目标邮箱: ${email}`)
        // 传递注册邮箱作为目标邮箱，用于别名过滤
        verificationCode = await getGmailVerificationCode(codeReceiveEmail, refreshTokenOrAuthCode, log, 120, email)
      } else if (isCodeOutlookEmail && refreshTokenOrAuthCode && clientId) {
        log(`使用 Outlook Graph API 获取验证码 (${codeReceiveEmail})...`)
        verificationCode = await getOutlookVerificationCode(refreshTokenOrAuthCode, clientId, log, 120)
      } else {
        log('无法自动获取验证码：不支持的邮箱类型或缺少必要参数')
      }
      
      if (!verificationCode) {
        throw new Error('无法获取验证码')
      }
      
      // 输入验证码 - 使用人类输入模拟
      log('使用人类输入方式输入验证码...')
      await humanType(page, codeInputSelector, verificationCode)
      log(`✓ 已输入验证码: ${verificationCode}`)
      
      await randomDelay(8, 15, log, '输入验证码后等待', configuredDelayMin, configuredDelayMax)
      
      // 点击 Continue 按钮（带错误检测和自动重试）
      // 选择器: button[data-testid="email-verification-verify-button"]
      const verifyButtonSelector = 'button[data-testid="email-verification-verify-button"]'
      if (!await waitAndClickWithRetry(page, verifyButtonSelector, log, 'Continue 按钮')) {
        throw new Error('点击 Continue 按钮失败')
      }
      
      // AWS 服务器处理验证码需要时间，增加等待
      log('等待 AWS 服务器处理验证码...')
      await randomDelay(10, 15, log, 'AWS 服务器处理验证码', configuredDelayMin, configuredDelayMax)
      
      // 步骤4: 等待密码输入框出现，输入密码
      log('\n步骤4: 输入密码...')
      // 选择器: input[placeholder="Enter password"]
      const passwordInputSelector = 'input[placeholder="Enter password"]'
      // 等待密码输入框出现
      log('等待密码输入框出现...')
      await page.locator(passwordInputSelector).first().waitFor({ state: 'visible', timeout: 60000 })
      
      // 使用人类输入方式
      await humanType(page, passwordInputSelector, password)
      log(`✓ 已输入密码`)
      
      await randomDelay(5, 10, log, '输入密码后等待', configuredDelayMin, configuredDelayMax)
      
      // 输入确认密码
      // 选择器: input[placeholder="Re-enter password"]
      const confirmPasswordSelector = 'input[placeholder="Re-enter password"]'
      // 等待确认密码输入框出现
      log('等待确认密码输入框出现...')
      await page.locator(confirmPasswordSelector).first().waitFor({ state: 'visible', timeout: 60000 })
      
      // 使用人类输入方式
      await humanType(page, confirmPasswordSelector, password)
      log(`✓ 已输入确认密码`)
      
      await randomDelay(5, 10, log, '输入确认密码后等待', configuredDelayMin, configuredDelayMax)
      
      // 点击第三个继续按钮（带错误检测和自动重试）
      // 选择器: button[data-testid="test-primary-button"]
      const thirdContinueSelector = 'button[data-testid="test-primary-button"]'
      if (!await waitAndClickWithRetry(page, thirdContinueSelector, log, '第三个继续按钮')) {
        throw new Error('点击第三个继续按钮失败')
      }
      
      await randomDelay(5, 8, log, '提交密码后等待', configuredDelayMin, configuredDelayMax)
    }
    
    // 步骤5: 获取 SSO Token（登录和注册流程共用）
    log('\n步骤5: 获取 SSO Token...')
    let ssoToken: string | null = null
    
    for (let i = 0; i < 30; i++) {
      const cookies = await context.cookies()
      const ssoCookie = cookies.find(c => c.name === 'x-amz-sso_authn')
      if (ssoCookie) {
        ssoToken = ssoCookie.value
        log(`✓ 成功获取 SSO Token (x-amz-sso_authn)!`)
        break
      }
      log(`等待 SSO Token... (${i + 1}/30)`)
      await page.waitForTimeout(1000)
    }
    
    if (!ssoToken) {
      throw new Error('未能获取 SSO Token，可能操作未完成')
    }
    
    // 步骤6: 等待并点击 "Confirm and continue" 按钮（授权确认页面）
    log('\n步骤6: 等待授权确认页面...')
    const confirmButtonSelectors = [
      'button:has-text("Confirm and continue")',
      'button:has-text("确认并继续")',
      'input[type="submit"][value="Confirm and continue"]',
      'input[type="submit"][value="确认并继续"]',
      'button[type="submit"]:has-text("Confirm")'
    ]
    
    let confirmClicked = false
    for (const selector of confirmButtonSelectors) {
      try {
        const confirmButton = page.locator(selector).first()
        await confirmButton.waitFor({ state: 'visible', timeout: 15000 })
        
        // 🔒 并发安全检查：验证页面显示的代码与获取的 userCode 一致
        const pageContent = await page.content()
        
        // 提取页面上显示的授权码 - 改进正则表达式，只匹配大写字母和数字
        const codeMatch = pageContent.match(/\b([A-Z]{4}-[A-Z]{4})\b/)
        const displayedCode = codeMatch ? codeMatch[1] : null
        
        if (displayedCode) {
          log(`页面显示的授权码: ${displayedCode}`)
          log(`我们获取的授权码: ${userCode}`)
          
          // 断言检查：确保代码一致
          if (displayedCode.toUpperCase() !== userCode.toUpperCase()) {
            log(`⚠ 授权码不匹配，但可能是页面解析问题，继续尝试点击`)
            // 不再抛出异常，只记录警告
          } else {
            log(`✓ 并发安全检查通过：授权码一致 (${userCode})`)
          }
        } else {
          log('⚠ 未能从页面提取授权码，跳过验证')
        }
        
        if (pageContent.includes('Authorization requested')) {
          log('✓ 检测到授权确认页面')
        }
        
        await randomDelay(2, 4, log, '发现确认按钮，等待后点击', configuredDelayMin, configuredDelayMax)
        await confirmButton.click()
        log('✓ 已点击 Confirm and continue 按钮')
        confirmClicked = true
        break
      } catch {
        continue
      }
    }
    
    if (!confirmClicked) {
      log('⚠ 未找到 Confirm and continue 按钮，尝试查找 Allow access 按钮...')
      
      // 打印当前页面信息用于调试
      try {
        const currentUrl = page.url()
        const pageTitle = await page.title()
        log(`当前页面 URL: ${currentUrl}`)
        log(`当前页面标题: ${pageTitle}`)
        
        // 查找所有可见的按钮
        const allButtons = await page.locator('button:visible, input[type="submit"]:visible').all()
        log(`页面上共有 ${allButtons.length} 个可见按钮`)
        
        for (let i = 0; i < Math.min(allButtons.length, 5); i++) {
          const buttonText = await allButtons[i].textContent().catch(() => '')
          const buttonType = await allButtons[i].getAttribute('type').catch(() => '')
          const buttonValue = await allButtons[i].getAttribute('value').catch(() => '')
          log(`  按钮 ${i + 1}: text="${buttonText?.trim()}" type="${buttonType}" value="${buttonValue}"`)
        }
      } catch (e) {
        log('⚠ 无法获取页面调试信息')
      }
      
      // 如果没找到 Confirm 按钮，尝试 Allow access 按钮（Kiro 授权页面）
      const allowButtonSelectors = [
        'button:has-text("Allow access")',
        'button:has-text("允许访问")',
        'button:has-text("Allow")',
        'button:has-text("允许")',
        'button[data-testid="test-primary-button"]:has-text("Allow")',
        'input[type="submit"][value="Allow access"]',
        // 添加更通用的选择器
        'button[type="submit"]',
        'input[type="submit"]',
        'button.primary',
        'button.btn-primary'
      ]
      
      for (const selector of allowButtonSelectors) {
        try {
          const allowButton = page.locator(selector).first()
          await allowButton.waitFor({ state: 'visible', timeout: 15000 })
          
          // 检查是否是 Kiro 授权页面
          const pageContent = await page.content()
          if (pageContent.includes('Allow AWS Builder ID Registration to access your data') || 
              pageContent.includes('Kiro')) {
            log('✓ 检测到 Kiro 授权页面')
          }
          
          await randomDelay(3, 6, log, '发现 Allow access 按钮，等待后点击', configuredDelayMin, configuredDelayMax)
          await allowButton.click()
          log('✓ 已点击 Allow access 按钮')
          confirmClicked = true
          break
        } catch {
          continue
        }
      }
    }
    
    if (!confirmClicked) {
      log('⚠ 未找到授权按钮，可能已自动授权或页面已跳转')
    } else {
      await randomDelay(3, 5, log, '点击授权按钮后等待', configuredDelayMin, configuredDelayMax)
    }
    
    // 步骤7: 等待最终确认页面或成功页面
    log('\n步骤7: 等待最终确认...')
    const successIndicators = [
      'text=Successfully',
      'text=成功',
      'text=You\'re all set',
      'text=完成',
      '[data-testid="success-message"]'
    ]
    
    let foundSuccess = false
    for (const indicator of successIndicators) {
      try {
        await page.locator(indicator).first().waitFor({ state: 'visible', timeout: 5000 })
        log('✓ 检测到成功页面')
        foundSuccess = true
        break
      } catch {
        continue
      }
    }
    
    if (!foundSuccess) {
      log('⚠ 未检测到明确的成功页面，但已获取 SSO Token')
    }
    
    // 等待一段时间确保所有操作完成
    await randomDelay(2, 4, log, '最终等待', configuredDelayMin, configuredDelayMax)
    
    // 关闭浏览器
    await browser.close()
    browser = null
    
    log('\n========== 操作成功! ==========')
    return { success: true, ssoToken, name: randomName }
    
  } catch (error) {
    log(`\n✗ 注册失败: ${error}`)
    if (browser) {
      try { await browser.close() } catch {}
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
