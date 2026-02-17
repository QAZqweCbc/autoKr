# 用户管理与Token分配系统 - 需求文档

## 1. 项目概述

### 1.1 背景
当前系统管理AWS Kiro账户池，需要添加普通用户管理功能，允许普通用户通过客户端注册并申请AWS Access Token。管理员审批后，系统从账户池中分配可用账户给用户。

### 1.2 目标
- 实现普通用户注册和认证系统（端口2233）
- 实现Token申请和审批流程
- 实现基于额度和订阅状态的智能分配
- 实现用户配额管理（每用户最多2个可用Token）
- 实现管理员审批和管理功能

---

## 2. 用户故事

### 2.1 普通用户注册
**作为** 普通用户  
**我想要** 通过客户端注册账号  
**以便** 申请和使用AWS Access Token

**验收标准：**
- 用户可以通过邮箱接收验证码
- 验证码6位数字，5分钟有效期
- 同一邮箱1分钟内只能发送1次验证码
- 注册需要：邮箱、验证码、用户名、密码
- 注册成功后返回JWT Token
- 注册服务运行在端口2233

### 2.2 Token申请
**作为** 已注册的普通用户  
**我想要** 申请AWS Access Token  
**以便** 使用AWS Kiro服务

**验收标准：**
- 用户可以提交Token申请
- 申请进入待审核状态
- 用户可以查看申请状态（待审核/已批准/已拒绝）
- 每个用户最多拥有2个可用Token
- 如果已有2个可用Token，不能再次申请

### 2.3 管理员审批
**作为** 管理员  
**我想要** 审批用户的Token申请  
**以便** 控制Token分配

**验收标准：**
- 管理员可以查看所有待审批的申请
- 管理员可以批准或拒绝申请
- 拒绝时可以填写原因
- 批准后系统自动从账户池分配可用账户
- 分配时选择注册时间最早的可用账户
- 分配前检测账户可用性（额度<85%、有订阅）

### 2.4 Token可用性检测
**作为** 系统  
**我想要** 检测Token的可用性  
**以便** 只分配可用的账户

**验收标准：**
- 账户可用条件：
  - usage_percent < 85%
  - subscription_type 存在
  - subscription_status === 'active'
  - access_token 有效
- 分配前实时检测账户可用性
- 调用现有的 `syncAccountUsage()` 方法
- 更新MySQL中的账户数据

### 2.5 用户刷新额度
**作为** 普通用户  
**我想要** 刷新我的Token额度信息  
**以便** 了解当前使用情况

**验收标准：**
- 用户可以刷新单个Token的额度
- 刷新时调用AWS API获取最新数据
- 数据同步到Server的MySQL数据库
- 返回最新的使用率、订阅状态等信息
- 限制刷新频率：单个账户5分钟内只能刷新1次

### 2.6 管理员管理功能
**作为** 管理员  
**我想要** 管理用户和Token分配  
**以便** 维护系统正常运行

**验收标准：**
- 查看所有普通用户列表
- 查看所有Token分配记录
- 审批/拒绝Token申请
- 手动释放用户的Token
- 调整用户的最大配额
- 封禁/解封用户
- 查看Token池使用率统计
- 批量刷新所有账户可用性

---

## 3. 功能需求

### 3.1 用户注册服务（端口2233）

#### 3.1.1 发送验证码
- **端点**: `POST /api/auth/send-code`
- **请求**: `{ email: string }`
- **响应**: `{ success: boolean, message: string }`
- **规则**:
  - 生成6位随机数字验证码
  - 5分钟有效期
  - 同一邮箱1分钟内只能发送1次
  - 通过邮件发送验证码

#### 3.1.2 用户注册
- **端点**: `POST /api/auth/register`
- **请求**: `{ username: string, email: string, password: string, code: string }`
- **响应**: `{ success: boolean, token?: string, user?: ClientUser }`
- **规则**:
  - 验证验证码有效性
  - 密码使用bcrypt加密（10轮salt）
  - 用户名和邮箱唯一
  - 注册成功返回JWT Token（7天有效期）

#### 3.1.3 用户登录
- **端点**: `POST /api/auth/login`
- **请求**: `{ email: string, password: string }`
- **响应**: `{ success: boolean, token?: string, user?: ClientUser }`

### 3.2 Token申请与分配

#### 3.2.1 提交申请
- **端点**: `POST /api/tokens/request`
- **认证**: JWT Token
- **响应**: `{ success: boolean, allocation_id?: string, message?: string }`
- **规则**:
  - 检查用户当前可用Token数量
  - 如果已有2个可用Token，拒绝申请
  - 创建待审批的分配记录

#### 3.2.2 查看我的申请
- **端点**: `GET /api/tokens/my-requests`
- **认证**: JWT Token
- **响应**: `{ success: boolean, requests: TokenAllocation[] }`

#### 3.2.3 查看我的Token
- **端点**: `GET /api/tokens/my-tokens`
- **认证**: JWT Token
- **响应**: 
```json
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

#### 3.2.4 刷新Token额度
- **端点**: `POST /api/tokens/refresh/:accountId`
- **认证**: JWT Token
- **响应**: `{ success: boolean, account: Account, is_available: boolean }`
- **规则**:
  - 验证账户归属于当前用户
  - 检查上次同步时间（5分钟内返回缓存）
  - 调用 `syncAccountUsage()` 获取最新数据
  - 更新MySQL数据库
  - 返回最新账户信息

### 3.3 管理员功能

#### 3.3.1 管理员登录
- **端点**: `POST /api/admin/login`
- **请求**: `{ email: string, password: string }`
- **默认账户**: 
  - 邮箱: `admin@user.com`
  - 密码: `cbc123123`
- **响应**: `{ success: boolean, token?: string, admin?: User }`

#### 3.3.2 查看待审批申请
- **端点**: `GET /api/admin/requests/pending`
- **认证**: Admin JWT Token
- **响应**: 
```json
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

#### 3.3.3 审批申请
- **端点**: `POST /api/admin/requests/:id/approve`
- **认证**: Admin JWT Token
- **响应**: `{ success: boolean, allocation?: TokenAllocation }`
- **规则**:
  - 查询可用账户（usage_percent < 85%, 有订阅）
  - 按 created_at 升序排序
  - 选择注册时间最早的账户
  - 分配前调用 `syncAccountUsage()` 实时检测
  - 创建分配记录，状态改为 'active'
  - 更新账户状态为 'assigned'

#### 3.3.4 拒绝申请
- **端点**: `POST /api/admin/requests/:id/reject`
- **认证**: Admin JWT Token
- **请求**: `{ reason: string }`
- **响应**: `{ success: boolean }`

#### 3.3.5 查看所有用户
- **端点**: `GET /api/admin/users`
- **认证**: Admin JWT Token
- **响应**: `{ success: boolean, users: ClientUser[] }`

#### 3.3.6 查看所有分配记录
- **端点**: `GET /api/admin/allocations`
- **认证**: Admin JWT Token
- **响应**: `{ success: boolean, allocations: TokenAllocation[] }`

#### 3.3.7 释放Token
- **端点**: `POST /api/admin/allocations/:id/revoke`
- **认证**: Admin JWT Token
- **响应**: `{ success: boolean }`
- **规则**:
  - 更新分配记录状态为 'revoked'
  - 更新账户状态为 'active'（回到池中）

#### 3.3.8 调整用户配额
- **端点**: `PUT /api/admin/users/:id/quota`
- **认证**: Admin JWT Token
- **请求**: `{ max_tokens: number }`
- **响应**: `{ success: boolean }`

#### 3.3.9 封禁/解封用户
- **端点**: `PUT /api/admin/users/:id/status`
- **认证**: Admin JWT Token
- **请求**: `{ status: 'active' | 'suspended' | 'banned' }`
- **响应**: `{ success: boolean }`

#### 3.3.10 Token池统计
- **端点**: `GET /api/admin/stats/pool`
- **认证**: Admin JWT Token
- **响应**:
```json
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

#### 3.3.11 批量刷新账户
- **端点**: `POST /api/admin/accounts/refresh-all`
- **认证**: Admin JWT Token
- **响应**: `{ success: boolean, refreshed: number, failed: number }`
- **规则**:
  - 遍历所有账户
  - 调用 `syncAccountUsage()` 更新数据
  - 返回刷新统计

---

## 4. 数据模型

### 4.1 普通用户表（client_users）
```typescript
interface ClientUser {
  id: string                    // UUID
  username: string              // 用户名（唯一）
  email: string                 // 邮箱（唯一）
  password_hash: string         // 密码哈希
  status: 'active' | 'suspended' | 'banned'
  max_tokens: number            // 最大Token数（默认2）
  created_at: number
  last_login_at?: number
}
```

### 4.2 Token分配表（token_allocations）
```typescript
interface TokenAllocation {
  id: string                    // UUID
  user_id: string               // 关联client_users.id
  account_id?: string           // 关联accounts.id（审批后分配）
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'revoked'
  requested_at: number          // 申请时间
  approved_at?: number          // 审批时间
  approved_by?: string          // 审批管理员ID
  reject_reason?: string        // 拒绝原因
  revoked_at?: number           // 释放时间
  revoked_by?: string           // 释放管理员ID
}
```

### 4.3 验证码表（verification_codes）
```typescript
interface VerificationCode {
  id: string
  email: string
  code: string                  // 6位数字验证码
  type: 'register' | 'reset'
  expires_at: number            // 5分钟有效期
  used: boolean
  created_at: number
}
```

### 4.4 管理员表（扩展现有users.json）
```typescript
interface AdminUser {
  id: string
  username: string
  email: string                 // admin@user.com
  password_hash: string         // bcrypt(cbc123123)
  role: 'admin'
  status: 'active'
  created_at: number
  last_login_at?: number
}
```

---

## 5. 非功能需求

### 5.1 安全性
- 密码使用bcrypt加密，至少10轮salt
- JWT Token使用强密钥，7天有效期
- 验证码防刷：IP限流、邮箱限流
- SQL注入防护：使用参数化查询
- 敏感信息不返回给客户端（如password）

### 5.2 性能
- 账户可用性检测缓存5分钟
- 用户刷新频率限制：5分钟/次
- 数据库连接池：10个连接
- 批量刷新使用异步并发（限制10个并发）

### 5.3 可靠性
- 数据库事务保证分配原子性
- 行锁防止并发分配冲突
- 审批操作记录审计日志
- 定时任务容错处理

### 5.4 可维护性
- 清晰的代码分层（Controller-Service-Model）
- 完整的错误处理和日志记录
- API文档自动生成
- 数据库迁移脚本

---

## 6. 约束条件

### 6.1 技术约束
- 注册服务必须运行在端口2233
- 主服务继续运行在端口3000
- 使用现有的MySQL数据库
- 复用现有的 `kiro-api.service.ts`
- 使用现有的邮件服务发送验证码

### 6.2 业务约束
- 每个用户最多2个可用Token（可由管理员调整）
- 账户可用性标准：usage_percent < 85%, 有订阅
- 验证码5分钟有效期
- JWT Token 7天有效期
- 账户同步最小间隔5分钟

---

## 7. 验收标准

### 7.1 用户注册流程
- [ ] 用户可以接收验证码邮件
- [ ] 验证码验证正确
- [ ] 注册成功返回JWT Token
- [ ] 重复邮箱/用户名注册失败

### 7.2 Token申请流程
- [ ] 用户可以提交申请
- [ ] 申请进入待审批状态
- [ ] 已有2个可用Token时申请被拒绝
- [ ] 管理员可以看到待审批申请

### 7.3 管理员审批流程
- [ ] 管理员可以批准申请
- [ ] 批准后自动分配注册时间最早的可用账户
- [ ] 分配前检测账户可用性
- [ ] 不可用账户不会被分配
- [ ] 管理员可以拒绝申请并填写原因

### 7.4 Token刷新流程
- [ ] 用户可以刷新Token额度
- [ ] 数据同步到MySQL
- [ ] 5分钟内返回缓存数据
- [ ] 返回最新的使用率和订阅信息

### 7.5 管理员管理功能
- [ ] 管理员可以查看所有用户
- [ ] 管理员可以查看所有分配记录
- [ ] 管理员可以释放Token
- [ ] 管理员可以调整用户配额
- [ ] 管理员可以封禁用户
- [ ] 管理员可以查看统计信息
- [ ] 管理员可以批量刷新账户

---

## 8. 里程碑

### 阶段1：数据库和基础服务（1-2天）
- 创建数据库表
- 实现JWT认证中间件
- 实现验证码服务

### 阶段2：用户注册功能（2-3天）
- 实现注册API
- 实现登录API
- 测试注册流程

### 阶段3：Token申请与审批（3-4天）
- 实现申请API
- 实现审批API
- 实现分配逻辑
- 测试审批流程

### 阶段4：Token刷新功能（1-2天）
- 实现刷新API
- 实现缓存机制
- 测试刷新流程

### 阶段5：管理员功能（2-3天）
- 实现管理员API
- 实现统计功能
- 测试管理功能

### 阶段6：集成测试和优化（2-3天）
- 端到端测试
- 性能优化
- 安全加固
- 文档完善

**总计：11-17天**
