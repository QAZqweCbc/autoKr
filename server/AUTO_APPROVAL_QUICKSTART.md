# 自动审批系统快速开始

## 功能概述

自动审批系统已成功集成到您的项目中，包含以下核心功能：

### 1. 申请自动审批
- 用户已分配账号 ≤ 2 时自动通过
- 无可用账号时自动触发生成任务
- 账号生成完成后自动分配

### 2. 账号池管理
- 可分配账号数 = 普通用户数
- 实时监控账号池健康度
- 自动补充不足的账号

### 3. 释放自动审批
- 关键词匹配自动通过（封禁、不可用、额度已满等）
- 不匹配则进入人工审批

## 新增文件

```
server/src/
├── services/
│   ├── auto-approval.service.ts      # 自动审批核心服务
│   └── account-pool.service.ts       # 账号池管理服务
├── migrations/
│   └── add-revoke-reason.ts          # 数据库迁移脚本
└── docs/
    └── AUTO_APPROVAL_SYSTEM.md       # 完整文档
```

## 修改的文件

```
server/src/
├── models/
│   └── token-allocation.model.ts     # 添加 revoke_reason 字段
├── services/
│   ├── mysql.service.ts              # 添加数据库迁移调用
│   ├── token-allocation.service.ts   # 支持 revoke_reason 字段
│   └── register.service.ts           # 账号生成完成后触发自动分配
├── controllers/
│   └── admin.controller.ts           # 新增释放审批和账号池管理接口
├── routes/
│   └── admin.routes.ts               # 新增路由
├── auth-service/
│   ├── controllers/
│   │   └── token.controller.ts       # 申请时触发自动审批
│   └── routes/
│       └── token.routes.ts           # 新增用户释放申请路由
└── frontend/src/api/
    └── admin.ts                      # 新增前端API接口
```

## 使用方法

### 用户端

#### 1. 提交Token申请
```bash
POST /api/client/tokens/request
Authorization: Bearer <user-token>
```

系统会自动判断是否满足自动审批条件：
- 满足条件：立即分配账号
- 无可用账号：触发生成任务，通知"账号构建中"
- 不满足条件：进入人工审批队列

#### 2. 请求释放Token
```bash
POST /api/client/tokens/:id/request-revoke
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "reason": "账号被封禁"
}
```

系统会根据理由自动判断：
- 包含关键词：自动通过释放
- 不包含关键词：进入人工审批

### 管理员端

#### 1. 查看账号池状态
```bash
GET /api/admin/account-pool/status
Authorization: Bearer <admin-token>
```

返回：
```json
{
  "success": true,
  "status": {
    "totalAccounts": 10,
    "availableAccounts": 5,
    "assignedAccounts": 3,
    "requiredAccounts": 8,
    "deficit": 3,
    "healthy": false
  }
}
```

#### 2. 手动触发账号池补充
```bash
POST /api/admin/account-pool/replenish
Authorization: Bearer <admin-token>
```

#### 3. 查看待审批的释放申请
```bash
GET /api/admin/revoke-requests/pending
Authorization: Bearer <admin-token>
```

#### 4. 审批释放申请
```bash
# 批准
POST /api/admin/revoke-requests/:id/approve
Authorization: Bearer <admin-token>

# 拒绝
POST /api/admin/revoke-requests/:id/reject
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reason": "理由不充分"
}
```

## 数据库变更

系统启动时会自动运行迁移脚本，为 `token_allocations` 表添加 `revoke_reason` 字段。

如果需要手动执行：
```sql
ALTER TABLE token_allocations 
ADD COLUMN revoke_reason TEXT COMMENT '释放理由' AFTER revoked_by;
```

## 配置说明

### 自动审批规则

在 `server/src/services/auto-approval.service.ts` 中：

```typescript
// 申请自动审批阈值
if (activeCount > 2) {
  // 不自动审批
}

// 释放自动审批关键词
const autoApproveKeywords = [
  '封禁', 'banned', 'ban',
  '不可用', 'unavailable', 'not available',
  '额度已满', 'quota', 'full', 'limit',
  '过期', 'expired', 'expire'
]
```

### 账号池规则

在 `server/src/services/account-pool.service.ts` 中：

```typescript
// 可分配账号数 = 普通用户数（排除admin@user.com）
const normalUsers = allUsers.filter(u => u.email !== 'admin@user.com')
const requiredAccounts = normalUsers.length
```

## 测试流程

### 1. 测试申请自动审批

```bash
# 创建测试用户
POST /api/auth/register
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "code": "123456"
}

# 登录获取token
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "password123"
}

# 提交申请（第一次，应该自动通过）
POST /api/client/tokens/request
Authorization: Bearer <token>

# 提交申请（第二次，应该自动通过）
POST /api/client/tokens/request
Authorization: Bearer <token>

# 提交申请（第三次，应该进入人工审批）
POST /api/client/tokens/request
Authorization: Bearer <token>
```

### 2. 测试释放自动审批

```bash
# 请求释放（包含关键词，应该自动通过）
POST /api/client/tokens/:id/request-revoke
Authorization: Bearer <token>
{
  "reason": "账号被封禁"
}

# 请求释放（不包含关键词，应该进入人工审批）
POST /api/client/tokens/:id/request-revoke
Authorization: Bearer <token>
{
  "reason": "不想用了"
}
```

### 3. 测试账号池管理

```bash
# 查看账号池状态
GET /api/admin/account-pool/status
Authorization: Bearer <admin-token>

# 手动触发补充
POST /api/admin/account-pool/replenish
Authorization: Bearer <admin-token>
```

## 监控和日志

系统会在控制台输出详细日志：

```
🤖 开始自动审批流程: <allocation_id>
📊 用户 testuser 当前已分配账号数: 1
✅ 找到可用账号: test@example.com
✅ 自动审批通过，账号已分配
```

查看日志文件：
- `server/logs/main-out.log` - 主服务日志
- `server/logs/main-error.log` - 错误日志

## 故障排查

### 问题1：自动审批未触发
- 检查用户已分配账号数是否 > 2
- 检查日志输出

### 问题2：账号生成失败
- 检查邮箱配置：`GET /api/config/email`
- 查看任务日志：`server/logs/main-out.log`

### 问题3：释放自动审批未通过
- 检查理由是否包含关键词
- 关键词不区分大小写

## 下一步

1. 启动服务器测试功能
2. 根据实际需求调整自动审批规则
3. 监控系统运行情况
4. 查看完整文档：`server/docs/AUTO_APPROVAL_SYSTEM.md`

## 技术支持

如有问题，请查看：
- 完整文档：`server/docs/AUTO_APPROVAL_SYSTEM.md`
- 代码注释：各服务文件中的详细注释
- 日志文件：`server/logs/` 目录
