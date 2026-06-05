/**
 * 环境变量校验工具
 * 在应用启动前检查必要的数据库密码环境变量是否已设置
 */

/**
 * 校验数据库密码环境变量
 * 
 * 校验规则：
 * 1. DB_PASSWORD 或 MYSQL_PASSWORD 至少有一个不为空
 * 2. REDIS_PASSWORD 不为空
 * 
 * @throws 校验失败时打印中文错误信息并 process.exit(1)
 */
export function validateDatabaseEnv(): void {
  const dbPassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD
  const redisPassword = process.env.REDIS_PASSWORD

  const missing: string[] = []

  // 检查 MySQL 密码环境变量
  if (!dbPassword || dbPassword.trim() === '') {
    missing.push('DB_PASSWORD 或 MYSQL_PASSWORD（MySQL 数据库密码）')
  }

  // 检查 Redis 密码环境变量
  if (!redisPassword || redisPassword.trim() === '') {
    missing.push('REDIS_PASSWORD（Redis 密码）')
  }

  // 如果有缺失的环境变量，打印错误并退出
  if (missing.length > 0) {
    console.error('')
    console.error('='.repeat(60))
    console.error('❌ 数据库密码环境变量未设置')
    console.error('='.repeat(60))
    console.error('')
    console.error('发现以下必需的环境变量缺失或未设置：')
    console.error('')
    for (const item of missing) {
      console.error(`  - ${item}`)
    }
    console.error('')
    console.error('处理方式（在 .env 文件中添加）：')
    console.error('  DB_PASSWORD=你的MySQL数据库密码')
    console.error('  MYSQL_PASSWORD=你的MySQL数据库密码（二选一）')
    console.error('  REDIS_PASSWORD=你的Redis密码')
    console.error('')
    console.error('或在启动命令中设置环境变量后重试。')
    console.error('='.repeat(60))
    console.error('')
    process.exit(1)
  }
}
