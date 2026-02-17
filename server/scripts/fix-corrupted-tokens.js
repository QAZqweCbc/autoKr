/**
 * 修复数据库中损坏的Token数据
 * 
 * 问题：
 * 1. 部分账号的 access_token 字段被错误地写入了 JWT 格式的 Bearer Token (eyJ...)
 * 2. 部分账号的 refresh_token 也被错误地写入了 JWT 格式
 * 
 * 正确的格式：
 * - access_token: OAuth Access Token (aoaAAAAA...)
 * - refresh_token: OAuth Refresh Token (aorAAAAA...)
 * - sso_token: 初始的 OAuth Access Token (历史记录，不应改变)
 * 
 * 修复策略：
 * 1. 如果 access_token 是 JWT 格式 (eyJ...)，从 sso_token 复制正确的 OAuth token
 * 2. 如果 refresh_token 是 JWT 格式，标记为需要重新导入
 */

const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

// 读取配置
const configPath = path.join(__dirname, '../data/config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

async function fixCorruptedTokens() {
  let connection

  try {
    // 连接数据库
    connection = await mysql.createConnection({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database
    })

    console.log('✅ 已连接到 MySQL 数据库\n')

    // 查询所有账号
    const [accounts] = await connection.execute('SELECT * FROM accounts')

    console.log(`📊 总账号数: ${accounts.length}\n`)
    console.log('='.repeat(80))

    let fixedAccessTokenCount = 0
    let corruptedRefreshTokenCount = 0
    const needReimport = []

    for (const account of accounts) {
      const { id, email, access_token, refresh_token, sso_token } = account

      let needsFix = false
      let issues = []

      // 检查 access_token 是否是 JWT 格式
      if (access_token && access_token.startsWith('eyJ')) {
        issues.push('❌ access_token 是 JWT 格式 (错误)')
        needsFix = true

        // 检查 sso_token 是否是正确的 OAuth 格式
        if (sso_token && sso_token.startsWith('aoa')) {
          issues.push(`✅ sso_token 是正确的 OAuth 格式，将复制到 access_token`)
          
          // 修复：将 sso_token 复制到 access_token
          await connection.execute(
            'UPDATE accounts SET access_token = ? WHERE id = ?',
            [sso_token, id]
          )
          
          fixedAccessTokenCount++
          issues.push('✅ 已修复 access_token')
        } else {
          issues.push('⚠️  sso_token 也不正确，需要重新导入')
          needReimport.push({ email, reason: 'access_token 和 sso_token 都损坏' })
        }
      }

      // 检查 refresh_token 是否是 JWT 格式
      if (refresh_token && refresh_token.startsWith('eyJ')) {
        issues.push('❌ refresh_token 是 JWT 格式 (错误)')
        issues.push('⚠️  refresh_token 无法自动修复，需要重新导入')
        corruptedRefreshTokenCount++
        needsFix = true
        
        if (!needReimport.find(item => item.email === email)) {
          needReimport.push({ email, reason: 'refresh_token 损坏' })
        }
      }

      // 打印账号信息
      if (needsFix) {
        console.log(`\n📧 ${email}`)
        console.log(`   ID: ${id}`)
        issues.forEach(issue => console.log(`   ${issue}`))
        console.log('-'.repeat(80))
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('📊 修复统计:')
    console.log(`   ✅ 修复的 access_token: ${fixedAccessTokenCount} 个`)
    console.log(`   ❌ 损坏的 refresh_token: ${corruptedRefreshTokenCount} 个`)
    console.log(`   ⚠️  需要重新导入: ${needReimport.length} 个`)

    if (needReimport.length > 0) {
      console.log('\n⚠️  以下账号需要从应用端重新导出并导入:')
      needReimport.forEach(({ email, reason }) => {
        console.log(`   - ${email} (${reason})`)
      })
      console.log('\n💡 操作步骤:')
      console.log('   1. 在应用端选择这些账号')
      console.log('   2. 点击"导出账号"按钮')
      console.log('   3. 在 Server 的"导入账号"页面重新导入')
    }

    console.log('\n✅ 修复完成！请重启 Server 以应用更改。')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ 修复失败:', error)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

// 运行修复
fixCorruptedTokens()
