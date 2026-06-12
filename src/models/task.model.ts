/**
 * 任务数据模型
 */

export interface Task {
  id: string
  email: string                        // AWS 注册邮箱
  password: string                     // AWS 账号密码
  receive_email: string                // 接收验证码的邮箱地址
  auth_code: string                    // 接收邮箱的授权码/IMAP密码
  client_id?: string
  proxy_url?: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'paused'
  error?: string
  created_at: number
  updated_at: number
}

export interface TaskCreateDTO {
  email: string
  password: string
  receive_email: string
  auth_code: string
  client_id?: string
  proxy_url?: string
}

export interface TaskStats {
  total: number
  pending: number
  running: number
  success: number
  failed: number
  paused: number
}
