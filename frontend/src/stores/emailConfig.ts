import { defineStore } from 'pinia'
import { getEmailConfig, saveEmailConfig, testEmailConnection, type EmailConfig } from '../api/emailConfig'

export const useEmailConfigStore = defineStore('emailConfig', () => {
  const loadConfig = async () => {
    try {
      const data = await getEmailConfig()
      return data.success ? data.config : null
    } catch (error) {
      console.error('加载邮箱配置失败:', error)
      return null
    }
  }

  const saveConfig = async (config: EmailConfig) => {
    const data = await saveEmailConfig(config)
    if (!data.success) {
      throw new Error(data.error || '保存失败')
    }
    return data
  }

  const testConnection = async () => {
    return await testEmailConnection()
  }

  return {
    loadConfig,
    saveConfig,
    testConnection
  }
})
