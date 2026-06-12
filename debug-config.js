/**
 * 配置诊断脚本
 * 用于排查配置加载问题
 */

require('dotenv/config');
const path = require('path');
const fs = require('fs');

console.log('========================================');
console.log('配置诊断信息');
console.log('========================================');
console.log('进程工作目录:', process.cwd());
console.log('脚本所在目录:', __dirname);
console.log('平台:', process.platform);
console.log('');

// 检查配置文件路径
const CONFIG_DIR = path.join(process.cwd(), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'database.config.json');

console.log('预期配置目录:', CONFIG_DIR);
console.log('预期配置文件:', CONFIG_FILE);
console.log('配置目录存在:', fs.existsSync(CONFIG_DIR));
console.log('配置文件存在:', fs.existsSync(CONFIG_FILE));
console.log('');

// 读取配置文件
let fileConfig = {};
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    fileConfig = JSON.parse(content);
    console.log('✅ 配置文件读取成功:');
    console.log('  存储模式:', fileConfig.storage);
    console.log('  MySQL 主机:', fileConfig.mysql?.host);
    console.log('  MySQL 端口:', fileConfig.mysql?.port);
    console.log('  MySQL 用户:', fileConfig.mysql?.user);
    console.log('  MySQL 数据库:', fileConfig.mysql?.database);
    console.log('  MySQL 密码:', fileConfig.mysql?.password ? '******' : '(空)');
    console.log('');
  } catch (error) {
    console.error('❌ 配置文件解析失败:', error.message);
  }
} else {
  console.log('❌ 配置文件不存在');
}

// 检查环境变量
console.log('环境变量:');
console.log('  DATABASE_STORAGE:', process.env.DATABASE_STORAGE || '(未设置)');
console.log('  STORAGE_MODE:', process.env.STORAGE_MODE || '(未设置)');
console.log('  MYSQL_HOST:', process.env.MYSQL_HOST || '(未设置)');
console.log('  MYSQL_PORT:', process.env.MYSQL_PORT || '(未设置)');
console.log('  MYSQL_USER:', process.env.MYSQL_USER || '(未设置)');
console.log('  MYSQL_DATABASE:', process.env.MYSQL_DATABASE || '(未设置)');
console.log('  MYSQL_PASSWORD:', process.env.MYSQL_PASSWORD ? '******' : '(未设置)');
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '******' : '(未设置)');
console.log('');

// 检查 .env 文件
const ENV_FILE = path.join(process.cwd(), '.env');
console.log('.env 文件路径:', ENV_FILE);
console.log('.env 文件存在:', fs.existsSync(ENV_FILE));
console.log('');

console.log('========================================');
console.log('模拟配置加载逻辑');
console.log('========================================');

// 模拟默认配置
const DEFAULT_CONFIG = {
  storage: 'mysql',
  mysql: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'KrioServer'
  }
};

// 模拟合并逻辑（问题可能在这里）
const mysqlConfig = {
  ...DEFAULT_CONFIG.mysql,
  ...(fileConfig.mysql && {
    ...fileConfig.mysql,
    ...(process.env.MYSQL_HOST && { host: process.env.MYSQL_HOST }),
    ...(process.env.MYSQL_PORT && { port: parseInt(process.env.MYSQL_PORT) }),
    ...(process.env.MYSQL_USER && { user: process.env.MYSQL_USER }),
    ...(process.env.MYSQL_PASSWORD && { password: process.env.MYSQL_PASSWORD }),
    ...(process.env.DB_PASSWORD && { password: process.env.DB_PASSWORD }),
    ...(process.env.MYSQL_DATABASE && { database: process.env.MYSQL_DATABASE })
  })
};

console.log('最终合并结果:');
console.log('  MySQL 主机:', mysqlConfig.host);
console.log('  MySQL 端口:', mysqlConfig.port);
console.log('  MySQL 用户:', mysqlConfig.user);
console.log('  MySQL 数据库:', mysqlConfig.database);
console.log('  MySQL 密码:', mysqlConfig.password ? '******' : '(空)');
console.log('');

// 检查是否使用了默认值
if (mysqlConfig.host === 'localhost' && mysqlConfig.port === 3306) {
  console.log('⚠️  警告: 使用了默认配置 (localhost:3306)');
  console.log('   可能原因:');
  console.log('   1. fileConfig.mysql 为空或 undefined');
  console.log('   2. 配置文件路径不正确');
  console.log('   3. 进程工作目录不是项目根目录');
  console.log('   4. fileConfig.mysql 存在性检查失败: fileConfig.mysql =', fileConfig.mysql);
} else {
  console.log('✅ 使用了自定义配置');
}

console.log('========================================');
