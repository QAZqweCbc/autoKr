/**
 * 健康检查和监控端点
 * 提供系统状态、性能指标和告警信息
 */

import { Request, Response } from 'express'
import { logger } from '../utils/logger'
import os from 'os'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: number
  uptime: number
  version: string
  services: {
    database: ServiceHealth
    websocket: ServiceHealth
    memory: MemoryHealth
    cpu: CPUHealth
  }
  metrics: SystemMetrics
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  error?: string
}

interface MemoryHealth {
  status: 'healthy' | 'warning' | 'critical'
  used: number
  total: number
  percentage: number
}

interface CPUHealth {
  status: 'healthy' | 'warning' | 'critical'
  usage: number
  loadAverage: number[]
}

interface SystemMetrics {
  requests: {
    total: number
    success: number
    failed: number
    avgResponseTime: number
  }
  errors: {
    last24h: number
    last1h: number
  }
}

// 全局指标收集器
class MetricsCollector {
  private metrics = {
    requests: {
      total: 0,
      success: 0,
      failed: 0,
      responseTimes: [] as number[]
    },
    errors: {
      timestamps: [] as number[]
    }
  }

  recordRequest(success: boolean, responseTime: number) {
    this.metrics.requests.total++
    if (success) {
      this.metrics.requests.success++
    } else {
      this.metrics.requests.failed++
    }
    this.metrics.requests.responseTimes.push(responseTime)
    
    // 只保留最近1000个响应时间
    if (this.metrics.requests.responseTimes.length > 1000) {
      this.metrics.requests.responseTimes.shift()
    }
  }

  recordError() {
    this.metrics.errors.timestamps.push(Date.now())
    
    // 清理超过24小时的错误记录
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    this.metrics.errors.timestamps = this.metrics.errors.timestamps.filter(
      t => t > oneDayAgo
    )
  }

  getMetrics(): SystemMetrics {
    const avgResponseTime = this.metrics.requests.responseTimes.length > 0
      ? this.metrics.requests.responseTimes.reduce((a, b) => a + b, 0) / 
        this.metrics.requests.responseTimes.length
      : 0

    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const errorsLast1h = this.metrics.errors.timestamps.filter(t => t > oneHourAgo).length

    return {
      requests: {
        total: this.metrics.requests.total,
        success: this.metrics.requests.success,
        failed: this.metrics.requests.failed,
        avgResponseTime: Math.round(avgResponseTime)
      },
      errors: {
        last24h: this.metrics.errors.timestamps.length,
        last1h: errorsLast1h
      }
    }
  }

  reset() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        failed: 0,
        responseTimes: []
      },
      errors: {
        timestamps: []
      }
    }
  }
}

export const metricsCollector = new MetricsCollector()

/**
 * 检查数据库健康状态
 */
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  try {
    const start = Date.now()
    // 这里应该调用实际的数据库检查
    // 示例：await db.ping()
    const responseTime = Date.now() - start
    
    return {
      status: 'up',
      responseTime
    }
  } catch (error: any) {
    logger.error('Database health check failed', { error: error.message })
    return {
      status: 'down',
      error: error.message
    }
  }
}

/**
 * 检查 WebSocket 健康状态
 */
function checkWebSocketHealth(io: any): ServiceHealth {
  try {
    const clientsCount = io?.engine?.clientsCount || 0
    return {
      status: clientsCount >= 0 ? 'up' : 'down',
      responseTime: 0
    }
  } catch (error: any) {
    return {
      status: 'down',
      error: error.message
    }
  }
}

/**
 * 检查内存健康状态
 */
function checkMemoryHealth(): MemoryHealth {
  const used = process.memoryUsage().heapUsed
  const total = process.memoryUsage().heapTotal
  const percentage = (used / total) * 100

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (percentage > 90) {
    status = 'critical'
    logger.error('Memory usage critical', { percentage: percentage.toFixed(2) })
  } else if (percentage > 75) {
    status = 'warning'
    logger.warn('Memory usage high', { percentage: percentage.toFixed(2) })
  }

  return {
    status,
    used: Math.round(used / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage: Math.round(percentage)
  }
}

/**
 * 检查 CPU 健康状态
 */
function checkCPUHealth(): CPUHealth {
  const loadAverage = os.loadavg()
  const cpuCount = os.cpus().length
  const usage = (loadAverage[0] / cpuCount) * 100

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (usage > 90) {
    status = 'critical'
    logger.error('CPU usage critical', { usage: usage.toFixed(2) })
  } else if (usage > 75) {
    status = 'warning'
    logger.warn('CPU usage high', { usage: usage.toFixed(2) })
  }

  return {
    status,
    usage: Math.round(usage),
    loadAverage: loadAverage.map(l => Math.round(l * 100) / 100)
  }
}

/**
 * 健康检查端点
 */
export async function healthCheckHandler(req: Request, res: Response) {
  try {
    const io = (req.app as any).io // 从 app 获取 io 实例
    
    const [database, websocket, memory, cpu] = await Promise.all([
      checkDatabaseHealth(),
      Promise.resolve(checkWebSocketHealth(io)),
      Promise.resolve(checkMemoryHealth()),
      Promise.resolve(checkCPUHealth())
    ])

    const metrics = metricsCollector.getMetrics()

    // 判断整体健康状态
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (
      database.status === 'down' ||
      memory.status === 'critical' ||
      cpu.status === 'critical'
    ) {
      overallStatus = 'unhealthy'
    } else if (
      database.status === 'degraded' ||
      websocket.status === 'degraded' ||
      memory.status === 'warning' ||
      cpu.status === 'warning'
    ) {
      overallStatus = 'degraded'
    }

    const health: HealthStatus = {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database,
        websocket,
        memory,
        cpu
      },
      metrics
    }

    const statusCode = overallStatus === 'healthy' ? 200 : 
                       overallStatus === 'degraded' ? 200 : 503

    res.status(statusCode).json(health)
  } catch (error: any) {
    logger.error('Health check failed', { error: error.message })
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: Date.now()
    })
  }
}

/**
 * 简单健康检查（用于负载均衡器）
 */
export function simpleHealthCheck(req: Request, res: Response) {
  res.status(200).json({ status: 'ok' })
}

/**
 * 指标端点（Prometheus 格式）
 */
export function metricsHandler(req: Request, res: Response) {
  const metrics = metricsCollector.getMetrics()
  const memory = checkMemoryHealth()
  const cpu = checkCPUHealth()

  // Prometheus 格式
  const prometheusMetrics = `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.requests.total}

# HELP http_requests_success Total number of successful HTTP requests
# TYPE http_requests_success counter
http_requests_success ${metrics.requests.success}

# HELP http_requests_failed Total number of failed HTTP requests
# TYPE http_requests_failed counter
http_requests_failed ${metrics.requests.failed}

# HELP http_request_duration_ms Average HTTP request duration in milliseconds
# TYPE http_request_duration_ms gauge
http_request_duration_ms ${metrics.requests.avgResponseTime}

# HELP errors_last_24h Number of errors in the last 24 hours
# TYPE errors_last_24h gauge
errors_last_24h ${metrics.errors.last24h}

# HELP errors_last_1h Number of errors in the last hour
# TYPE errors_last_1h gauge
errors_last_1h ${metrics.errors.last1h}

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_bytes ${memory.used * 1024 * 1024}

# HELP memory_usage_percentage Memory usage percentage
# TYPE memory_usage_percentage gauge
memory_usage_percentage ${memory.percentage}

# HELP cpu_usage_percentage CPU usage percentage
# TYPE cpu_usage_percentage gauge
cpu_usage_percentage ${cpu.usage}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${Math.round(process.uptime())}
`.trim()

  res.set('Content-Type', 'text/plain')
  res.send(prometheusMetrics)
}

/**
 * 监控中间件：记录请求指标
 */
export function monitoringMiddleware(req: Request, res: Response, next: Function) {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    const success = res.statusCode < 400
    
    metricsCollector.recordRequest(success, duration)
    
    if (!success) {
      metricsCollector.recordError()
    }
  })
  
  next()
}
