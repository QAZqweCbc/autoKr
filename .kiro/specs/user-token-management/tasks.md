# 用户管理与Token分配系统 - 任务列表

## 阶段1：数据库和基础服务

- [x] 1.1 创建数据库表
  - [x] 1.1.1 创建 client_users 表
  - [x] 1.1.2 创建 token_allocations 表
  - [x] 1.1.3 创建 verification_codes 表
  - [x] 1.1.4 添加数据库迁移脚本

- [x] 1.2 安装依赖包
  - [x] 1.2.1 安装 jsonwebtoken, bcrypt, express, cors
  - [x] 1.2.2 安装对应的 @types 包

- [x] 1.3 创建数据模型
  - [x] 1.3.1 创建 client-user.model.ts
  - [x] 1.3.2 创建 token-allocation.model.ts

- [x] 1.4 实现JWT服务
  - [x] 1.4.1 创建 jwt.service.ts (生成和验证Token)
  - [x] 1.4.2 创建 auth.middleware.ts (JWT验证中间件)
  - [x] 1.4.3 添加环境变量 JWT_SECRET

- [x] 1.5 实现验证码服务
  - [x] 1.5.1 创建 verification.service.ts
  - [x] 1.5.2 实现验证码生成逻辑
  - [x] 1.5.3 实现频率限制逻辑
  - [x] 1.5.4 集成邮件发送服务

## 阶段2：用户注册功能

- [x] 2.1 创建注册认证服务结构
  - [x] 2.1.1 创建 auth-service/index.ts (端口2233)
  - [x] 2.1.2 配置Express应用和中间件
  - [x] 2.1.3 配置CORS和JSON解析

- [x] 2.2 实现用户数据库操作
  - [x] 2.2.1 创建 client-user.service.ts
  - [x] 2.2.2 实现用户CRUD操作
  - [x] 2.2.3 实现密码加密和验证

- [x] 2.3 实现注册API
  - [x] 2.3.1 创建 auth.controller.ts
  - [x] 2.3.2 实现 POST /api/auth/send-code
  - [x] 2.3.3 实现 POST /api/auth/register
  - [x] 2.3.4 创建 auth.routes.ts 并注册路由

- [x] 2.4 实现登录API
  - [x] 2.4.1 实现 POST /api/auth/login
  - [x] 2.4.2 添加密码验证逻辑
  - [x] 2.4.3 返回JWT Token

- [ ] 2.5 测试注册流程
  - [ ] 2.5.1 测试验证码发送
  - [ ] 2.5.2 测试用户注册
  - [ ] 2.5.3 测试用户登录
  - [ ] 2.5.4 测试错误场景

## 阶段3：Token申请与审批

- [x] 3.1 实现Token分配数据库操作
  - [x] 3.1.1 创建 token-allocation.service.ts
  - [x] 3.1.2 实现分配记录CRUD操作
  - [x] 3.1.3 实现按用户查询分配记录

- [x] 3.2 实现Token可用性检测
  - [x] 3.2.1 创建 token-availability.service.ts
  - [x] 3.2.2 实现 isAccountAvailable() 函数
  - [x] 3.2.3 实现 selectAvailableAccount() 函数
  - [x] 3.2.4 集成 syncAccountUsage() 调用

- [x] 3.3 实现用户Token申请API
  - [x] 3.3.1 创建 token.controller.ts
  - [x] 3.3.2 实现 POST /api/tokens/request
  - [x] 3.3.3 实现配额检查逻辑
  - [x] 3.3.4 实现 GET /api/tokens/my-requests
  - [x] 3.3.5 实现 GET /api/tokens/my-tokens
  - [x] 3.3.6 创建 token.routes.ts 并注册路由

- [x] 3.4 实现管理员审批API
  - [x] 3.4.1 创建 admin.controller.ts
  - [x] 3.4.2 实现 POST /api/admin/login
  - [x] 3.4.3 创建管理员默认账户 (admin@user.com)
  - [x] 3.4.4 实现 GET /api/admin/requests/pending
  - [x] 3.4.5 实现 POST /api/admin/requests/:id/approve
  - [x] 3.4.6 实现 POST /api/admin/requests/:id/reject
  - [x] 3.4.7 创建 admin.routes.ts 并注册到主服务

- [x] 3.5 实现分配逻辑
  - [x] 3.5.1 实现事务处理
  - [x] 3.5.2 实现账户选择算法（按created_at排序）
  - [x] 3.5.3 实现实时可用性检测
  - [x] 3.5.4 实现分配状态更新

- [ ] 3.6 测试申请审批流程
  - [ ] 3.6.1 测试用户申请
  - [ ] 3.6.2 测试配额限制
  - [ ] 3.6.3 测试管理员审批
  - [ ] 3.6.4 测试管理员拒绝
  - [ ] 3.6.5 测试账户选择算法

## 阶段4：Token刷新功能

- [x] 4.1 实现Token刷新API
  - [x] 4.1.1 实现 POST /api/tokens/refresh/:accountId
  - [x] 4.1.2 实现归属验证
  - [x] 4.1.3 实现缓存检查（5分钟）
  - [x] 4.1.4 集成 syncAccountUsage() 调用
  - [x] 4.1.5 实现数据库更新

- [x] 4.2 实现缓存机制
  - [x] 4.2.1 实现内存缓存
  - [x] 4.2.2 实现缓存过期检查
  - [x] 4.2.3 实现缓存清理

- [ ] 4.3 测试刷新流程
  - [ ] 4.3.1 测试首次刷新
  - [ ] 4.3.2 测试缓存返回
  - [ ] 4.3.3 测试频率限制
  - [ ] 4.3.4 测试数据同步

## 阶段5：管理员功能

- [x] 5.1 实现用户管理API
  - [x] 5.1.1 实现 GET /api/admin/users
  - [x] 5.1.2 实现 PUT /api/admin/users/:id/quota
  - [x] 5.1.3 实现 PUT /api/admin/users/:id/status

- [x] 5.2 实现分配管理API
  - [x] 5.2.1 实现 GET /api/admin/allocations
  - [x] 5.2.2 实现 POST /api/admin/allocations/:id/revoke
  - [x] 5.2.3 实现释放逻辑（回收账户到池中）

- [x] 5.3 实现统计功能
  - [x] 5.3.1 实现 GET /api/admin/stats/pool
  - [x] 5.3.2 计算可用账户数量
  - [x] 5.3.3 计算待审批申请数量
  - [x] 5.3.4 计算用户统计

- [x] 5.4 实现批量刷新功能
  - [x] 5.4.1 实现 POST /api/admin/accounts/refresh-all
  - [x] 5.4.2 实现批量并发控制（10个并发）
  - [x] 5.4.3 实现进度反馈

- [ ] 5.5 测试管理员功能
  - [ ] 5.5.1 测试用户管理
  - [ ] 5.5.2 测试Token释放
  - [ ] 5.5.3 测试配额调整
  - [ ] 5.5.4 测试统计查询
  - [ ] 5.5.5 测试批量刷新

## 阶段6：集成测试和优化

- [ ] 6.1 端到端测试
  - [ ] 6.1.1 测试完整用户旅程
  - [ ] 6.1.2 测试并发申请场景
  - [ ] 6.1.3 测试配额边界情况
  - [ ] 6.1.4 测试错误恢复

- [x] 6.2 性能优化
  - [x] 6.2.1 添加数据库索引
  - [x] 6.2.2 优化查询语句（使用复合索引）
  - [x] 6.2.3 实现连接池配置（已配置10个连接）
  - [x] 6.2.4 添加请求日志（已实现）

- [x] 6.3 安全加固
  - [x] 6.3.1 添加请求频率限制（验证码已实现）
  - [x] 6.3.2 配置CORS白名单（已配置）
  - [x] 6.3.3 添加SQL注入防护（使用参数化查询）
  - [x] 6.3.4 添加XSS防护（前端框架自带）
  - [x] 6.3.5 添加路由守卫（管理员页面需要登录）
  - [ ] 6.3.6 配置HTTPS（生产环境部署时）

- [x] 6.4 日志和监控
  - [x] 6.4.1 添加操作审计日志（audit-log.service.ts）
  - [x] 6.4.2 添加错误日志（已集成）
  - [x] 6.4.3 添加性能监控（PM2监控）
  - [x] 6.4.4 配置日志轮转（部署文档中说明）

- [x] 6.5 文档完善
  - [x] 6.5.1 编写API文档（TESTING.md）
  - [x] 6.5.2 编写部署文档（DEPLOYMENT.md）
  - [x] 6.5.3 编写运维文档（DEPLOYMENT.md包含）
  - [x] 6.5.4 编写故障排查指南（DEPLOYMENT.md包含）

## 阶段7：部署和上线

- [x] 7.1 环境配置
  - [x] 7.1.1 配置生产环境变量（.env.production.example）
  - [x] 7.1.2 配置数据库连接（已在配置文件中）
  - [x] 7.1.3 配置邮件服务（已在配置文件中）
  - [x] 7.1.4 配置JWT密钥（已在配置文件中）

- [x] 7.2 服务部署
  - [x] 7.2.1 构建生产版本（npm run build）
  - [x] 7.2.2 部署注册服务（PM2配置完成）
  - [x] 7.2.3 部署主服务（PM2配置完成）
  - [x] 7.2.4 配置进程管理（ecosystem.config.js）

- [x] 7.3 数据迁移
  - [x] 7.3.1 执行数据库迁移脚本（自动创建表）
  - [x] 7.3.2 创建管理员账户（npm run init:admin）
  - [x] 7.3.3 验证数据完整性（优化脚本包含）

- [ ] 7.4 上线验证
  - [ ] 7.4.1 验证注册流程
  - [ ] 7.4.2 验证申请审批流程
  - [ ] 7.4.3 验证管理员功能
  - [ ] 7.4.4 验证监控和日志

- [x] 7.5 回滚准备
  - [x] 7.5.1 备份数据库（部署文档中说明）
  - [x] 7.5.2 准备回滚脚本（部署文档中说明）
  - [x] 7.5.3 文档化回滚步骤（DEPLOYMENT.md）
