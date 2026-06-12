#!/usr/bin/env ts-node
/**
 * 环境检测和自动安装脚本
 * 
 * 检测系统环境并自动安装必要的依赖
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'

interface CheckResult {
  name: string
  passed: boolean
  message: string
  fix?: string
}

const results: CheckResult[] = []

/**
 * 执行命令并返回结果
 */
function runCommand(command: string, silent = false): string {
  try {
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit'
    })
    return output.trim()
  } catch (error: any) {
    return ''
  }
}

/**
 * 检查命令是否存在
 */
function commandExists(command: string): boolean {
  try {
    if (os.platform() === 'win32') {
      runCommand(`where ${command}`, true)
    } else {
      runCommand(`which ${command}`, true)
    }
    return true
  } catch {
    return false
  }
}

/**
 * 检测操作系统
 */
function checkOS(): CheckResult {
  const platform = os.platform()
  const release = os.release()
  
  console.log(`\n📋 操作系统: ${platform} ${release}`)
  
  return {
    name: '操作系统',
    passed: true,
    message: `${platform} ${release}`
  }
}

/**
 * 检测 Node.js 版本
 */
function checkNodeVersion(): CheckResult {
  const version = process.version
  const major = parseInt(version.slice(1).split('.')[0])
  
  console.log(`\n📦 Node.js 版本: ${version}`)
  
  if (major >= 18) {
    return {
      name: 'Node.js',
      passed: true,
      message: `版本 ${version} ✓`
    }
  } else {
    return {
      name: 'Node.js',
      passed: false,
      message: `版本 ${version} 过低，需要 >= 18.x`,
      fix: '请升级 Node.js: https://nodejs.org/'
    }
  }
}

/**
 * 检测浏览器
 */
function checkBrowsers(): CheckResult {
  console.log(`\n🌐 检测浏览器...`)
  
  const browsers = [
    { name: 'chromium', paths: ['/usr/bin/chromium', '/usr/bin/chromium-browser'] },
    { name: 'chrome', paths: ['/usr/bin/google-chrome', '/opt/google/chrome/chrome'] },
    { name: 'firefox', paths: ['/usr/bin/firefox'] }
  ]
  
  const found: string[] = []
  
  for (const browser of browsers) {
    for (const path of browser.paths) {
      if (fs.existsSync(path)) {
        found.push(`${browser.name} (${path})`)
        console.log(`   ✓ 找到 ${browser.name}: ${path}`)
        break
      }
    }
  }
  
  if (found.length > 0) {
    return {
      name: '浏览器',
      passed: true,
      message: `找到 ${found.length} 个浏览器: ${found.join(', ')}`
    }
  } else {
    return {
      name: '浏览器',
      passed: false,
      message: '未找到系统浏览器',
      fix: os.platform() === 'linux' 
        ? 'sudo apt install -y chromium' 
        : '请手动安装 Chrome 或 Chromium'
    }
  }
}

/**
 * 检测 Playwright
 */
function checkPlaywright(): CheckResult {
  console.log(`\n🎭 检测 Playwright...`)
  
  const playwrightPath = './node_modules/playwright'
  
  if (fs.existsSync(playwrightPath)) {
    console.log(`   ✓ Playwright 已安装`)
    
    // 检查浏览器是否已下载
    const browsersPath = os.homedir() + '/.cache/ms-playwright'
    if (fs.existsSync(browsersPath)) {
      const browsers = fs.readdirSync(browsersPath)
      console.log(`   ✓ Playwright 浏览器: ${browsers.join(', ')}`)
      
      return {
        name: 'Playwright',
        passed: true,
        message: `已安装，浏览器: ${browsers.join(', ')}`
      }
    } else {
      return {
        name: 'Playwright',
        passed: false,
        message: 'Playwright 已安装但浏览器未下载',
        fix: 'npx playwright install chromium'
      }
    }
  } else {
    return {
      name: 'Playwright',
      passed: false,
      message: 'Playwright 未安装',
      fix: 'npm install playwright && npx playwright install chromium'
    }
  }
}

/**
 * 检测系统依赖（Linux）
 */
function checkSystemDependencies(): CheckResult {
  if (os.platform() !== 'linux') {
    return {
      name: '系统依赖',
      passed: true,
      message: '非 Linux 系统，跳过检查'
    }
  }
  
  console.log(`\n📚 检测系统依赖...`)
  
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
    const result = runCommand(`dpkg -l | grep ${lib}`, true)
    if (!result) {
      missing.push(lib)
    }
  }
  
  if (missing.length === 0) {
    console.log(`   ✓ 所有系统依赖已安装`)
    return {
      name: '系统依赖',
      passed: true,
      message: '所有依赖已安装'
    }
  } else {
    console.log(`   ✗ 缺少 ${missing.length} 个依赖`)
    return {
      name: '系统依赖',
      passed: false,
      message: `缺少 ${missing.length} 个依赖`,
      fix: `sudo apt install -y ${missing.join(' ')}`
    }
  }
}

/**
 * 检测数据库连接（可选）
 */
function checkDatabase(): CheckResult {
  console.log(`\n🗄️  检测数据库配置...`)
  
  const configPath = './data/config.json'
  
  if (!fs.existsSync(configPath)) {
    return {
      name: '数据库',
      passed: true,
      message: '配置文件不存在，将使用默认配置'
    }
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    
    if (config.storage === 'mysql') {
      console.log(`   ℹ️  使用 MySQL 存储`)
      console.log(`   主机: ${config.mysql?.host || 'localhost'}`)
      console.log(`   端口: ${config.mysql?.port || 3306}`)
    } else {
      console.log(`   ℹ️  使用 JSON 文件存储`)
    }
    
    return {
      name: '数据库',
      passed: true,
      message: `存储模式: ${config.storage || 'json'}`
    }
  } catch (error: any) {
    return {
      name: '数据库',
      passed: false,
      message: '配置文件格式错误',
      fix: '请检查 data/config.json 文件'
    }
  }
}

/**
 * 自动修复问题
 */
async function autoFix(result: CheckResult): Promise<boolean> {
  if (!result.fix) return false
  
  console.log(`\n🔧 尝试自动修复: ${result.name}`)
  console.log(`   命令: ${result.fix}`)
  
  try {
    runCommand(result.fix)
    console.log(`   ✓ 修复成功`)
    return true
  } catch (error: any) {
    console.log(`   ✗ 修复失败: ${error.message}`)
    return false
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60))
  console.log('🔍 Kiro Account Manager - 环境检测')
  console.log('='.repeat(60))
  
  // 执行所有检查
  results.push(checkOS())
  results.push(checkNodeVersion())
  results.push(checkBrowsers())
  results.push(checkPlaywright())
  results.push(checkSystemDependencies())
  results.push(checkDatabase())
  
  // 显示结果
  console.log('\n' + '='.repeat(60))
  console.log('📊 检测结果')
  console.log('='.repeat(60))
  
  let allPassed = true
  
  for (const result of results) {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.name}: ${result.message}`)
    
    if (!result.passed) {
      allPassed = false
      if (result.fix) {
        console.log(`   💡 修复建议: ${result.fix}`)
      }
    }
  }
  
  console.log('='.repeat(60))
  
  if (allPassed) {
    console.log('\n✅ 环境检测通过！可以启动服务器。')
    console.log('\n运行命令: npm run start')
  } else {
    console.log('\n⚠️  发现问题，请根据上述建议进行修复。')
    
    // 询问是否自动修复
    const autoFixEnabled = process.argv.includes('--auto-fix')
    
    if (autoFixEnabled) {
      console.log('\n🔧 开始自动修复...')
      
      for (const result of results) {
        if (!result.passed && result.fix) {
          await autoFix(result)
        }
      }
      
      console.log('\n✅ 自动修复完成，请重新运行检测。')
    } else {
      console.log('\n💡 提示: 使用 --auto-fix 参数可以尝试自动修复')
      console.log('   命令: npm run setup -- --auto-fix')
    }
  }
  
  console.log('')
}

// 运行
main().catch(console.error)
