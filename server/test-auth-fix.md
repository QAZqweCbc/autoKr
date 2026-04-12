# 401 认证错误修复验证

## 修复内容

### 1. ✅ 自动处理 401 错误
**文件**: `server/frontend/src/api/axios.ts`

**功能**:
- 拦截所有 401 响应
- 自动清除过期的 `admin_token`
- 重定向到登录页面
- 防止重复重定向

**代码**:
```typescript
// Handle 401 Unauthorized - clear token and redirect to login
if (error.response?.status === 401) {
  console.warn('[Auth] Token expired or invalid, clearing localStorage')
  localStorage.removeItem('admin_token')
  
  // Redirect to login page if not already there
  if (!window.location.pathname.includes('/admin/login')) {
    window.location.href = '/admin/login'
  }
}
```

### 2. ✅ 时间显示已完整
**文件**: `server/frontend/src/views/UserManagementView.vue`

**已有时间列**:
- 待审批申请表 → `requested_at` (申请时间)
- 待审批释放申请表 → `requested_at` (申请时间)
- Token分配记录表 → `requested_at` (申请时间)

**格式化函数**: `server/frontend/src/utils/format.ts`
```typescript
export function formatTime(timestamp: number | string): string {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}
```

## 测试步骤

### 测试 401 错误处理

1. **清除 localStorage**
   ```javascript
   // 在浏览器控制台执行
   localStorage.removeItem('admin_token')
   ```

2. **访问管理页面**
   - 打开 `http://localhost:3000/admin/users`
   - 应该自动重定向到 `/admin/login`

3. **登录后验证**
   - 登录成功后，token 应该被保存
   - 所有 API 请求应该正常工作

### 测试时间显示

1. **查看待审批申请**
   - 打开用户管理页面
   - 检查"待审批申请"表格
   - 确认"申请时间"列显示正确的本地时间

2. **查看分配记录**
   - 滚动到"Token分配记录"表格
   - 确认"申请时间"列显示正确

3. **时间格式验证**
   - 格式应为: `2024/1/15 14:30:25`
   - 使用中文本地化格式

## 数据库时间字段

### token_allocations 表
```sql
CREATE TABLE token_allocations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(36),
  status ENUM('pending', 'approved', 'rejected', 'active', 'revoked'),
  requested_at BIGINT NOT NULL,      -- ✅ 申请时间 (毫秒时间戳)
  approved_at BIGINT,                -- ✅ 批准时间
  approved_by VARCHAR(36),
  reject_reason TEXT,
  revoked_at BIGINT,                 -- ✅ 释放时间
  revoked_by VARCHAR(36),
  revoke_reason TEXT
)
```

## 预期结果

✅ 401 错误不再导致页面卡死
✅ 自动清除过期 token
✅ 自动重定向到登录页
✅ 所有申请都显示时间
✅ 时间格式为本地化中文格式

## 注意事项

1. **Token 过期时间**: 默认 24 小时，可在后端配置
2. **时间戳格式**: 使用毫秒时间戳 (JavaScript `Date.now()`)
3. **时区**: 自动使用浏览器本地时区
