# WebSocket实时刷新修复文档

## 问题分析

1. **404错误**: `/api/admin/revoke-requests/pending` 端点不存在
   - `getPendingRevokeRequests`、`approveRevokeRequest`、`rejectRevokeRequest` 函数未在控制器中实现
   - 路由未注册

2. **臃肿代码**: WebSocket实现过于复杂
   - 使用了不必要的回调注册系统
   - 前端需要手动注册回调函数

3. **缺少事件触发**: 自动审批服务未触发WebSocket事件

## 解决方案

### 1. 后端修复

#### 1.1 添加释放申请管理端点

**文件**: `server/src/controllers/admin.controller.ts`

新增三个函数:
- `getPendingRevokeRequests()` - 查询待审批的释放申请
- `approveRevokeRequest()` - 批准释放申请
- `rejectRevokeRequest()` - 拒绝释放申请

#### 1.2 注册路由

**文件**: `server/src/routes/admin.routes.ts`

```typescript
// 释放申请管理
router.get('/revoke-requests/pending', getPendingRevokeRequests)
router.post('/revoke-requests/:id/approve', approveRevokeRequest)
router.post('/revoke-requests/:id/reject', rejectRevokeRequest)
```

#### 1.3 添加数据库查询方法

**文件**: `server/src/services/token-allocation.service.ts`

新增 `getPendingRevokeRequests()` 方法，查询所有 `status='active'` 且 `revoke_reason IS NOT NULL` 的记录。

#### 1.4 触发WebSocket事件

**文件**: `server/src/services/auto-approval.service.ts`

在自动审批流程中添加事件触发:
- 申请通过后: `emitAdminRefreshRequests()` + `emitAdminRefreshAllocations()`
- 释放通过后: `emitAdminRefreshRevokeRequests()` + `emitAdminRefreshAllocations()`
- 触发生成后: `emitAdminRefreshRequests()`

### 2. 前端修复

#### 2.1 简化WebSocket Store

**文件**: `server/frontend/src/stores/websocket.ts`

移除复杂的回调注册系统:
- 删除 `taskUpdateCallbacks` 和 `accountUpdateCallbacks`
- 删除 `onTaskUpdate()` 和 `onAccountUpdate()` 方法
- 保留简单的事件监听和日志记录

#### 2.2 添加API方法

**文件**: `server/frontend/src/api/admin.ts`

新增:
- `PendingRevokeRequest` 类型定义
- `getPendingRevokeRequests()` - 获取待审批释放申请
- `approveRevokeRequest()` - 批准释放申请
- `rejectRevokeRequest()` - 拒绝释放申请

#### 2.3 更新用户管理页面

**文件**: `server/frontend/src/views/UserManagementView.vue`

1. 导入WebSocket store
2. 添加 `pendingRevokeRequests` 数据
3. 添加加载和处理函数:
   - `loadPendingRevokeRequests()`
   - `handleApproveRevoke()`
   - `handleRejectRevoke()`
4. 在 `onMounted` 中直接监听WebSocket事件:
   ```typescript
   wsStore.socket?.on('admin:refresh-requests', () => {
     loadPendingRequests()
   })
   wsStore.socket?.on('admin:refresh-revoke-requests', () => {
     loadPendingRevokeRequests()
   })
   wsStore.socket?.on('admin:refresh-allocations', () => {
     loadAllocations()
   })
   ```
5. 添加"待审批的释放申请"UI卡片

## 实时刷新流程

### 客户端请求释放 (端口2233)
```
POST /api/tokens/:id/request-revoke
↓
auto-approval.service.ts 处理
↓
如果包含关键词 → 自动通过 → emit事件
如果不包含 → 需人工审批 → emit事件
↓
WebSocket广播: admin:refresh-revoke-requests
↓
管理员页面自动刷新
```

### 客户端申请Token (端口2233)
```
POST /api/tokens/request
↓
auto-approval.service.ts 处理
↓
如果≤2个账号 → 自动通过 → emit事件
如果>2个账号 → 需人工审批 → emit事件
↓
WebSocket广播: admin:refresh-requests
↓
管理员页面自动刷新
```

## 关键改进

1. **直接事件监听**: 不再使用回调注册，直接在组件中监听WebSocket事件
2. **简化代码**: 移除了臃肿的回调管理系统
3. **完整端点**: 补全了所有缺失的API端点
4. **实时更新**: 自动审批后立即触发前端刷新

## 测试要点

1. 客户端提交释放请求后，管理员页面"待审批的释放申请"应立即刷新
2. 客户端提交Token申请后，管理员页面"待审批申请"应立即刷新
3. 自动审批通过后，"Token分配记录"应立即刷新
4. WebSocket断开重连后，事件监听应继续工作
