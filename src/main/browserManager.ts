/**
 * 浏览器管理模块
 * 自动检测本地浏览器路径，支持无痕模式启动
 */

import { exec } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

export interface BrowserInfo {
  name: string
  displayName: string
  icon: string
  path: string | null
  installed: boolean
}

/**
 * 获取 Windows 系统上常见浏览器的默认安装路径
 */
function getWindowsBrowserPaths(): Record<string, string[]> {
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const localAppData = process.env['LOCALAPPDATA'] || join(process.env['USERPROFILE'] || '', 'AppData', 'Local')
  
  return {
    chrome: [
      join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
    ],
    edge: [
      join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
      join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
    ],
    firefox: [
      join(programFiles, 'Mozilla Firefox\\firefox.exe'),
      join(programFilesX86, 'Mozilla Firefox\\firefox.exe'),
    ],
    brave: [
      join(programFiles, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
      join(programFilesX86, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
      join(localAppData, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
    ],
    opera: [
      join(programFiles, 'Opera\\launcher.exe'),
      join(programFilesX86, 'Opera\\launcher.exe'),
      join(localAppData, 'Programs\\Opera\\launcher.exe'),
    ],
  }
}

/**
 * 检测浏览器是否已安装
 */
function detectBrowserPath(paths: string[]): string | null {
  for (const path of paths) {
    if (existsSync(path)) {
      return path
    }
  }
  return null
}

/**
 * 检测所有已安装的浏览器
 */
export async function detectInstalledBrowsers(): Promise<BrowserInfo[]> {
  const browsers: BrowserInfo[] = [
    {
      name: 'chrome',
      displayName: 'Google Chrome',
      icon: '🌐',
      path: null,
      installed: false,
    },
    {
      name: 'edge',
      displayName: 'Microsoft Edge',
      icon: '🔷',
      path: null,
      installed: false,
    },
    {
      name: 'firefox',
      displayName: 'Mozilla Firefox',
      icon: '🦊',
      path: null,
      installed: false,
    },
    {
      name: 'brave',
      displayName: 'Brave Browser',
      icon: '🦁',
      path: null,
      installed: false,
    },
    {
      name: 'opera',
      displayName: 'Opera',
      icon: '🎭',
      path: null,
      installed: false,
    },
  ]

  const paths = getWindowsBrowserPaths()

  for (const browser of browsers) {
    const detectedPath = detectBrowserPath(paths[browser.name])
    if (detectedPath) {
      browser.path = detectedPath
      browser.installed = true
    }
  }

  return browsers
}

/**
 * 启动浏览器（无痕模式）
 */
export async function launchBrowserIncognito(
  browserName: string,
  browserPath: string,
  url?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let command = ''
    const targetUrl = url || 'about:blank'

    switch (browserName) {
      case 'chrome':
      case 'brave':
      case 'edge':
        // Chromium 系浏览器使用 --incognito
        command = `"${browserPath}" --incognito "${targetUrl}"`
        break
      
      case 'firefox':
        // Firefox 使用 -private-window
        command = `"${browserPath}" -private-window "${targetUrl}"`
        break
      
      case 'opera':
        // Opera 使用 --private
        command = `"${browserPath}" --private "${targetUrl}"`
        break
      
      default:
        return {
          success: false,
          error: `不支持的浏览器: ${browserName}`
        }
    }

    console.log('[BrowserManager] 启动命令:', command)
    
    // 使用 exec 启动浏览器（不等待进程结束）
    exec(command, (error) => {
      if (error) {
        console.error('[BrowserManager] 启动失败:', error)
      }
    })

    return { success: true }
  } catch (error: any) {
    console.error('[BrowserManager] 启动出错:', error)
    return {
      success: false,
      error: error.message || '启动失败'
    }
  }
}

/**
 * 使用系统默认浏览器打开 URL
 */
export async function openUrlInDefaultBrowser(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { shell } = require('electron')
    await shell.openExternal(url)
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '打开失败'
    }
  }
}
