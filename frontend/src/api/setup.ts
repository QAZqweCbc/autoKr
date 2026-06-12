/**
 * 配置向导 API
 */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

/**
 * 配置状态接口
 */
export interface SetupStatus {
  completed: boolean
  mysql: {
    configured: boolean
    tested: boolean
  }
  redis: {
    configured: boolean
    tested: boolean
    optional: true
  }
  envVars: {
    jwtSecret: boolean
    encryptionKey: boolean
  }
  dependencies: DependencyCheck[]
  needsRestart: boolean
}

/**
 * 依赖检查接口
 */
export interface DependencyCheck {
  name: string
  category: 'required' | 'optional'
  status: 'pass' | 'fail' | 'skip'
  message: string
  installCommand?: string
  platform: 'win32' | 'linux' | 'both'
}

/**
 * 环境变量接口
 */
export interface EnvVars {
  JWT_SECRET: string
  ENCRYPTION_KEY: string
}

/**
 * 配置变更接口
 */
export interface ConfigChanges {
  envVarsChanged: boolean
  systemDepsInstalled: boolean
  mysqlChanged: boolean
  redisChanged: boolean
}

/**
 * 获取配置状态
 */
export const checkSetupStatus = async () => {
  const { data } = await api.get<{
    success: boolean
    status?: SetupStatus
    platform?: string
    error?: string
  }>('/setup/status')
  return data
}

/**
 * 生成环境变量
 */
export const generateEnvVars = async () => {
  const { data } = await api.post<{
    success: boolean
    envVars?: EnvVars
    message?: string
    error?: string
  }>('/setup/env-vars/generate')
  return data
}

/**
 * 保存环境变量
 */
export const saveEnvVars = async (vars: EnvVars) => {
  const { data } = await api.post<{
    success: boolean
    message?: string
    needsRestart?: boolean
    error?: string
  }>('/setup/env-vars', vars)
  return data
}

/**
 * 检测系统依赖
 */
export const checkDependencies = async () => {
  const { data } = await api.get<{
    success: boolean
    dependencies?: DependencyCheck[]
    platform?: string
    error?: string
  }>('/setup/check-deps')
  return data
}

/**
 * 标记配置完成
 */
export const markSetupComplete = async (changes: ConfigChanges) => {
  const { data } = await api.post<{
    success: boolean
    message?: string
    needsRestart?: boolean
    restartCommand?: string
    error?: string
  }>('/setup/complete', changes)
  return data
}

/**
 * 重置配置状态（开发/调试用）
 */
export const resetSetup = async () => {
  const { data } = await api.post<{
    success: boolean
    message?: string
    error?: string
  }>('/setup/reset')
  return data
}
