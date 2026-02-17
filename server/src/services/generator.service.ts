/**
 * 账号生成服务
 */

import { GenerateAccountDTO, GeneratedAccount, GenerateResult } from '../models/generator.model'

// 随机姓名生成
const FIRST_NAMES = ['james', 'robert', 'john', 'michael', 'david', 'william', 'richard', 'maria', 'elizabeth', 'jennifer', 'linda', 'barbara', 'susan', 'jessica', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander', 'patrick', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'adam', 'nathan', 'henry', 'douglas', 'zachary', 'peter', 'kyle', 'walter', 'ethan', 'jeremy', 'harold', 'keith', 'christian', 'roger', 'noah', 'gerald', 'carl', 'terry', 'sean', 'austin', 'arthur', 'lawrence', 'jesse', 'dylan', 'bryan', 'joe', 'jordan', 'billy', 'bruce', 'albert', 'willie', 'gabriel', 'logan', 'alan', 'juan', 'wayne', 'elijah', 'randy', 'roy', 'vincent', 'ralph', 'eugene', 'russell', 'bobby', 'mason', 'philip', 'louis']
const LAST_NAMES = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson', 'thomas', 'taylor', 'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson', 'white', 'harris', 'sanchez', 'clark', 'ramirez', 'lewis', 'robinson', 'walker', 'young', 'allen', 'king', 'wright', 'scott', 'torres', 'nguyen', 'hill', 'flores', 'green', 'adams', 'nelson', 'baker', 'hall', 'rivera', 'campbell', 'mitchell', 'carter', 'roberts', 'gomez', 'phillips', 'evans', 'turner', 'diaz', 'parker', 'cruz', 'edwards', 'collins', 'reyes', 'stewart', 'morris', 'morales', 'murphy', 'cook', 'rogers', 'gutierrez', 'ortiz', 'morgan', 'cooper', 'peterson', 'bailey', 'reed', 'kelly', 'howard', 'ramos', 'kim', 'cox', 'ward', 'richardson', 'watson', 'brooks', 'chavez', 'wood', 'james', 'bennett', 'gray', 'mendoza', 'ruiz', 'hughes', 'price', 'alvarez', 'castillo', 'sanders', 'patel', 'myers', 'long', 'ross', 'foster', 'jimenez']

function generateRandomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  // 首字母大写
  return `${first.charAt(0).toUpperCase() + first.slice(1)} ${last.charAt(0).toUpperCase() + last.slice(1)}`
}

// 生成随机字符串（确保包含所有类型的字符）
function generateRandomString(length: number, includeSpecial: boolean = true): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const special = '!@#$%^&*'
  
  // 确保密码至少包含每种类型的字符
  let result = ''
  
  // 先添加必需的字符（至少各一个）
  result += lowercase.charAt(Math.floor(Math.random() * lowercase.length))
  result += uppercase.charAt(Math.floor(Math.random() * uppercase.length))
  result += numbers.charAt(Math.floor(Math.random() * numbers.length))
  
  if (includeSpecial) {
    result += special.charAt(Math.floor(Math.random() * special.length))
  }
  
  // 填充剩余长度
  const allChars = lowercase + uppercase + numbers + (includeSpecial ? special : '')
  const remainingLength = length - result.length
  
  for (let i = 0; i < remainingLength; i++) {
    result += allChars.charAt(Math.floor(Math.random() * allChars.length))
  }
  
  // 打乱字符顺序（避免固定模式）
  return result.split('').sort(() => Math.random() - 0.5).join('')
}

// 生成真实风格的邮箱用户名
function generateRealisticUsername(targetLength?: number): string {
  const patterns = [
    // 模式1: firstname.lastname (50%)
    () => {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
      return `${first}.${last}`
    },
    // 模式2: firstnamelastname (30%)
    () => {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
      return `${first}${last}`
    },
    // 模式3: firstname + 1-2位数字 (10%)
    () => {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
      const num = Math.floor(Math.random() * 99) + 1  // 1-99
      return `${first}${num}`
    },
    // 模式4: firstname_lastname (5%)
    () => {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
      return `${first}_${last}`
    },
    // 模式5: firstname.lastname + 1位数字 (5%)
    () => {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
      const num = Math.floor(Math.random() * 9) + 1  // 1-9
      return `${first}.${last}${num}`
    }
  ]
  
  // 根据权重选择模式
  const rand = Math.random()
  let pattern
  if (rand < 0.5) pattern = patterns[0]      // 50%
  else if (rand < 0.8) pattern = patterns[1]  // 30%
  else if (rand < 0.9) pattern = patterns[2]  // 10%
  else if (rand < 0.95) pattern = patterns[3] // 5%
  else pattern = patterns[4]                   // 5%
  
  let username = pattern()
  
  // 如果指定了目标长度，调整用户名长度
  if (targetLength !== undefined && targetLength > 0) {
    if (username.length > targetLength) {
      // 截断到目标长度
      username = username.substring(0, targetLength)
    } else if (username.length < targetLength) {
      // 补充随机数字到目标长度
      const charsNeeded = targetLength - username.length
      const randomDigits = Math.floor(Math.random() * Math.pow(10, charsNeeded))
        .toString()
        .padStart(charsNeeded, '0')
      username += randomDigits
    }
  }
  
  return username
}

// 生成随机邮箱
function generateRandomEmail(domains: string[], emailLength?: number): string {
  const username = generateRealisticUsername(emailLength)
  
  // 从域名列表中随机选择一个
  const domain = domains[Math.floor(Math.random() * domains.length)]
  
  // 移除域名开头的 @ 符号（如果有）
  const cleanDomain = domain.startsWith('@') ? domain.slice(1) : domain
  
  return `${username}@${cleanDomain}`
}

/**
 * 生成账号
 */
export function generateAccounts(dto: GenerateAccountDTO): GenerateResult {
  try {
    // 从配置文件加载默认值
    const { getGeneratorConfig } = require('./config.service')
    const defaultConfig = getGeneratorConfig()
    
    const {
      count,
      email_domain,
      email_domains,
      email_length,
      password_length = defaultConfig.defaultPasswordLength,
      use_random_name = true
    } = dto
    
    if (count <= 0 || count > 1000) {
      throw new Error('生成数量必须在 1-1000 之间')
    }
    
    // 确定使用的域名列表
    let domains: string[] = []
    if (email_domains && email_domains.length > 0) {
      domains = email_domains
    } else if (email_domain) {
      // 向后兼容旧的单域名参数
      domains = [email_domain]
    } else {
      domains = ['example.com']
    }
    
    const accounts: GeneratedAccount[] = []
    
    for (let i = 0; i < count; i++) {
      const account: GeneratedAccount = {
        email: generateRandomEmail(domains, email_length),
        password: generateRandomString(password_length, true)
      }
      
      if (use_random_name) {
        account.name = generateRandomName()
      }
      
      accounts.push(account)
    }
    
    return {
      success: true,
      accounts,
      count: accounts.length
    }
  } catch (error: any) {
    console.error('❌ 生成账号失败:', error.message)
    throw error
  }
}

/**
 * 导出账号为 JSON
 */
export function exportAccountsAsJSON(accounts: any[]): string {
  return JSON.stringify(accounts, null, 2)
}

/**
 * 导出账号为 CSV
 */
export function exportAccountsAsCSV(accounts: any[]): string {
  if (accounts.length === 0) {
    return ''
  }
  
  // 获取所有字段
  const fields = Object.keys(accounts[0])
  
  // CSV 头部
  let csv = fields.join(',') + '\n'
  
  // CSV 数据行
  for (const account of accounts) {
    const row = fields.map(field => {
      const value = account[field] || ''
      // 转义逗号和引号
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
    csv += row.join(',') + '\n'
  }
  
  return csv
}
