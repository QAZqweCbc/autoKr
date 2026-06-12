/**
 * JSON 数据迁移服务 - 将 JSON 文件数据批量导入到 MySQL
 */

import * as fs from 'fs'
import * as path from 'path'
import { MySQLAccountDB } from './mysql-account.service'
import { MySQLTaskDB } from './mysql.service'
import { Account } from '../models/account.model'
import { Task } from '../models/task.model'

/**
 * 单个文件的迁移结果
 */
export interface FileMigrationResult {
  fileName: string
  tableName: string
  totalRecords: number
  imported: number
  failed: number
  status: 'success' | 'partial' | 'failed'
}

/**
 * 迁移错误详情
 */
export interface MigrationError {
  file: string
  recordIndex: number
  recordId?: string
  error: string
  data?: any
}

/**
 * 完整迁移结果
 */
export interface MigrationResult {
  success: boolean
  totalRecords: number
  importedRecords: number
  failedRecords: number
  files: FileMigrationResult[]
  backupPath: string
  errors: MigrationError[]
  startTime: number
  endTime: number
  duration: number
}

/**
 * JSON 文件映射配置
 */
interface FileMapping {
  fileName: string
  tableName: string
  handler: (records: any[]) => Promise<FileMigrationResult>
}

const DATA_DIR = path.join(process.cwd(), 'data')
const BACKUP_DIR = path.join(DATA_DIR, 'backup')

/**
 * JSON 迁移服务
 */
export class JsonMigratorService {
  /**
   * 检测 data/ 目录中的 JSON 文件
   */
  detectJsonFiles(): string[] {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        console.log('⚠️  data/ 目录不存在')
        return []
      }

      const files = fs.readdirSync(DATA_DIR)
      const jsonFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase()
        const baseName = path.basename(file, ext)

        // 只检测特定的 JSON 文件
        return ext === '.json' &&
               ['accounts', 'tasks', 'users', 'checkson'].includes(baseName)
      })

      console.log(`📁 检测到 ${jsonFiles.length} 个 JSON 文件:`, jsonFiles)
      return jsonFiles
    } catch (error: any) {
      console.error('❌ 检测 JSON 文件失败:', error.message)
      return []
    }
  }

  /**
   * 备份 JSON 文件到时间戳目录
   */
  backupJsonFiles(files: string[]): string {
    try {
      // 创建 backup 目录
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true })
      }

      // 创建时间戳子目录
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, -5) // 移除毫秒和 Z

      const backupPath = path.join(BACKUP_DIR, timestamp)
      fs.mkdirSync(backupPath, { recursive: true })

      // 复制文件
      let copiedCount = 0
      for (const file of files) {
        const srcPath = path.join(DATA_DIR, file)
        const destPath = path.join(backupPath, file)

        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath)
          copiedCount++
        }
      }

      console.log(`✅ 已备份 ${copiedCount} 个文件到: ${backupPath}`)
      return backupPath
    } catch (error: any) {
      console.error('❌ 备份文件失败:', error.message)
      throw error
    }
  }

  /**
   * 迁移 accounts.json
   */
  private async migrateAccounts(records: any[]): Promise<FileMigrationResult> {
    const result: FileMigrationResult = {
      fileName: 'accounts.json',
      tableName: 'accounts',
      totalRecords: records.length,
      imported: 0,
      failed: 0,
      status: 'success'
    }

    const errors: MigrationError[] = []

    for (let i = 0; i < records.length; i++) {
      const record = records[i]

      try {
        // 转换为标准 Account 格式
        const account: Account = this.normalizeAccount(record)

        // 批量导入到 MySQL
        await MySQLAccountDB.create(account)
        result.imported++
      } catch (error: any) {
        result.failed++
        errors.push({
          file: 'accounts.json',
          recordIndex: i,
          recordId: record.id || record.email,
          error: error.message,
          data: record
        })

        // 记录错误但继续处理
        console.warn(`⚠️  账号导入失败 [${i}]:`, error.message)
      }
    }

    if (result.failed > 0) {
      result.status = result.imported > 0 ? 'partial' : 'failed'
    }

    return result
  }

  /**
   * 迁移 tasks.json
   */
  private async migrateTasks(records: any[]): Promise<FileMigrationResult> {
    const result: FileMigrationResult = {
      fileName: 'tasks.json',
      tableName: 'tasks',
      totalRecords: records.length,
      imported: 0,
      failed: 0,
      status: 'success'
    }

    const errors: MigrationError[] = []

    for (let i = 0; i < records.length; i++) {
      const record = records[i]

      try {
        // 转换为标准 Task 格式
        const task: Task = this.normalizeTask(record)

        // 批量导入到 MySQL
        await MySQLTaskDB.create(task)
        result.imported++
      } catch (error: any) {
        result.failed++
        errors.push({
          file: 'tasks.json',
          recordIndex: i,
          recordId: record.id,
          error: error.message,
          data: record
        })

        console.warn(`⚠️  任务导入失败 [${i}]:`, error.message)
      }
    }

    if (result.failed > 0) {
      result.status = result.imported > 0 ? 'partial' : 'failed'
    }

    return result
  }

  /**
   * 标准化账号数据（兼容多种格式）
   */
  private normalizeAccount(record: any): Account {
    const now = Date.now()

    return {
      id: record.id || this.generateId(),
      email: record.email,
      password: record.password || '',
      nickname: record.nickname,
      idp: record.idp || 'BuilderId',
      userId: record.userId || record.user_id,
      visitorId: record.visitorId || record.visitor_id,

      credentials: {
        accessToken: record.access_token || record.x_amz_sso_authn || record.credentials?.accessToken || '',
        csrfToken: record.csrf_token || record.credentials?.csrfToken,
        refreshToken: record.refresh_token || record.credentials?.refreshToken,
        ssoToken: record.x_amz_sso_authn || record.credentials?.ssoToken,
        clientId: record.client_id || record.credentials?.clientId,
        clientSecret: record.client_secret || record.credentials?.clientSecret,
        region: record.region || record.credentials?.region,
        expiresAt: record.expires_at || record.credentials?.expiresAt,
        authMethod: record.auth_method || record.credentials?.authMethod,
        provider: record.provider || record.credentials?.provider
      },

      subscription: {
        type: record.subscription_type || record.subscription?.type || 'Free',
        title: record.subscription_title || record.subscription?.title,
        rawType: record.subscription_raw_type || record.subscription?.rawType,
        expiresAt: record.subscription_expires_at || record.subscription?.expiresAt,
        daysRemaining: record.subscription_days_remaining || record.days_remaining || record.subscription?.daysRemaining,
        upgradeCapability: record.upgrade_capability || record.subscription?.upgradeCapability,
        overageCapability: record.overage_capability || record.subscription?.overageCapability,
        managementTarget: record.management_target || record.subscription?.managementTarget
      },

      usage: {
        current: record.usage_current || record.usage?.current || 0,
        limit: record.usage_limit || record.usage?.limit || 0,
        percentUsed: record.usage_percent_used || record.usage_percent || record.usage?.percentUsed || 0,
        lastUpdated: record.usage_last_updated || record.last_sync_at || record.usage?.lastUpdated || now,
        baseLimit: record.base_limit || record.usage?.baseLimit,
        baseCurrent: record.base_current || record.usage?.baseCurrent,
        freeTrialLimit: record.free_trial_limit || record.usage?.freeTrialLimit,
        freeTrialCurrent: record.free_trial_current || record.usage?.freeTrialCurrent,
        freeTrialExpiry: record.free_trial_expiry || record.usage?.freeTrialExpiry,
        bonuses: this.parseBonuses(record.usage_bonuses || record.usage?.bonuses),
        nextResetDate: record.next_reset_date || record.usage?.nextResetDate,
        resourceDetail: {
          resourceType: record.resource_type || record.usage?.resourceDetail?.resourceType,
          displayName: record.resource_display_name || record.usage?.resourceDetail?.displayName,
          displayNamePlural: record.resource_display_name_plural || record.usage?.resourceDetail?.displayNamePlural,
          currency: record.resource_currency || record.usage?.resourceDetail?.currency,
          unit: record.resource_unit || record.usage?.resourceDetail?.unit,
          overageRate: record.overage_rate || record.usage?.resourceDetail?.overageRate,
          overageCap: record.overage_cap || record.usage?.resourceDetail?.overageCap,
          overageEnabled: record.overage_enabled || record.usage?.resourceDetail?.overageEnabled
        }
      },

      groupId: record.group_id || record.groupId,
      tags: this.parseTags(record.tags),
      ownerUserId: record.owner_user_id || record.ownerUserId,

      status: record.status || 'pending',
      lastError: record.last_error || record.lastError,
      consecutiveFailures: record.consecutive_failures || record.consecutiveFailures || 0,
      isActive: record.is_active !== undefined ? record.is_active : record.isActive,

      deviceId: record.device_id || record.deviceId,
      assignedAt: record.assigned_at || record.assignedAt,

      createdAt: record.created_at || record.createdAt || now,
      lastUsedAt: record.last_used_at || record.lastUsedAt,
      lastCheckedAt: record.last_checked_at || record.lastCheckedAt || record.last_sync_at
    }
  }

  /**
   * 标准化任务数据
   */
  private normalizeTask(record: any): Task {
    const now = Date.now()

    return {
      id: record.id || this.generateId(),
      email: record.email,
      password: record.password,
      receive_email: record.receive_email || record.receiveEmail,
      auth_code: record.auth_code || record.authCode,
      client_id: record.client_id || record.clientId,
      proxy_url: record.proxy_url || record.proxyUrl,
      status: record.status || 'pending',
      error: record.error,
      created_at: record.created_at || record.createdAt || now,
      updated_at: record.updated_at || record.updatedAt || now
    }
  }

  /**
   * 解析奖励数据
   */
  private parseBonuses(bonuses: any): any[] | undefined {
    if (!bonuses) return undefined
    if (typeof bonuses === 'string') {
      try {
        return JSON.parse(bonuses)
      } catch {
        return undefined
      }
    }
    return Array.isArray(bonuses) ? bonuses : undefined
  }

  /**
   * 解析标签数据
   */
  private parseTags(tags: any): string[] | undefined {
    if (!tags) return undefined
    if (typeof tags === 'string') {
      try {
        return JSON.parse(tags)
      } catch {
        return [tags]
      }
    }
    return Array.isArray(tags) ? tags : undefined
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 主迁移流程
   */
  async migrateAllData(): Promise<MigrationResult> {
    const startTime = Date.now()

    console.log('\n' + '='.repeat(60))
    console.log('🚀 开始 JSON 数据迁移到 MySQL')
    console.log('='.repeat(60) + '\n')

    const result: MigrationResult = {
      success: false,
      totalRecords: 0,
      importedRecords: 0,
      failedRecords: 0,
      files: [],
      backupPath: '',
      errors: [],
      startTime,
      endTime: 0,
      duration: 0
    }

    try {
      // 1. 检测 JSON 文件
      console.log('📋 步骤 1: 检测 JSON 文件')
      const jsonFiles = this.detectJsonFiles()

      if (jsonFiles.length === 0) {
        console.log('ℹ️  没有需要迁移的 JSON 文件')
        result.success = true
        result.endTime = Date.now()
        result.duration = result.endTime - startTime
        return result
      }

      // 2. 备份文件
      console.log('\n📋 步骤 2: 备份 JSON 文件')
      result.backupPath = this.backupJsonFiles(jsonFiles)

      // 3. 迁移数据
      console.log('\n📋 步骤 3: 迁移数据到 MySQL\n')

      for (const file of jsonFiles) {
        const filePath = path.join(DATA_DIR, file)
        const baseName = path.basename(file, '.json')

        console.log(`🔄 处理: ${file}`)

        try {
          // 读取 JSON 文件
          const content = fs.readFileSync(filePath, 'utf-8')
          let records: any[] = []

          try {
            const parsed = JSON.parse(content)
            records = Array.isArray(parsed) ? parsed : []
          } catch (parseError: any) {
            console.error(`❌ 解析 ${file} 失败:`, parseError.message)
            result.errors.push({
              file,
              recordIndex: -1,
              error: `JSON 解析失败: ${parseError.message}`
            })
            continue
          }

          if (records.length === 0) {
            console.log(`   ⚠️  文件为空，跳过`)
            continue
          }

          // 根据文件类型调用对应的迁移方法
          let fileResult: FileMigrationResult

          switch (baseName) {
            case 'accounts':
              fileResult = await this.migrateAccounts(records)
              break

            case 'tasks':
              fileResult = await this.migrateTasks(records)
              break

            case 'users':
            case 'checkson':
              // 暂不支持的文件类型
              console.log(`   ℹ️  暂不支持迁移 ${file}，跳过`)
              continue

            default:
              console.log(`   ⚠️  未知文件类型: ${file}，跳过`)
              continue
          }

          result.files.push(fileResult)
          result.totalRecords += fileResult.totalRecords
          result.importedRecords += fileResult.imported
          result.failedRecords += fileResult.failed

          // 打印结果
          const statusIcon = fileResult.status === 'success' ? '✅' :
                             fileResult.status === 'partial' ? '⚠️' : '❌'
          console.log(`   ${statusIcon} 完成: 总计 ${fileResult.totalRecords}, 成功 ${fileResult.imported}, 失败 ${fileResult.failed}`)

        } catch (error: any) {
          console.error(`❌ 处理 ${file} 时出错:`, error.message)
          result.errors.push({
            file,
            recordIndex: -1,
            error: `文件处理失败: ${error.message}`
          })
        }
      }

      // 4. 生成迁移报告
      console.log('\n📋 步骤 4: 生成迁移报告')
      await this.generateMigrationReport(result)

      // 判断整体成功
      result.success = result.failedRecords === 0 || result.importedRecords > 0

      result.endTime = Date.now()
      result.duration = result.endTime - startTime

      // 打印总结
      console.log('\n' + '='.repeat(60))
      if (result.success) {
        console.log('✅ 数据迁移完成')
      } else {
        console.log('⚠️  数据迁移完成（部分失败）')
      }
      console.log('='.repeat(60))
      console.log(`总记录数: ${result.totalRecords}`)
      console.log(`成功导入: ${result.importedRecords}`)
      console.log(`导入失败: ${result.failedRecords}`)
      console.log(`备份路径: ${result.backupPath}`)
      console.log(`耗时: ${(result.duration / 1000).toFixed(2)}s`)
      console.log('='.repeat(60) + '\n')

      return result

    } catch (error: any) {
      console.error('\n❌ 迁移过程出现严重错误:', error.message)
      result.success = false
      result.endTime = Date.now()
      result.duration = result.endTime - startTime
      result.errors.push({
        file: 'GLOBAL',
        recordIndex: -1,
        error: error.message
      })
      throw error
    }
  }

  /**
   * 生成详细的迁移报告
   */
  private async generateMigrationReport(result: MigrationResult): Promise<void> {
    try {
      const reportPath = path.join(DATA_DIR, 'migration-report.json')

      const report = {
        timestamp: new Date().toISOString(),
        success: result.success,
        summary: {
          totalRecords: result.totalRecords,
          importedRecords: result.importedRecords,
          failedRecords: result.failedRecords,
          duration: `${(result.duration / 1000).toFixed(2)}s`
        },
        backupPath: result.backupPath,
        files: result.files,
        errors: result.errors.slice(0, 100) // 限制错误数量，避免报告过大
      }

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
      console.log(`   ✅ 报告已保存: ${reportPath}`)

    } catch (error: any) {
      console.warn(`   ⚠️  生成报告失败:`, error.message)
    }
  }
}

// 导出单例
export const jsonMigrator = new JsonMigratorService()
