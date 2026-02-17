# 用户管理与Token分配系统 - 设计文档

## 1. 系统架构

### 1.1 整体架构
```
┌─────────────────────────────────────────────────────────┐
│                     客户端应用                            │
│              (注册、登录、申请Token)                       │
└────────────┬────────────────────────────────┬───────────┘
             │                                │
             │ HTTP/REST                      │ HTTP/REST
             │ Port 2233                      │ Port 3000
             ▼                                ▼
┌────────────────────────┐      ┌─────────────────────────┐
│   注册认证服务          │      │    主服务 (现有)         │
│  (auth-service)        │      │  - 账户管理              │
│  - 用户注册            │      │  - Token管理             │
│  - 验证码              │      │  - 任务管理              │
│  - JWT认证             │      │  - 管理面板              │
└────────────┬───────────┘      └──────────┬──────────────┘
             │                              │
             └──────────────┬───────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │   MySQL 数据库    │
                  │  - client_users  │
                  │  - allocations   │
                  │  - accounts      │
                  │  - codes         │
                  └──────────────────┘
```

### 1.2 服务端口分配
- **端口 2233**: 注册认证服务（独立Express应用）
- **端口 3000**: 主服务（现有系统）

### 1.3 技术栈
- **后端**: Node.js + TypeScript + Express
- **数据库**: MySQL 8.0+
- **认证**: JWT (jsonwebtoken)
- **密码加密**: bcrypt
- **邮件**: 复用现有邮件服务
- **API调用**: 复用 kiro-api.service.ts


## 2. 数据库设计

### 2.1 client_users 表
```sql
CREATE TABLE client_users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
  max_tokens INT DEFAULT 2 COMMENT '最大Token配额',
  created_at BIGINT NOT NULL,
  last_login_at BIGINT,
  INDEX idx_email (email),
  INDEX idx_username (username),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.2 token_allocations 表
```sql
CREATE TABLE token_allocations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(36),
  status ENUM('pending', 'approved', 'rejected', 'active', 'revoked') DEFAULT 'pending',
  requested_at BIGINT NOT NULL,
  approved_at BIGINT,
  approved_by VARCHAR(36),
  reject_reason TEXT,
  revoked_at BIGINT,
  revoked_by VARCHAR(36),
  INDEX idx_user_id (user_id),
  INDEX idx_account_id (account_id),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES client_users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.3 verification_codes 表
```sql
CREATE TABLE verification_codes (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  type ENUM('register', 'reset') DEFAULT 'register',
  expires_at BIGINT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  INDEX idx_email (email),
  INDEX idx_code (code),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.4 扩展 accounts 表
现有表已包含所需字段，无需修改：
- usage_percent (使用率)
- subscription_type (订阅类型)
- subscription_status (订阅状态)
- created_at (注册时间 - 用于排序)


## 3. 核心业务逻辑

### 3.1 Token可用性检测
```typescript
/**
 * 检测账户是否可用
 */
async function isAccountAvailable(account: Account): Promise<boolean> {
  // 条件1: 使用率 < 85%
  if (!account.usage_percent || account.usage_percent >= 85) {
    return false
  }
  
  // 条件2: 必须有订阅
  if (!account.subscription_type) {
    return false
  }
  
  // 条件3: 订阅状态必须激活
  if (account.subscription_status !== 'active') {
    return false
  }
  
  // 条件4: 必须有access_token
  if (!account.access_token) {
    return false
  }
  
  return true
}
```

### 3.2 确定性账户选择算法
```typescript
/**
 * 选择注册时间最早的可用账户
 */
async function selectAvailableAccount(): Promise<Account | null> {
  // 1. 查询所有active状态的账户
  const accounts = await db.AccountDB.getAll()
  
  // 2. 过滤可用账户
  const availableAccounts = accounts.filter(acc => 
    acc.status === 'active' && isAccountAvailable(acc)
  )
  
  if (availableAccounts.length === 0) {
    return null
  }
  
  // 3. 按created_at升序排序（最早的在前）
  availableAccounts.sort((a, b) => a.created_at - b.created_at)
  
  // 4. 返回第一个（注册时间最早）
  return availableAccounts[0]
}
```

### 3.3 Token分配流程
```typescript
/**
 * 审批并分配Token
 */
async function approveTokenRequest(
  allocationId: string, 
  adminId: string
): Promise<{ success: boolean; message?: string }> {
  
  // 1. 查询申请记录
  const allocation = await db.AllocationDB.getById(allocationId)
  if (!allocation || allocation.status !== 'pending') {
    return { success: false, message: '申请不存在或已处理' }
  }
  
  // 2. 检查用户当前配额
  const user = await db.ClientUserDB.getById(allocation.user_id)
  const activeAllocations = await db.AllocationDB.getByUserId(
    allocation.user_id, 
    'active'
  )
  
  if (activeAllocations.length >= user.max_tokens) {
    return { success: false, message: '用户已达最大配额' }
  }
  
  // 3. 选择可用账户
  const account = await selectAvailableAccount()
  if (!account) {
    return { success: false, message: '暂无可用账户' }
  }
  
  // 4. 实时检测账户可用性
  const syncResult = await syncAccountUsage(
    account.access_token, 
    account.idp || 'BuilderId'
  )
  
  if (syncResult.success && syncResult.data) {
    await db.AccountDB.updateExtendedInfo(account.id, syncResult.data)
    
    // 重新检查可用性
    if (!isAccountAvailable({ ...account, ...syncResult.data })) {
      return { success: false, message: '账户检测后不可用' }
    }
  }
  
  // 5. 使用事务分配
  await db.transaction(async (trx) => {
    // 更新分配记录
    await trx.AllocationDB.update(allocationId, {
      account_id: account.id,
      status: 'active',
      approved_at: Date.now(),
      approved_by: adminId
    })
    
    // 更新账户状态
    await trx.AccountDB.update(account.id, {
      status: 'assigned'
    })
  })
  
  return { success: true }
}
```


## 4. API设计

### 4.1 注册认证服务 (Port 2233)

#### 4.1.1 发送验证码
```
POST /api/auth/send-code
Content-Type: application/json

Request:
{
  "email": "user@example.com"
}

Response (200):
{
  "success": true,
  "message": "验证码已发送"
}

Response (429):
{
  "success": false,
  "message": "请1分钟后再试"
}
```

#### 4.1.2 用户注册
```
POST /api/auth/register
Content-Type: application/json

Request:
{
  "username": "user123",
  "email": "user@example.com",
  "password": "password123",
  "code": "123456"
}

Response (200):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "user123",
    "email": "user@example.com",
    "status": "active",
    "max_tokens": 2,
    "created_at": 1707696000000
  }
}

Response (400):
{
  "success": false,
  "message": "验证码错误"
}
```

#### 4.1.3 用户登录
```
POST /api/auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response (200):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### 4.2 Token管理 (Port 2233)

#### 4.2.1 提交申请
```
POST /api/tokens/request
Authorization: Bearer <JWT_TOKEN>

Response (200):
{
  "success": true,
  "allocation_id": "uuid",
  "message": "申请已提交，等待管理员审批"
}

Response (400):
{
  "success": false,
  "message": "已达到最大配额(2个)"
}
```

#### 4.2.2 查看我的申请
```
GET /api/tokens/my-requests
Authorization: Bearer <JWT_TOKEN>

Response (200):
{
  "success": true,
  "requests": [
    {
      "id": "uuid",
      "status": "pending",
      "requested_at": 1707696000000
    },
    {
      "id": "uuid",
      "status": "rejected",
      "requested_at": 1707695000000,
      "reject_reason": "账户池已满"
    }
  ]
}
```

#### 4.2.3 查看我的Token
```
GET /api/tokens/my-tokens
Authorization: Bearer <JWT_TOKEN>

Response (200):
{
  "success": true,
  "tokens": [
    {
      "allocation_id": "uuid",
      "account": {
        "id": "uuid",
        "email": "account@example.com",
        "access_token": "...",
        "refresh_token": "...",
        "client_id": "...",
        "region": "us-east-1",
        "usage_percent": 45,
        "usage_current": 450000,
        "usage_limit": 1000000,
        "subscription_type": "Free",
        "subscription_title": "KIRO FREE"
      },
      "status": "active",
      "allocated_at": 1707696000000
    }
  ],
  "quota": {
    "used": 1,
    "max": 2
  }
}
```

#### 4.2.4 刷新Token额度
```
POST /api/tokens/refresh/:accountId
Authorization: Bearer <JWT_TOKEN>

Response (200):
{
  "success": true,
  "account": {
    "id": "uuid",
    "usage_percent": 47,
    "usage_current": 470000,
    "usage_limit": 1000000,
    "subscription_type": "Free",
    "last_sync_at": 1707696300000
  },
  "is_available": true
}

Response (429):
{
  "success": false,
  "message": "请5分钟后再试"
}
```


### 4.3 管理员API (Port 3000)

#### 4.3.1 管理员登录
```
POST /api/admin/login
Content-Type: application/json

Request:
{
  "email": "admin@user.com",
  "password": "cbc123123"
}

Response (200):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "uuid",
    "username": "admin",
    "email": "admin@user.com",
    "role": "admin"
  }
}
```

#### 4.3.2 查看待审批申请
```
GET /api/admin/requests/pending
Authorization: Bearer <ADMIN_JWT_TOKEN>

Response (200):
{
  "success": true,
  "requests": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "username": "user123",
      "email": "user@example.com",
      "status": "pending",
      "requested_at": 1707696000000
    }
  ]
}
```

#### 4.3.3 审批申请
```
POST /api/admin/requests/:id/approve
Authorization: Bearer <ADMIN_JWT_TOKEN>

Response (200):
{
  "success": true,
  "allocation": {
    "id": "uuid",
    "user_id": "uuid",
    "account_id": "uuid",
    "status": "active",
    "approved_at": 1707696100000
  }
}

Response (400):
{
  "success": false,
  "message": "暂无可用账户"
}
```

#### 4.3.4 拒绝申请
```
POST /api/admin/requests/:id/reject
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

Request:
{
  "reason": "账户池已满，请稍后再试"
}

Response (200):
{
  "success": true
}
```

#### 4.3.5 释放Token
```
POST /api/admin/allocations/:id/revoke
Authorization: Bearer <ADMIN_JWT_TOKEN>

Response (200):
{
  "success": true,
  "message": "Token已释放"
}
```

#### 4.3.6 调整用户配额
```
PUT /api/admin/users/:id/quota
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

Request:
{
  "max_tokens": 5
}

Response (200):
{
  "success": true
}
```

#### 4.3.7 Token池统计
```
GET /api/admin/stats/pool
Authorization: Bearer <ADMIN_JWT_TOKEN>

Response (200):
{
  "success": true,
  "stats": {
    "total_accounts": 100,
    "available_accounts": 45,
    "assigned_accounts": 50,
    "unavailable_accounts": 5,
    "total_users": 30,
    "pending_requests": 5
  }
}
```


## 5. 目录结构

```
server/
├── src/
│   ├── auth-service/              # 新增：注册认证服务
│   │   ├── index.ts              # 独立启动文件（端口2233）
│   │   ├── routes/
│   │   │   ├── auth.routes.ts    # 注册、登录路由
│   │   │   └── token.routes.ts   # Token申请、查询路由
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   └── token.controller.ts
│   │   ├── services/
│   │   │   ├── verification.service.ts  # 验证码服务
│   │   │   ├── jwt.service.ts           # JWT服务
│   │   │   └── allocation.service.ts    # 分配服务
│   │   └── middleware/
│   │       └── auth.middleware.ts       # JWT验证中间件
│   │
│   ├── models/
│   │   ├── client-user.model.ts   # 新增：普通用户模型
│   │   └── token-allocation.model.ts  # 新增：分配模型
│   │
│   ├── services/
│   │   ├── client-user.service.ts      # 新增：用户服务
│   │   ├── token-allocation.service.ts # 新增：分配服务
│   │   ├── token-availability.service.ts # 新增：可用性检测
│   │   └── kiro-api.service.ts         # 现有：复用
│   │
│   ├── routes/
│   │   └── admin.routes.ts        # 新增：管理员路由
│   │
│   └── controllers/
│       └── admin.controller.ts    # 新增：管理员控制器
│
└── package.json
```

## 6. 依赖包

### 6.1 新增依赖
```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17"
  }
}
```

### 6.2 现有依赖（复用）
- mysql2: 数据库操作
- cbor-x: Kiro API调用
- nodemailer: 邮件发送（如果已有）

## 7. 安全设计

### 7.1 密码安全
```typescript
import bcrypt from 'bcrypt'

// 加密密码
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)  // 10轮salt
}

// 验证密码
async function verifyPassword(
  password: string, 
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

### 7.2 JWT配置
```typescript
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = '7d'

// 生成Token
function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// 验证Token
function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET)
}
```

### 7.3 验证码安全
```typescript
// 生成6位数字验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 频率限制
const codeCache = new Map<string, number>()

function canSendCode(email: string): boolean {
  const lastSent = codeCache.get(email)
  if (lastSent && Date.now() - lastSent < 60000) {
    return false  // 1分钟内已发送
  }
  return true
}
```

### 7.4 API安全
- 所有敏感API需要JWT认证
- 管理员API需要role验证
- 使用参数化查询防止SQL注入
- 限制请求频率（rate limiting）
- CORS配置白名单


## 8. 数据流程图

### 8.1 用户注册流程
```
用户 → 输入邮箱 → 点击"发送验证码"
  ↓
Server → 检查频率限制 → 生成验证码 → 保存到数据库 → 发送邮件
  ↓
用户 → 收到邮件 → 输入验证码、用户名、密码 → 点击"注册"
  ↓
Server → 验证验证码 → 检查用户名/邮箱唯一性 → 加密密码 → 创建用户 → 生成JWT
  ↓
用户 ← 返回JWT Token和用户信息
```

### 8.2 Token申请审批流程
```
用户 → 点击"申请Token"
  ↓
Server → 检查配额 → 创建申请记录(status=pending)
  ↓
用户 ← 返回"申请已提交"
  ↓
管理员 → 查看待审批列表 → 点击"批准"
  ↓
Server → 查询可用账户 → 按created_at排序 → 选择最早的
  ↓
Server → 调用syncAccountUsage() → 实时检测可用性
  ↓
Server → 使用事务 → 更新allocation(status=active) → 更新account(status=assigned)
  ↓
用户 → 刷新页面 → 看到已分配的Token
```

### 8.3 Token刷新流程
```
用户 → 点击"刷新额度"
  ↓
Server → 检查归属 → 检查上次同步时间
  ↓
  ├─ 5分钟内 → 返回缓存数据
  │
  └─ 超过5分钟 → 调用AWS API → 获取最新数据 → 更新MySQL → 返回新数据
```

## 9. 错误处理

### 9.1 错误码定义
```typescript
enum ErrorCode {
  // 认证错误 (1xxx)
  INVALID_CREDENTIALS = 1001,
  TOKEN_EXPIRED = 1002,
  INVALID_TOKEN = 1003,
  UNAUTHORIZED = 1004,
  
  // 验证码错误 (2xxx)
  CODE_EXPIRED = 2001,
  CODE_INVALID = 2002,
  CODE_RATE_LIMIT = 2003,
  
  // 业务错误 (3xxx)
  QUOTA_EXCEEDED = 3001,
  NO_AVAILABLE_ACCOUNT = 3002,
  ACCOUNT_NOT_AVAILABLE = 3003,
  ALLOCATION_NOT_FOUND = 3004,
  
  // 系统错误 (5xxx)
  DATABASE_ERROR = 5001,
  INTERNAL_ERROR = 5002
}
```

### 9.2 统一错误响应
```typescript
interface ErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: any
  }
}

// 示例
{
  "success": false,
  "error": {
    "code": 3001,
    "message": "已达到最大配额(2个)",
    "details": {
      "current": 2,
      "max": 2
    }
  }
}
```

## 10. 性能优化

### 10.1 缓存策略
```typescript
// 账户可用性缓存（5分钟）
const accountCache = new Map<string, {
  data: Account
  timestamp: number
}>()

function getCachedAccount(accountId: string): Account | null {
  const cached = accountCache.get(accountId)
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.data
  }
  return null
}
```

### 10.2 数据库索引
- client_users: email, username, status
- token_allocations: user_id, account_id, status
- verification_codes: email, expires_at
- accounts: status, created_at, usage_percent

### 10.3 批量操作
```typescript
// 批量刷新账户（限制并发）
async function refreshAllAccounts() {
  const accounts = await db.AccountDB.getAll()
  const batchSize = 10
  
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize)
    await Promise.all(
      batch.map(acc => syncAccountUsage(acc.access_token, acc.idp))
    )
  }
}
```

## 11. 监控与日志

### 11.1 关键操作日志
```typescript
// 审批操作
logger.info('Token allocation approved', {
  allocation_id: allocationId,
  user_id: userId,
  account_id: accountId,
  admin_id: adminId,
  timestamp: Date.now()
})

// 分配失败
logger.error('Token allocation failed', {
  allocation_id: allocationId,
  reason: 'No available account',
  timestamp: Date.now()
})
```

### 11.2 监控指标
- 待审批申请数量
- 可用账户数量
- 账户使用率分布
- API响应时间
- 错误率

## 12. 测试策略

### 12.1 单元测试
- 验证码生成和验证
- 密码加密和验证
- JWT生成和验证
- 账户可用性检测
- 账户选择算法

### 12.2 集成测试
- 注册流程
- 登录流程
- 申请审批流程
- Token刷新流程
- 管理员操作

### 12.3 端到端测试
- 完整用户旅程
- 并发申请测试
- 配额限制测试
- 错误场景测试
