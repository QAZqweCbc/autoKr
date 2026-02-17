#!/usr/bin/env node

/**
 * 前端回滚脚本
 * 功能：恢复到之前的public备份
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SERVER_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(SERVER_DIR, 'public');

console.log('\n' + '='.repeat(60));
console.log('🔄 前端回滚脚本');
console.log('='.repeat(60));

// 查找所有备份
const backups = fs.readdirSync(SERVER_DIR)
  .filter(name => name.startsWith('public.backup.'))
  .map(name => ({
    name,
    path: path.join(SERVER_DIR, name),
    time: parseInt(name.split('.').pop()),
    date: new Date(parseInt(name.split('.').pop()))
  }))
  .sort((a, b) => b.time - a.time);

if (backups.length === 0) {
  console.log('\n❌ 没有找到备份文件');
  console.log('💡 备份文件格式: public.backup.{timestamp}');
  process.exit(1);
}

console.log('\n📦 找到以下备份：\n');
backups.forEach((backup, index) => {
  console.log(`   [${index + 1}] ${backup.name}`);
  console.log(`       时间: ${backup.date.toLocaleString('zh-CN')}`);
  console.log('');
});

// 交互式选择
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('请选择要恢复的备份编号 (1-' + backups.length + ', 0取消): ', (answer) => {
  const choice = parseInt(answer);
  
  if (choice === 0 || isNaN(choice)) {
    console.log('\n❌ 已取消');
    rl.close();
    process.exit(0);
  }
  
  if (choice < 1 || choice > backups.length) {
    console.log('\n❌ 无效的选择');
    rl.close();
    process.exit(1);
  }
  
  const selectedBackup = backups[choice - 1];
  
  console.log('\n⚠️  警告：这将删除当前的public目录！');
  rl.question('确认回滚? (yes/no): ', (confirm) => {
    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ 已取消');
      rl.close();
      process.exit(0);
    }
    
    // 执行回滚
    console.log('\n🔄 开始回滚...');
    
    try {
      // 删除当前public
      if (fs.existsSync(PUBLIC_DIR)) {
        console.log('   删除当前public目录...');
        fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
      }
      
      // 恢复备份
      console.log('   恢复备份...');
      fs.renameSync(selectedBackup.path, PUBLIC_DIR);
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ 回滚成功！');
      console.log('='.repeat(60));
      console.log('\n📝 后续步骤：');
      console.log('   1. 重启服务器');
      console.log('   2. 访问: http://localhost:3000');
      console.log('');
    } catch (error) {
      console.error('\n❌ 回滚失败:', error.message);
      process.exit(1);
    }
    
    rl.close();
  });
});
