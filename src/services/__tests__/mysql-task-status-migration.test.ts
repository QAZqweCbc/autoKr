import { ensureTaskStatusEnumSupportsPause } from '../mysql.service'
import { describe, expect, it, jest } from '@jest/globals'

describe('ensureTaskStatusEnumSupportsPause', () => {
  it('旧任务状态枚举缺少 paused 时应执行迁移', async () => {
    const connection = {
      execute: jest
        .fn<(...args: any[]) => Promise<any>>()
        .mockResolvedValueOnce([[{ COLUMN_TYPE: "enum('pending','running','success','failed')" }]])
        .mockResolvedValueOnce([{}])
    }

    await ensureTaskStatusEnumSupportsPause(connection as any)

    expect(connection.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("ENUM('pending', 'running', 'success', 'failed', 'paused')")
    )
  })

  it('任务状态枚举已支持 paused 时不应重复迁移', async () => {
    const connection = {
      execute: jest
        .fn<(...args: any[]) => Promise<any>>()
        .mockResolvedValueOnce([[{ COLUMN_TYPE: "enum('pending','running','success','failed','paused')" }]])
    }

    await ensureTaskStatusEnumSupportsPause(connection as any)

    expect(connection.execute).toHaveBeenCalledTimes(1)
  })
})
