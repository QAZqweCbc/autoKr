/**
 * Token 模型
 */

export interface TokenSubmitDTO {
  email: string                // 账号邮箱
  x_amz_sso_authn: string     // AWS SSO Token (x-amz-sso_authn)
}

export interface AccountRequestDTO {
  device_id: string      // 设备唯一标识
  device_name?: string   // 设备名称（可选）
}

export interface AccountResponse {
  success: boolean
  account?: {
    id: string
    email: string
    password: string
    x_amz_sso_authn: string
    assigned_at: string
  }
  message?: string
}
