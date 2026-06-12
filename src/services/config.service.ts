/**
 * 配置管理服务
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const CONFIG_DIR = path.join(process.cwd(), 'data')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export interface BrowserConfig {
  // Browser settings
  browserType: 'chrome' | 'firefox'
  browserPath: string  // Empty string for Playwright built-in
  headless: boolean
  showWindow: boolean
  args: string[]  // Custom launch arguments
  
  // Human behavior settings
  delayMin: number  // Minimum delay in seconds (default: 3)
  delayMax: number  // Maximum delay in seconds (default: 8)
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface EnvironmentInfo {
  isLinux: boolean
  isRoot: boolean
  hasDisplay: boolean
}

export interface ServerConfig {
  email?: {
    qqEmail?: string
    authCode?: string
    domains?: string
    useAlias?: boolean
    aliasType?: 'gmail' | 'qq'
    gmailBase?: string
    gmailAppPassword?: string
    qqAliases?: string
  }
  browserConfig?: BrowserConfig
  generator?: {
    defaultCount?: number
    defaultEmailLength?: number
    defaultPasswordLength?: number
  }
  autoRefresh?: {
    enabled: boolean
    interval: number  // 刷新间隔（分钟）
    concurrency: number  // 并发数
    lastRefreshTime: string | null  // 上次刷新时间
    
    // 新增：刷新策略配置
    refreshBeforeExpiry?: number  // 过期前多久刷新（分钟，默认5）
    maxConsecutiveFailures?: number  // 最大连续失败次数（默认3）
    retryFailedAfter?: number  // 失败后多久重试（小时，默认24）
    
    // 新增：日志配置
    logRetentionDays?: number  // 日志保留天数（默认30）
    
    // 新增：通知配置
    enableWebSocket?: boolean  // 是否启用WebSocket通知（默认false）
    enableAlerts?: boolean  // 是否启用告警（默认true）
    
    // 新增：告警阈值配置
    alertThresholds?: {
      bannedAccountsError?: number  // 封禁账号告警阈值（默认1）
      failureRateWarning?: number  // 失败率告警阈值（默认0.3）
      consecutiveFailuresError?: number  // 连续失败告警阈值（默认3）
      refreshTimeoutWarning?: number  // 刷新超时告警阈值（分钟，默认120）
    }
    // ?????????
    distributedLock?: {
      enabled?: boolean
      ttl?: number
      retryDelay?: number
      retryTimes?: number
    }

    // ?????????
    exponentialBackoff?: {
      enabled?: boolean
    }

    // ??????????
    priorityQueue?: {
      enabled?: boolean
    }

  }
  databaseConfigMigrated?: boolean  // 标记数据库配置已迁移
}

// 默认浏览器配置
const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  browserType: 'chrome',
  browserPath: '',
  headless: true,  // Safe default for Linux
  showWindow: false,
  args: [
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions'
  ],
  delayMin: 3,
  delayMax: 8
}

// 默认配置
const DEFAULT_CONFIG: ServerConfig = {
  browserConfig: DEFAULT_BROWSER_CONFIG,
  generator: {
    defaultCount: 5,
    defaultPasswordLength: 12
  }
}

/**
 * 加载配置
 */
export function loadConfig(): ServerConfig {
  try {
    // 确保目录存在
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true })
    }
    
    // 如果配置文件不存在，创建默认配置
    if (!existsSync(CONFIG_FILE)) {
      saveConfig(DEFAULT_CONFIG)
      return DEFAULT_CONFIG
    }
    
    const data = readFileSync(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(data) as ServerConfig
    
    // 合并默认配置（防止缺少字段）
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      browserConfig: { ...DEFAULT_BROWSER_CONFIG, ...config.browserConfig },
      generator: { ...DEFAULT_CONFIG.generator, ...config.generator }
    }
    
    // 🆕 自动迁移配置（如果需要）
    const { migrateConfig } = require('./config-migration.service')
    const migrationResult = migrateConfig(mergedConfig)
    
    // 如果配置被迁移，保存更新后的配置
    if (migrationResult.migrated) {
      saveConfig(mergedConfig)
      console.log('✅ 配置已自动迁移并保存')
    }
    
    // 🆕 自动检测并配置浏览器路径（如果为空）
    if (!mergedConfig.browserConfig.browserPath) {
      console.log('⚠️  浏览器路径为空，尝试自动检测...')
      const configured = autoConfigureBrowser(mergedConfig)
      if (configured) {
        console.log('✅ 自动配置成功，已保存配置')
      } else {
        console.log('⚠️  未检测到系统浏览器，将使用 Playwright 内置浏览器')
        console.log('💡 提示: 运行 "npx playwright install chromium" 安装内置浏览器')
      }
    }
    
    return mergedConfig
  } catch (error: any) {
    console.error('❌ 加载配置失败:', error.message)
    return DEFAULT_CONFIG
  }
}

/**
 * 自动配置浏览器路径
 * 根据平台自动检测并配置最佳浏览器
 * @returns 是否成功配置
 */
function autoConfigureBrowser(config: ServerConfig): boolean {
  try {
    const isLinux = process.platform === 'linux'
    const isWindows = process.platform === 'win32'
    
    console.log(`🔍 检测到平台: ${process.platform}`)
    
    // Linux 平台检测
    if (isLinux) {
      const linuxBrowsers = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/snap/bin/chromium',
        '/usr/bin/firefox'
      ]
      
      for (const path of linuxBrowsers) {
        if (existsSync(path)) {
          config.browserConfig.browserPath = path
          config.browserConfig.headless = true  // Linux 强制无头模式
          config.browserConfig.showWindow = false
          
          // Root 用户添加安全参数
          if (process.getuid && process.getuid() === 0) {
            if (!config.browserConfig.args.includes('--no-sandbox')) {
              config.browserConfig.args.push('--no-sandbox', '--disable-setuid-sandbox')
            }
          }
          
          console.log(`✅ 自动配置浏览器: ${path}`)
          saveConfig(config)
          return true
        }
      }
      
      console.log('⚠️  未检测到系统浏览器，将使用 Playwright 内置浏览器')
      console.log('💡 提示: 运行 "npx playwright install chromium" 安装')
      return false
    }
    
    // Windows 平台检测
    if (isWindows) {
      const windowsBrowsers = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
      ]
      
      for (const path of windowsBrowsers) {
        if (existsSync(path)) {
          config.browserConfig.browserPath = path
          console.log(`✅ 自动配置浏览器: ${path}`)
          saveConfig(config)
          return true
        }
      }
      
      console.log('⚠️  未检测到系统浏览器，将使用 Playwright 内置浏览器')
      return false
    }
    
    return false
  } catch (error: any) {
    console.error('❌ 自动配置浏览器失败:', error.message)
    return false
  }
}

/**
 * 保存配置
 */
export function saveConfig(config: ServerConfig): void {
  try {
    // 确保目录存在
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true })
    }
    
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
    console.log('✅ 配置已保存')
  } catch (error: any) {
    console.error('❌ 保存配置失败:', error.message)
    throw error
  }
}

/**
 * 更新配置
 */
export function updateConfig(updates: Partial<ServerConfig>): ServerConfig {
  const config = loadConfig()
  const newConfig = {
    ...config,
    ...updates
  }
  saveConfig(newConfig)
  return newConfig
}

/**
 * 获取当前存储类型（从数据库配置服务获取）
 */
export function getStorageType(): 'json' | 'mysql' {
  try {
    const { loadDatabaseConfig } = require('./database-config.service')
    const dbConfig = loadDatabaseConfig()
    return dbConfig.storage as 'json' | 'mysql'
  } catch (error) {
    console.warn('⚠️  无法加载数据库配置，使用默认值 json')
    return 'json'
  }
}

/**
 * 切换存储类型（已废弃，请使用数据库配置服务）
 * @deprecated 使用 database-config.service.ts 中的 saveDatabaseConfig
 */
export function switchStorage(type: 'json' | 'mysql'): void {
  console.warn('⚠️  switchStorage 已废弃，请使用 database-config.service.ts')
  const { loadDatabaseConfig, saveDatabaseConfig } = require('./database-config.service')
  const dbConfig = loadDatabaseConfig()
  dbConfig.storage = type
  saveDatabaseConfig(dbConfig)
  console.log(`✅ 存储类型已切换为: ${type}`)
}

/**
 * 加载浏览器配置
 * 根据存储类型从 MySQL 或 JSON 文件加载
 */
export async function loadBrowserConfig(): Promise<BrowserConfig> {
  const storageType = getStorageType()
  
  if (storageType === 'mysql') {
    try {
      const { MySQLBrowserConfigDB } = await import('./mysql.service')
      const config = await MySQLBrowserConfigDB.get()
      
      if (config) {
        return { ...DEFAULT_BROWSER_CONFIG, ...config }
      }
    } catch (error: any) {
      console.warn('⚠️  从 MySQL 加载浏览器配置失败，使用默认配置:', error.message)
    }
  }
  
  // 从 JSON 文件加载（默认或回退）
  const config = loadConfig()
  return {
    ...DEFAULT_BROWSER_CONFIG,
    ...config.browserConfig
  }
}

/**
 * 保存浏览器配置
 * 根据存储类型保存到 MySQL 或 JSON 文件
 */
export async function saveBrowserConfig(browserConfig: BrowserConfig): Promise<void> {
  // 先验证配置
  const validation = validateBrowserConfig(browserConfig)
  if (!validation.valid) {
    throw new Error(`Invalid browser configuration: ${validation.errors.join(', ')}`)
  }
  
  const storageType = getStorageType()
  
  if (storageType === 'mysql') {
    try {
      const { MySQLBrowserConfigDB } = await import('./mysql.service')
      await MySQLBrowserConfigDB.save(browserConfig)
      console.log('✅ 浏览器配置已保存到 MySQL')
      return
    } catch (error: any) {
      console.error('❌ 保存到 MySQL 失败，回退到 JSON 文件:', error.message)
    }
  }
  
  // 保存到 JSON 文件（默认或回退）
  const config = loadConfig()
  config.browserConfig = browserConfig
  saveConfig(config)
  console.log('✅ 浏览器配置已保存到 JSON 文件')
}

/**
 * 获取生成器配置
 */
export function getGeneratorConfig(): { defaultCount: number; defaultEmailLength: number; defaultPasswordLength: number } {
  const config = loadConfig()
  return {
    defaultCount: config.generator?.defaultCount || 5,
    defaultEmailLength: config.generator?.defaultEmailLength || 12,
    defaultPasswordLength: config.generator?.defaultPasswordLength || 12
  }
}

/**
 * 保存生成器配置
 */
export function saveGeneratorConfig(generatorConfig: { defaultCount: number; defaultEmailLength: number; defaultPasswordLength: number }): void {
  const config = loadConfig()
  config.generator = generatorConfig
  saveConfig(config)
  console.log('✅ 生成器配置已保存')
}

/**
 * 验证浏览器配置
 * 检查所有配置项的有效性，包括浏览器类型、路径、延迟和启动参数
 * 
 * @param config - 要验证的浏览器配置对象
 * @returns 验证结果，包含是否有效和错误列表
 */
export function validateBrowserConfig(config: BrowserConfig): ValidationResult {
  const errors: string[] = []
  
  // 验证浏览器类型 - 只支持 Chrome 和 Firefox
  if (!['chrome', 'firefox'].includes(config.browserType)) {
    errors.push('Browser type must be chrome or firefox')
  }
  
  // 验证浏览器路径（如果提供）- 确保文件存在
  // 空字符串表示使用 Playwright 内置浏览器，不需要验证
  if (config.browserPath && !existsSync(config.browserPath)) {
    errors.push(`Browser path does not exist: ${config.browserPath}`)
  }
  
  // 验证延迟配置 - 确保延迟值合理
  // 最小延迟必须大于 0，否则会导致操作过快
  if (config.delayMin <= 0) {
    errors.push('Minimum delay must be greater than 0')
  }
  // 最大延迟必须大于最小延迟，否则随机延迟无法工作
  if (config.delayMax <= config.delayMin) {
    errors.push('Maximum delay must be greater than minimum delay')
  }
  
  // 验证启动参数（检查危险参数）
  // 某些参数可能导致安全问题或与系统冲突
  const dangerousArgs = ['--remote-debugging-port', '--user-data-dir']
  for (const arg of config.args) {
    if (dangerousArgs.some(dangerous => arg.includes(dangerous))) {
      errors.push(`Potentially dangerous argument: ${arg}`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 获取环境信息
 * 检测平台、root用户和显示环境
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  return {
    isLinux: process.platform === 'linux',
    isRoot: process.getuid ? process.getuid() === 0 : false,
    hasDisplay: !!process.env.DISPLAY
  }
}

/**
 * 应用Linux优化
 * 在Linux环境下强制headless模式并添加root用户安全标志
 * 
 * Linux 环境特点：
 * - 通常没有图形界面（无 X11 显示服务器）
 * - 必须使用无头模式运行浏览器
 * - Root 用户需要额外的安全标志才能启动浏览器
 * 
 * @param config - 原始浏览器配置
 * @returns 优化后的配置，适用于当前环境
 */
export function applyLinuxOptimizations(config: BrowserConfig): BrowserConfig {
  const envInfo = getEnvironmentInfo()
  const optimized = { ...config }
  
  // 在Linux上强制headless模式
  // 原因：Linux 服务器通常没有图形界面，无法显示浏览器窗口
  if (envInfo.isLinux) {
    optimized.headless = true
    optimized.showWindow = false
  }
  
  // 为root用户添加安全标志
  // 原因：Chromium 默认不允许 root 用户启动，需要禁用沙箱
  // 注意：这会降低安全性，生产环境建议使用非 root 用户
  if (envInfo.isRoot) {
    const rootArgs = ['--no-sandbox', '--disable-setuid-sandbox']
    for (const arg of rootArgs) {
      // 避免重复添加相同的参数
      if (!optimized.args.includes(arg)) {
        optimized.args.push(arg)
      }
    }
  }
  
  return optimized
}

/**
 * 检测系统中可用的浏览器路径
 * 在 Linux 和 Windows 上检测常见的浏览器安装位置
 * 
 * @returns 检测到的浏览器列表，包含类型、路径和版本信息
 */
export async function detectBrowserPaths(): Promise<Array<{
  type: 'chrome' | 'firefox'
  path: string
  name: string
  version?: string
}>> {
  const browsers: Array<{
    type: 'chrome' | 'firefox'
    path: string
    name: string
    version?: string
  }> = []
  
  const isLinux = process.platform === 'linux'
  const isWindows = process.platform === 'win32'
  
  // Linux 浏览器路径
  const linuxPaths = [
    { type: 'chrome' as const, path: '/usr/bin/chromium', name: 'Chromium' },
    { type: 'chrome' as const, path: '/usr/bin/chromium-browser', name: 'Chromium Browser' },
    { type: 'chrome' as const, path: '/usr/bin/google-chrome', name: 'Google Chrome' },
    { type: 'chrome' as const, path: '/usr/bin/google-chrome-stable', name: 'Google Chrome Stable' },
    { type: 'chrome' as const, path: '/snap/bin/chromium', name: 'Chromium (Snap)' },
    { type: 'firefox' as const, path: '/usr/bin/firefox', name: 'Firefox' },
    { type: 'firefox' as const, path: '/usr/bin/firefox-esr', name: 'Firefox ESR' },
    { type: 'firefox' as const, path: '/snap/bin/firefox', name: 'Firefox (Snap)' }
  ]
  
  // Windows 浏览器路径
  const windowsPaths = [
    { type: 'chrome' as const, path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', name: 'Google Chrome' },
    { type: 'chrome' as const, path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', name: 'Google Chrome (x86)' },
    { type: 'firefox' as const, path: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe', name: 'Firefox' },
    { type: 'firefox' as const, path: 'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe', name: 'Firefox (x86)' }
  ]
  
  // 选择要检测的路径列表
  const pathsToCheck = isLinux ? linuxPaths : isWindows ? windowsPaths : []
  
  // 检测每个路径是否存在
  for (const browser of pathsToCheck) {
    if (existsSync(browser.path)) {
      try {
        // 尝试获取浏览器版本
        const version = await getBrowserVersion(browser.path, browser.type)
        browsers.push({
          ...browser,
          version
        })
        console.log(`✅ 检测到浏览器: ${browser.name} at ${browser.path}`)
      } catch (error) {
        // 即使无法获取版本，也添加到列表
        browsers.push(browser)
        console.log(`✅ 检测到浏览器: ${browser.name} at ${browser.path} (无法获取版本)`)
      }
    }
  }
  
  return browsers
}

/**
 * 获取浏览器版本信息
 * 通过执行浏览器的 --version 命令获取版本号
 * 
 * @param browserPath - 浏览器可执行文件路径
 * @param browserType - 浏览器类型
 * @returns 版本字符串，如果无法获取则返回 undefined
 */
async function getBrowserVersion(browserPath: string, browserType: 'chrome' | 'firefox'): Promise<string | undefined> {
  try {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const execFileAsync = promisify(execFile)
    
    // Chrome/Chromium 使用 --version
    // Firefox 使用 --version 或 -v
    const versionFlag = browserType === 'chrome' ? '--version' : '--version'
    
    const { stdout, stderr } = await execFileAsync(browserPath, [versionFlag], {
      timeout: 5000 // 5秒超时
    })
    
    // 只返回数字版本，避免 Windows 本地化输出或乱码前缀进入前端展示
    const output = `${stdout || ''}\n${stderr || ''}`
    const match = output.match(/\b\d+(?:\.\d+){1,3}\b/)
    return match ? match[0] : undefined
  } catch (error) {
    // 无法获取版本，返回 undefined
    return undefined
  }
}

/**
 * 测试浏览器启动
 * 尝试使用提供的配置启动浏览器，验证配置是否有效
 * 
 * 测试流程：
 * 1. 应用 Linux 优化（如果需要）
 * 2. 动态导入 Playwright
 * 3. 根据配置选择浏览器类型
 * 4. 准备启动选项
 * 5. 启动浏览器并获取版本信息
 * 6. 关闭浏览器
 * 
 * @param config - 要测试的浏览器配置
 * @returns 测试结果，包含启动状态、浏览器版本和启动时间
 * @throws 如果浏览器启动失败，抛出详细错误信息
 */
export async function testBrowserLaunch(config: BrowserConfig): Promise<{
  launched: boolean
  browserVersion?: string
  launchTime: number
}> {
  const startTime = Date.now()
  
  try {
    // 应用Linux优化 - 确保在 Linux 环境下使用正确的设置
    const optimizedConfig = applyLinuxOptimizations(config)
    
    // 动态导入playwright - 避免在模块加载时就导入，提高启动速度
    const playwright = await import('playwright')
    
    // 选择浏览器类型
    // Playwright 支持 chromium (Chrome/Edge/Brave/Opera) 和 firefox
    const browserType = optimizedConfig.browserType === 'firefox' 
      ? playwright.firefox 
      : playwright.chromium
    
    // 准备启动选项
    const launchOptions: any = {
      headless: optimizedConfig.headless,
      args: optimizedConfig.args
    }
    
    // 如果提供了自定义浏览器路径，使用它
    // 否则使用 Playwright 内置的浏览器
    if (optimizedConfig.browserPath) {
      launchOptions.executablePath = optimizedConfig.browserPath
    }
    
    console.log('🔍 Testing browser launch with config:', {
      browserType: optimizedConfig.browserType,
      headless: optimizedConfig.headless,
      hasCustomPath: !!optimizedConfig.browserPath,
      argsCount: optimizedConfig.args.length
    })
    
    // 启动浏览器 - 这是最关键的步骤，可能失败
    const browser = await browserType.launch(launchOptions)
    
    // 获取浏览器版本 - 用于验证浏览器正确启动
    const version = browser.version()
    
    // 关闭浏览器 - 测试完成，释放资源
    await browser.close()
    
    const launchTime = Date.now() - startTime
    
    console.log(`✅ Browser launched successfully in ${launchTime}ms`)
    
    return {
      launched: true,
      browserVersion: version,
      launchTime
    }
  } catch (error: any) {
    const launchTime = Date.now() - startTime
    console.error(`❌ Browser launch failed after ${launchTime}ms:`, error.message)
    // 重新抛出错误，让调用者处理
    throw error
  }
}
