/**
 * 环境配置向导服务
 * 提供配置检查、生成、保存等功能
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import { execSync } from 'child_process'
import * as os from 'os'
import * as path from 'path'
import * as crypto from 'crypto'
import { loadDatabaseConfig, saveDatabaseConfig, DatabaseConfig } from './database-config.service'

const ENV_FILE = path.join(process.cwd(), '.env')
const SETUP_COMPLETE_FILE = path.join(process.cwd(), '.setup-completed')

// .env 中数据库相关变量的前缀，Setup Wizard 需要同步更新这些值
const DB_ENV_KEYS = [
  'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE',
  'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD', 'REDIS_DB'
]

/**
 * 更新 .env 中的数据库相关环境变量
 * 将对应的旧值替换为新值，保持 .env 与 JSON 配置一致
 */
export function updateDbEnvVars(vars: Record<string, string>): void {
  if (!existsSync(ENV_FILE)) return

  try {
    let content = readFileSync(ENV_FILE, 'utf-8')

    for (const [key, value] of Object.entries(vars)) {
      // 构建正则：匹配 KEY= 开头的一行
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`)
      } else {
        // 如果变量不存在，追加一行
        content += `\n${key}=${value}\n`
      }
    }

    writeFileSync(ENV_FILE, content, 'utf-8')
    console.log('✅ 数据库环境变量已同步到 .env 文件')
  } catch (error: any) {
    console.error('❌ 更新 .env 文件失败:', error.message)
    // 不抛出异常，不影响主流程
  }
}

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
 * 获取当前平台
 */
export function getPlatform(): 'win32' | 'linux' | 'darwin' {
  return os.platform() as 'win32' | 'linux' | 'darwin'
}

/**
 * 执行命令（静默模式）
 */
function runCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim()
  } catch (error) {
    return ''
  }
}

/**
 * 检查命令是否存在
 */
function commandExists(command: string): boolean {
  try {
    const platform = getPlatform()
    if (platform === 'win32') {
      runCommand(`where ${command}`)
    } else {
      runCommand(`which ${command}`)
    }
    return true
  } catch {
    return false
  }
}

/**
 * 检查环境变量是否已配置
 */
export function checkEnvVars(): { jwtSecret: boolean; encryptionKey: boolean } {
  if (!existsSync(ENV_FILE)) {
    return { jwtSecret: false, encryptionKey: false }
  }

  try {
    const content = readFileSync(ENV_FILE, 'utf-8')
    const hasJwtSecret = /^JWT_SECRET=.+$/m.test(content) &&
                        !/^JWT_SECRET=your-/.test(content)
    const hasEncryptionKey = /^ENCRYPTION_KEY=.+$/m.test(content) &&
                            !/^ENCRYPTION_KEY=your-/.test(content)

    return {
      jwtSecret: hasJwtSecret,
      encryptionKey: hasEncryptionKey
    }
  } catch (error) {
    return { jwtSecret: false, encryptionKey: false }
  }
}

/**
 * 生成环境变量（使用加密安全的随机字节）
 */
export function generateEnvVars(): EnvVars {
  return {
    JWT_SECRET: crypto.randomBytes(32).toString('base64'),
    ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64')
  }
}

/**
 * 保存环境变量到 .env 文件
 */
export function saveEnvVars(vars: EnvVars): void {
  try {
    let content = ''

    // 读取现有内容
    if (existsSync(ENV_FILE)) {
      content = readFileSync(ENV_FILE, 'utf-8')
    } else {
      // 如果文件不存在，从示例文件复制
      const exampleFile = path.join(__dirname, '../../.env.example')
      if (existsSync(exampleFile)) {
        content = readFileSync(exampleFile, 'utf-8')
      }
    }

    // 更新或添加 JWT_SECRET
    if (/^JWT_SECRET=/m.test(content)) {
      content = content.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${vars.JWT_SECRET}`)
    } else {
      content += `\nJWT_SECRET=${vars.JWT_SECRET}\n`
    }

    // 更新或添加 ENCRYPTION_KEY
    if (/^ENCRYPTION_KEY=/m.test(content)) {
      content = content.replace(/^ENCRYPTION_KEY=.*$/m, `ENCRYPTION_KEY=${vars.ENCRYPTION_KEY}`)
    } else {
      content += `ENCRYPTION_KEY=${vars.ENCRYPTION_KEY}\n`
    }

    // 写入文件
    writeFileSync(ENV_FILE, content, 'utf-8')
    console.log('✅ 环境变量已保存到 .env 文件')
  } catch (error: any) {
    console.error('❌ 保存环境变量失败:', error.message)
    throw new Error(`保存环境变量失败: ${error.message}`)
  }
}

/**
 * 检查 Node.js 版本
 */
function checkNodeVersion(): DependencyCheck {
  const version = process.version
  const major = parseInt(version.slice(1).split('.')[0])

  if (major >= 18) {
    return {
      name: 'Node.js',
      category: 'required',
      status: 'pass',
      message: `版本 ${version} ✓`,
      platform: 'both'
    }
  } else {
    return {
      name: 'Node.js',
      category: 'required',
      status: 'fail',
      message: `版本 ${version} 过低，需要 >= 18.x`,
      installCommand: '请从 https://nodejs.org/ 下载并安装最新版本',
      platform: 'both'
    }
  }
}

/**
 * 检查 npm 依赖
 */
function checkNpmDependencies(): DependencyCheck {
  const nodeModulesPath = path.join(__dirname, '../../node_modules')

  if (existsSync(nodeModulesPath)) {
    return {
      name: 'npm 依赖',
      category: 'required',
      status: 'pass',
      message: 'node_modules 已安装',
      platform: 'both'
    }
  } else {
    return {
      name: 'npm 依赖',
      category: 'required',
      status: 'fail',
      message: 'node_modules 未安装',
      installCommand: 'npm install',
      platform: 'both'
    }
  }
}

/**
 * 检查 Playwright 浏览器
 */
function checkPlaywright(): DependencyCheck {
  const playwrightPath = path.join(__dirname, '../../node_modules/playwright')

  if (!existsSync(playwrightPath)) {
    return {
      name: 'Playwright',
      category: 'required',
      status: 'fail',
      message: 'Playwright 未安装',
      installCommand: 'npm install playwright && npx playwright install chromium',
      platform: 'both'
    }
  }

  const browsersPath = path.join(os.homedir(), '.cache/ms-playwright')
  if (existsSync(browsersPath)) {
    return {
      name: 'Playwright 浏览器',
      category: 'required',
      status: 'pass',
      message: 'Playwright 浏览器已安装 ✓',
      platform: 'both'
    }
  } else {
    return {
      name: 'Playwright 浏览器',
      category: 'required',
      status: 'fail',
      message: 'Playwright 浏览器未下载',
      installCommand: 'npx playwright install chromium',
      platform: 'both'
    }
  }
}

/**
 * 检查系统库（仅 Linux）
 */
function checkSystemLibs(): DependencyCheck {
  const platform = getPlatform()

  if (platform !== 'linux') {
    return {
      name: '系统库',
      category: 'optional',
      status: 'skip',
      message: '非 Linux 系统，跳过',
      platform: 'linux'
    }
  }

  const requiredLibs = [
    'libnss3',
    'libnspr4',
    'libatk1.0-0',
    'libatk-bridge2.0-0',
    'libcups2',
    'libdrm2',
    'libxkbcommon0',
    'libxcomposite1',
    'libxdamage1',
    'libxrandr2',
    'libgbm1',
    'libpango-1.0-0',
    'libasound2'
  ]

  const missing: string[] = []

  for (const lib of requiredLibs) {
    const result = runCommand(`dpkg -l | grep ${lib}`)
    if (!result) {
      missing.push(lib)
    }
  }

  if (missing.length === 0) {
    return {
      name: '系统库',
      category: 'required',
      status: 'pass',
      message: '所有系统库已安装 ✓',
      platform: 'linux'
    }
  } else {
    return {
      name: '系统库',
      category: 'required',
      status: 'fail',
      message: `缺少 ${missing.length} 个库`,
      installCommand: `sudo apt install -y ${missing.join(' ')}`,
      platform: 'linux'
    }
  }
}

/**
 * 检查 MySQL 服务状态（可选）
 */
function checkMySQLService(): DependencyCheck {
  const platform = getPlatform()

  // 这个检查是可选的，因为 MySQL 可能运行在远程服务器
  return {
    name: 'MySQL 服务',
    category: 'optional',
    status: 'skip',
    message: '请在 MySQL 配置步骤中测试连接',
    platform: 'both'
  }
}

/**
 * 检查 Redis 服务状态（可选）
 */
function checkRedisService(): DependencyCheck {
  const platform = getPlatform()

  // 这个检查是可选的，因为 Redis 可能运行在远程服务器
  return {
    name: 'Redis 服务',
    category: 'optional',
    status: 'skip',
    message: 'Redis 为可选配置',
    platform: 'both'
  }
}

/**
 * 检测所有系统依赖
 */
export function checkSystemDependencies(): DependencyCheck[] {
  return [
    checkNodeVersion(),
    checkNpmDependencies(),
    checkPlaywright(),
    checkSystemLibs(),
    checkMySQLService(),
    checkRedisService()
  ]
}

/**
 * 检查整体配置状态
 */
export function checkSetupStatus(): SetupStatus {
  // 检查是否已标记为配置完成
  const completed = existsSync(SETUP_COMPLETE_FILE)

  // 检查数据库配置
  const dbConfig = loadDatabaseConfig()
  const mysqlConfigured = !!(dbConfig.mysql.host && dbConfig.mysql.user && dbConfig.mysql.password)
  const redisConfigured = !!(dbConfig.redis.host)

  // 检查环境变量
  const envVars = checkEnvVars()

  // 检查系统依赖
  const dependencies = checkSystemDependencies()

  return {
    completed,
    mysql: {
      configured: mysqlConfigured,
      tested: false // 需要通过测试连接 API 来确认
    },
    redis: {
      configured: redisConfigured,
      tested: false,
      optional: true
    },
    envVars,
    dependencies,
    needsRestart: false // 初始状态不需要重启
  }
}

/**
 * 标记配置完成
 */
export function markSetupComplete(): void {
  try {
    writeFileSync(SETUP_COMPLETE_FILE, new Date().toISOString(), 'utf-8')
    console.log('✅ 配置已标记为完成')
  } catch (error: any) {
    console.error('❌ 标记配置完成失败:', error.message)
    throw new Error(`标记配置完成失败: ${error.message}`)
  }
}

/**
 * 判断是否需要重启服务器
 */
export function needsRestart(changes: ConfigChanges): boolean {
  // 修改环境变量需要重启
  if (changes.envVarsChanged) return true

  // 安装系统依赖需要重启
  if (changes.systemDepsInstalled) return true

  // MySQL/Redis 配置更改可以热重载
  return false
}

/**
 * 获取安装命令（根据平台）
 */
export function getInstallCommand(dependencyName: string): string {
  const platform = getPlatform()

  const commands: Record<string, Record<string, string>> = {
    'npm 依赖': {
      win32: 'npm install',
      linux: 'npm install',
      darwin: 'npm install'
    },
    'Playwright 浏览器': {
      win32: 'npx playwright install chromium',
      linux: 'npx playwright install chromium',
      darwin: 'npx playwright install chromium'
    },
    'Playwright': {
      win32: 'npm install playwright && npx playwright install chromium',
      linux: 'npm install playwright && npx playwright install chromium',
      darwin: 'npm install playwright && npx playwright install chromium'
    }
  }

  return commands[dependencyName]?.[platform] || ''
}
