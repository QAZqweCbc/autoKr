/**
 * 加密工具模块
 * 使用 AES-256-GCM 加密敏感数据
 */

import crypto from 'crypto'

// 加密算法
const ALGORITHM = 'aes-256-gcm'
// 密钥长度
const KEY_LENGTH = 32
// IV 长度
const IV_LENGTH = 16
// Auth Tag 长度
const AUTH_TAG_LENGTH = 16

/**
 * 从环境变量获取加密密钥
 * 如果没有配置，在开发环境使用默认密钥（生产环境会警告）
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.ENCRYPTION_KEY
  
  if (!keyString) {
    const isDevelopment = process.env.NODE_ENV !== 'production'
    
    if (isDevelopment) {
      // 开发环境：使用默认密钥并警告
      console.warn('⚠️  警告: 未设置 ENCRYPTION_KEY，使用默认密钥（仅用于开发）')
      console.warn('⚠️  生产环境请务必设置自定义加密密钥！')
      const defaultKey = 'default-development-key-do-not-use-in-production-32chars'
      return crypto.createHash('sha256').update(defaultKey).digest()
    } else {
      // 生产环境：强制要求配置
      throw new Error(
        '\n' + '='.repeat(60) + '\n' +
        '❌ 生产环境未设置加密密钥！\n' +
        '='.repeat(60) + '\n' +
        '请在 .env 文件中设置 ENCRYPTION_KEY 环境变量\n\n' +
        '生成密钥命令:\n' +
        '  openssl rand -base64 32\n\n' +
        '或者:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"\n\n' +
        '示例:\n' +
        '  ENCRYPTION_KEY=your-32-character-or-longer-encryption-key-here\n' +
        '='.repeat(60)
      )
    }
  }
  
  if (keyString.length < 32) {
    throw new Error(
      '❌ 加密密钥长度必须至少32字符\n' +
      `当前长度: ${keyString.length} 字符\n` +
      '请使用更长的密钥以确保安全性'
    )
  }
  
  // 使用 SHA-256 生成固定长度的密钥
  return crypto.createHash('sha256').update(keyString).digest()
}

/**
 * 加密文本
 * @param text 要加密的明文
 * @returns 加密后的字符串（格式：iv:authTag:encryptedData，全部为 hex 编码）
 */
export function encrypt(text: string): string {
  if (!text) return ''
  
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    // 返回格式：iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error: any) {
    console.error('❌ 加密失败:', error.message)
    throw new Error('加密失败')
  }
}

/**
 * 解密文本
 * @param encryptedText 加密的字符串（格式：iv:authTag:encryptedData）
 * @returns 解密后的明文，解密失败返回空字符串
 *
 * 注意：解密失败不会抛异常，而是返回空字符串并记录警告
 * 这样可以避免因密钥不匹配导致服务崩溃
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  
  try {
    const key = getEncryptionKey()
    
    // 解析加密数据
    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      console.warn('⚠️  加密数据格式错误，返回空字符串')
      return ''
    }
    
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error: any) {
    console.warn('⚠️  解密失败（可能是密钥不匹配）:', error.message)
    console.warn('💡 提示: 如果数据是在其他设备上加密的，请确保 ENCRYPTION_KEY 一致')
    return ''  // 降级处理：返回空字符串而不是抛异常
  }
}

/**
 * 验证加密设置
 * 在服务启动时调用，确保加密密钥已正确配置
 */
export function validateEncryptionSetup(): void {
  try {
    getEncryptionKey()
    if (process.env.ENCRYPTION_KEY) {
      console.log('✅ 加密密钥已配置')
    } else {
      console.log('⚠️  使用默认加密密钥（开发模式）')
    }
  } catch (error: any) {
    console.error(error.message)
    process.exit(1)
  }
}

/**
 * 测试加密解密功能
 */
export function testCrypto() {
  console.log('\n🔐 测试加密解密功能...')
  
  const testData = [
    'test@example.com',
    'password123',
    'authorization-code-xyz',
    '中文测试',
    'special!@#$%^&*()characters'
  ]
  
  for (const data of testData) {
    const encrypted = encrypt(data)
    const decrypted = decrypt(encrypted)
    
    const success = data === decrypted
    console.log(`  ${success ? '✅' : '❌'} "${data}" -> "${encrypted.substring(0, 40)}..." -> "${decrypted}"`)
    
    if (!success) {
      throw new Error('加密解密测试失败')
    }
  }
  
  console.log('✅ 加密解密功能正常\n')
}
