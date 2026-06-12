/**

 * 浏览器管理模块

 * 自动检测本地浏览器路径，支持无痕模式启动

 */



import { exec, spawn } from 'child_process'

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
 * 验证浏览器路径格式，防止命令注入
 * 仅允许安全字符集，且必须以常见浏览器可执行文件结尾
 */
export function validateBrowserPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false

  // 禁止的 shell 元字符: ; | & $ ` * ? < > " '
  const forbiddenPattern = /[;|&$`*?<>(){}]/
  if (forbiddenPattern.test(path)) return false

  // 只允许字母、数字、空格、反斜杠、点、括号、下划线、横杠
  const allowedPattern = /^[a-zA-Z0-9\\.\s\[\]\(\)_-]+$/
  if (!allowedPattern.test(path)) return false

  // 必须以常见浏览器可执行文件结尾
  const validExtensions = [
    'chrome.exe',
    'firefox.exe',
    'msedge.exe',
    'brave.exe',
    'launcher.exe',
    'safari.app',
  ]

  const lowerPath = path.toLowerCase()
  const isBrowserExec = validExtensions.some((ext) =>
    lowerPath.endsWith(ext)
  )
  if (!isBrowserExec) return false

  return true
}



/**

 * 获取 Windows 系统上常见浏览器的默认安装路径

 */

function getWindowsBrowserPaths(): Record<string, string[]> {

  const programFiles = process.env['ProgramFiles'] || 'C:/Program Files'

  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)'

  const localAppData = process.env['LOCALAPPDATA'] || join(process.env['USERPROFILE'] || '', 'AppData', 'Local')

  

  return {

    chrome: [

      join(programFiles, 'Google/Chrome/Application/chrome.exe'),

      join(programFilesX86, 'Google/Chrome/Application/chrome.exe'),

      join(localAppData, 'Google/Chrome/Application/chrome.exe'),

    ],

    edge: [

      join(programFiles, 'Microsoft/Edge/Application/msedge.exe'),

      join(programFilesX86, 'Microsoft/Edge/Application/msedge.exe'),

    ],

    firefox: [

      join(programFiles, 'Mozilla Firefox/firefox.exe'),

      join(programFilesX86, 'Mozilla Firefox/firefox.exe'),

    ],

    brave: [

      join(programFiles, 'BraveSoftware/Brave-Browser/Application/brave.exe'),

      join(programFilesX86, 'BraveSoftware/Brave-Browser/Application/brave.exe'),

      join(localAppData, 'BraveSoftware/Brave-Browser/Application/brave.exe'),

    ],

    opera: [

      join(programFiles, 'Opera/launcher.exe'),

      join(programFilesX86, 'Opera/launcher.exe'),

      join(localAppData, 'Programs/Opera/launcher.exe'),

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
    // 安全验证：防止命令注入
    if (!validateBrowserPath(browserPath)) {
      return {
        success: false,
        error: '浏览器路径包含非法字符或被拒绝',
      }
    }

    const targetUrl = url || 'about:blank'

    let args: string[] = ['--incognito', targetUrl]

    switch (browserName) {
      case 'firefox':
        // Firefox 使用 -private-window
        args = ['-private-window', targetUrl]
        break

      case 'opera':
        // Opera 使用 --private
        args = ['--private', targetUrl]
        break

      case 'chrome':
      case 'brave':
      case 'edge':
      default:
        // Chromium 系浏览器使用 --incognito
        args = ['--incognito', targetUrl]
        break
    }

    console.log(
      '[BrowserManager] 启动浏览器:',
      browserPath,
      '参数:',
      args.join(' ')
    )

    // 使用 spawn 替代 exec，避免 shell 解释
    const child = spawn(browserPath, args, { detached: true, stdio: 'ignore' })

    child.on('error', (err) => {
      console.error('[BrowserManager] 启动失败:', err.message)
    })

    // 不等待子进程，让操作系统独立管理
    child.unref()

    return { success: true }
  } catch (error: any) {
    console.error('[BrowserManager] 启动出错:', error)
    return {
      success: false,
      error: error.message || '启动失败',
    }
  }
}


/**

 * 使用系统默认浏览器打开 URL

 */

export async function openUrlInDefaultBrowser(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 优先使用 Electron
    const { shell } = require('electron')
    await shell.openExternal(url)
    return { success: true }
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      // 非 Electron 环境，使用 Node.js 跨平台回退
      try {
        const { exec } = require('child_process')
        const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
        exec(cmd, (e) => { if (e) return { success: false, error: e.message } })
        return { success: true }
      } catch (innerError: any) {
        return { success: false, error: innerError.message }
      }
    }
    return {
      success: false,
      error: error.message || '打开失败'
    }
  }
}
