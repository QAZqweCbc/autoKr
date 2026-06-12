import * as fs from 'fs'
import * as path from 'path'
import { describe, expect, it } from '@jest/globals'
import {
  buildBrowserProfileDir,
  buildWindowProfile,
  cleanupBrowserProfileDir,
  getBrowserProfilesRoot,
  sanitizeProfileSegment
} from '../browser-profile.service'

describe('browser-profile.service', () => {
  it('为同一个任务生成稳定的浏览器用户目录', () => {
    const first = buildBrowserProfileDir('task-123', 'user@example.com')
    const second = buildBrowserProfileDir('task-123', 'user@example.com')

    expect(first).toBe(second)
    expect(first).toBe(path.join(getBrowserProfilesRoot(), 'task-123-user_example.com'))
  })

  it('为不同任务生成隔离的浏览器用户目录', () => {
    const first = buildBrowserProfileDir('task-1', 'user@example.com')
    const second = buildBrowserProfileDir('task-2', 'user@example.com')

    expect(first).not.toBe(second)
  })

  it('清理路径片段中的非法字符', () => {
    expect(sanitizeProfileSegment('../task:abc?*')).toBe('task_abc')
    expect(sanitizeProfileSegment('   ')).toBe('unknown')
  })

  it('成功清理 profiles 根目录下的任务用户目录', async () => {
    const profileDir = buildBrowserProfileDir('cleanup-task', 'user@example.com')
    const markerFile = path.join(profileDir, 'marker.txt')

    fs.mkdirSync(profileDir, { recursive: true })
    fs.writeFileSync(markerFile, 'ok', 'utf-8')

    const result = await cleanupBrowserProfileDir(profileDir)

    expect(result.deleted).toBe(true)
    expect(fs.existsSync(profileDir)).toBe(false)
  })

  it('清理不存在的任务用户目录时不报错', async () => {
    const profileDir = buildBrowserProfileDir('missing-task', 'user@example.com')

    const result = await cleanupBrowserProfileDir(profileDir)

    expect(result.deleted).toBe(false)
    expect(result.reason).toBe('not_found')
  })

  it('拒绝清理 profiles 根目录外的路径', async () => {
    const outsideDir = path.resolve(getBrowserProfilesRoot(), '..', 'outside-profile')

    const result = await cleanupBrowserProfileDir(outsideDir)

    expect(result.deleted).toBe(false)
    expect(result.reason).toBe('outside_root')
  })

  it('为同一个窗口生成稳定一致的指纹画像', () => {
    const first = buildWindowProfile({
      taskId: 'task-123',
      email: 'user@example.com',
      windowName: 'current',
      browserType: 'chrome',
      proxyUrl: 'http://127.0.0.1:8080'
    })
    const second = buildWindowProfile({
      taskId: 'task-123',
      email: 'user@example.com',
      windowName: 'current',
      browserType: 'chrome',
      proxyUrl: 'http://127.0.0.1:8080'
    })

    expect(first).toEqual(second)
    expect(first.profileId).toBe('task-123-current')
    expect(first.impersonate).toBe('chrome')
    expect(first.userAgent).toContain('Chrome/')
    expect(first.extraHTTPHeaders['sec-ch-ua']).toContain('Chromium')
    expect(first.proxyUrl).toBe('http://127.0.0.1:8080')
    expect(first.userDataDir).toBe(buildBrowserProfileDir('task-123-current', 'user@example.com'))
  })

  it('为不同窗口生成隔离但真实的指纹画像', () => {
    const current = buildWindowProfile({
      taskId: 'task-123',
      email: 'user@example.com',
      windowName: 'current',
      browserType: 'chrome'
    })
    const secondary = buildWindowProfile({
      taskId: 'task-123',
      email: 'user@example.com',
      windowName: 'secondary',
      browserType: 'chrome'
    })

    expect(current.profileId).not.toBe(secondary.profileId)
    expect(current.canvasNoiseSeed).not.toBe(secondary.canvasNoiseSeed)
    expect(current.userDataDir).not.toBe(secondary.userDataDir)
    expect(['chrome', 'chrome136']).toContain(current.impersonate)
    expect(['chrome', 'chrome136']).toContain(secondary.impersonate)
  })

  it('为 Firefox 窗口生成 Firefox 画像且不包含 Chromium 专属提示头', () => {
    const profile = buildWindowProfile({
      taskId: 'task-123',
      email: 'user@example.com',
      windowName: 'current',
      browserType: 'firefox'
    })

    expect(profile.impersonate).toBe('firefox')
    expect(profile.userAgent).toContain('Firefox/')
    expect(profile.extraHTTPHeaders['sec-ch-ua']).toBeUndefined()
    expect(profile.extraHTTPHeaders['sec-ch-ua-platform']).toBeUndefined()
  })
})
