/**
 * Kiro Token 管理系统 - API客户端
 * 
 * 这是一个即用型的API客户端，可以直接复制到你的项目中使用
 * 
 * 使用方法:
 * 1. 复制此文件到你的项目
 * 2. 修改 AUTH_API_URL 为你的服务端地址
 * 3. 导入并使用: import { kiroAuth } from './kiro-auth-client'
 */

// ==================== 配置 ====================

const AUTH_API_URL = process.env.KIRO_AUTH_URL || 'http://localhost:2233'

// ==================== API客户端类 ====================

class KiroAuthClient {
  constructor(baseURL) {
    this.baseURL = baseURL
    this.token = null
  }

  /**
   * 设置JWT Token
   */
  setToken(token) {
    this.token = token
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('kiro_jwt_token', token)
    }
  }

  /**
   * 获取JWT Token
   */
  getToken() {
    if (this.token) return this.token
    
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('kiro_jwt_token')
    }
    
    return this.token
  }

  /**
   * 清除JWT Token
   */
  clearToken() {
    this.token = null
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('kiro_jwt_token')
      localStorage.removeItem('kiro_user')
    }
  }

  /**
   * 通用请求方法
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }

    // 自动添加认证头
    if (this.token && !options.skipAuth) {
      config.headers['Authorization'] = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      // 处理业务错误
      if (!response.ok || !data.success) {
        const error = new Error(data.message || data.error?.message || '请求失败')
        error.code = data.error?.code
        error.statusCode = response.status
        throw error
      }

      return data
    } catch (error) {
      // 处理网络错误
      if (!error.statusCode) {
        error.message = '网络错误，请检查连接'
      }

      // Token过期，自动清除
      if (error.statusCode === 401) {
        this.clearToken()
      }

      throw error
    }
  }

  // ==================== 认证相关 ====================

  /**
   * 发送验证码
   * @param {string} email - 邮箱地址
   */
  async sendVerificationCode(email) {
    return this.request('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true
    })
  }

  /**
   * 用户注册
   * @param {string} username - 用户名
   * @param {string} email - 邮箱地址
   * @param {string} password - 密码
   * @param {string} code - 验证码
   */
  async register(username, email, password, code) {
    const result = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, code }),
      skipAuth: true
    })

    // 自动保存Token
    if (result.token) {
      this.setToken(result.token)
      
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('kiro_user', JSON.stringify(result.user))
      }
    }

    return result
  }

  /**
   * 用户登录
   * @param {string} email - 邮箱地址
   * @param {string} password - 密码
   */
  async login(email, password) {
    const result = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true
    })

    // 自动保存Token
    if (result.token) {
      this.setToken(result.token)
      
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('kiro_user', JSON.stringify(result.user))
      }
    }

    return result
  }

  /**
   * 退出登录
   */
  logout() {
    this.clearToken()
  }

  // ==================== Token管理 ====================

  /**
   * 申请Token
   */
  async requestToken() {
    return this.request('/api/tokens/request', {
      method: 'POST'
    })
  }

  /**
   * 查看我的申请
   */
  async getMyRequests() {
    return this.request('/api/tokens/my-requests', {
      method: 'GET'
    })
  }

  /**
   * 查看我的Token
   */
  async getMyTokens() {
    return this.request('/api/tokens/my-tokens', {
      method: 'GET'
    })
  }

  /**
   * 刷新Token额度
   * @param {string} accountId - 账户ID
   */
  async refreshTokenUsage(accountId) {
    return this.request(`/api/tokens/refresh/${accountId}`, {
      method: 'POST'
    })
  }

  // ==================== 辅助方法 ====================

  /**
   * 检查是否已登录
   */
  isLoggedIn() {
    return !!this.getToken()
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
    if (typeof localStorage === 'undefined') return null
    
    const userStr = localStorage.getItem('kiro_user')
    return userStr ? JSON.parse(userStr) : null
  }
}

// ==================== 导出 ====================

// 创建单例
const kiroAuth = new KiroAuthClient(AUTH_API_URL)

// CommonJS导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { kiroAuth, KiroAuthClient }
}

// ES6导出
if (typeof exports !== 'undefined') {
  exports.kiroAuth = kiroAuth
  exports.KiroAuthClient = KiroAuthClient
}

// 浏览器全局变量
if (typeof window !== 'undefined') {
  window.kiroAuth = kiroAuth
  window.KiroAuthClient = KiroAuthClient
}

// ==================== 使用示例 ====================

/*

// 示例1: 用户注册流程
async function registerUser() {
  try {
    // 1. 发送验证码
    await kiroAuth.sendVerificationCode('user@example.com')
    console.log('验证码已发送')

    // 2. 用户输入验证码后，进行注册
    const code = '123456' // 从用户输入获取
    const result = await kiroAuth.register(
      'myusername',
      'user@example.com',
      'password123',
      code
    )

    console.log('注册成功:', result.user)
    console.log('JWT Token已自动保存')

    // 3. 申请Token
    const tokenRequest = await kiroAuth.requestToken()
    console.log('Token申请已提交:', tokenRequest.allocation_id)

  } catch (error) {
    console.error('注册失败:', error.message)
  }
}

// 示例2: 用户登录
async function loginUser() {
  try {
    const result = await kiroAuth.login('user@example.com', 'password123')
    console.log('登录成功:', result.user)
    console.log('JWT Token已自动保存')
  } catch (error) {
    console.error('登录失败:', error.message)
  }
}

// 示例3: 查看我的Token
async function viewMyTokens() {
  try {
    const result = await kiroAuth.getMyTokens()
    
    console.log('配额:', result.quota.used + '/' + result.quota.max)
    
    result.tokens.forEach(token => {
      console.log('账户:', token.account.email)
      console.log('使用率:', token.account.usage_percent + '%')
      console.log('Access Token:', token.account.access_token)
    })
  } catch (error) {
    console.error('查询失败:', error.message)
  }
}

// 示例4: 刷新Token使用量
async function refreshUsage() {
  try {
    const result = await kiroAuth.getMyTokens()
    
    if (result.tokens.length > 0) {
      const accountId = result.tokens[0].account.id
      const refreshResult = await kiroAuth.refreshTokenUsage(accountId)
      
      console.log('刷新成功')
      console.log('使用率:', refreshResult.account.usage_percent + '%')
      console.log('是否可用:', refreshResult.is_available ? '是' : '否')
    }
  } catch (error) {
    console.error('刷新失败:', error.message)
  }
}

// 示例5: 检查登录状态
if (kiroAuth.isLoggedIn()) {
  const user = kiroAuth.getCurrentUser()
  console.log('当前用户:', user.username)
} else {
  console.log('未登录')
}

// 示例6: 退出登录
kiroAuth.logout()
console.log('已退出登录')

*/
