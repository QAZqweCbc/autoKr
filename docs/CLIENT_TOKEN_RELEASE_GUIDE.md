# 客户端Token释放请求指南

## 概述

本文档说明客户端如何请求释放已分配的Token账号。系统支持自动审批机制，符合条件的释放请求会立即通过，无需等待管理员人工审批。

## API接口

### 请求释放Token

**端点**: `POST /api/client/tokens/:id/request-revoke`

**认证**: 需要用户JWT Token

**请求参数**:
- `:id` - Token分配记录的ID（路径参数）

**请求体**:
```json
{
  "reason": "释放理由"
}
```

**请求头**:
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

## 自动审批规则

系统会根据您提供的释放理由自动判断是否立即通过：

### 自动通过的关键词

如果释放理由包含以下任一关键词，系统会**自动审批通过**：

#### 中文关键词
- 封禁
- 不可用
- 额度已满
- 过期

#### 英文关键词
- banned / ban
- unavailable / not available
- quota / full / limit
- expired / expire

### 示例

✅ **自动通过的理由**:
- "账号被封禁"
- "账号不可用了"
- "额度已满无法使用"
- "Token已过期"
- "Account is banned"
- "Quota limit reached"

❌ **需要人工审批的理由**:
- "不想用了"
- "换个新的"
- "测试完成"

## 请求示例

### JavaScript/TypeScript

```typescript
// 使用 axios
import axios from 'axios'

async function requestRevokeToken(allocationId: string, reason: string) {
  try {
    const response = await axios.post(
      `/api/client/tokens/${allocationId}/request-revoke`,
      { reason },
      {
        headers: {
          'Authorization': `Bearer ${yourJwtToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (response.data.auto_approved) {
      console.log('✅ 释放申请已自动审批通过')
    } else {
      console.log('⏳ 释放申请已提交，等待管理员审批')
    }
    
    return response.data
  } catch (error) {
    console.error('释放申请失败:', error.response?.data?.message)
    throw error
  }
}

// 调用示例
await requestRevokeToken('allocation-id-123', '账号被封禁')
```

### Python

```python
import requests

def request_revoke_token(allocation_id: str, reason: str, jwt_token: str):
    url = f'http://your-api-domain/api/client/tokens/{allocation_id}/request-revoke'
    headers = {
        'Authorization': f'Bearer {jwt_token}',
        'Content-Type': 'application/json'
    }
    data = {
        'reason': reason
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        if result.get('auto_approved'):
            print('✅ 释放申请已自动审批通过')
        else:
            print('⏳ 释放申请已提交，等待管理员审批')
        
        return result
    except requests.exceptions.RequestException as e:
        print(f'释放申请失败: {e}')
        raise

# 调用示例
request_revoke_token('allocation-id-123', '账号被封禁', 'your-jwt-token')
```

### cURL

```bash
# 自动审批通过的示例
curl -X POST \
  'http://your-api-domain/api/client/tokens/allocation-id-123/request-revoke' \
  -H 'Authorization: Bearer your-jwt-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "reason": "账号被封禁"
  }'

# 响应示例（自动通过）
{
  "success": true,
  "message": "释放申请已自动审批通过",
  "auto_approved": true
}

# 响应示例（需要人工审批）
{
  "success": true,
  "message": "释放申请已提交，等待管理员审批",
  "auto_approved": false,
  "reason": "需人工审批"
}
```

## 响应说明

### 成功响应

#### 自动审批通过
```json
{
  "success": true,
  "message": "释放申请已自动审批通过",
  "auto_approved": true
}
```

#### 需要人工审批
```json
{
  "success": true,
  "message": "释放申请已提交，等待管理员审批",
  "auto_approved": false,
  "reason": "需人工审批"
}
```

### 错误响应

#### 400 - 缺少释放理由
```json
{
  "success": false,
  "message": "请提供释放理由"
}
```

#### 403 - 无权操作
```json
{
  "success": false,
  "message": "无权操作此Token"
}
```

#### 404 - 分配记录不存在
```json
{
  "success": false,
  "message": "分配记录不存在"
}
```

#### 400 - 状态不正确
```json
{
  "success": false,
  "message": "只能释放活跃的Token"
}
```

## 完整流程示例

### 1. 获取我的Token列表

首先获取您当前拥有的Token列表：

```typescript
// GET /api/client/tokens/my-tokens
const response = await axios.get('/api/client/tokens/my-tokens', {
  headers: {
    'Authorization': `Bearer ${yourJwtToken}`
  }
})

// 响应示例
{
  "success": true,
  "tokens": [
    {
      "id": "allocation-id-123",
      "account_email": "test@example.com",
      "status": "active",
      "allocated_at": 1234567890000,
      "usage_current": 500,
      "usage_limit": 3000,
      "usage_percent": 16.67
    }
  ]
}
```

### 2. 选择要释放的Token

从列表中选择需要释放的Token，获取其 `id`。

### 3. 提交释放请求

使用获取到的 `id` 提交释放请求：

```typescript
const allocationId = 'allocation-id-123'
const reason = '账号被封禁' // 包含关键词，会自动通过

const response = await axios.post(
  `/api/client/tokens/${allocationId}/request-revoke`,
  { reason },
  {
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
      'Content-Type': 'application/json'
    }
  }
)

if (response.data.auto_approved) {
  console.log('✅ Token已释放，可以申请新的Token了')
} else {
  console.log('⏳ 释放申请已提交，请等待管理员审批')
}
```

## 最佳实践

### 1. 提供准确的释放理由

为了提高自动审批通过率，请提供准确的释放理由：

✅ **推荐**:
```json
{
  "reason": "账号被AWS封禁，无法继续使用"
}
```

❌ **不推荐**:
```json
{
  "reason": "不想用了"
}
```

### 2. 常见释放场景及建议理由

| 场景 | 建议理由 | 是否自动通过 |
|------|---------|-------------|
| 账号被封禁 | "账号被封禁" | ✅ 是 |
| 额度用完 | "额度已满" | ✅ 是 |
| Token过期 | "Token已过期" | ✅ 是 |
| 账号异常 | "账号不可用" | ✅ 是 |
| 测试完成 | "测试完成，不再需要" | ❌ 否 |
| 换新账号 | "想换个新的账号" | ❌ 否 |

### 3. 错误处理

```typescript
async function safeRequestRevoke(allocationId: string, reason: string) {
  try {
    const response = await requestRevokeToken(allocationId, reason)
    return {
      success: true,
      data: response
    }
  } catch (error) {
    if (error.response?.status === 403) {
      return {
        success: false,
        error: '您无权释放此Token'
      }
    } else if (error.response?.status === 404) {
      return {
        success: false,
        error: 'Token不存在'
      }
    } else if (error.response?.status === 400) {
      return {
        success: false,
        error: error.response.data.message || '请求参数错误'
      }
    } else {
      return {
        success: false,
        error: '释放请求失败，请稍后重试'
      }
    }
  }
}
```

### 4. 释放后重新申请

Token释放成功后，您可以立即申请新的Token：

```typescript
// 1. 释放旧Token
await requestRevokeToken(oldAllocationId, '账号被封禁')

// 2. 申请新Token
const newTokenResponse = await axios.post(
  '/api/client/tokens/request',
  {},
  {
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`
    }
  }
)

if (newTokenResponse.data.auto_approved) {
  console.log('✅ 新Token已自动分配')
} else if (newTokenResponse.data.generating) {
  console.log('⏳ 账号构建中，请稍候...')
} else {
  console.log('⏳ 申请已提交，等待审批')
}
```

## 注意事项

1. **释放理由必填**: 必须提供释放理由，否则请求会被拒绝
2. **只能释放自己的Token**: 只能释放分配给您的Token，无法释放其他用户的Token
3. **只能释放活跃状态的Token**: 只有状态为 `active` 的Token才能被释放
4. **关键词不区分大小写**: 自动审批的关键词匹配不区分大小写
5. **释放后立即生效**: 自动审批通过的释放请求会立即生效，Token会被释放回账号池

## 常见问题

### Q1: 为什么我的释放请求需要人工审批？

A: 如果您的释放理由不包含自动审批关键词，系统会将请求提交给管理员人工审批。建议使用包含关键词的准确理由。

### Q2: 释放请求提交后多久会处理？

A: 
- 自动审批：立即处理（通常在1秒内）
- 人工审批：取决于管理员的处理速度，通常在24小时内

### Q3: 可以取消已提交的释放请求吗？

A: 目前系统不支持取消释放请求。如果是自动审批通过的请求，Token已被释放；如果是人工审批，请联系管理员。

### Q4: 释放Token后可以立即申请新的吗？

A: 可以。Token释放成功后，您的配额会立即释放，可以立即申请新的Token。

### Q5: 如何查看我的释放请求状态？

A: 可以通过以下接口查看您的申请历史：

```bash
GET /api/client/tokens/my-requests
Authorization: Bearer <your-jwt-token>
```

## 技术支持

如有问题，请联系：
- 技术支持邮箱: support@example.com
- 查看完整API文档: `/docs/AUTO_APPROVAL_SYSTEM.md`
- 管理员联系方式: admin@example.com
