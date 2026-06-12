/**
 * 账号池管理服务
 * 管理账号池状态，确保可分配账号数 = 普通用户数
 */

import { MySQLAccountDB } from './mysql-account.service'
import { getAllClientUsers } from './client-user.service'
import { isAccountAvailable } from './token-availability.service'
import { startRegisterTask } from './register.service'
import { v4 as uuidv4 } from 'uuid'
import { getEmailConfigForInternal } from './email-config-manager.service'

/**
 * 账号池状态
 */
export interface AccountPoolStatus {
  totalAccounts: number
  availableAccounts: number
  assignedAccounts: number
  requiredAccounts: number
  deficit: number
  healthy: boolean
}

/**
 * 获取账号池状态
 */
export async function getAccountPoolStatus(): Promise<AccountPoolStatus> {
  // 获取所有账号
  const allAccounts = await MySQLAccountDB.getAll()
  
  // 统计可用账号（active状态 + 使用率<85%）
  const availableAccounts = allAccounts.filter(acc => 
    acc.status === 'active' && isAccountAvailable(acc)
  ).length
  
  // 统计已分配账号
  const assignedAccounts = allAccounts.filter(acc => 
    acc.status === 'assigned'
  ).length
  
  // 获取普通用户数量（排除admin@user.com）
  const allUsers = await getAllClientUsers()
  const normalUsers = allUsers.filter(u => u.email !== 'admin@user.com')
  const requiredAccounts = normalUsers.length
  
  // 计算缺口
  const deficit = Math.max(0, requiredAccounts - availableAccounts)
  
  return {
    totalAccounts: allAccounts.length,
    availableAccounts,
    assignedAccounts,
    requiredAccounts,
    deficit,
    healthy: deficit === 0
  }
}

/**
 * 触发账号生成任务
 * @param count 需要生成的账号数量
 * @returns 生成的任务ID列表
 */
export async function triggerAccountGeneration(count: number): Promise<string[]> {
  if (count <= 0) {
    return []
  }
  
  console.log(`🔄 触发账号生成任务，数量: ${count}`)
  
  // 获取邮箱配置
  const emailConfig = await getEmailConfigForInternal()
  if (!emailConfig || !emailConfig.authCode) {
    throw new Error('未配置邮箱授权码，无法生成账号')
  }
  
  // 解析域名列表，移除@符号
  const emailDomains = emailConfig.domains
    .split(',')
    .map(d => d.trim())
    .map(d => d.startsWith('@') ? d.slice(1) : d) // 移除开头的@
    .filter(d => d.length > 0)
  
  if (emailDomains.length === 0) {
    throw new Error('未配置邮箱域名，无法生成账号')
  }
  
  // 使用现有的generator服务生成账号数据
  const { generateAccounts } = await import('./generator.service')
  const { getGeneratorConfig } = await import('./config.service')
  
  // 获取生成器配置
  const generatorConfig = getGeneratorConfig()
  
  const generateResult = generateAccounts({
    count,
    email_domains: emailDomains,
    email_length: generatorConfig.defaultEmailLength,
    password_length: generatorConfig.defaultPasswordLength,
    use_random_name: true
  })
  
  if (!generateResult.success || !generateResult.accounts) {
    throw new Error('生成账号数据失败')
  }
  
  // 使用现有的TaskDB和startRegisterTask创建任务
  const { TaskDB } = await import('./database.adapter')
  const { startRegisterTask } = await import('./register.service')
  
  const taskIds: string[] = []
  
  for (const account of generateResult.accounts) {
    const taskId = uuidv4()
    
    const task = await TaskDB.create({
      id: taskId,
      email: account.email,
      password: account.password,
      auth_code: emailConfig.authCode,
      receive_email: emailConfig.qqEmail,
      client_id: '',
      proxy_url: undefined,
      status: 'pending' as const
    })
    
    // 启动注册任务
    await startRegisterTask(task)
    taskIds.push(taskId)
  }
  
  console.log(`✅ 已创建 ${count} 个账号生成任务`)
  return taskIds
}

/**
 * 检查账号池健康度并自动补充
 */
export async function checkAndReplenishPool(): Promise<void> {
  const status = await getAccountPoolStatus()
  
  console.log(`📊 账号池状态检查:`)
  console.log(`  - 总账号数: ${status.totalAccounts}`)
  console.log(`  - 可用账号: ${status.availableAccounts}`)
  console.log(`  - 已分配: ${status.assignedAccounts}`)
  console.log(`  - 需要账号: ${status.requiredAccounts}`)
  console.log(`  - 缺口: ${status.deficit}`)
  
  if (status.deficit > 0) {
    console.log(`⚠️ 账号池不足，触发自动生成 ${status.deficit} 个账号`)
    await triggerAccountGeneration(status.deficit)
  } else {
    console.log(`✅ 账号池健康`)
  }
}
