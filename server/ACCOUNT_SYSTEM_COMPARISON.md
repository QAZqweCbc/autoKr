# 账号系统对比分析

## 概述

系统中存在**两套完全独立的账号体系**：

1. **AWS 账号系统** (`accounts` 表) - 3000端口注册的AWS账号
2. **普通用户系统** (`client_users` 表) - 用户管理系统的客户端用户

---

## 一、AWS 账号系统 (accounts 表)

### 用途
存储通过自动注册流程创建的 **AWS Builder ID 账号**

### 数据库表结构
```sql
CREATE TABLE accounts (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  
  -- AWS 认证凭证
  x_amz_sso_authn TEXT,              -- SSO Token
  access_token TEXT,                  -- OAuth Access Token
  refresh_token TEXT,                 -- OAuth Refresh Token
  client_id VARCHAR(255),             -- OAuth Client ID
  client_secret TEXT,                 -- OAuth Client Secret
  region VARCHAR(50),
  
  -- 订阅和使用量信息
  subscription_type VARCHAR(50),
  subscription_title VARCHAR(100),
  usage_current INT,
  usage_limit INT,
  usage_percent_used DECIMAL(5,2),
  
  -- 分配状态
  device_id VARCHAR(255),             -- 分配给哪个设备
  status ENUM('pending', 'active', 'assigned', 'expired'),
  assigned_at BIGINT,
  owner_user_id VARCHAR(36),          -- 分配给哪个普通用户
  
  -- 时间戳
  created_at BIGINT NOT NULL,
  last_checked_at BIGINT,
  
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_owner_user_id (owner_user_id)
) COMMENT='AWS账号表'
```

### 注册流程
**端口**: 3000 (主服务)  
**路由**: `POST /api/tasks` → 创建注册任务  
**服务**: `register.service.ts` → `autoRegisterAWS()`

**流程**:
1. 用户在3000端口提交注册任务（邮箱、密码）
2. 系统使用 Playwright 自动化注册 AWS Builder ID
3. 获取 SSO Token 和 OAuth 凭证
4. 调用 Kiro API 同步账号信息（订阅、使用量）
5. 保存到 `accounts` 表

**关键代码**:
```typescript
// server/src/services/register.service.ts
await AccountDB.create(accountData)  // 保存到 accounts 表
```

### 特点
- ✅ 包含完整的 AWS 认证凭证
- ✅ 包含订阅和使用量信息
- ✅ 可以被分配给普通用户使用
- ✅ 支持自动刷新 Token
- ❌ 不是登录系统的用户账号

---

## 二、普通用户系统 (client_users 表)

### 用途
存储**客户端用户**，用于登录和申请 AWS Token

### 数据库表结构
```sql
CREATE TABLE client_users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,    -- 注意：使用 bcrypt 加密
  
  -- 用户状态
  status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
  max_tokens INT DEFAULT 2,               -- 最大Token配额
  
  -- 时间戳
  created_at BIGINT NOT NULL,
  last_login_at BIGINT,
  
  INDEX idx_email (email),
  INDEX idx_username (username),
  INDEX idx_status (status)
) COMMENT='普通用户表'
```

### 注册流程
**端口**: 3001 (Auth Service)  
**路由**: `POST /api/auth/register`  
**服务**: `client-user.service.ts` → `createClientUser()`

**流程**:
1. 用户访问 Auth Service (3001端口)
2. 发送验证码到邮箱
3. 提交注册信息（用户名、邮箱、密码、验证码）
4. 验证验证码
5. 使用 bcrypt 加密密码
6. 保存到 `client_users` 表

**关键代码**:
```typescript
// server/src/auth-service/controllers/auth.controller.ts
export async function registerHandler(req: Request, res: Response) {
  const { username, email, password, code } = req.body
  
  // 验证验证码
  const isCodeValid = await verifyCode(email, code, 'register')
  
  // 创建用户
  const user = await createClientUser({ username, email, password })
  
  // 保存到 client_users 表
}
```

### 特点
- ✅ 用于登录认证
- ✅ 可以申请 AWS Token
- ✅ 有配额限制（max_tokens）
- ✅ 密码使用 bcrypt 加密
- ❌ 不包含 AWS 凭证
- ❌ 不是 AWS 账号

---

## 三、两者关系

### 关联方式
通过 `token_allocations` 表关联：

```sql
CREATE TABLE token_allocations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,          -- 关联 client_users.id
  account_id VARCHAR(36),                -- 关联 accounts.id
  status ENUM('pending', 'approved', 'rejected', 'active', 'revoked'),
  requested_at BIGINT NOT NULL,
  
  FOREIGN KEY (user_id) REFERENCES client_users(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
)
```

### 工作流程

```
┌─────────────────┐         申请Token          ┌──────────────────┐
│  普通用户        │  ──────────────────────>   │  Token分配表      │
│  (client_users) │                            │  (allocations)   │
└─────────────────┘                            └──────────────────┘
                                                        │
                                                        │ 管理员批准
                                                        ↓
                                               ┌──────────────────┐
                                               │  AWS账号池        │
                                               │  (accounts)      │
                                               └──────────────────┘
```

**详细流程**:
1. 普通用户登录 (client_users)
2. 申请 Token → 创建 `token_allocations` 记录
3. 管理员审批 → 从 `accounts` 表选择可用账号
4. 分配账号 → 更新 `accounts.owner_user_id` 和 `token_allocations.account_id`
5. 用户获得 AWS Access Token

---

## 四、关键区别对比

| 特性 | AWS账号 (accounts) | 普通用户 (client_users) |
|------|-------------------|------------------------|
| **用途** | AWS Builder ID 账号 | 系统登录用户 |
| **注册端口** | 3000 (主服务) | 3001 (Auth Service) |
| **注册方式** | 自动化注册 AWS | 手动注册 + 验证码 |
| **密码存储** | 明文 (AWS密码) | bcrypt 加密 |
| **包含凭证** | ✅ SSO Token, OAuth | ❌ 无 |
| **可登录系统** | ❌ 否 | ✅ 是 |
| **可分配** | ✅ 可分配给用户 | ❌ 不可分配 |
| **配额管理** | ❌ 无 | ✅ max_tokens |
| **使用量追踪** | ✅ 完整追踪 | ❌ 无 |

---

## 五、代码位置

### AWS 账号系统
- **模型**: `server/src/models/account.model.ts`
- **服务**: `server/src/services/register.service.ts`
- **数据库**: `server/src/services/mysql-account.service.ts`
- **控制器**: `server/src/controllers/task.controller.ts`
- **路由**: `POST /api/tasks` (3000端口)

### 普通用户系统
- **模型**: `server/src/models/client-user.model.ts`
- **服务**: `server/src/services/client-user.service.ts`
- **控制器**: `server/src/auth-service/controllers/auth.controller.ts`
- **路由**: `POST /api/auth/register` (3001端口)

### 关联系统
- **模型**: `server/src/models/token-allocation.model.ts`
- **服务**: `server/src/services/token-allocation.service.ts`
- **审批**: `server/src/services/auto-approval.service.ts`

---

## 六、总结

### 是否是同一个注册？
**❌ 不是！** 这是两个完全独立的注册系统：

1. **3000端口注册** = 注册 AWS Builder ID 账号
   - 目的：创建可用的 AWS 账号池
   - 存储：`accounts` 表
   - 包含：AWS 凭证和使用量信息

2. **3001端口注册** = 注册系统用户
   - 目的：创建可以登录系统的用户
   - 存储：`client_users` 表
   - 包含：用户名、邮箱、加密密码

### 使用场景
- **管理员**: 在3000端口批量注册 AWS 账号 → 填充账号池
- **普通用户**: 在3001端口注册系统账号 → 登录后申请使用 AWS Token
- **分配关系**: 通过 `token_allocations` 表将 AWS 账号分配给普通用户

### 架构优势
- ✅ 职责分离：账号池管理 vs 用户管理
- ✅ 安全性：普通用户无法直接访问 AWS 凭证
- ✅ 可控性：管理员审批分配流程
- ✅ 可扩展：支持多用户共享账号池
