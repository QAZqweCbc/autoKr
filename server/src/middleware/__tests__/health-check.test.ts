/**
 * 健康检查测试
 */

import { Request, Response } from 'express'
import { healthCheckHandler, simpleHealthCheck, metricsCollector } from '../health-check'

describe('HealthCheck', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let jsonMock: jest.Mock
  let statusMock: jest.Mock

  beforeEach(() => {
    jsonMock = jest.fn()
    statusMock = jest.fn().mockReturnValue({ json: jsonMock })
    
    mockReq = {
      app: { io: null } as any
    }
    
    mockRes = {
      status: statusMock,
      json: jsonMock
    }
  })

  describe('simpleHealthCheck', () => {
    it('应该返回 200 状态和 ok', () => {
      simpleHealthCheck(mockReq as Request, mockRes as Response)
      
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ status: 'ok' })
    })
  })

  describe('healthCheckHandler', () => {
    it('应该返回完整的健康状态', async () => {
      await healthCheckHandler(mockReq as Request, mockRes as Response)
      
      expect(statusMock).toHaveBeenCalled()
      expect(jsonMock).toHaveBeenCalled()
      
      const response = jsonMock.mock.calls[0][0]
      expect(response).toHaveProperty('status')
      expect(response).toHaveProperty('timestamp')
      expect(response).toHaveProperty('uptime')
      expect(response).toHaveProperty('services')
      expect(response).toHaveProperty('metrics')
    })

    it('应该包含所有服务的健康状态', async () => {
      await healthCheckHandler(mockReq as Request, mockRes as Response)
      
      const response = jsonMock.mock.calls[0][0]
      expect(response.services).toHaveProperty('database')
      expect(response.services).toHaveProperty('websocket')
      expect(response.services).toHaveProperty('memory')
      expect(response.services).toHaveProperty('cpu')
    })
  })

  describe('metricsCollector', () => {
    beforeEach(() => {
      metricsCollector.reset()
    })

    it('应该能够记录成功的请求', () => {
      metricsCollector.recordRequest(true, 100)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.requests.total).toBe(1)
      expect(metrics.requests.success).toBe(1)
      expect(metrics.requests.failed).toBe(0)
    })

    it('应该能够记录失败的请求', () => {
      metricsCollector.recordRequest(false, 200)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.requests.total).toBe(1)
      expect(metrics.requests.success).toBe(0)
      expect(metrics.requests.failed).toBe(1)
    })

    it('应该能够计算平均响应时间', () => {
      metricsCollector.recordRequest(true, 100)
      metricsCollector.recordRequest(true, 200)
      metricsCollector.recordRequest(true, 300)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.requests.avgResponseTime).toBe(200)
    })

    it('应该能够记录错误', () => {
      metricsCollector.recordError()
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.errors.last24h).toBe(1)
      expect(metrics.errors.last1h).toBe(1)
    })

    it('应该能够重置指标', () => {
      metricsCollector.recordRequest(true, 100)
      metricsCollector.recordError()
      metricsCollector.reset()
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.requests.total).toBe(0)
      expect(metrics.errors.last24h).toBe(0)
    })
  })
})
