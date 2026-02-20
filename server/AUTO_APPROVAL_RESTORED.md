# 自动审批功能恢复完成

## 已恢复的功能

### 1. 申请自动审批 ✅
- 用户提交Token申请时，系统自动检查已分配账号数
- 已分配账号 ≤ 2 时自动通过
- 无可用账号时触发账号生成任务
- 账号生成完成后自动分配给等待的用户

**修改文件：**
- `server/src/auth-service/controllers/token.controller.ts` - 添加自动审批调用

### 2. 释放自动审批 ✅
- 用户可以请求释放已分配的Token
- 系统根据释放理由中的关键词自动判断
- 关键词包括：封禁、不可用、额度已满、过期等

**修改文件：**
- `server/src/auth-service/controllers/token.controller.ts` - 添加 `requestRevoke` 函数
- `server/src/auth-service/routes/token.routes.ts` - 添加释放申请路由
- `server/src/models/token-allocation.model.ts` - 添加 `revoke_reason` 字段

### 3. 账号池管理 ✅
- 管理员可以查看账号池状态
- 管理员可以手动触发账号池补充
- 账号生成完成后自动分配给等待的用户

**修改文件：**
- `server/src/controllers/admin.controller.ts` - 添加账号池管理接口
- `server/src/routes/admin.routes.ts` - 添加账号池路由
- `server/src/services/register.service.ts` - 账号生成完成后触发自动分配

### 4. 数据库迁移 ✅
- 自动为 `token_allocations` 表添加 `revoke_reason` 字段

**修改文件：**
- `server/src/services/mysql.service.ts` - 添加迁移调用

### 5. 前端WebSocket支持 ✅
- 添加任务更新和账号更新的事件监听方法

**修改文件：**
- `server/frontend/src/stores/websocket.ts` - 添加 `onTaskUpdate` 和 `onAccountUpdate` 方法

## API接口总览

### 用户端接口

#### 提交Token申请
```http
POST /api/client/tokens/request
Authorization: Bearer <token>
```

#### 请求释放Token
```http
POST /api/client/tokens/:id/request-revoke
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "账号被封禁"
}
```

### 管理员接口

#### 获取待审批的释放申请
```http
GET /api/admin/revoke-requests/pending
Authorization: Bearer <admin-token>
```

#### 批准释放申请
```http
POST /api/admin/revoke-requests/:id/approve
Authorization: Bearer <admin-token>
```

#### 拒绝释放申请
```http
POST /api/admin/revoke-requests/:id/reject
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reason": "理由不充分"
}
```

#### 获取账号池状态
```http
GET /api/admin/account-pool/status
Authorization: Bearer <admin-token>
```

#### 手动触发账号池补充
```http
POST /api/admin/account-pool/replenish
Authorization: Bearer <admin-token>
```

## 测试建议

1. 重启服务器，确保数据库迁移执行
2. 测试申请自动审批（已分配 ≤ 2）
3. 测试释放自动审批（包含关键词）
4. 测试账号池状态查询
5. 查看日志确认自动审批流程正常

## 相关文档

- 完整文档：`server/docs/AUTO_APPROVAL_SYSTEM.md`
- 快速开始：`server/AUTO_APPROVAL_QUICKSTART.md`
- 管理员释放审批指南：`server/docs/ADMIN_REVOKE_APPROVAL_GUIDE.md`
