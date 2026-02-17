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
 * 从环境变量或配置获取加密密钥
 * 如果没有配置，使用默认密钥（生产环境应该使用环境变量）
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.ENCRYPTION_KEY || 'kiro-default-encryption-key-change-in-production'
  
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
 * @returns 解密后的明文
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  
  try {
    const key = getEncryptionKey()
    
    // 解析加密数据
    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      throw new Error('加密数据格式错误')
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
    console.error('❌ 解密失败:', error.message)
    throw new Error('解密失败')
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
