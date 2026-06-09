/**
 * 检测控制器 - IP状态、AWS连接、邮箱服务检测
 */

import { Request, Response } from 'express'
import { 
  createCheckRecord, 
  getAllCheckRecords, 
  getCheckRecordById, 
  deleteCheckRecord, 
  clearAllCheckRecords,
  getCheckStats 
} from '../services/check.service'
import { getEmailConfigForInternal } from '../services/email-config-manager.service'

/**
 * Electron mock 初始化标志（确保只执行一次，避免污染其他模块）
 */
let electronMockInstalled = false

/**
 * Mock electron 模块（用于 Node.js 环境）
 */
function mockElectronModule() {
  if (electronMockInstalled) return  // 已安装则跳过，避免重复覆盖全局 require

  const Module = require('module')
  const originalRequire = Module.prototype.require

  Module.prototype.require = function(id: string) {
    if (id === 'electron') {
      // 返回一个 mock electron 对象
      const path = require('path')
      const os = require('os')
      
      return {
        app: {
          getPath: (name: string) => {
            return path.join(os.homedir(), '.kiro-auto-register')
          }
        }
      }
    }
    return originalRequire.apply(this, arguments)
  }
  
  console.log('✅ 已安装 Electron mock')
  electronMockInstalled = true
}

/**
 * 动态加载 ipCheck 模块（运行时）
 */
async function getIPCheckModule() {
  try {
    // 先 mock electron 模块
    mockElectronModule()
    
    // 尝试加载编译后的文件（优先）
    let ipCheckModule
    try {
      // 首先尝试加载编译后的 JS 文件
      ipCheckModule = require('../../../out/main/ipCheck')
      console.log('✅ 成功加载编译后的 ipCheck 模块')
    } catch (outError: any) {
      // 如果编译后的文件不存在，尝试加载源文件（开发环境）
      console.log('⚠️  编译后的文件加载失败:', outError.message)
      console.log('⚠️  尝试加载源文件...')
      ipCheckModule = require('../../../src/main/ipCheck')
      console.log('✅ 成功加载源文件 ipCheck 模块')
    }
    
    if (!ipCheckModule || !ipCheckModule.checkIPStatus) {
      throw new Error('checkIPStatus 函数未找到')
    }
    
    return ipCheckModule
  } catch (error: any) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ 加载 ipCheck 模块失败')
    console.error('='.repeat(60))
    console.error(`错误: ${error.message}`)
    console.error(`堆栈: ${error.stack}`)
    console.error('\n可能的原因：')
    console.error('  1. 主项目的 ipCheck.ts 未编译 - 请运行: npm run build')
    console.error('  2. 编译后的文件路径不正确')
    console.error('  3. 模块导出有问题')
    console.error('\n解决方案：')
    console.error('  在项目根目录运行: npm run build')
    console.error('='.repeat(60) + '\n')
    throw error
  }
}

/**
 * IP 状态检测
 */
export async function checkIPStatus(req: Request, res: Response) {
  try {
    const { proxyUrl, emailDomains } = req.body
    
    // 从存储中获取解密后的邮箱配置
    const emailConfig = await getEmailConfigForInternal()
    const qqEmail = emailConfig?.qqEmail || ''
    const qqAuthCode = emailConfig?.authCode || ''
    
    // 加载浏览器配置
    const { loadBrowserConfig } = await import('../services/config.service')
    const browserConfig = await loadBrowserConfig()
    console.log('[Check] 加载的浏览器配置:', JSON.stringify(browserConfig, null, 2))
    
    // 动态导入 ipCheck 模块
    const ipCheckModule = await getIPCheckModule()
    const checkIP = ipCheckModule.checkIPStatus
    
    // 日志收集
    const logs: string[] = []
    const log = (message: string) => {
      logs.push(message)
      console.log(`[Check] ${message}`)
    }
    
    // 执行检测（包括 QQ 邮箱和浏览器配置）
    const result = await checkIP(
      proxyUrl,
      log,
      qqEmail,      // 传递解密后的邮箱
      qqAuthCode,   // 传递解密后的授权码
      emailDomains || emailConfig?.domains,
      browserConfig  // 🆕 传递浏览器配置
    )
    
    // 保存检测记录
    const record = await createCheckRecord({
      proxyUrl,
      result
    })
    
    res.json({
      success: true,
      result,
      logs,
      recordId: record.id
    })
  } catch (error: any) {
    console.error('IP检测失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取检测记录列表
 */
export async function getCheckRecords(req: Request, res: Response) {
  try {
    const { limit } = req.query
    const records = await getAllCheckRecords(limit ? parseInt(limit as string) : undefined)
    
    res.json({
      success: true,
      records,
      count: records.length
    })
  } catch (error: any) {
    console.error('获取检测记录失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取检测记录详情
 */
export async function getCheckRecordDetail(req: Request, res: Response) {
  try {
    const { id } = req.params
    const record = await getCheckRecordById(id as string)
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      })
    }
    
    res.json({
      success: true,
      record
    })
  } catch (error: any) {
    console.error('获取检测记录详情失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 删除检测记录
 */
export async function deleteCheckRecordById(req: Request, res: Response) {
  try {
    const { id } = req.params
    await deleteCheckRecord(id as string)
    
    res.json({
      success: true,
      message: '记录已删除'
    })
  } catch (error: any) {
    console.error('删除检测记录失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 清空所有检测记录
 */
export async function clearCheckRecords(req: Request, res: Response) {
  try {
    await clearAllCheckRecords()
    
    res.json({
      success: true,
      message: '所有记录已清空'
    })
  } catch (error: any) {
    console.error('清空检测记录失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取检测统计
 */
export async function getCheckStatistics(req: Request, res: Response) {
  try {
    const stats = await getCheckStats()
    
    res.json({
      success: true,
      stats
    })
  } catch (error: any) {
    console.error('获取检测统计失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 域名分析
 */
export async function analyzeDomains(req: Request, res: Response) {
  try {
    const { domains } = req.body
    
    if (!domains || !Array.isArray(domains)) {
      return res.status(400).json({
        success: false,
        error: '请提供域名列表'
      })
    }
    
    // 动态导入 ipCheck 模块
    const ipCheckModule = await getIPCheckModule()
    
    // 检查是否有域名分析函数
    if (!ipCheckModule.analyzeDomainReputation) {
      return res.status(501).json({
        success: false,
        error: '域名分析功能暂未实现'
      })
    }
    
    const analyzeDomainReputation = ipCheckModule.analyzeDomainReputation
    
    // 日志收集
    const logs: string[] = []
    const log = (message: string) => {
      logs.push(message)
      console.log(`[DomainAnalysis] ${message}`)
    }
    
    // 分析每个域名
    const results = []
    for (const domain of domains) {
      log(`分析域名: ${domain}`)
      const result = await analyzeDomainReputation(domain, log)
      results.push({
        domain,
        ...result
      })
    }
    
    res.json({
      success: true,
      results,
      logs
    })
  } catch (error: any) {
    console.error('域名分析失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
