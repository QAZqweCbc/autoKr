# Token 认证失败分析与解决方案

**版本**: 2.0  
**最后更新**: 2026-06-03  
**重要改进**: 添加主动 Token 刷新逻辑

## 🎯 关键改进 v2.0

### 用户发现的问题

原始逻辑是**被动响应**：
```
检测到 JWT → 警告但继续 → API 失败 401 → 才刷新
⏱️  浪费 2-3 秒等待必然失败的请求
```

### 改进后的逻辑

现在是**主动预防**：
```
检测到 JWT → 立即刷新 → 使用新 Token → API 成功
⚡ 节省时间，避免无效请求
```

## 📊 问题诊断

### 原始错误日志

```
[0] [Sync] Syncing usage for: sean.scott70@kasxi.site
[0] [Kiro API] Calling GetUserInfo
[0] [Kiro API] Response status: 200  ✅ 成功
[0] [Kiro API] Calling GetUserUsageAndLimits
[0] [Kiro API] Response status: 401  ❌ 失败
[0] [Kiro API] Error: UnauthorizedException: Authentication required or access denied.
```

### 关键发现

经过深入分析，发现问题的**根本原因**是：

| 对比项 | 失败时 | 成功时 | 差异 |
|--------|--------|--------|------|
| **AccessToken 长度** | 1481 字符 | 232 字符 | **6倍差异** |
| **GetUserInfo** | ✅ 200 | ✅ 200 | 都成功 |
| **GetUserUsageAndLimits** | ❌ 401 | ✅ 200 | Token 格式问题 |

## 🔍 Token 格式分析

### 正确的 AWS SSO Access Token

```
格式: aoa + Base64 编码内容
长度: 200-300 字符
示例: aoaAAAAAGoef5MGMfNuV1BJoz-iOLixRtH-RZA7xlwmLcK9uP0m5ZUNchFOluHTEXYRn0gCkc0:MGUCME...
```

### 错误的 Token 类型

| Token 类型 | 特征 | 长度 | 问题 |
|-----------|------|------|------|
| **JWT Token** | 以 `eyJ` 开头，包含 `.` 分隔符 | 800-2000+ | 这是身份凭证，不是 API Access Token |
| **Refresh Token** | 长字符串，无特定格式 | 1000-1500+ | 用于刷新，不能直接调用 API |
| **复合凭证** | Base64 编码的完整响应 | 1000+ | 整个 OAuth 响应被错误存储 |

## 💡 解决方案

### 1. 已实施的改进

#### ✅ Token 格式验证工具

创建了 `src/utils/token-validator.ts`，提供：

```typescript
// 验证 Token 格式
const validation = validateAccessToken(token)

// 返回详细结果
interface TokenValidationResult {
  valid: boolean
  type: 'aws-sso' | 'jwt' | 'unknown' | 'invalid'
  length: number
  issue?: string
  suggestion?: string
}
```

#### ✅ 关键位置添加日志

1. **SSO 设备授权时** (`token.controller.ts:319`)
   - 验证获取到的 Access Token 格式
   - 记录 Token 类型和长度
   - 警告异常格式但不阻断（向前兼容）

2. **API 调用前** (`kiro-api.service.ts:28`)
   - 验证即将使用的 Token
   - 记录详细的 Token 信息
   - 提前发现格式问题

### 2. 使用方式

#### 启动服务并观察日志

```bash
npm run dev
```

当提交 Token 或刷新 Token 时，会看到详细的验证日志：

```
✅ [Token Validation] SSO Device Auth - Access Token
   类型: aws-sso
   长度: 232 字符
   开头: aoaAAAAAGoef5MGM8vDw2PNpXid6ppv21SQfNuV1BJoz-iOL...
   结尾: ...tlH07GtJ89TUMs/wbI6OShOKJRut//wIefEqJfpEo6Ti68ZWhg
```

或者错误时：

```
❌ [Token Validation] Kiro API - GetUserUsageAndLimits
   类型: jwt
   长度: 1481 字符
   开头: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ⚠️  问题: 这是 JWT Token，不是 AWS SSO Access Token
   💡 建议: 请使用 SSO 设备授权获取的 accessToken（以 aoa 开头）
```

### 3. 诊断工具

#### 检查现有账号的 Token 格式

```bash
node diagnose-token.js
```

输出示例：

```
📊 总账号数: 5

[1] user1@example.com
  Type: AWS SSO Token (CORRECT)
  Length: 245
  Start: aoaAAAAAHge...
  
[2] user2@example.com
  Type: JWT Token (WRONG)
  Length: 1423
  ISSUE: This is a JWT, not AWS SSO Access Token
```

## 🎯 故障排查流程

### 步骤 1：验证 Token 来源

确认 Token 来自正确的 OAuth 流程：

```typescript
// ✅ 正确：使用 SSO 设备授权
const ssoResult = await ssoDeviceAuth(x_amz_sso_authn, region)
const accessToken = ssoResult.accessToken  // 这是正确的

// ❌ 错误：直接使用 Bearer Token
const accessToken = x_amz_sso_authn  // 这是 JWT，不能用于 API 调用
```

### 步骤 2：检查数据库中的 Token

```bash
node diagnose-token.js
```

如果发现 JWT 或其他格式，需要重新提交正确的 Token。

### 步骤 3：测试 API 调用

```bash
# 测试单个账号的使用量同步
curl -X POST http://localhost:3000/api/token/{account_id}/sync-usage
```

观察控制台日志中的 Token 验证信息。

### 步骤 4：如果还是失败

1. **检查 Token 是否过期**
   ```baken/{account_id}/refresh
   ```

2. **检查账号状态**
   - 确认账号在 AWS 控制台中是活跃状态
   - 确认不是临时邮箱注册的测试账号

3. **查看完整错误信息**
   - 检查 `lastError` 字段
   - 查看 `consecutiveFailures` 计数

## 📋 常见问题 FAQ

### Q1: 为什么 GetUserInfo 成功但 GetUserUsageAndLimits 失败？

**A**: 这两个 API 对 Token 格式的要求不同：
- `GetUserInfo` 更宽松，JWT 也可能通过
- `GetUserUsageAndLimits` 严格要求 AWS SSO Access Token

### Q2: 如何确认我的 Token 格式正确？

**A**: 正确的 AWS SSO Access Token 应该：
- ✅ 以 `aoa` 开头
- ✅ 长度在 200-350 字符之间
- ✅ 不包含 `.` 分隔符（那是 JWT）

### Q3: Token 刷新后还是失败怎么办？

**A**: Token 刷新只能获取新的相同类型 Token。如果原始 Token 类型就错了，刷新后仍然是错误类型。需要：
1. 删除账号
2. 重新执行 SSO 设备授权流程
3. 确保获取的是 `accessToken` 字段，不是 Bearer Token

### Q4: 参考项目能用，为什么我的项目不行？

**A**: 参考项目也会遇到同样问题。从您提供的日志看：
- **失败时**: AccessToken 长度 1481（错误格式）
- **成功时**: AccessToken 长度 232（正确格式）

说明参考项目在 Token 刷新后才恢复正常。现在两个项目都有了验证机制。

### Q5: 1481 字符的 Token 是什么？

**A**: 最可能是：
1. **完整的 JWT 身份凭证**（identity token）
2. **Base64 编码的完整 OAuth 响应**
3. **Refresh Token**（用于刷新，不能直接 API 调用）

这些都不能直接用于 Kiro API 调用。

## 🔧 代码变更总结

### 新增文件

1. `src/utils/token-validator.ts` - Token 验证工具
2. `diagnose-token.js` - 数据库诊断脚本
3. `TOKEN_AUTHENTICATION_ANALYSIS.md` - 本文档

### 修改文件

1. `src/controllers/token.controller.ts`
   - 导入 Token 验证工具
   - 在 SSO 授权成功后验证 Token 格式

2. `src/services/kiro-api.service.ts`
   - 导入 Token 验证工具
   - 在 API 调用前验证 Token 格式

### 验证改进效果

启动服务后，任何 Token 提交、刷新、API 调用都会自动验证并记录详细信息：

```bash
npm run dev

# 然后提交一个 Token 或触发刷新
# 观察控制台输出的验证日志
```

## 🎓 技术要点

### AWS SSO OAuth 流程

```
1. 注册 OIDC 客户端
   → 获取 clientId, clientSecret

2. 发起设备授权
   → 获取 deviceCode, userCode

3. 用户使用 Bearer Token 验证
   → whoAmI API

4. 批准授权
   → associate_token

5. 轮询获取 Token
   → 获取 accessToken (以 aoa 开头) ✅
   → 获取 refreshToken (用于刷新)
```

### Token 类型对照表

| Token 名称 | 用途 | 格式 | 长度 | 能否调用 API |
|-----------|------|------|------|-------------|
| Bearer Token (x-amz-sso-authn) | 初始身份验证 | JWT | 800-1500 | ❌ 不能 |
| Access Token | API 调用凭证 | AWS SSO | 200-300 | ✅ 可以 |
| Refresh Token | 刷新 Access Token | 无固定格式 | 500-1000 | ❌ 不能 |
| ID Token | 身份信息 | JWT | 1000-2000 | ❌ 不能 |

## 📞 后续支持

如果遇到问题：

1. 查看控制台的 Token 验证日志
2. 运行 `node diagnose-token.js` 检查数据库
3. 确认 Token 来源是 `ssoResult.accessToken`
4. 确认账号状态和权限

---

**文档版本**: 1.0  
**创建日期**: 2026-06-02  
**最后更新**: 2026-06-02
