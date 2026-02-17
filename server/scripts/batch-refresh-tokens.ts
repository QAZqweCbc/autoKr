/**
 * 批量刷新所有账号的Token
 * 使用方法: npx ts-node server/scripts/batch-refresh-tokens.ts
 */

async function batchRefreshTokens() {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'
  
  try {
    console.log(`\n🔄 开始批量刷新Token...`)
    console.log(`🌐 服务器地址: ${serverUrl}\n`)
    
    // 获取所有账号
    const accountsRes = await fetch(`${serverUrl}/api/accounts`)
    const accountsData = await accountsRes.json()
    
    if (!accountsData.success || !accountsData.accounts) {
      console.error('❌ 获取账号列表失败')
      process.exit(1)
    }
    
    const accounts = accountsData.accounts
    console.log(`📊 找到 ${accounts.length} 个账号\n`)
    
    let successCount = 0
    let skipCount = 0
    let failCount = 0
    
    for (const account of accounts) {
      console.log(`${'='.repeat(60)}`)
      console.log(`📧 账号: ${account.email}`)
      console.log(`🆔 ID: ${account.id}`)
      
      // 检查是否有OAuth凭证
      if (!account.credentials.refreshToken || !account.credentials.clientId) {
        console.log(`⏭️  跳过（缺少OAuth凭证）`)
        skipCount++
        continue
      }
      
      try {
        const refreshRes = await fetch(`${serverUrl}/api/token/${account.id}/refresh`, {
          method: 'POST'
        })
        
        const result = await refreshRes.json()
        
        if (result.success) {
          console.log(`✅ 刷新成功`)
          if (result.account?.expiresIn) {
            console.log(`   过期时间: ${result.account.expiresIn}秒`)
          }
          successCount++
        } else {
          console.log(`❌ 刷新失败: ${result.error}`)
          if (result.needReimport) {
            console.log(`   提示: 需要从应用端重新导入`)
          }
          failCount++
        }
      } catch (error: any) {
        console.log(`❌ 刷新失败: ${error.message}`)
        failCount++
      }
    }
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📊 刷新完成`)
    console.log(`   成功: ${successCount}`)
    console.log(`   跳过: ${skipCount}`)
    console.log(`   失败: ${failCount}`)
    console.log(`   总计: ${accounts.length}`)
    console.log(`${'='.repeat(60)}\n`)
    
  } catch (error: any) {
    console.error(`\n❌ 批量刷新失败: ${error.message}`)
    process.exit(1)
  }
}

batchRefreshTokens()
