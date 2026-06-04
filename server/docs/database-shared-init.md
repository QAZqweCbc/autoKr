# 数据库共享初始化方案

## 问题背景

项目中有两个独立的服务进程：
- **Main Service** (端口1455) - 主服务
- **Auth Service** (端口2233) - 认证服务

之前的架构中，两个服务各自独立执行数据库初始化，导致：
1. **重复检查**：每个服务都执行预检 + 初始化，共4次MySQL连接测试
2. **资源浪费**：重复的表创建检查和连接测试
3. **启动延迟**：两个服务串行执行相同的初始化逻辑

## 解决方案：多进程协调初始化

### 核心思想

通过文件系统共享初始化状态，让一个服务作为"主初始化进程"完成数据库初始化，其他服务等待并复用结果。

### 架构设计

```
启动流程：
┌─────────────────┐         ┌─────────────────┐
│  Main Service   │         │  Auth Service   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         ├─ 1. 预检测试              ├─ 1. 预检测试
         ├─ 2. 尝试成为初始化进程    ├─ 2. 发现已有初始化进程
         ├─ 3. 执行完整初始化        ├─ 3. 等待初始化完成
         │    - 创建表               │
         │    - 迁移字段             │
         ├─ 4. 标记完成              ├─ 4. 读取共享状态
         ├─ 5. 写入状态文件          ├─ 5. 创建连接池
         │                           │
         └─ MySQL ←──────────────────┘
            (共享同一个数据库)
```

### 实现组件

#### 1. 数据库初始化协调器 (`database-init-coordinator.service.ts`)

负责多进程间的初始化协调，通过 `.db-init-state.json` 共享状态。

**核心功能：**
- `tryBecomeInitializer()` - 尝试成为主初始化进程
- `waitForDatabaseInit()` - 等待其他进程完成初始化
- `markPreCheckDone()` - 标记预检完成
- `markInitDone()` - 标记初始化完成
- `cleanupInitState()` - 清理状态文件

**状态文件结构：**
```json
{
  "initialized": true,
  "storageMode": "mysql",
  "timestamp": 1234567890,
  "preCheckDone": true,
  "initializingPid": 12345
}
```

#### 2. 数据库适配器更新 (`database.adapter.ts`)

**主要改动：**

```typescript
export async function initDatabase() {
  // 1. 检查是否已有其他进程完成初始化
  const existingState = getInitState()
  if (existingState?.initialized) {
    // 复用已有初始化，只创建连接池
    await createConnectionPool(existingState.storageMode)
    return
  }

  // 2. 尝试成为初始化进程
  isInitializer = tryBecomeInitializer()

  if (!isInitializer) {
    // 等待主进程完成
    const state = await waitForDatabaseInit()
    await createConnectionPool(state.storageMode)
    return
  }

  // 3. 作为主进程执行完整初始化
  await initMySQL(config.mysql, preCheckPassed)
  markInitDone(currentStorage)
}
```

**新增函数：**
- `createConnectionPool()` - 只创建连接池，不执行表创建等初始化操作

#### 3. MySQL 服务更新 (`mysql.service.ts`)

**新增导出：**
```typescript
export function setPool(newPool: mysql.Pool) {
  pool = newPool
}
```

允许外部设置连接池，供非主初始化进程使用。

#### 4. 启动文件更新

**Main Service (`src/index.ts`):**
```typescript
// 标记预检完成
markPreCheckDone(preCheckResult.storageMode)

// 初始化数据库（支持多进程共享）
await initDatabase()

// 关闭时清理状态文件
process.on('SIGINT', async () => {
  cleanupInitState()
  await closeDatabase()
})
```

**Auth Service (`src/auth-service/index.ts`):**
```typescript
// 标记预检完成
markPreCheckDone(preCheckResult.storageMode)

// 初始化数据库（会自动等待主进程）
await initDatabase()
```

### 工作流程

#### 场景1：Main Service 先启动

1. Main Service 执行预检 → 写入状态文件（preCheckDone: true）
2. Main Service 调用 `initDatabase()` → 成为初始化进程
3. Main Service 执行完整初始化（创建表、迁移字段等）
4. Main Service 标记完成 → 更新状态文件（initialized: true）
5. Auth Service 启动 → 读取状态文件 → 发现已初始化
6. Auth Service 只创建自己的连接池 → 完成

**检查次数：1次（Main Service 的预检）**

#### 场景2：并发启动

1. 两个服务同时启动，都执行预检
2. Main Service 先获取初始化锁
3. Auth Service 发现有进程正在初始化 → 进入等待模式
4. Main Service 完成初始化 → 写入状态文件
5. Auth Service 检测到状态更新 → 创建连接池 → 完成

**检查次数：2次（各自的预检），但只有一个执行完整初始化**

#### 场景3：Auth Service 先启动

1. Auth Service 执行预检 → 成为初始化进程
2. Auth Service 执行完整初始化
3. Main Service 启动 → 发现已初始化 → 创建连接池

**检查次数：1次（Auth Service 的预检）**

### 优化效果

| 项目 | 修复前 | 修复后 | 优化幅度 |
|------|--------|--------|----------|
| MySQL连接测试 | 4次 | 1-2次 | 减少50-75% |
| 表创建检查 | 2次 | 1次 | 减少50% |
| 字段迁移 | 2次 | 1次 | 减少50% |
| 启动日志行数 | ~200行 | ~100行 | 减少50% |

### 日志输出示例

**Main Service (主初始化进程):**
```
📦 [预检] 测试 MySQL 连接...
✅ [预检] MySQL 连接成功
🎯 当前进程负责数据库初始化
📦 存储模式: MYSQL
ℹ️  预检已通过，跳过重复连接测试
✅ MySQL 初始化完成
✅ 数据库初始化完成（主进程）
✅ 数据库初始化状态已共享给其他服务
```

**Auth Service (等待进程):**
```
ℹ️  检测到数据库已由其他服务初始化完成
   存储模式: MYSQL
✅ MySQL 连接池已创建
✅ 数据库连接池创建完成（复用已有初始化）
```

### 文件清单

**新增文件：**
- `src/services/database-init-coordinator.service.ts` - 初始化协调器
- `.db-init-state.json` - 状态共享文件（临时，已加入 .gitignore）

**修改文件：**
- `src/services/database.adapter.ts` - 支持共享初始化
- `src/services/mysql.service.ts` - 新增 setPool 函数
- `src/index.ts` - 集成协调器
- `src/auth-service/index.ts` - 集成协调器
- `server/.gitignore` - 忽略状态文件

### 注意事项

1. **状态文件位置**：`.db-init-state.json` 位于 `server/` 目录下
2. **超时机制**：等待初始化超时时间为30秒
3. **清理机制**：主服务关闭时会自动清理状态文件
4. **进程独立**：每个进程仍维护自己的连接池（因为是独立进程）
5. **兼容性**：完全向后兼容，单个服务启动时行为与之前一致

### 测试建议

1. **正常启动**：`npm run dev:all` - 验证并发启动
2. **Main 先启动**：先 `npm run dev`，再 `npm run dev:auth`
3. **Auth 先启动**：先 `npm run dev:auth`，再 `npm run dev`
4. **清理测试**：Ctrl+C 后检查 `.db-init-state.json` 是否被清理
5. **降级测试**：MySQL 不可用时，验证两个服务都能降级到 JSON

### 未来优化方向

1. **Redis 作为状态存储**：替换文件系统，支持分布式部署
2. **健康检查端点**：暴露初始化状态给监控系统
3. **初始化超时告警**：当等待超时时发送告警
4. **数据库版本管理**：集成 migration 版本控制
