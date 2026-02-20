# Design Document

## 1. System Architecture Overview

### 1.1 Current Architecture

**Technology Stack:**
- Backend: Express.js + TypeScript
- Frontend: Vue.js 3 + Vite  
- Database: JSON files / MySQL (configurable via STORAGE_MODE)
- Real-time Communication: Socket.IO WebSocket
- Authentication: JWT tokens (currently stored in localStorage)
- Task Queue: In-memory task management

**Key Services:**
- `auth-service/`: Authentication and user management (port 2233)
- `services/`: Core business logic (token allocation, account management, auto-approval)
- `websocket/`: Real-time event broadcasting
- `controllers/`: HTTP request handlers
- `routes/`: API endpoint definitions

### 1.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                        │
│  - Rate Limiting (express-rate-limit)                       │
│  - Request Validation                                        │
│  - CORS Configuration                                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Authentication Layer                       │
│  - JWT Access Tokens (15min, httpOnly cookies)              │
│  - JWT Refresh Tokens (30d, httpOnly cookies)               │
│  - Token Rotation on Refresh                                 │
│  - WebSocket Authentication                                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│  - Auto-Approval Service                                     │
│  - Token Allocation Service                                  │
│  - Account Pool Service                                      │
│  - Transaction-wrapped Operations                            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                       │
│  - Secret Store (environment variables)                      │
│  - Database Pool Manager (dynamic sizing)                    │
│  - Distributed Lock Manager (Redis/DB-based)                 │
│  - Error Handler (centralized)                               │
│  - Health Monitor                                            │
│  - Config Manager (hot-reload)                               │
└─────────────────────────────────────────────────────────────┘
```

## 2. Component Design

### 2.1 Secret Store (`src/utils/secret-store.ts`)

**Purpose:** Centralized secure credential management

**Interface:**
```typescript
interface SecretStore {
  get(key: string): string
  getRequired(key: string): string
  validate(): void
  isLoaded(): boolean
}
```

**Implementation:**
- Load from `process.env` on startup
- Validate required secrets (JWT_SECRET, MAIN_API_KEY, etc.)
- Throw descriptive errors for missing secrets
- Never log actual secret values
- Support optional secrets with defaults

**Required Secrets:**
- JWT_SECRET
- MAIN_API_KEY  
- ADMIN_PASSWORD (or auto-generate)
- MYSQL_PASSWORD (if STORAGE_MODE=mysql)
- REDIS_PASSWORD (if using Redis locks)

### 2.2 Token Manager (`src/services/token-manager.service.ts`)

**Purpose:** Secure JWT token lifecycle management

**Token Strategy:**
- Access Token: 15 minutes, httpOnly cookie, sameSite=strict, secure
- Refresh Token: 30 days, httpOnly cookie, sameSite=strict, secure
- Token rotation on refresh (invalidate old refresh token)

**Interface:**
```typescript
interface TokenManager {
  generateAccessToken(payload: JWTPayload): string
  generateRefreshToken(userId: string): Promise<string>
  verifyAccessToken(token: string): JWTPayload
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string, refreshToken: string }>
  revokeRefreshToken(token: string): Promise<void>
  setTokenCookies(res: Response, accessToken: string, refreshToken: string): void
  clearTokenCookies(res: Response): void
}
```

**Database Schema (refresh_tokens table):**
```sql
CREATE TABLE refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  INDEX idx_user_id (user_id),
  INDEX idx_token_hash (token_hash)
)
```

### 2.3 WebSocket Authentication (`src/websocket/socket.handler.ts`)

**Authentication Flow:**
1. Client connects with auth cookie or query token
2. Server validates token before accepting connection
3. Periodic re-validation (every 5 minutes)
4. Graceful disconnect on token expiration

**Implementation:**
```typescript
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.cookie?.match(/accessToken=([^;]+)/)?.[1]
    
    if (!token) {
      return next(new Error('Authentication required'))
    }
    
    const payload = TokenManager.verifyAccessToken(token)
    socket.data.user = payload
    next()
  } catch (error) {
    next(new Error('Invalid token'))
  }
})
```

### 2.4 Rate Limiter (`src/middleware/rate-limiter.middleware.ts`)

**Strategy:** Sliding window with Redis or in-memory store

**Configuration:**
```typescript
const rateLimitConfig = {
  public: { windowMs: 15 * 60 * 1000, max: 100 },      // 100 req/15min
  auth: { windowMs: 15 * 60 * 1000, max: 1000 },       // 1000 req/15min
  sensitive: { windowMs: 15 * 60 * 1000, max: 10 },    // 10 req/15min (login, register)
}
```

**Implementation:**
- Use `express-rate-limit` package
- Redis store for multi-instance deployments
- Memory store for single-instance
- Return 429 with Retry-After header
- Log violations to security audit log

### 2.5 Database Pool Manager (`src/services/database-pool.service.ts`)

**Purpose:** Dynamic connection pool management

**Configuration:**
```typescript
const poolConfig = {
  development: { min: 2, max: 10 },
  staging: { min: 5, max: 20 },
  production: { min: 10, max: 50 }
}
```

**Features:**
- Environment-based pool sizing
- Connection health monitoring
- Automatic stale connection removal
- Pool statistics logging
- Graceful shutdown

### 2.6 Lock Manager (`src/services/lock-manager.service.ts`)

**Purpose:** Distributed locking for critical operations

**Implementation Options:**
1. Redis-based (recommended for multi-instance)
2. Database-based (fallback for single-instance)

**Interface:**
```typescript
interface LockManager {
  acquire(key: string, ttl: number): Promise<Lock>
  release(lock: Lock): Promise<void>
  extend(lock: Lock, ttl: number): Promise<void>
}

interface Lock {
  key: string
  token: string
  expiresAt: number
}
```

**Critical Operations Requiring Locks:**
- Account allocation (`lock:account:${accountId}`)
- Token request approval (`lock:allocation:${allocationId}`)
- Account generation (`lock:generation`)
- Configuration updates (`lock:config`)

### 2.7 Transaction Manager (`src/services/transaction-manager.service.ts`)

**Purpose:** ACID transaction wrapper for multi-step operations

**Interface:**
```typescript
interface TransactionManager {
  execute<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>
  executeWithRetry<T>(fn: (tx: Transaction) => Promise<T>, maxRetries: number): Promise<T>
}
```

**Operations Requiring Transactions:**
- Token allocation (update allocation + update account status)
- Token revocation (update allocation + release account)
- Account generation (create account + update pool stats)
- User registration (create user + send verification email)

### 2.8 Error Handler (`src/middleware/error-handler.middleware.ts`)

**Purpose:** Centralized error processing and logging

**Error Categories:**
- ValidationError (400)
- AuthenticationError (401)
- AuthorizationError (403)
- NotFoundError (404)
- ConflictError (409)
- RateLimitError (429)
- InternalError (500)

**Implementation:**
```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log with context
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.id,
    timestamp: Date.now()
  })
  
  // Return safe error response
  res.status(getStatusCode(err)).json({
    error: getSafeMessage(err),
    requestId: req.id
  })
})
```

### 2.9 Health Monitor (`src/services/health-monitor.service.ts`)

**Endpoints:**
- `GET /health/live` - Liveness probe (200 if running)
- `GET /health/ready` - Readiness probe (200 if ready to serve)

**Health Checks:**
- Database connectivity
- Redis connectivity (if enabled)
- Disk space availability
- Memory usage
- Active WebSocket connections

**Response Format:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  version: '1.0.0',
  uptime: 123456,
  checks: {
    database: { status: 'healthy', latency: 5 },
    redis: { status: 'healthy', latency: 2 },
    disk: { status: 'healthy', usage: 45 },
    memory: { status: 'healthy', usage: 60 }
  }
}
```

### 2.10 Config Manager (`src/services/config-manager.service.ts`)

**Purpose:** Safe configuration hot-reload

**Features:**
- JSON schema validation
- Atomic updates (all-or-nothing)
- Rollback capability
- Change notification to dependent services
- Audit logging

**Watched Configuration:**
- Database connection settings
- Rate limit thresholds
- Auto-approval rules
- Email service settings

## 3. Security Enhancements

### 3.1 Authentication Flow Changes

**Before:**
```
Login → JWT in localStorage → API requests with Authorization header
```

**After:**
```
Login → Access Token (httpOnly cookie) + Refresh Token (httpOnly cookie)
→ API requests (cookies auto-sent)
→ Token expires → Auto-refresh with refresh token
→ Refresh token expires → Re-login required
```

### 3.2 WebSocket Security

**Before:**
- No authentication
- Open connections

**After:**
- Token validation on connect
- Periodic re-validation
- Graceful disconnect on expiration
- Rate limiting per connection

### 3.3 Secret Management

**Before:**
- Hardcoded secrets in code
- Secrets in version control

**After:**
- All secrets from environment variables
- Validation on startup
- No secrets in logs
- Secure defaults

## 4. Reliability Enhancements

### 4.1 Database Operations

**Before:**
- No transactions
- Race conditions possible
- No connection pooling

**After:**
- All multi-step operations in transactions
- Distributed locks for critical sections
- Dynamic connection pooling
- Automatic retry on transient failures

### 4.2 Error Handling

**Before:**
- Inconsistent error handling
- Stack traces exposed to clients
- Limited error logging

**After:**
- Centralized error handler
- Safe error messages to clients
- Comprehensive error logging with context
- Error categorization and alerting

### 4.3 WebSocket Reliability

**Before:**
- No reconnection logic
- Connection drops unhandled

**After:**
- Exponential backoff reconnection
- Message queuing during disconnect
- Connection state notifications
- Automatic re-subscription

## 5. TypeScript Strictness

**tsconfig.json changes:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## 6. Migration Strategy

### Phase 1: Infrastructure (Low Risk)
- Secret Store
- Error Handler
- Health Monitor
- TypeScript strict mode

### Phase 2: Database Layer (Medium Risk)
- Database Pool Manager
- Transaction Manager
- Lock Manager

### Phase 3: Authentication (High Risk)
- Token Manager with refresh tokens
- Cookie-based token storage
- WebSocket authentication

### Phase 4: Reliability (Medium Risk)
- Rate Limiter
- Config Manager hot-reload
- WebSocket reconnection

### Phase 5: Integration & Testing
- End-to-end testing
- Load testing
- Security audit
- Documentation updates

## 7. Rollback Plan

Each phase includes:
- Feature flags for gradual rollout
- Database migration rollback scripts
- Configuration rollback capability
- Monitoring and alerting for issues

## 8. Testing Strategy

### Unit Tests
- All new services with >80% coverage
- Mock external dependencies
- Test error conditions

### Integration Tests
- Database transactions
- Lock acquisition/release
- Token refresh flow
- WebSocket authentication

### Security Tests
- XSS attack prevention
- CSRF protection
- Rate limit enforcement
- Token theft scenarios

### Load Tests
- 1000 concurrent users
- Token refresh under load
- WebSocket connection limits
- Database pool under stress

## 9. Monitoring & Observability

### Metrics to Track
- Request rate and latency
- Error rate by type
- Token refresh success rate
- WebSocket connection count
- Database pool utilization
- Lock contention
- Health check status

### Alerts
- Error rate > 5%
- Health check failures
- Database connection pool exhausted
- High lock contention
- Unusual token refresh patterns

## 10. Documentation Updates

- API documentation (OpenAPI/Swagger)
- Deployment guide
- Configuration reference
- Security best practices
- Troubleshooting guide
- Migration guide for existing deployments
DESIGN_EOF


## 11. Frontend Changes

### 11.1 Authentication Store Updates

**File:** `server/frontend/src/stores/auth.ts` (to be created)

**Purpose:** Centralized authentication state management

**Implementation:**
```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from '@/api/axios'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)
  const isRefreshing = ref(false)

  async function login(username: string, password: string) {
    const response = await axios.post('/auth/login', { username, password })
    user.value = response.data.user
    // Tokens automatically stored in httpOnly cookies
  }

  async function logout() {
    await axios.post('/auth/logout')
    user.value = null
  }

  async function refreshToken() {
    if (isRefreshing.value) return
    
    isRefreshing.value = true
    try {
      await axios.post('/auth/refresh')
      // New tokens automatically stored in cookies
    } finally {
      isRefreshing.value = false
    }
  }

  async function checkAuth() {
    try {
      const response = await axios.get('/auth/me')
      user.value = response.data.user
    } catch {
      user.value = null
    }
  }

  return {
    user,
    isAuthenticated,
    login,
    logout,
    refreshToken,
    checkAuth
  }
})
```

### 11.2 Axios Interceptor Updates

**File:** `server/frontend/src/api/axios.ts`

**Changes:**
```typescript
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // Send cookies with requests
  timeout: 30000
})

// Response interceptor for automatic token refresh
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const authStore = useAuthStore()
        await authStore.refreshToken()
        
        // Retry original request
        return instance(originalRequest)
      } catch (refreshError) {
        // Refresh failed, redirect to login
        const authStore = useAuthStore()
        authStore.logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default instance
```

### 11.3 WebSocket Store Updates

**File:** `server/frontend/src/stores/websocket.ts`

**Changes:**
```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'

export const useWebSocketStore = defineStore('websocket', () => {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 10
  const messageQueue = ref<any[]>([])

  function connect() {
    socket.value = io(import.meta.env.VITE_WS_URL, {
      withCredentials: true, // Send cookies for authentication
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: maxReconnectAttempts
    })

    socket.value.on('connect', () => {
      connected.value = true
      reconnectAttempts.value = 0
      
      // Send queued messages
      while (messageQueue.value.length > 0) {
        const msg = messageQueue.value.shift()
        socket.value?.emit(msg.event, msg.data)
      }
    })

    socket.value.on('disconnect', (reason) => {
      connected.value = false
      
      if (reason === 'io server disconnect') {
        // Server disconnected, likely auth issue
        // Will be handled by reconnection logic
      }
    })

    socket.value.on('connect_error', (error) => {
      reconnectAttempts.value++
      
      if (reconnectAttempts.value >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached')
        disconnect()
      }
    })
  }

  function disconnect() {
    socket.value?.disconnect()
    socket.value = null
    connected.value = false
  }

  function emit(event: string, data: any) {
    if (connected.value) {
      socket.value?.emit(event, data)
    } else {
      // Queue message for later
      messageQueue.value.push({ event, data })
    }
  }

  return {
    socket,
    connected,
    connect,
    disconnect,
    emit
  }
})
```

## 12. Database Schema Changes

### 12.1 Refresh Tokens Table

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at BIGINT DEFAULT NULL,
  revoked_reason VARCHAR(255) DEFAULT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_token_hash (token_hash),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 12.2 Distributed Locks Table

```sql
CREATE TABLE IF NOT EXISTS distributed_locks (
  lock_key VARCHAR(255) PRIMARY KEY,
  lock_token VARCHAR(64) NOT NULL,
  acquired_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  owner VARCHAR(255) DEFAULT NULL,
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 12.3 Rate Limit Records Table (Optional, if not using Redis)

```sql
CREATE TABLE IF NOT EXISTS rate_limit_records (
  id VARCHAR(36) PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  window_start BIGINT NOT NULL,
  window_end BIGINT NOT NULL,
  INDEX idx_identifier_endpoint (identifier, endpoint),
  INDEX idx_window_end (window_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 12.4 Audit Log Table

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  user_id VARCHAR(36) DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) DEFAULT NULL,
  resource_id VARCHAR(36) DEFAULT NULL,
  details TEXT DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT DEFAULT NULL,
  INDEX idx_timestamp (timestamp),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_resource (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 13. Environment Variables

### 13.1 Required Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Security
JWT_SECRET=<strong-random-secret-min-32-chars>
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=30d
COOKIE_SECRET=<strong-random-secret-min-32-chars>

# API Keys
MAIN_API_KEY=<secure-api-key>
ADMIN_PASSWORD=<secure-admin-password>

# Database
STORAGE_MODE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=kiro_user
MYSQL_PASSWORD=<secure-database-password>
MYSQL_DATABASE=kiro_accounts
DB_POOL_MIN=10
DB_POOL_MAX=50

# Redis (Optional, for distributed locking and rate limiting)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<secure-redis-password>
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_PUBLIC_MAX=100
RATE_LIMIT_PUBLIC_WINDOW=900000
RATE_LIMIT_AUTH_MAX=1000
RATE_LIMIT_AUTH_WINDOW=900000
RATE_LIMIT_SENSITIVE_MAX=10
RATE_LIMIT_SENSITIVE_WINDOW=900000

# CORS
CORS_ORIGIN=https://your-frontend-domain.com
CORS_CREDENTIALS=true

# WebSocket
WS_PORT=3001
WS_PING_INTERVAL=25000
WS_PING_TIMEOUT=60000

# Email (if applicable)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=<secure-smtp-password>
SMTP_FROM=noreply@example.com

# Monitoring
SENTRY_DSN=<sentry-dsn-if-using>
METRICS_ENABLED=true
```

### 13.2 Environment Variable Validation

**File:** `server/src/utils/env-validator.ts`

```typescript
import { SecretStore } from './secret-store'

export function validateEnvironment(): void {
  const required = [
    'NODE_ENV',
    'JWT_SECRET',
    'MAIN_API_KEY',
    'ADMIN_PASSWORD'
  ]

  const missing: string[] = []

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  // Conditional requirements
  if (process.env.STORAGE_MODE === 'mysql') {
    const mysqlVars = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
    for (const key of mysqlVars) {
      if (!process.env[key]) {
        missing.push(key)
      }
    }
  }

  if (process.env.REDIS_ENABLED === 'true') {
    const redisVars = ['REDIS_HOST', 'REDIS_PORT']
    for (const key of redisVars) {
      if (!process.env[key]) {
        missing.push(key)
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    )
  }

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET!
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long')
  }

  // Validate NODE_ENV
  const validEnvs = ['development', 'staging', 'production', 'test']
  if (!validEnvs.includes(process.env.NODE_ENV!)) {
    throw new Error(`NODE_ENV must be one of: ${validEnvs.join(', ')}`)
  }
}
```

## 14. Deployment Considerations

### 14.1 Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations executed
- [ ] Database backups created
- [ ] SSL certificates installed
- [ ] CORS origins configured
- [ ] Rate limits configured appropriately
- [ ] Health check endpoints accessible
- [ ] Monitoring and alerting configured
- [ ] Rollback procedures documented
- [ ] Team trained on new features

### 14.2 Deployment Steps

1. **Backup Current System**
   - Database backup
   - Configuration backup
   - Code backup

2. **Deploy Infrastructure Changes (Phase 1)**
   - Deploy secret store
   - Deploy error handler
   - Deploy health monitor
   - Verify health checks

3. **Deploy Database Layer (Phase 2)**
   - Run database migrations
   - Deploy pool manager
   - Deploy lock manager
   - Deploy transaction manager
   - Verify database operations

4. **Deploy Authentication Changes (Phase 3)**
   - Deploy token manager
   - Deploy updated auth routes
   - Deploy frontend changes
   - Test authentication flow
   - Monitor for issues

5. **Deploy Reliability Features (Phase 4)**
   - Deploy rate limiter
   - Deploy config manager
   - Deploy WebSocket reconnection
   - Verify all features

6. **Post-Deployment Verification**
   - Run smoke tests
   - Check health endpoints
   - Monitor error rates
   - Monitor performance metrics
   - Verify user authentication
   - Test WebSocket connections

### 14.3 Monitoring Metrics

**Application Metrics:**
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (errors/second, %)
- Active connections
- WebSocket connections

**Authentication Metrics:**
- Login success rate
- Login failure rate
- Token refresh rate
- Token refresh failures
- Session duration

**Database Metrics:**
- Connection pool utilization
- Query execution time
- Transaction success rate
- Lock contention
- Deadlock count

**System Metrics:**
- CPU usage
- Memory usage
- Disk I/O
- Network I/O
- Disk space

### 14.4 Alert Thresholds

**Critical Alerts:**
- Error rate > 5%
- Health check failures
- Database connection pool exhausted
- High lock contention (>100 concurrent locks)
- Disk space < 10%

**Warning Alerts:**
- Error rate > 2%
- Response time p95 > 1000ms
- Database pool utilization > 80%
- Memory usage > 80%
- Unusual token refresh patterns

## 15. Security Hardening Checklist

### 15.1 Application Security

- [x] All secrets in environment variables
- [x] JWT tokens in httpOnly cookies
- [x] CSRF protection enabled
- [x] Rate limiting on all endpoints
- [x] Input validation on all endpoints
- [x] SQL injection prevention (parameterized queries)
- [x] XSS prevention (output encoding)
- [x] Secure headers (helmet.js)
- [x] HTTPS enforced in production
- [x] CORS properly configured

### 15.2 Authentication Security

- [x] Strong password requirements
- [x] Password hashing (bcrypt)
- [x] Token expiration enforced
- [x] Refresh token rotation
- [x] Session invalidation on logout
- [x] Multi-factor authentication (future)
- [x] Account lockout on failed attempts (future)

### 15.3 Database Security

- [x] Least privilege database user
- [x] Encrypted connections (SSL/TLS)
- [x] Regular backups
- [x] Backup encryption
- [x] Access logging
- [x] Query parameterization

### 15.4 Infrastructure Security

- [x] Firewall configured
- [x] Intrusion detection (future)
- [x] Log aggregation
- [x] Security monitoring
- [x] Regular security updates
- [x] Vulnerability scanning (future)

## 16. Performance Optimization

### 16.1 Database Optimization

- Use connection pooling
- Add appropriate indexes
- Optimize slow queries
- Use read replicas for read-heavy operations (future)
- Implement query caching (future)

### 16.2 Application Optimization

- Enable gzip compression
- Implement response caching
- Use CDN for static assets
- Optimize bundle size
- Lazy load components
- Implement pagination

### 16.3 WebSocket Optimization

- Limit message size
- Implement message batching
- Use binary protocols for large data (future)
- Implement backpressure handling

## 17. Disaster Recovery

### 17.1 Backup Strategy

**Database Backups:**
- Full backup: Daily at 2 AM
- Incremental backup: Every 6 hours
- Retention: 30 days
- Off-site storage: Yes

**Configuration Backups:**
- Backup on every change
- Retention: 90 days
- Version control: Git

**Application Backups:**
- Code: Git repository
- Dependencies: package-lock.json
- Environment: .env.example template

### 17.2 Recovery Procedures

**Database Recovery:**
1. Stop application
2. Restore database from backup
3. Verify data integrity
4. Restart application
5. Verify functionality

**Application Recovery:**
1. Checkout previous stable version
2. Restore configuration
3. Run database migrations (if needed)
4. Restart application
5. Verify functionality

**Configuration Recovery:**
1. Restore configuration from backup
2. Validate configuration
3. Restart affected services
4. Verify functionality

### 17.3 Recovery Time Objectives (RTO)

- Critical services: < 1 hour
- Non-critical services: < 4 hours
- Full system recovery: < 8 hours

### 17.4 Recovery Point Objectives (RPO)

- Database: < 6 hours (incremental backup interval)
- Configuration: < 1 hour (backup on change)
- Application code: 0 (version control)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-21
**Status:** Ready for Implementation
