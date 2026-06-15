import * as path from 'path'
import { describe, expect, it } from '@jest/globals'
import {
  buildDebugArtifactPath,
  createDebugArtifactBasename,
  getDebugHtmlDir,
  getDebugImageDir
} from '../debug-artifacts'

describe('debug-artifacts', () => {
  it('将调试截图统一写入 logs/debug-img', () => {
    expect(getDebugImageDir()).toBe(path.resolve(process.cwd(), 'logs', 'debug-img'))
    expect(buildDebugArtifactPath('debug-login.png', 'image')).toBe(
      path.resolve(process.cwd(), 'logs', 'debug-img', 'debug-login.png')
    )
  })

  it('将调试 HTML 和诊断 JSON 统一写入 logs/debug-html', () => {
    expect(getDebugHtmlDir()).toBe(path.resolve(process.cwd(), 'logs', 'debug-html'))
    expect(buildDebugArtifactPath('debug-login.html', 'html')).toBe(
      path.resolve(process.cwd(), 'logs', 'debug-html', 'debug-login.html')
    )
    expect(buildDebugArtifactPath('debug-login.json', 'metadata')).toBe(
      path.resolve(process.cwd(), 'logs', 'debug-html', 'debug-login.json')
    )
  })

  it('清理文件名中的路径片段，避免调试产物散落到 logs 外', () => {
    expect(buildDebugArtifactPath('../debug-login.png', 'image')).toBe(
      path.resolve(process.cwd(), 'logs', 'debug-img', 'debug-login.png')
    )
  })

  it('为调试快照生成可复用的安全基础文件名', () => {
    const basename = createDebugArtifactBasename('点击异常: 第 1 次', new Date('2026-06-13T01:02:03.004Z'))

    expect(basename).toBe('debug-点击异常__第_1_次-2026-06-13T01-02-03-004Z')
  })
})
