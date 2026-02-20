# 自动审批系统文档

## 概述

自动审批系统是一个智能化的账号分配和释放管理系统，能够根据预设规则自动处理用户的申请和释放请求，减少人工干预，提高效率。

## 核心功能

### 1. 申请自动审批

当用户提交Token申请时，系统会自动检查以下条件：

- **自动审批条件**：用户当前已分配账号数 ≤ 2
- **配额检查**：用户未超过最大配额限制

#### 审批流程

```
用户提交申请
    ↓
检查已分配账号数 ≤ 2？
    ↓ 是
检查是否有可用账号？
    ↓ 有
自动分配账号 → 审批通过
    ↓ 无
触发账号生成任务
    ↓
通知用户"账号构建中"
    ↓
等待账号生成完成
    ↓
自动分配给用户
```

### 2. 账号池管理

系统维护一个账号池，确保可分配账号数量满足需求。

#### 账号池规则

- **可分配账号数 = 普通用户总数**
- 系统实时监控账号池状态
- 当账号不足时自动触发生成任务

#### 账号池状态

```typescript
{
  totalAccounts: number      // 总账号数
  availableAccounts: number  // 可用账号数
  assignedAccounts: number   // 已分配账号数
  requiredAccounts: number   // 需要的账号数（=普通用户数）
  deficit: number            // 缺口数量
  healthy: boolean           // 是否健康
}
```

### 3. 释放自动审批

用户可以请求释放已分配的Token，系统会根据释放理由自动判断是否通过。

#### 自动审批关键词

以下关键词会触发自动审批通过：

- 中文：封禁、不可用、额度已满、过期
- 英文：banned、ban、unavailable、not available、quota、full、limit、expired、expire

#### 释放流程

```
用户提交释放申请（带理由）
    ↓
检查理由是否包含关键词？
    ↓ 是
自动审批通过 → 释放账号
    ↓ 否
进入人工审批队列
```

## API接口

### 用户端接口

#### 1. 提交Token申请

```http
POST /api/client/tokens/request
Authorization: Bearer <token>
```

响应：
```json
{
  "success": true,
  "allocation_id": "uuid",
  "message": "申请已自动审批通过",
  "auto_approved": true
}
```

或（账号生成中）：
```json
{
  "success": true,
  "allocation_id": "uuid",
  "message": "账号构建中，请稍候...",
  "generating": true
}
```

#### 2. 请求释放Token

```http
POST /api/client/tokens/:id/request-revoke
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "账号被封禁"
}
```

响应：
```json
{
  "success": true,
  "message": "释放申请已自动审批通过",
  "auto_approved": true
}
```

### 管理员接口

#### 1. 获取待审批的释放申请

```http
GET /api/admin/revoke-requests/pending
Authorization: Bearer <admin-token>
```

#### 2. 批准释放申请

```http
POST /api/admin/revoke-requests/:id/approve
Authorization: Bearer <admin-token>
```

#### 3. 拒绝释放申请

```http
POST /api/admin/revoke-requests/:id/reject
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reason": "理由不充分"
}
```

#### 4. 获取账号池状态

```http
GET /api/admin/account-pool/status
Authorization: Bearer <admin-token>
```

#### 5. 手动触发账号池补充

```http
POST /api/admin/account-pool/replenish
Authorization: Bearer <admin-token>
```

## 数据库变更

### token_allocations表新增字段

```sql
ALTER TABLE token_allocations 
ADD COLUMN revoke_reason TEXT COMMENT '释放理由' AFTER revoked_by;
```

该字段用于存储用户提交的释放理由，系统会根据理由内容判断是否自动审批。

## 配置说明

### 自动审批规则配置

自动审批规则硬编码在以下文件中：

- `server/src/services/auto-approval.service.ts`

如需修改规则，可以调整以下参数：

```typescript
// 申请自动审批：已分配账号数阈值
if (activeCount > 2) {
  // 不自动审批
}

// 释放自动审批：关键词列表
const autoApproveKeywords = [
  '封禁', 'banned', 'ban',
  '不可用', 'unavailable', 'not available',
  '额度已满', 'quota', 'full', 'limit',
  '过期', 'expired', 'expire'
]
```

## 监控和日志

### 日志输出

系统会在控制台输出详细的审批日志：

```
🤖 开始自动审批流程: <allocation_id>
📊 用户 <username> 当前已分配账号数: <count>
✅ 找到可用账号: <email>
✅ 自动审批通过，账号已分配
```

### WebSocket通知

系统会通过WebSocket实时通知用户和管理员：

- 申请自动审批通过
- 账号构建中
- 释放申请自动审批通过

## 故障排查

### 常见问题

1. **自动审批未触发**
   - 检查用户已分配账号数是否 > 2
   - 检查用户是否已达最大配额

2. **账号生成失败**
   - 检查邮箱配置是否正确
   - 检查邮箱授权码是否有效
   - 查看任务日志：`server/logs/main-out.log`

3. **释放自动审批未通过**
   - 检查释放理由是否包含关键词
   - 关键词匹配不区分大小写

## 最佳实践

1. **定期检查账号池状态**
   - 使用 `GET /api/admin/account-pool/status` 监控账号池健康度
   - 当 `deficit > 0` 时，考虑手动触发补充

2. **合理设置用户配额**
   - 根据实际需求调整 `max_tokens`
   - 避免单个用户占用过多资源

3. **监控自动审批日志**
   - 定期查看日志，了解自动审批情况
   - 发现异常及时调整规则

## 未来优化方向

1. 支持自定义自动审批规则（通过配置文件）
2. 添加审批统计和报表功能
3. 支持更复杂的审批条件（如时间段、用户组等）
4. 添加审批历史记录和审计日志
