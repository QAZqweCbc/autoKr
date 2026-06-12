/**
 * 从应用端导出的JSON文件导入账号到服务器
 * 使用方法: npx ts-node scripts/import-from-app-json.ts <json文件路径>
 */

import * as fs from 'fs'
import * as path from 'path'

interface AppAccount {
  email: string
  userId: string
  nickname?: string
  idp: string
  credentials: {
    accessToken: string
    refreshToken: string
    clientId: string
    clientSecret: string
    region: string
    expiresAt?: number
  }
  subscription?: {
    type: string
    title: string
    daysRemaining?: number
  }
  usage?: {
    current: number
    limit: number
    freeTrialExpiry?: string
  }
  status: string
  id: string
  createdAt: number
}

interface AppExport {
  version: string
  exportedAt: number
  accounts: AppAccount[]
}

async function importAccounts(jsonFilePath: string) {
  try {
    // 读取JSON文件
    const fullPath = path.resolve(jsonFilePath)
    console.log(`\n📂 读取文件: ${fullPath}`)
    
    if (!fs.existsSync(fullPath)) {
      console.error(`�?文件不存�? ${fullPath}`)
      process.exit(1)
    }
    
    const fileContent = fs.readFileSync(fullPath, 'utf-8')
    const data: AppExport = JSON.parse(fileContent)
    
    console.log(`\n📊 文件信息:`)
    console.log(`   版本: ${data.version}`)
    console.log(`   导出时间: ${new Date(data.exportedAt).toLocaleString()}`)
    console.log(`   账号数量: ${data.accounts.length}`)
    
    // 服务器地址
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'
    console.log(`\n🌐 服务器地址: ${serverUrl}`)
    
    // 导入每个账号
    let successCount = 0
    let failCount = 0
    
    for (const account of data.accounts) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`📥 导入账号: ${account.email}`)
      
      try {
        const response = await fetch(`${serverUrl}/api/token/import-from-app`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: account.email,
            sso_token: account.credentials.accessToken,
            refresh_token: account.credentials.refreshToken,
            client_id: account.credentials.clientId,
            client_secret: account.credentials.clientSecret,
            region: account.credentials.region,
            user_id: account.userId,
            subscription_info: {
              type: account.subscription?.type,
              status: account.status,
              trial_expiry: account.usage?.freeTrialExpiry
            },
            usage_info: {
              current_usage: account.usage?.current,
              usage_limit: account.usage?.limit
            }
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          console.log(`�?导入成功`)
          console.log(`   账号ID: ${result.account.id}`)
          console.log(`   用户ID: ${result.account.userId}`)
          console.log(`   订阅类型: ${result.account.subscription.type}`)
          console.log(`   支持自动刷新: ${result.account.credentials.refreshToken ? '�? : '�?}`)
          successCount++
        } else {
          console.error(`�?导入失败: ${result.error}`)
          failCount++
        }
      } catch (error: any) {
        console.error(`�?导入失败: ${error.message}`)
        failCount++
      }
    }
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📊 导入完成`)
    console.log(`   成功: ${successCount}`)
    console.log(`   失败: ${failCount}`)
    console.log(`   总计: ${data.accounts.length}`)
    console.log(`${'='.repeat(60)}\n`)
    
  } catch (error: any) {
    console.error(`\n�?导入失败: ${error.message}`)
    process.exit(1)
  }
}

// 获取命令行参�?
const args = process.argv.slice(2)

if (args.length === 0) {
  console.log(`
使用方法:
  npx ts-node scripts/import-from-app-json.ts <json文件路径>

示例:
  npx ts-node scripts/import-from-app-json.ts kiro-accounts-2026-02-07.json
  npx ts-node scripts/import-from-app-json.ts E:\\git\\Kiro-auto-register\\kiro-accounts-2026-02-07.json

环境变量:
  SERVER_URL - 服务器地址（默�? http://localhost:3000�?
`)
  process.exit(1)
}

const jsonFilePath = args[0]
importAccounts(jsonFilePath)
