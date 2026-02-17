# Server Token 自动刷新优化 - 设计文档

## 1. 系统架构

### 1.1 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    Auto Refresh Scheduler                    │
│  - 定时触发刷新                                               │
│  - 动态配置更新                                               │
│  - 健康检查                                                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Smart Refresh Orchestrator                      │
│  - 智能过期检测                                               │
│  - 账号状态过滤                                               │
│  - 并发控制                                                   │
│  - 进度通知                                                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ Token        │      │ Account      │
│ Refresher    │      │ Info Syncer  │
│              │      │              │
│ - OIDC刷新   │      │ - 使用量同步 │
│ - 错误处理   │      │ - 封禁检测   │
│ - 重试机制   │      │ - 订阅更新   │
└──────────────┘      └──────────────┘
        │                     │
        └──────────┬──────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Refresh Logger                            │
│  - 批次日志                                                   │
│  - 账号详情                                                   │
│  - 性能指标                                                   │
│  - 历史查询                                                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 数据流

```
1. 定时触发 → 2. 加载配置 → 3. 获取账号列表
                                    ↓
                            4. 智能过期检测
                                    ↓
                            5. 状态过滤
                                    ↓
                            6. 批量刷新（并发控制）
                                    ↓
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            7a. Token刷新                    7b. 信息同步
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                            8. 更新数据库
                                    ↓
                            9. 记录日志
                                    ▼
                            10. 发送通知（可选）
```

## 2. 数据模型扩展

### 2.1 Account 模型新增字段

```typescript
interface Account {
  // ... 现有字段 ...
  
  // 新增：错误状态管理
  lastError?: string                    // 最后一次错误信息
  lastCheckedAt?: number                // 最后检查时间（毫秒时间戳）
  consecutiveFailures?: number          // 连续失败次数
  
  // 新增：Token 过期管理
  credentials: {
    // ... 现有字段 ...
    expiresAt?: number                  // Token 过期时间（毫秒时间戳）
  }
}
```

### 2.2 RefreshLog 模型（新增）

```typescript
interface RefreshLog {
  id: string                            // 日志ID
  timestamp: number                     // 刷新时间戳
  totalAccounts: number                 // 总账号数
  successCount: number                  // 成功数
  failedCount: number                   // 失败数
  skippedCount: number                  // 跳过数
  duration: number                      // 总耗时（毫秒）
  details: RefreshDetail[]              // 详细结果
}

interface RefreshDetail {
  accountId: string                     // 账号ID
  email: string                         // 邮箱
  success: boolean                      // 是否成功
  error?: string                        // 错误信息
  duration: number                      // 耗时（毫秒）
  skipped?: boolean                     // 是否跳过
  skipReason?: string                   // 跳过原因
}
```

### 2.3 HealthStatus 模型（新增）

```typescript
interface HealthStatus {
  timestamp: number                     // 检查时间
  accounts: {
    total: number                       // 总数
    active: number                      // 活跃数
    banned: number                      // 封禁数
    failed: number                      // 失败数
    needsRefresh: number                // 需要刷新数
  }
  lastRefresh: {
    time: number                        // 上次刷新时间
    success: number                     // 成功数
    failed: number                      // 失败数
  }
  nextRefresh: number                   // 下次刷新时间
  alerts: Alert[]                       // 告警列表
}

interface Alert {
  level: 'ERROR' | 'WARNING' | 'INFO'   // 告警级别
  message: string                       // 告警信息
  timestamp: number                     // 告警时间
}
```

## 3. 核心算法

### 3.1 智能过期检测算法

```typescript
const TOKEN_REFRESH_BEFORE_EXPIRY = 5 * 60 * 1000 // 过期前5分钟

function needsRefresh(account: Account): boolean {
  const now = Date.now()
  const expiresAt = account.credentials.expiresAt
  
  // 没有过期时间，需要刷新以获取过期时间
  if (!expiresAt) {
    return true
  }
  
  // 检查是否即将过期
  const timeUntilExpiry = expiresAt - now
  return timeUntilExpiry <= TOKEN_REFRESH_BEFORE_EXPIRY
}
```

### 3.2 账号状态过滤算法

```typescript
function shouldSkipAccount(account: Account): { skip: boolean; reason?: string } {
  // 跳过已封禁账号
  if (account.lastError?.includes('AccountSuspendedException') || 
      account.lastError?.includes('UnauthorizedException')) {
    return { skip: true, reason: '账号已封禁' }
  }
  
  // 跳过连续失败3次以上的账号
  if (account.consecutiveFailures && account.consecutiveFailures >= 3) {
    return { skip: true, reason: `连续失败${account.consecutiveFailures}次` }
  }
  
  // 跳过缺少OAuth凭证的账号
  if (!account.credentials.refreshToken || 
      !account.credentials.clientId || 
      !account.credentials.clientSecret) {
    return { skip: true, reason: '缺少OAuth凭证' }
  }
  
  return { skip: false }
}
```

### 3.3 并发控制算法

```typescript
async function batchRefresh(
  accounts: Account[], 
  concurrency: number,
  onProgress?: (progress: RefreshProgress) => void
): Promise<RefreshResult> {
  const results: RefreshDetail[] = []
  
  for (let i = 0; i < accounts.length; i += concurrency) {
    const batch = accounts.slice(i, i + concurrency)
    
    const batchResults = await Promise.allSettled(
      batch.map(account => refreshSingleAccount(account))
    )
    
    batchResults.forEach((result, index) => {
      const account = batch[index]
      const detail = processResult(account, result)
      results.push(detail)
      
      // 发送进度通知
      if (onProgress) {
        onProgress({
          current: i + index + 1,
          total: accounts.length,
          detail
        })
      }
    })
    
    // 批次间延迟，避免API限流
    if (i + concurrency < accounts.length) {
      await delay(200)
    }
  }
  
  return aggregateResults(results)
}
```

## 4. API 设计

### 4.1 新增 API 端点

```typescript
// 健康检查
GET /api/health/refresh
Response: HealthStatus

// 查询刷新日志
GET /api/refresh/logs?limit=10&offset=0
Response: { logs: RefreshLog[], total: number }

// 重置账号错误状态
POST /api/accounts/:id/reset-error
Response: { success: boolean }

// 批量重置错误状态
POST /api/accounts/reset-errors
Body: { accountIds: string[] }
Response: { success: boolean, count: number }
```

### 4.2 WebSocket 事件（可选）

```typescript
// 刷新开始
emit('refresh:start', { 
  timestamp: number, 
  totalAccounts: number 
})

// 账号刷新完成
emit('refresh:account', { 
  accountId: string,
  email: string,
  success: boolean,
  error?: string
})

// 批量刷新完成
emit('refresh:complete', { 
  timestamp: number,
  successCount: number,
  failedCount: number,
  duration: number
})

// 告警通知
emit('refresh:alert', Alert)
```

## 5. 配置设计

### 5.1 扩展配置项

```typescript
interface AutoRefreshConfig {
  enabled: boolean                      // 是否启用
  interval: number                      // 刷新间隔（分钟）
  concurrency: number                   // 并发数
  lastRefreshTime: string | null        // 上次刷新时间
  
  // 新增配置
  refreshBeforeExpiry: number           // 过期前多久刷新（分钟，默认5）
  maxConsecutiveFailures: number        // 最大连续失败次数（默认3）
  retryFailedAfter: number              // 失败后多久重试（小时，默认24）
  logRetentionDays: number              // 日志保留天数（默认30）
  enableWebSocket: boolean              // 是否启用WebSocket通知（默认false）
  enableAlerts: boolean                 // 是否启用告警（默认true）
  alertThresholds: {
    bannedAccountsError: number         // 封禁账号告警阈值（默认1）
    failureRateWarning: number          // 失败率告警阈值（默认0.3）
  }
}
```

## 6. 实现计划

### 阶段一：P0 功能（核心优化）

1. **数据模型扩展**
   - 添加 `lastError`、`lastCheckedAt`、`consecutiveFailures` 字段
   - 添加 `credentials.expiresAt` 字段
   - 数据库迁移脚本

2. **智能过期检测**
   - 实现 `needsRefresh()` 函数
   - 修改刷新逻辑，只刷新即将过期的账号
   - 记录 Token 过期时间

3. **账号状态管理**
   - 实现 `shouldSkipAccount()` 函数
   - 刷新失败时更新错误状态
   - 刷新成功时重置失败计数

4. **刷新后同步账号信息**
   - Token 刷新成功后调用 Kiro API
   - 更新使用量、订阅信息
   - 检测封禁状态（423 状态码）

### 阶段二：P1 功能（可观测性）

5. **刷新日志系统**
   - 实现 `RefreshLog` 数据模型
   - 记录每次批量刷新的详细信息
   - 提供日志查询 API
   - 自动清理旧日志

6. **健康检查和告警**
   - 实现 `HealthStatus` 数据模型
   - 提供健康检查 API
   - 实现告警规则引擎
   - 生成告警通知

7. **动态配置更新**
   - 配置更新后自动重启调度器
   - 验证配置有效性
   - 记录配置变更日志

### 阶段三：P2 功能（增强特性）

8. **WebSocket 实时通知**
   - 实现刷新进度推送
   - 实现告警推送
   - 前端订阅管理

9. **告警通知渠道**
   - 邮件通知
   - Webhook 通知
   - 可配置的通知规则

## 7. 性能优化

### 7.1 减少 API 调用

- 智能过期检测：只刷新即将过期的 Token，预计减少 80% 的 API 调用
- 状态过滤：跳过已知失败的账号，避免重复失败

### 7.2 并发控制

- 可配置的并发数（默认 10）
- 批次间延迟（200ms），避免 API 限流
- 单个请求超时控制（30秒）

### 7.3 数据库优化

- 批量更新操作
- 索引优化（email, status, lastCheckedAt）
- 定期清理旧日志

## 8. 错误处理

### 8.1 错误分类

```typescript
enum RefreshErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',           // 网络错误
  AUTH_ERROR = 'AUTH_ERROR',                 // 认证错误
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',   // 账号封禁
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS', // 凭证无效
  API_ERROR = 'API_ERROR',                   // API错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'            // 未知错误
}
```

### 8.2 错误处理策略

| 错误类型 | 处理策略 | 重试 |
|---------|---------|------|
| NETWORK_ERROR | 记录错误，下次继续尝试 | 是 |
| AUTH_ERROR | 标记账号，跳过后续刷新 | 否 |
| ACCOUNT_SUSPENDED | 标记账号，跳过后续刷新 | 否 |
| INVALID_CREDENTIALS | 标记账号，需要重新导入 | 否 |
| API_ERROR | 记录错误，下次继续尝试 | 是 |
| UNKNOWN_ERROR | 记录错误，下次继续尝试 | 是 |

## 9. 测试策略

### 9.1 单元测试

- 智能过期检测逻辑
- 账号状态过滤逻辑
- 并发控制逻辑
- 错误处理逻辑

### 9.2 集成测试

- Token 刷新流程
- 账号信息同步流程
- 日志记录流程
- 健康检查流程

### 9.3 性能测试

- 100 个账号批量刷新耗时
- 并发控制效果
- 数据库性能影响

## 10. 监控指标

### 10.1 关键指标

- 刷新成功率
- 平均刷新耗时
- API 调用次数
- 封禁账号数量
- 失败账号数量

### 10.2 告警规则

- 封禁账号数 > 0 → ERROR
- 失败率 > 30% → WARNING
- 平均耗时 > 5秒 → WARNING
- 连续刷新失败 > 3次 → ERROR

## 11. 向后兼容性

### 11.1 数据库兼容

- 新增字段使用可选类型
- 提供数据库迁移脚本
- 兼容旧数据格式

### 11.2 API 兼容

- 保持现有 API 接口不变
- 只新增 API 端点
- 响应格式向后兼容

### 11.3 配置兼容

- 新增配置项有默认值
- 兼容旧配置格式
- 自动迁移配置
