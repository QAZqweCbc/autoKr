/**
 * 认证控制器
 */

import { Request, Response } from 'express'
import { 
  createClientUser, 
  findClientUserByEmail, 
  verifyPassword, 
  updateLastLogin 
} from '../../services/client-user.service'
import { 
  generateCode, 
  canSendCode, 
  saveCode, 
  verifyCode 
} from '../services/verification.service'
import { sendVerificationEmail } from '../services/email.service'
import { generateToken } from '../services/jwt.service'
import { ClientUserCreateDTO, ClientUserLoginDTO } from '../../models/client-user.model'

/**
 * 发送验证码
 */
export async function sendCodeHandler(req: Request, res: Response) {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 2003,
          message: '邮箱不能为空'
        }
      })
    }
    
    // 检查频率限制
    const canSend = await canSendCode(email)
    if (!canSend) {
      return res.status(429).json({
        success: false,
        error: {
          code: 2003,
          message: '请1分钟后再试'
        }
      })
    }
    
    // 生成验证码
    const code = generateCode()
    
    // 保存到数据库
    await saveCode(email, code, 'register')
    
    // 发送邮件
    await sendVerificationEmail(email, code)
    
    res.json({
      success: true,
      message: '验证码已发送'
    })
  } catch (error: any) {
    console.error('[SendCode] Error:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 5002,
        message: error.message || '发送验证码失败'
      }
    })
  }
}

/**
 * 用户注册
 */
export async function registerHandler(req: Request, res: Response) {
  try {
    const { username, email, password, code } = req.body as ClientUserCreateDTO & { code: string }
    
    // 验证必填字段
    if (!username || !email || !password || !code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 1001,
          message: '所有字段都是必填的'
        }
      })
    }
    
    // 验证验证码
    const isCodeValid = await verifyCode(email, code, 'register')
    if (!isCodeValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 2002,
          message: '验证码错误或已过期'
        }
      })
    }
    
    // 创建用户
    const user = await createClientUser({ username, email, password })
    
    // 生成JWT Token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: 'user'
    })
    
    // 返回用户信息（不包含密码）
    const { password_hash, ...userResponse } = user
    
    res.status(201).json({
      success: true,
      token,
      user: userResponse
    })
  } catch (error: any) {
    console.error('[Register] Error:', error)
    
    // 处理特定错误
    if (error.message === '用户名已存在' || error.message === '邮箱已被注册') {
      return res.status(400).json({
        success: false,
        error: {
          code: 1001,
          message: error.message
        }
      })
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 5002,
        message: '注册失败'
      }
    })
  }
}

/**
 * 用户登录
 */
export async function loginHandler(req: Request, res: Response) {
  try {
    const { email, password } = req.body as ClientUserLoginDTO
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 1001,
          message: '邮箱和密码不能为空'
        }
      })
    }
    
    // 查找用户
    const user = await findClientUserByEmail(email)
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 1001,
          message: '邮箱或密码错误'
        }
      })
    }
    
    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 1004,
          message: `账户已被${user.status === 'suspended' ? '暂停' : '封禁'}`
        }
      })
    }
    
    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.password_hash)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 1001,
          message: '邮箱或密码错误'
        }
      })
    }
    
    // 更新最后登录时间
    await updateLastLogin(user.id)
    
    // 生成JWT Token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: 'user'
    })
    
    // 返回用户信息（不包含密码）
    const { password_hash, ...userResponse } = user
    
    res.json({
      success: true,
      token,
      user: {
        ...userResponse,
        last_login_at: Date.now()
      }
    })
  } catch (error: any) {
    console.error('[Login] Error:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 5002,
        message: '登录失败'
      }
    })
  }
}
