/**
 * 删除指定邮箱的用户
 * 使用方法: node delete-user.js email@example.com
 *
 * 升级版删除逻辑:
 * - 如果用户注册流程未完成(pending/in_progress)，标记为预删除，等待注册完成后执行
 * - 如果用户注册已完成(completed)，立即删除
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function deleteUser(email) {
  let connection;

  try {
    // 连接数据库
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'kiro_accounts'
    });

    console.log('✅ 数据库连接成功');

    // 查询用户（包含注册状态）
    const [users] = await connection.execute(
      `SELECT id, email, username, status, registration_status, pending_delete, registration_started_at
       FROM client_users WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      console.log(`❌ 未找到邮箱为 ${email} 的用户`);
      return;
    }

    const user = users[0];
    console.log('\n找到用户:');
    console.log(JSON.stringify(user, null, 2));

    // 检查注册状态
    const registrationStatus = user.registration_status || 'completed';

    if (registrationStatus === 'completed') {
      // 注册已完成，立即删除
      await connection.execute('DELETE FROM client_users WHERE email = ?', [email]);
      console.log(`\n✅ 已删除用户: ${email}`);

    } else {
      //除
      console.log(`\n⚠️  用户注册流程未完成 (状态: ${registrationStatus})`);
      console.log('⏳ 标记为预删除，将在注册完成后自动删除');

      await connection.execute(
        'UPDATE client_users SET pending_delete = TRUE WHERE email = ?',
        [email]
      );

      console.log(`\n✅ 已标记预删除: ${email}`);
      console.log('💡 该用户将在注册流程完成后自动删除');

      // 显示注册开始时间
      if (user.registration_started_at) {
        const startTime = new Date(user.registration_started_at).toLocaleString('zh-CN');
        const elapsed = Math.floor((Date.now() - user.registration_started_at) / 1000);
        console.log(`📝 注册开始于: ${startTime} (${elapsed}秒前)`);
      }
    }

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 获取命令行参数
const email = process.argv[2];

if (!email) {
  console.log('使用方法: node delete-user.js email@example.com');
  process.exit(1);
}

deleteUser(email);
