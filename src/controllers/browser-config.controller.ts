/**
 * Browser Configuration Controller
 * Handles HTTP requests for browser configuration management
 */

import { Request, Response } from 'express'
import {
  loadBrowserConfig,
  saveBrowserConfig,
  validateBrowserConfig,
  getEnvironmentInfo,
  testBrowserLaunch,
  detectBrowserPaths
} from '../services/config.service'

/**
 * GET /api/config/browser
 * Returns current browser configuration with environment info
 */
export async function getBrowserConfig(req: Request, res: Response) {
  try {
    const config = await loadBrowserConfig()
    const envInfo = getEnvironmentInfo()
    
    res.json({
      success: true,
      config,
      envInfo
    })
  } catch (error: any) {
    console.error('Failed to get browser config:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * PUT /api/config/browser
 * Updates browser configuration with validation
 */
export async function updateBrowserConfig(req: Request, res: Response) {
  try {
    const newConfig = req.body
    
    // Validate configuration
    const validation = validateBrowserConfig(newConfig)
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      })
    }
    
    // Save configuration
    await saveBrowserConfig(newConfig)
    
    res.json({
      success: true,
      message: 'Browser configuration saved successfully'
    })
  } catch (error: any) {
    console.error('Failed to update browser config:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * GET /api/config/browser/detect
 * Detects available browsers on the system
 */
export async function detectBrowsers(_req: Request, res: Response) {
  try {
    console.log('🔍 开始检测系统浏览器...')
    const browsers = await detectBrowserPaths()
    
    console.log(`✅ 检测完成，找到 ${browsers.length} 个浏览器`)
    
    res.json({
      success: true,
      browsers,
      count: browsers.length
    })
  } catch (error: any) {
    console.error('浏览器检测失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * POST /api/config/browser/test
 * Tests browser launch with current configuration
 */
export async function testBrowserConfig(_req: Request, res: Response) {
  try {
    const config = await loadBrowserConfig()
    const envInfo = getEnvironmentInfo()
    
    // Test browser launch
    const result = await testBrowserLaunch(config)
    
    res.json({
      success: true,
      result,
      envInfo
    })
  } catch (error: any) {
    console.error('Browser launch test failed:', error)
    
    const envInfo = getEnvironmentInfo()
    const suggestions = generateErrorSuggestions(error, envInfo)
    
    res.json({
      success: false,
      error: error.message,
      suggestions,
      envInfo
    })
  }
}

/**
 * Generate error suggestions based on error message and environment
 * 
 * 根据错误信息和环境特征，生成针对性的解决建议
 * 这个函数分析常见的浏览器启动错误，并提供用户友好的解决方案
 * 
 * @param error - 浏览器启动时抛出的错误对象
 * @param envInfo - 当前运行环境信息（Linux、root用户等）
 * @returns 建议列表，每个建议都是可操作的解决方案
 */
function generateErrorSuggestions(error: Error, envInfo: any): string[] {
  const suggestions: string[] = []
  const errorMsg = error.message.toLowerCase()
  
  // 检查常见错误模式并提供对应建议
  
  // 错误 1: 浏览器可执行文件不存在
  // 通常是因为 Playwright 浏览器未安装或自定义路径错误
  if (errorMsg.includes('executable') && errorMsg.includes('exist')) {
    suggestions.push('Run: npx playwright install chromium')
    suggestions.push('Check that the browser path is correct')
    suggestions.push('Ensure system dependencies are installed')
  }
  
  // 错误 2: 沙箱相关错误
  // 通常发生在 root 用户运行时，需要禁用沙箱
  if (errorMsg.includes('sandbox') || errorMsg.includes('root')) {
    suggestions.push('Add --no-sandbox to launch arguments')
    suggestions.push('Or run as non-root user')
  }
  
  // 错误 3: 显示服务器相关错误
  // 通常发生在 Linux 无图形界面环境，需要启用无头模式
  if (errorMsg.includes('display') || errorMsg.includes('x11')) {
    suggestions.push('Enable headless mode (required for Linux without X11)')
    suggestions.push('Or install X11 display server')
  }
  
  // 错误 4: 超时错误
  // 可能是系统资源不足或浏览器启动过慢
  if (errorMsg.includes('timeout')) {
    suggestions.push('Increase launch timeout')
    suggestions.push('Check system resources (CPU, memory)')
  }
  
  // 环境特定建议
  // 根据检测到的环境特征提供额外建议
  
  // Linux 环境且没有显示服务器
  if (envInfo.isLinux && !envInfo.hasDisplay) {
    suggestions.push('Headless mode is required on Ubuntu Server without GUI')
  }
  
  // Root 用户运行
  if (envInfo.isRoot) {
    suggestions.push('Running as root requires --no-sandbox flag')
  }
  
  // 通用后备建议
  // 如果没有匹配到特定错误模式，提供通用建议
  if (suggestions.length === 0) {
    suggestions.push('Check browser configuration settings')
    suggestions.push('Review server logs for detailed error information')
    suggestions.push('Ensure Playwright is properly installed')
  }
  
  return suggestions
}
