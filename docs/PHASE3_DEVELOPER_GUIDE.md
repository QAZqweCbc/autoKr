# Phase 3 开发者指南

本指南介绍 Phase 3 新增功能的使用方法和最佳实践。

---

## 📋 目录

1. [Request ID 追踪](#request-id-追踪)
2. [事务保护](#事务保护)
3. [健康检查](#健康检查)
4. [最佳实践](#最佳实践)

---

## 1. Request ID 追踪

### 概述

Request ID 追踪系统为每个 HTTP 请求分配唯一标识符，用于日志关联和问题排查。

### 自动功能

Request ID 中间件已自动应用到所有路由，无需手动配置：

```typescript
// 已在 src/index.ts 中自动应用
app.use(requestIdMiddleware)
```

### 在路由中使用

每个请求对象都包含 `requestId` 和带有 Request ID 的 `logger`：

```typescript
import { Router } from 'express'

const router = Router()

router.get('/api/accounts', async (req, res) => {
  // 使用带有 Request ID 的 logger
  req.logger.info('Fetching accounts')
  
  try {
    const accounts = await getAccounts()
    req.logger.info('Accounts fetched successfully', { count: accounts.length })
    res.json(accounts)
  } catch (error) {
    req.logger.error('Failed to fetch accounts', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
```

### 客户端传入 Request ID

客户端可以通过 `X-Request-ID` 头传入自定义 Request ID：

```bash
curl -H "X-Request-ID: my-custom-id" http://localhost:3000/api/accounts
```

响应头会包含相同的 Request ID：

```
X-Request-ID: my-custom-id
```

### 日志示例

所有日志自动包含 Request ID：

```json
{
  "timestamp": "2026-04-15 10:30:45",
  "level": "info",
  "message": "Fetching accounts",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "GET",
  "path": "/api/accounts",
  "ip": "127.0.0.1"
}
```

---

## 2. 事务保护

### 概述

事务保护确保多个数据库操作要么全部成功，要么全部失败，防止数据不一致。

### 基础用法

使用 `withTransaction` 包装数据库操作：

```typescript
import { withTransaction } from '../utils/transaction.util'

async function createAccountWithTags(accountData: any, tags: string[]) {
  return withTransaction(async (connection) => {
    // 插入账号
    const [result] = await connection.execute(
      'INSERT INTO accounts (id, email, password) VALUES (?, ?, ?)',
      [accountData.id, accountData.email, accountData.password]
    )
    
    // 插入标签
    for (const tag of tags) {
      await connection.execute(
        'INSERT INTO account_tags (account_id, tag) VALUES (?, ?)',
        [accountData.id, tag]
      )
    }
    
    return { success: true, accountId: accountData.id }
  }, 'createAccountWithTags')
}
```

### 批量操作

使用 `withBatchTransaction` 执行多个独立操作：

```typescript
import { withBatchTransaction } from '../utils/transaction.util'

async function batchUpdateAccounts(updates: Array<{ id: string, status: string }>) {
  const operations = updates.map(update => 
    (connection) => connection.execute(
      'UPDATE accounts SET status = ? WHERE id = ?',
      [update.status, update.id]
    )
  )
  
  return withBatchTransaction(operations, 'batchUpdateAccounts')
}
```

### 带重试的事务

使用 `withTransactionRetry` 处理可能失败的操作：

```typescript
import { withTransactionRetry } from '../utils/transaction.util'

async function criticalOperation(data: any) {
  return withTransactionRetry(
    async (connection) => {
      // 关键操作
      await connection.execute('INSERT INTO critical_data ...')
      return { success: true }
    },
    'criticalOperation',
    3,      // 最大重试次数
    1000    // 初始重试延迟（毫秒）
  )
}
```

### 错误处理

事务会自动回滚并重新抛出错误：

```typescript
try {
  await withTransaction(async (connection) => {
    await connection.execute('INSERT INTO accounts ...')
    throw new Error('Something went wrong')  // 触发回滚
  }, 'myOperation')
} catch (error) {
  console.error('Transaction failed:', error.message)
  // 所有操作已回滚
}
```

### 可重试的错误

以下错误会自动重试（使用 `withTransactionRetry`）：

- `ECONNRESET` - 连接重置
- `ETIMEDOUT` - 连接超时
- `ENOTFOUND` - 主机未找到
- `ER_LOCK_DEADLOCK` - 死锁
- `ER_LOCK_WAIT_TIMEOUT` - 锁等待超时

---

## 3. 健康检查

### 概述

健康检查端点提供系统状态监控，支持多种检查级别。

### 完整健康检查

```bash
GET /health
```

返回详细的系统状态：

```json
{
  "status": "healthy",
  "timestamp": 1713196800000,
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "up",
      "responseTime": 5
    },
    "websocket": {
      "status": "up"
    },
    "memory": {
      "status": "healthy",
      "used": 256,
      "total": 512,
      "percentage": 50
    },
    "cpu": {
      "status": "healthy",
      "usage": 30,
      "loadAverage": [1.5, 1.2, 1.0]
    }
  },
  "metrics": {
    "requests": {
      "total": 1000,
      "success": 980,
      "failed": 20,
      "avgResponseTime": 150
    },
    "errors": {
      "last24h": 5,
      "last1h": 1
    }
  }
}
```

### 简单健康检查

用于负载均衡器的快速检查：

```bash
GET /health-basic
```

返回：

```json
{
  "status": "ok"
}
```

### Prometheus 指标

```bash
GET /metrics
```

返回 Prometheus 格式的指标：

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total 1000

# HELP http_requests_success Total number of successful HTTP requests
# TYPE http_requests_success counter
http_requests_success 980

# HELP memory_usage_percentage Memory usage percentage
# TYPE memory_usage_percentage gauge
memory_usage_percentage 50
```

### 健康状态

系统健康状态分为三个级别：

| 状态 | HTTP 状态码 | 说明 |
|------|------------|------|
| `healthy` | 200 | 所有服务正常 |
| `degraded` | 200 | 部分服务降级（警告） |
| `unhealthy` | 503 | 关键服务不可用 |

### 监控集成

#### Prometheus

在 `prometheus.yml` 中添加：

```yaml
scrape_configs:
  - job_name: 'kiro-account-manager'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

#### Kubernetes Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health-basic
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
```

#### Kubernetes Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
```

---

## 4. 最佳实践

### Request ID 最佳实践

#### ✅ 推荐

```typescript
// 使用 req.logger 而不是全局 logger
router.get('/api/accounts', (req, res) => {
  req.logger.info('Processing request')  // ✅ 包含 Request ID
})

// 在错误处理中使用
try {
  await someOperation()
} catch (error) {
  req.logger.error('Operation failed', { error: error.message })  // ✅
  res.status(500).json({ error: 'Internal error' })
}
```

#### ❌ 避免

```typescript
// 不要使用全局 logger
import { logger } from '../utils/logger'

router.get('/api/accounts', (req, res) => {
  logger.info('Processing request')  // ❌ 不包含 Request ID
})
```

### 事务最佳实践

#### ✅ 推荐

```typescript
// 将相关操作放在同一个事务中
await withTransaction(async (connection) => {
  await connection.execute('INSERT INTO accounts ...')
  await connection.execute('INSERT INTO tags ...')
  await connection.execute('UPDATE stats ...')
}, 'createAccountWithTags')

// 使用有意义的上下文名称
await withTransaction(operation, 'createAccount')  // ✅
```

#### ❌ 避免

```typescript
// 不要嵌套事务
await withTransaction(async (connection) => {
  await connection.execute('INSERT INTO accounts ...')
  
  // ❌ 不要在事务中再开启事务
  await withTransaction(async (conn2) => {
    await conn2.execute('INSERT INTO tags ...')
  }, 'nested')
}, 'outer')

// 不要在事务中执行长时间操作
await withTransaction(async (connection) => {
  await connection.execute('INSERT INTO accounts ...')
  await sleep(10000)  // ❌ 阻塞连接
}, 'slowOperation')
```

### 健康检查最佳实践

#### ✅ 推荐

```typescript
// 在负载均衡器中使用简单检查
// HAProxy
backend kiro_backend
  option httpchk GET /health-basic
  
// 在监控系统中使用完整检查
// Prometheus
scrape_configs:
  - job_name: 'kiro'
    metrics_path: '/metrics'
```

#### ❌ 避免

```typescript
// 不要在负载均衡器中使用完整检查（太慢）
// HAProxy
backend kiro_backend
  option httpchk GET /health  // ❌ 太慢，使用 /health-basic
```

### 日志最佳实践

#### ✅ 推荐

```typescript
// 使用结构化日志
req.logger.info('Account created', {
  accountId: account.id,
  email: account.email,
  status: account.status
})

// 记录关键操作
req.logger.info('Starting critical operation', { operationId })
await criticalOperation()
req.logger.info('Critical operation completed', { operationId })
```

#### ❌ 避免

```typescript
// 不要记录敏感信息
req.logger.info('Account created', {
  password: account.password  // ❌ 不要记录密码
})

// 不要在循环中记录大量日志
for (const item of items) {
  req.logger.debug('Processing item', { item })  // ❌ 太多日志
}
```

---

## 🔍 故障排查

### Request ID 未出现在日志中

**问题**: 日志中没有 Request ID

**解决方案**:
1. 确保使用 `req.logger` 而不是全局 `logger`
2. 检查 Request ID 中间件是否已应用
3. 确保中间件在路由之前应用

### 事务回滚但没有错误

**问题**: 事务回滚但没有看到错误日志

**解决方案**:
1. 检查是否捕获了错误但没有重新抛出
2. 确保在 `withTransaction` 中抛出错误
3. 检查日志级别是否设置正确

### 健康检查返回 503

**问题**: `/health` 返回 503 状态码

**解决方案**:
1. 检查数据库连接状态
2. 检查内存和 CPU 使用率
3. 查看详细的健康检查响应找出问题服务

---

## 📚 相关文档

- [Phase 3 实施完成报告](../PHASE3_IMPLEMENTATION_COMPLETE.md)
- [后端代码审计报告](../BACKEND_CODE_AUDIT_REPORT.md)
- [Winston 日志库文档](https://github.com/winstonjs/winston)
- [MySQL2 事务文档](https://github.com/sidorares/node-mysql2#using-connection-pools)

---

**最后更新**: 2026-04-15  
**维护者**: Kiro Development Team
