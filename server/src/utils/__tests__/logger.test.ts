/**
 * 日志系统测试
 */

import { logger, log } from '../logger'

describe('Logger', () => {
  beforeEach(() => {
    // 清除之前的日志
    jest.clearAllMocks()
  })

  it('应该能够记录 info 级别日志', () => {
    const spy = jest.spyOn(logger, 'info')
    log.info('Test info message')
    expect(spy).toHaveBeenCalledWith('Test info message', undefined)
  })

  it('应该能够记录 error 级别日志', () => {
    const spy = jest.spyOn(logger, 'error')
    log.error('Test error message')
    expect(spy).toHaveBeenCalledWith('Test error message', undefined)
  })

  it('应该能够记录带元数据的日志', () => {
    const spy = jest.spyOn(logger, 'warn')
    const meta = { userId: '123', action: 'login' }
    log.warn('Test warning', meta)
    expect(spy).toHaveBeenCalledWith('Test warning', meta)
  })

  it('应该支持所有日志级别', () => {
    expect(log.error).toBeDefined()
    expect(log.warn).toBeDefined()
    expect(log.info).toBeDefined()
    expect(log.http).toBeDefined()
    expect(log.debug).toBeDefined()
  })
})
