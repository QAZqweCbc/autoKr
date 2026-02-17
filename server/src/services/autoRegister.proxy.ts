/**
 * autoRegister 代理模块
 * 运行时动态加载主项目的 autoRegister，避免编译时路径问题
 */

import * as path from 'path'
import * as fs from 'fs'

// 运行时动态导入，避免 TypeScript 编译时检查
export async function getAutoRegisterAWS() {
  // 计算绝对路径：从项目根目录加载
  const projectRoot = path.resolve(__dirname, '../../..')
  
  // 查找 out/main 目录中的 autoRegister 文件（可能带 hash）
  const outMainDir = path.join(projectRoot, 'out/main')
  let autoRegisterPath: string | null = null
  
  try {
    // 检查 out/main 目录是否存在
    if (fs.existsSync(outMainDir)) {
      const files = fs.readdirSync(outMainDir)
      // 查找 autoRegister-*.js 文件
      const autoRegisterFile = files.find(f => f.startsWith('autoRegister-') && f.endsWith('.js'))
      
      if (autoRegisterFile) {
        autoRegisterPath = path.join(outMainDir, autoRegisterFile)
        console.log(`📦 找到编译后的 autoRegister 模块: ${autoRegisterFile}`)
      }
    }
  } catch (error) {
    console.error('查找编译文件失败:', error)
  }
  
  // 如果没找到编译版本，尝试直接加载 TypeScript 源码（需要 ts-node）
  if (!autoRegisterPath) {
    console.log('⚠️  未找到编译版本，尝试加载 TypeScript 源码...')
    autoRegisterPath = path.join(projectRoot, 'src/main/autoRegister.ts')
  }
  
  try {
    console.log(`📦 加载路径: ${autoRegisterPath}`)
    
    // 使用 require 动态加载（运行时解析）
    const autoRegisterModule = require(autoRegisterPath)
    
    if (!autoRegisterModule || !autoRegisterModule.autoRegisterAWS) {
      throw new Error('autoRegisterAWS 函数未找到')
    }
    
    return autoRegisterModule.autoRegisterAWS
  } catch (error: any) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ 加载 autoRegister 模块失败')
    console.error('='.repeat(60))
    console.error(`错误: ${error.message}`)
    console.error(`尝试加载路径: ${autoRegisterPath}`)
    console.error(`项目根目录: ${projectRoot}`)
    console.error('\n可能的原因：')
    console.error('  1. 主项目未编译（out/main/ 目录为空）')
    console.error('  2. 依赖未安装（playwright, imap, mailparser）')
    console.error('  3. TypeScript 源码不存在（src/main/autoRegister.ts）')
    console.error('\n解决方法：')
    console.error('  npm install           # 安装所有依赖')
    console.error('  npm run build         # 编译主项目')
    console.error('  npm run server:build  # 编译服务器')
    console.error('  npm run server:start  # 启动服务器')
    console.error('='.repeat(60) + '\n')
    throw error
  }
}

// 导出类型（仅用于类型检查，不会编译到 JS）
export type AutoRegisterAWSFunction = (
  email: string,
  password: string,
  refreshTokenOrAuthCode: string,
  clientId: string,
  log: (message: string) => void,
  emailPassword?: string,
  skipOutlookActivation?: boolean,
  proxyUrl?: string,
  receiveEmail?: string,
  browserConfig?: any
) => Promise<{ success: boolean; ssoToken?: string; name?: string; error?: string }>
