# P0 安全修复 - 测试指南

## ✅ 已完成的修复

1. ✅ 强制加密密钥配置
2. ✅ 强制JWT密钥配置  
3. ✅ CORS安全配置
4. ✅ 数据库初始化时序修复
5. ✅ 创建认证中间件
6. ✅ 创建 .env.example 配置模板

---

## 🧪 测试步骤

### 测试1: 验证加密密钥强制配置

**步骤**:
1. 确保 `.env` 文件中**没有** `ENCRYPTION_KEY`
2. 启动服务: `npm run dev`

**预期结果**:
```
❌ 未设置加密密钥！
============================================================
请在 .env 文件中设置 ENCRYPTION_KEY 环境变量

生成密钥命令:
  openssl rand -base64 32
```

服务应该**拒绝启动**并退出。

---

### 测试2: 验证JWT密钥强制配置

**步骤**:
1. 在 `.env` 中设置 `ENCRYPTION_KEY`
2. 确保**没有** `JWT_SECRET`
3. 启动服务: `npm run dev`

**预期结果**:
```
✅ 加密密钥已配置
❌ 未设置 JWT 密钥！
============================================================
请在 .env 文件中设置 JWT_SECRET 环境变量
```

服务应该**拒绝启动**并退出。

---

### 测试3: 验证正常启动

**步骤**:
1. 生成密钥:
   ```bash
   openssl rand -base64 32
   ```

2. 在 `.env` 文件中设置:
   ```bash
   ENCRYPTION_KEY=<生成的密钥1>
   JWT_SECRET=<生成的密钥2>
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

3. 启动服务: `npm run dev`

**预期结果**:
```
✅ 加密密钥已配置
✅ JWT 密钥已配置
🔒 CORS 允许的来源: [ 'http://localhost:3000', 'http://localhost:5173' ]
📦 存储模式: JSON
✅ 数据库初始化完成
✅ 服务器启动成功！
```

服务应该**正常启动**。

---

### 测试4: 验证CORS保护

**步骤**:
1. 启动服务
2. 使用浏览器或 curl 从**未授权的来源**发送请求:
   ```bash
   curl -H "Origin: http://evil.com" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        http://localhost:3000/api/accounts
   ```

**预期结果**:
- 请求被拒绝
- 日志显示: `CORS blocked origin: http://evil.com`

---

### 测试5: 验证数据库初始化错误处理

**步骤**:
1. 在 `config/database.config.json` 中配置错误的MySQL连接:
   ```json
   {
     "storage": "mysql",
     "mysql": {
       "host": "invalid-host",
       "port": 3306,
       "user": "root",
       "password": "wrong",
       "database": "test"
     }
   }
   ```

2. 启动服务: `npm run dev`

**预期结果**:
```
📦 存储模式: MYSQL
❌ MySQL 连接失败
⚠️  数据库初始化失败，已自动降级到 JSON 存储模式
📦 当前存储模式: JSON
✅ 服务器启动成功！
```

服务应该**降级到JSON模式**并继续运行。

---

### 测试6: 验证认证中间件（需要先应用到路由）

**注意**: 认证中间件已创建，但还需要应用到具体路由。

**临时测试步骤**:
1. 创建测试路由文件 `test-auth-route.ts`:
   ```typescript
   import { Router } from 'express'
   import { requireAuth, requireAdmin } from '../middleware/auth.middleware'
   
   const router = Router()
   
   router.get('/test-public', (req, res) => {
     res.json({ message: '公开端点' })
   })
   
   router.get('/test-auth', requireAuth, (req, res) => {
     res.json({ message: '需要认证', user: req.user })
   })
   
   router.get('/test-admin', requireAuth, requireAdmin, (req, res) => {
     res.json({ message: '需要管理员权限', user: req.user })
   })
   
   export default router
   ```

2. 在 `src/routes/index.ts` 中添加:
   ```typescript
   import testAuthRoutes from './test-auth-route'
   router.use('/test', testAuthRoutes)
   ```

3. 测试未认证访问:
   ```bash
   curl http://localhost:3000/api/test/test-auth
   ```
   
   **预期**: 返回 401 错误

4. 测试认证访问（需要先生成有效的JWT令牌）

---

## 📋 下一步工作

### 立即需要做的:
1. ✅ 将认证中间件应用到所有敏感路由
2. ✅ 更新 README.md 文档
3. ✅ 创建管理员登录接口（生成JWT令牌）
4. ✅ 添加单元测试

### 路由保护清单:

#### 需要认证的路由:
- `GET /api/accounts` - 获取账号列表
- `GET /api/accounts/:id` - 获取单个账号
- `POST /api/accounts/:id/reset-error` - 重置错误状态
- `GET /api/tasks` - 获取任务列表
- `GET /api/config` - 获取配置
- `GET /api/refresh/logs` - 获取刷新日志

#### 需要管理员权限的路由:
- `DELETE /api/accounts/:id` - 删除账号
- `POST /api/accounts/export` - 导出账号
- `POST /api/accounts/reset-errors` - 批量重置错误
- `POST /api/accounts/import` - 导入账号
- `POST /api/generator` - 生成账号
- `POST /api/config` - 更新配置
- `DELETE /api/tasks/:id` - 删除任务
- 所有 `/api/admin/*` 路由

#### 保持公开的路由:
- `GET /health` - 健康检查
- `GET /health-basic` - 基础健康检查
- `GET /metrics` - 监控指标
- `POST /api/auth/login` - 登录（生成令牌）
- `POST /api/auth/register` - 注册

---

## 🔍 验证检查清单

- [ ] 未设置 ENCRYPTION_KEY 时服务拒绝启动
- [ ] 未设置 JWT_SECRET 时服务拒绝启动
- [ ] 密钥长度小于32字符时服务拒绝启动
- [ ] CORS 只允许配置的来源访问
- [ ] 数据库初始化失败时能够降级到JSON模式
- [ ] 未认证请求返回 401 错误
- [ ] 非管理员请求管理员接口返回 403 错误
- [ ] 日志中不包含敏感信息（密钥、密码）
- [ ] .env.example 文件完整且准确

---

## 📝 注意事项

1. **不要提交 .env 文件到版本控制**
   - 添加到 .gitignore
   - 只提交 .env.example

2. **生产环境密钥管理**
   - 使用环境变量或密钥管理服务
   - 定期轮换密钥
   - 不要在代码中硬编码

3. **CORS 配置**
   - 开发环境可以宽松一些
   - 生产环境必须严格限制
   - 不要使用 `*` 通配符

4. **认证令牌**
   - 设置合理的过期时间（建议7天）
   - 使用 HTTPS 传输
   - 实现令牌刷新机制

---

## 🎯 成功标准

所有测试通过后，系统应该:
- ✅ 强制要求配置加密密钥和JWT密钥
- ✅ 只允许授权的来源访问API
- ✅ 数据库初始化失败时能够优雅降级
- ✅ 所有敏感操作都需要认证和授权
- ✅ 提供清晰的错误信息和配置指南
- ✅ 日志中不泄露敏感信息

---

**测试完成后，请继续下一步：应用认证中间件到所有路由**
