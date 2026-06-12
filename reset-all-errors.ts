/**
 * 快速重置所有账号的错误状�?
 * 使用方法：npx tsx reset-all-errors.ts
 */

import { initDatabase, AccountDB } from './src/services/database.adapter'

async function resetAllErrors() {
  try {
    console.log('🔄 正在重置所有账号的错误状�?..')
    
    // 初始化数据库
    await initDatabase()
    
    // 获取所有账�?
    const accounts = await AccountDB.getAll()
    console.log(`📊 找到 ${accounts.length} 个账号`)
    
    // 统计需要重置的账号
    const needReset = accounts.filter(acc => 
      acc.consecutiveFailures && acc.consecutiveFailures > 0
    )
    console.log(`⚠️  其中 ${needReset.length} 个账号有错误状态`)
    
    if (needReset.length === 0) {
      console.log('�?所有账号状态正常，无需重置')
      return
    }
    
    // 重置每个账号
    let successCount = 0
    for (const account of needReset) {
      try {
        await AccountDB.update(account.id, {
          consecutiveFailures: 0,
          lastError: null
        })
        console.log(`�?已重�? ${account.email} (之前失败${account.consecutiveFailures}�?`)
        successCount++
      } catch (error) {
        console.error(`�?重置失败: ${account.email}`, error)
      }
    }
    
    console.log(`\n�?重置完成！成�? ${successCount}/${needReset.length}`)
    console.log('💡 现在可以重新尝试刷新Token�?)
    
  } catch (error) {
    console.error('�?重置失败:', error)
    process.exit(1)
  }
}

resetAllErrors()
