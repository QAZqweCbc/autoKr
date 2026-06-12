import { defineStore } from 'pinia'
import { 
  getBrowserConfig, 
  saveBrowserConfig, 
  testBrowserConfig,
  detectBrowsers,
  type BrowserConfig 
} from '../api/browserConfig'
import type { 
  BrowserConfigResponse,
  BrowserTestResponse,
  BrowserDetectResponse 
} from '../types'

// ==================== Store Definition ====================
export const useBrowserConfigStore = defineStore('browserConfig', () => {
  
  // ==================== Actions ====================
  
  /**
   * 加载浏览器配置
   * @returns 配置数据和环境信息，失败返回 null
   */
  const loadConfig = async (): Promise<BrowserConfigResponse | null> => {
    try {
      const data = await getBrowserConfig()
      return data.success ? data : null
    } catch (error) {
      console.error('加载浏览器配置失败:', error)
      return null
    }
  }

  /**
   * 保存浏览器配置
   * @param config 浏览器配置对象
   * @throws 保存失败时抛出错误
   */
  const saveConfig = async (config: BrowserConfig): Promise<void> => {
    const data = await saveBrowserConfig(config)
    
    if (!data.success) {
      const errorMsg = data.errors?.join('\n') || data.error || '保存失败'
      throw new Error(errorMsg)
    }
  }

  /**
   * 测试浏览器配置
   * @returns 测试结果
   */
  const testConfig = async (): Promise<BrowserTestResponse> => {
    return await testBrowserConfig()
  }

  /**
   * 检测系统浏览器
   * @returns 检测到的浏览器列表
   */
  const detect = async (): Promise<BrowserDetectResponse> => {
    return await detectBrowsers()
  }

  // ==================== Exports ====================
  return {
    loadConfig,
    saveConfig,
    testConfig,
    detect
  }
})
