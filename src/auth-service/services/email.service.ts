/**
 * 邮件发送服务（用于验证码）
 * 从数据库读取SMTP配置
 */

import * as nodemailer from 'nodemailer'
import { getEmailConfig } from '../../services/email-config.service'

/**
 * 创建邮件传输器（从数据库读取配置）
 */
async function createTransporter(): Promise<nodemailer.Transporter | null> {
  try {
    // 从数据库读取邮箱配置
    const config = await getEmailConfig(true)
    
    if (!config || !config.smtpHost || !config.smtpUser || !config.smtpPassword) {
      throw new Error('未配置SMTP服务')
    }
    
    // 创建传输器
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpSecure || false,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      }
    })
    
    // 验证连接
    await transporter.verify()
    console.log(`✅ 邮件服务已连接: ${config.smtpHost}:${config.smtpPort}`)
    
    return transporter
  } catch (error: any) {
    console.error('❌ 邮件服务连接失败:', error.message)
    return null
  }
}

/**
 * 发送验证码邮件
 */
export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<void> {
  console.log(`[Email Service] 发送验证码到 ${email}`)
  
  // 获取邮箱配置
  const config = await getEmailConfig(true)
  
  if (!config || !config.smtpHost || !config.smtpUser || !config.smtpPassword) {
    throw new Error('未配置SMTP服务，无法发送邮件')
  }
  
  const transporter = await createTransporter()
  
  if (!transporter) {
    throw new Error('邮件服务连接失败')
  }
  
  await transporter.sendMail({
    from: config.smtpFrom || `"Kiro Account System" <${config.smtpUser}>`,
    to: email,
    subject: 'Kiro账户注册验证码',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code-box { background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Kiro账户注册</h1>
          </div>
          <div class="content">
            <p>您好，</p>
            <p>感谢您注册Kiro账户。请使用以下验证码完成注册：</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            
            <p><strong>验证码有效期为5分钟</strong>，请尽快使用。</p>
            
            <p>如果这不是您的操作，请忽略此邮件。</p>
            
            <div class="footer">
              <p>此邮件由系统自动发送，请勿回复。</p>
              <p>&copy; 2026 Kiro Account System. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  })
  
  console.log(`✅ 验证码邮件已发送到 ${email}`)
}
