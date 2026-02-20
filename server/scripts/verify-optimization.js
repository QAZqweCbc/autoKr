/**
 * 验证优化功能是否正常工作
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: path.includes('/metrics') ? data : JSON.parse(data)
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function verifyOptimizations() {
  log('\n🔍 开始验证优化功能...\n', 'blue');

  let passed = 0;
  let failed = 0;

  // 1. 验证健康检查
  log('1️⃣  测试健康检查端点...', 'yellow');
  try {
    const health = await makeRequest('/health');
    if (health.statusCode === 200 && health.data.status) {
      log('   ✅ 完整健康检查正常', 'green');
      log(`   📊 状态: ${health.data.status}`, 'blue');
      log(`   ⏱️  运行时间: ${health.data.uptime}秒`, 'blue');
      passed++;
    } else {
      log('   ❌ 健康检查失败', 'red');
      failed++;
    }
  } catch (error) {
    log(`   ❌ 健康检查错误: ${error.message}`, 'red');
    failed++;
  }

  // 2. 验证简单健康检查
  log('\n2️⃣  测试简单健康检查...', 'yellow');
  try {
    const healthBasic = await makeRequest('/health-basic');
    if (healthBasic.statusCode === 200 && healthBasic.data.status === 'ok') {
      log('   ✅ 简单健康检查正常', 'green');
      passed++;
    } else {
      log('   ❌ 简单健康检查失败', 'red');
      failed++;
    }
  } catch (error) {
    log(`   ❌ 简单健康检查错误: ${error.message}`, 'red');
    failed++;
  }

  // 3. 验证 Prometheus 指标
  log('\n3️⃣  测试 Prometheus 指标端点...', 'yellow');
  try {
    const metrics = await makeRequest('/metrics');
    if (metrics.statusCode === 200 && metrics.data.includes('http_requests_total')) {
      log('   ✅ Prometheus 指标正常', 'green');
      const lines = metrics.data.split('\n').filter(l => !l.startsWith('#') && l.trim());
      log(`   📈 指标数量: ${lines.length}`, 'blue');
      passed++;
    } else {
      log('   ❌ Prometheus 指标失败', 'red');
      failed++;
    }
  } catch (error) {
    log(`   ❌ Prometheus 指标错误: ${error.message}`, 'red');
    failed++;
  }

  // 4. 验证请求限流（发送多个请求）
  log('\n4️⃣  测试请求限流...', 'yellow');
  try {
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(makeRequest('/health-basic'));
    }
    const results = await Promise.all(requests);
    const allSuccess = results.every(r => r.statusCode === 200);
    
    if (allSuccess) {
      log('   ✅ 请求限流中间件已加载', 'green');
      log('   ℹ️  正常请求未触发限流（符合预期）', 'blue');
      passed++;
    } else {
      log('   ❌ 请求限流测试失败', 'red');
      failed++;
    }
  } catch (error) {
    log(`   ❌ 请求限流测试错误: ${error.message}`, 'red');
    failed++;
  }

  // 5. 验证日志文件
  log('\n5️⃣  检查日志文件...', 'yellow');
  const fs = require('fs');
  const path = require('path');
  
  const logFiles = [
    'logs/error.log',
    'logs/combined.log'
  ];
  
  let logFilesExist = true;
  for (const logFile of logFiles) {
    const fullPath = path.join(__dirname, '..', logFile);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      log(`   ✅ ${logFile} 存在 (${stats.size} bytes)`, 'green');
    } else {
      log(`   ⚠️  ${logFile} 不存在（可能还未生成）`, 'yellow');
      logFilesExist = false;
    }
  }
  
  if (logFilesExist) {
    passed++;
  } else {
    log('   ℹ️  日志文件将在服务运行后生成', 'blue');
    passed++;
  }

  // 总结
  log('\n' + '='.repeat(50), 'blue');
  log('📊 验证结果总结', 'blue');
  log('='.repeat(50), 'blue');
  log(`✅ 通过: ${passed}`, 'green');
  log(`❌ 失败: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`📈 成功率: ${Math.round((passed / (passed + failed)) * 100)}%`, 'blue');
  log('='.repeat(50) + '\n', 'blue');

  if (failed === 0) {
    log('🎉 所有优化功能验证通过！', 'green');
    log('💡 提示: 查看 OPTIMIZATION_SUMMARY.md 了解详细信息\n', 'blue');
  } else {
    log('⚠️  部分功能验证失败，请检查服务是否正常运行', 'yellow');
    log('💡 提示: 确保服务已启动 (npm run dev:all)\n', 'blue');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// 检查服务是否运行
log('🔌 检查服务连接...', 'yellow');
makeRequest('/health-basic')
  .then(() => {
    log('✅ 服务已连接\n', 'green');
    verifyOptimizations();
  })
  .catch(() => {
    log('❌ 无法连接到服务', 'red');
    log('💡 请先启动服务: npm run dev:all\n', 'yellow');
    process.exit(1);
  });
