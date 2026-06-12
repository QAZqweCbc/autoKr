#!/usr/bin/env node

/**
 * 前端部署脚本
 * 功能：构建Vue前端并部署到public目录
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FRONTEND_DIR = path.join(__dirname, '../frontend');
const DIST_DIR = path.join(FRONTEND_DIR, 'dist');
const PUBLIC_DIR = path.join(__dirname, '../public');
const BACKUP_DIR = path.join(__dirname, '../public.backup.' + Date.now());

console.log('\n' + '='.repeat(60));
console.log('🚀 前端部署脚本');
console.log('='.repeat(60));

// 步骤1：检查frontend目录
console.log('\n📁 [1/6] 检查前端目录...');
if (!fs.existsSync(FRONTEND_DIR)) {
  console.error('❌ 错误：frontend目录不存在');
  process.exit(1);
}
console.log('✅ 前端目录存在');

// 步骤2：安装前端依赖
console.log('\n📦 [2/6] 检查前端依赖...');
const nodeModulesDir = path.join(FRONTEND_DIR, 'node_modules');
if (!fs.existsSync(nodeModulesDir)) {
  console.log('⚙️  安装前端依赖（首次运行需要一些时间）...');
  try {
    execSync('npm install', { 
      cwd: FRONTEND_DIR, 
      stdio: 'inherit' 
    });
    console.log('✅ 依赖安装完成');
  } catch (error) {
    console.error('❌ 依赖安装失败');
    process.exit(1);
  }
} else {
  console.log('✅ 依赖已安装');
}

// 步骤3：构建前端
console.log('\n🔨 [3/6] 构建Vue前端...');
try {
  // 清理旧的构建产物
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  
  execSync('npm run build', { 
    cwd: FRONTEND_DIR, 
    stdio: 'inherit' 
  });
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ 构建失败：dist目录未生成');
    process.exit(1);
  }
  console.log('✅ 前端构建完成');
} catch (error) {
  console.error('❌ 构建失败');
  process.exit(1);
}

// 步骤4：备份旧的public目录
console.log('\n💾 [4/6] 备份当前public目录...');
if (fs.existsSync(PUBLIC_DIR)) {
  try {
    fs.renameSync(PUBLIC_DIR, BACKUP_DIR);
    console.log(`✅ 备份完成: ${path.basename(BACKUP_DIR)}`);
  } catch (error) {
    console.error('❌ 备份失败:', error.message);
    process.exit(1);
  }
} else {
  console.log('⚠️  public目录不存在，跳过备份');
}

// 步骤5：复制dist到public
console.log('\n📋 [5/6] 部署新前端...');
try {
  copyDir(DIST_DIR, PUBLIC_DIR);
  console.log('✅ 部署完成');
} catch (error) {
  console.error('❌ 部署失败:', error.message);
  // 尝试回滚
  if (fs.existsSync(BACKUP_DIR)) {
    console.log('🔄 正在回滚...');
    if (fs.existsSync(PUBLIC_DIR)) {
      fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
    }
    fs.renameSync(BACKUP_DIR, PUBLIC_DIR);
    console.log('✅ 已回滚到备份版本');
  }
  process.exit(1);
}

// 步骤6：验证部署
console.log('\n✅ [6/6] 验证部署...');
const indexHtml = path.join(PUBLIC_DIR, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('❌ 验证失败：index.html不存在');
  process.exit(1);
}
console.log('✅ 验证通过');

// 清理旧备份（保留最近3个）
console.log('\n🧹 清理旧备份...');
cleanOldBackups();

console.log('\n' + '='.repeat(60));
console.log('✅ 部署成功！');
console.log('='.repeat(60));
console.log('\n📝 后续步骤：');
console.log('   1. 启动服务器: npm run dev 或 npm start');
console.log('   2. 访问: http://localhost:3000');
console.log('   3. 如有问题，运行回滚: npm run frontend:rollback');
console.log('\n💡 备份位置:', BACKUP_DIR);
console.log('');

// 工具函数：递归复制目录
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 工具函数：清理旧备份
function cleanOldBackups() {
  const serverDir = path.join(__dirname, '..');
  const backups = fs.readdirSync(serverDir)
    .filter(name => name.startsWith('public.backup.'))
    .map(name => ({
      name,
      path: path.join(serverDir, name),
      time: parseInt(name.split('.').pop())
    }))
    .sort((a, b) => b.time - a.time);
  
  // 保留最近3个备份
  const toDelete = backups.slice(3);
  toDelete.forEach(backup => {
    try {
      fs.rmSync(backup.path, { recursive: true, force: true });
      console.log(`   删除旧备份: ${backup.name}`);
    } catch (error) {
      console.warn(`   警告：无法删除 ${backup.name}`);
    }
  });
  
  if (toDelete.length === 0) {
    console.log('   无需清理');
  }
}
