import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export interface DatabaseConfig {
  storage: 'json' | 'mysql' | 'redis'
  mysql: {
    host: string
    port: number
    user: string
    password: string
    database: string
  }
  redis: {
    host: string
    port: number
    password?: string
    db: number
  }
}

export interface ConfigSource {
  storage: 'env' | 'file' | 'default'
  mysql: 'env' | 'file' | 'default'
  redis: 'env' | 'file' | 'default'
}

export const getDatabaseConfig = async () => {
  const { data } = await api.get<{
    success: boolean
    config?: DatabaseConfig
    source?: ConfigSource
    message?: string
  }>('/database/config')
  return data
}

export const saveDatabaseConfig = async (config: DatabaseConfig) => {
  const { data } = await api.put<{
    success: boolean
    message?: string
    error?: string
    errors?: string[]
  }>('/database/config', config)
  return data
}

export const testConnection = async (type: 'mysql' | 'redis', config: any) => {
  const { data } = await api.post<{
    success: boolean
    message?: string
    error?: string
  }>('/database/test', { type, config })
  return data
}

export const getDatabaseStatus = async () => {
  const { data } = await api.get<{
    success: boolean
    status?: {
      currentStorage: string
      configSource: ConfigSource
      mysqlConfigured: boolean
      redisConfigured: boolean
    }
  }>('/database/status')
  return data
}
