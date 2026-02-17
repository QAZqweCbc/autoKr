/**
 * 账号生成器控制器
 */

import { Request, Response } from 'express'
import { generateAccounts } from '../services/generator.service'
import { GenerateAccountDTO } from '../models/generator.model'
import { getEmailConfigForInternal } from '../services/email-config-manager.service'
import { getGeneratorConfig, saveGeneratorConfig } from '../services/config.service'

/**
 * 获取生成器配置
 */
export function getGeneratorConfigHandler(req: Request, res: Response) {
  try {
    const config = getGeneratorConfig()
    res.json({
      success: true,
      config
    })
  } catch (error: any) {
    console.error('获取生成器配置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 保存生成器配置
 */
export function saveGeneratorConfigHandler(req: Request, res: Response) {
  try {
    const { defaultCount, defaultEmailLength, defaultPasswordLength } = req.body
    
    // 验证参数
    if (defaultCount !== undefined && (defaultCount < 1 || defaultCount > 1000)) {
      return res.status(400).json({
        success: false,
        error: '默认生成数量必须在 1-1000 之间'
      })
    }
    
    if (defaultEmailLength !== undefined && (defaultEmailLength < 6 || defaultEmailLength > 30)) {
      return res.status(400).json({
        success: false,
        error: '默认邮箱长度必须在 6-30 之间'
      })
    }
    
    if (defaultPasswordLength !== undefined && (defaultPasswordLength < 8 || defaultPasswordLength > 32)) {
      return res.status(400).json({
        success: false,
        error: '默认密码长度必须在 8-32 之间'
      })
    }
    
    saveGeneratorConfig({
      defaultCount: defaultCount || 5,
      defaultEmailLength: defaultEmailLength || 12,
      defaultPasswordLength: defaultPasswordLength || 12
    })
    
    res.json({
      success: true,
      message: '生成器配置已保存'
    })
  } catch (error: any) {
    console.error('保存生成器配置失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 生成账号
 */
export async function generateAccountsHandler(req: Request, res: Response) {
  try {
    const dto: GenerateAccountDTO = req.body
    
    // 验证必填字段
    if (!dto.count || dto.count <= 0) {
      return res.status(400).json({
        success: false,
        error: '生成数量必须大于 0'
      })
    }
    
    if (dto.count > 1000) {
      return res.status(400).json({
        success: false,
        error: '单次生成数量不能超过 1000'
      })
    }
    
    // 从配置管理器读取邮箱域名（支持 JSON 和 MySQL）
    const emailConfig = await getEmailConfigForInternal()
    let emailDomains: string[] = []
    
    if (emailConfig?.domains) {
      // 解析域名列表（逗号分隔）
      emailDomains = emailConfig.domains
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0)
    }
    
    if (emailDomains.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请先在"邮箱配置"中设置邮箱域名'
      })
    }
    
    // 将域名列表传递给生成器
    dto.email_domains = emailDomains
    
    // 生成账号
    const result = generateAccounts(dto)
    
    res.json(result)
  } catch (error: any) {
    console.error('生成账号失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
