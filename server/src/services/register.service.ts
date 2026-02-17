/**
 * 注册服务 - 执行自动注册任务
 * 🔄 预留接口，等待实现
 */

import { v4 as uuidv4 } from 'uuid'
import { Task, TaskDB, AccountDB } from './database.adapter'
import { Account, IdpType, AccountStatus, SubscriptionType } from '../models/account.model'
import { getAutoRegisterAWS } from './autoRegister.proxy'
import { emitTaskUpdate, emitTaskLog, emitAccountUpdate } from '../websocket/socket.handler'
import { loadBrowserConfig, applyLinuxOptimizations, getEnvironmentInfo } from './config.service'
import { getEmailConfigForInternal } from './email-config-manager.service'
import { syncAccountUsage } from './kiro-api.service'

// 当前正在执行的任务数
let runningTasks = 0
let MAX_CONCURRENT = 3 // 最大并发数

// 任务队列
const taskQueue: Task[] = []

/**
 * 设置最大并发数
 */
export function setMaxConcurrent(max: number) {
  if (max > 0 && max <= 10) {
    MAX_CONCURRENT = max
    console.log(`✅ 最大并发数已设置为: ${MAX_CONCURRENT}`)
  }
}

/**
 * 获取队列状态
 */
export function getQueueStatus() {
  return {
    running: runningTasks,
    queued: taskQueue.length,
    maxConcurrent: MAX_CONCURRENT
  }
}

/**
 * 启动注册任务
 * 🔄 预留接口 - 等待实现
 */
export async function startRegisterTask(task: Task) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔄 注册任务已接收 [${task.id}]`)
  console.log(`📧 邮箱: ${task.email}`)
  console.log('='.repeat(60))
  
  // 如果达到最大并发数，加入队列
  if (runningTasks >= MAX_CONCURRENT) {
    console.log(`⏳ 任务加入队列 [${task.email}]`)
    taskQueue.push(task)
    emitTaskUpdate(task.id, 'pending', '等待执行')
    return
  }
  
  // 执行任务
  await executeTask(task)
}

/**
 * 执行任务
 * 🔄 预留接口 - 等待实现
 */
async function executeTask(task: Task) {
  runningTasks++
  
  try {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🚀 开始执行任务 [${task.id}]`)
    console.log(`📧 邮箱: ${task.email}`)
    console.log(`🔄 当前并发: ${runningTasks}/${MAX_CONCURRENT}`)
    console.log('='.repeat(60))
    
    // 更新状态为运行中
    await TaskDB.updateStatus(task.id, 'running')
    emitTaskUpdate(task.id, 'running')
    
    // 日志回调
    const log = (message: string) => {
      console.log(`[${task.email}] ${message}`)
      emitTaskLog(task.id, message)
    }
    
    // 🔄 动态加载 autoRegisterAWS
    log('正在加载注册模块...')
    const autoRegisterAWS = await getAutoRegisterAWS()
    log('✅ 注册模块加载成功')
    
    // 🔧 加载浏览器配置
    log('正在加载浏览器配置...')
    const browserConfig = await loadBrowserConfig()
    log(`✅ 浏览器配置加载成功: ${browserConfig.browserType}`)
    
    // 🐧 获取环境信息
    const envInfo = getEnvironmentInfo()
    
    if (envInfo.isLinux) {
      log('🐧 检测到 Linux 环境')
    }
    if (envInfo.isRoot) {
      log('⚠️  检测到 root 用户，将添加安全参数')
    }
    
    // 🔧 应用 Linux 优化
    const optimizedConfig = applyLinuxOptimizations(browserConfig)
    
    // 📝 记录浏览器配置详情
    log(`浏览器类型: ${optimizedConfig.browserType}`)
    log(`运行模式: ${optimizedConfig.headless ? 'headless' : 'headed'}`)
    log(`启动参数数量: ${optimizedConfig.args.length}`)
    log(`延迟范围: ${optimizedConfig.delayMin}s - ${optimizedConfig.delayMax}s`)
    
    if (optimizedConfig.browserPath) {
      log(`自定义浏览器路径: ${optimizedConfig.browserPath}`)
    }
    
    if (envInfo.isRoot && optimizedConfig.args.includes('--no-sandbox')) {
      log('✓ 已添加 root 用户安全参数 (--no-sandbox)')
    }
    
    // 🔄 执行注册
    log('开始执行注册流程...')
    
    // 📧 从配置管理器获取解密后的邮箱配置
    log('正在获取邮箱配置...')
    const emailConfig = await getEmailConfigForInternal()
    
    if (!emailConfig || !emailConfig.authCode) {
      throw new Error('未配置邮箱授权码，请先在配置页面设置')
    }
    
    // 调试：检查授权码是否被正确解密
    const authCodePreview = emailConfig.authCode.substring(0, 4) + '****'
    log(`✅ 邮箱配置加载成功: ${emailConfig.qqEmail}`)
    log(`📝 授权码预览: ${authCodePreview} (长度: ${emailConfig.authCode.length})`)
    
    // 检查是否是脱敏数据
    if (emailConfig.authCode === '******' || emailConfig.authCode.includes('*')) {
      throw new Error('❌ 授权码未正确解密，请检查存储配置')
    }
    
    // 使用配置中的授权码，而不是任务表中的
    const authCode = emailConfig.authCode
    const receiveEmail = task.receive_email || emailConfig.qqEmail
    
    const result = await autoRegisterAWS(
      task.email,
      task.password,
      authCode,  // ✅ 使用从配置管理器获取的解密后的授权码
      task.client_id || '',
      log,
      task.password, // emailPassword
      false, // skipOutlookActivation
      task.proxy_url,
      receiveEmail,
      optimizedConfig  // 🔧 使用优化后的浏览器配置
    )
    
    if (result.success) {
      // 注册成功
      console.log(`✅ 注册成功 [${task.email}]`)
      console.log(`  SSO Token: ${result.ssoToken?.substring(0, 20)}...`)
      console.log(`  姓名: ${result.name}`)
      log('✅ 注册成功！')
      
      // 保存账号
      try {
        // 准备基本账号数据
        const baseAccountData = {
          id: uuidv4(),
          email: task.email,
          password: task.password,
          idp: 'BuilderId' as IdpType,
          status: 'active' as AccountStatus,
          credentials: {
            accessToken: result.ssoToken || '',
            refreshToken: task.auth_code,
            clientId: task.client_id,
            clientSecret: '',
            region: 'us-east-1'
          },
          subscription: {
            type: 'Free' as SubscriptionType
          },
          usage: {
            current: 0,
            limit: 0,
            percentUsed: 0,
            lastUpdated: Date.now()
          },
          createdAt: Date.now()
        } as Account
        
        // 尝试同步完整账号信息（用户信息、订阅信息、使用量等）
        log('正在获取账号详细信息...')
        console.log(`[${task.email}] 调用 Kiro API 同步账号信息...`)
        
        // 新注册账号可能需要等待 token 生效，添加重试逻辑
        let syncResult = await syncAccountUsage(result.ssoToken || '', 'BuilderId')
        
        if (!syncResult.success && syncResult.error?.includes('401')) {
          log('⏳ Token 尚未生效，等待 3 秒后重试...')
          await new Promise(resolve => setTimeout(resolve, 3000))
          syncResult = await syncAccountUsage(result.ssoToken || '', 'BuilderId')
        }
        
        let accountData = baseAccountData
        if (syncResult.success && syncResult.data) {
          // 同步成功，使用映射工具更新账户信息
          log('✅ 账号信息同步成功')
          console.log(`[${task.email}] 账号信息同步成功:`)
          console.log(`  - 用户ID: ${syncResult.data.user_id}`)
          console.log(`  - 订阅类型: ${syncResult.data.subscription_title}`)
          console.log(`  - 使用量: ${syncResult.data.usage_current}/${syncResult.data.usage_limit}`)
          
          const { updateAccountUsage } = await import('../utils/account-mapper')
          accountData = updateAccountUsage(baseAccountData, syncResult.data)
        } else {
          // 同步失败，记录警告但继续保存基本信息
          log(`⚠️ 账号信息同步失败: ${syncResult.error || '未知错误'}`)
          console.warn(`[${task.email}] 账号信息同步失败: ${syncResult.error}`)
          console.warn(`[${task.email}] 将只保存基本信息，可稍后手动同步`)
        }
        
        // 保存账号（基本信息或完整信息）
        await AccountDB.create(accountData)
        console.log(`💾 账号已保存到数据库`)
        log('💾 账号已保存')
        
        // 通知前端账号列表已更新
        emitAccountUpdate()
      } catch (dbError: any) {
        console.error(`❌ 保存账号失败:`, dbError.message)
        log(`⚠️ 保存账号失败: ${dbError.message}`)
      }
      
      // 更新任务状态
      await TaskDB.updateStatus(task.id, 'success')
      emitTaskUpdate(task.id, 'success')
      
    } else {
      // 注册失败
      const error = result.error || '未知错误'
      console.error(`❌ 注册失败 [${task.email}]: ${error}`)
      log(`❌ 注册失败: ${error}`)
      
      await TaskDB.updateStatus(task.id, 'failed', error)
      emitTaskUpdate(task.id, 'failed', error)
    }
    
  } catch (error: any) {
    console.error(`💥 任务执行异常 [${task.email}]:`, error)
    
    await TaskDB.updateStatus(task.id, 'failed', error.message || '执行异常')
    emitTaskUpdate(task.id, 'failed', error.message)
    
  } finally {
    runningTasks--
    console.log(`✓ 任务完成，当前并发: ${runningTasks}/${MAX_CONCURRENT}\n`)
    
    // 处理队列中的下一个任务
    if (taskQueue.length > 0) {
      const nextTask = taskQueue.shift()!
      console.log(`📤 从队列取出任务: ${nextTask.email}`)
      executeTask(nextTask)
    }
  }
}

