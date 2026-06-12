import * as path from 'path'
import { promises as fs } from 'fs'
import { createHash } from 'crypto'

const MAX_SEGMENT_LENGTH = 80

export type WindowProfileName = 'current' | 'secondary' | string
export type FingerprintBrowserType = 'chrome' | 'edge' | 'firefox' | 'brave' | 'opera'

export interface BuildWindowProfileInput {
  taskId: string
  email: string
  windowName: WindowProfileName
  browserType?: FingerprintBrowserType
  proxyUrl?: string
}

export interface WindowFingerprintProfile {
  profileId: string
  windowName: string
  impersonate: 'chrome' | 'chrome136' | 'firefox'
  userAgent: string
  viewport: {
    width: number
    height: number
  }
  locale: string
  timezoneId: string
  extraHTTPHeaders: Record<string, string>
  canvasNoiseSeed: number
  userDataDir: string
  proxyUrl?: string
}

const CHROME_PROFILES = [
  {
    impersonate: 'chrome' as const,
    chromeMajor: 136,
    secChUa: '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"'
  },
  {
    impersonate: 'chrome136' as const,
    chromeMajor: 136,
    secChUa: '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"'
  }
]

const FIREFOX_PROFILE = {
  impersonate: 'firefox' as const,
  firefoxMajor: 136
}

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 1365, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 }
]

const LOCALES = [
  { locale: 'en-US', acceptLanguage: 'en-US,en;q=0.9', timezoneId: 'America/New_York' },
  { locale: 'en-US', acceptLanguage: 'en-US,en;q=0.9', timezoneId: 'America/Chicago' },
  { locale: 'en-US', acceptLanguage: 'en-US,en;q=0.9', timezoneId: 'America/Los_Angeles' }
]

export function getBrowserProfilesRoot(): string {
  return path.resolve(__dirname, '../../data/browser-profiles')
}

export function sanitizeProfileSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, MAX_SEGMENT_LENGTH)

  return sanitized || 'unknown'
}

export function buildBrowserProfileDir(taskId: string, email: string): string {
  const taskSegment = sanitizeProfileSegment(taskId)
  const emailSegment = sanitizeProfileSegment(email)

  return path.join(getBrowserProfilesRoot(), `${taskSegment}-${emailSegment}`)
}

function hashSeed(value: string): number {
  const hash = createHash('sha256').update(value).digest()
  return hash.readUInt32BE(0)
}

function pickStable<T>(items: T[], seed: number, salt: number): T {
  return items[(seed + salt) % items.length]
}

export function buildWindowProfile(input: BuildWindowProfileInput): WindowFingerprintProfile {
  const windowName = sanitizeProfileSegment(input.windowName)
  const taskSegment = sanitizeProfileSegment(input.taskId)
  const profileId = `${taskSegment}-${windowName}`
  const browserType = input.browserType || 'chrome'
  const seed = hashSeed([
    input.taskId,
    input.email.toLowerCase(),
    windowName,
    browserType,
    input.proxyUrl || ''
  ].join('|'))

  const viewport = pickStable(VIEWPORTS, seed, 7)
  const localeProfile = pickStable(LOCALES, seed, 13)
  // 指纹画像必须按窗口稳定，避免刷新页面后 Canvas 结果抖动。
  const canvasNoiseSeed = seed / 0xffffffff

  if (browserType === 'firefox') {
    return {
      profileId,
      windowName,
      impersonate: FIREFOX_PROFILE.impersonate,
      userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${FIREFOX_PROFILE.firefoxMajor}.0) Gecko/20100101 Firefox/${FIREFOX_PROFILE.firefoxMajor}.0`,
      viewport,
      locale: localeProfile.locale,
      timezoneId: localeProfile.timezoneId,
      extraHTTPHeaders: {
        'accept-language': localeProfile.acceptLanguage
      },
      canvasNoiseSeed,
      userDataDir: buildBrowserProfileDir(profileId, input.email),
      proxyUrl: input.proxyUrl
    }
  }

  const browserProfile = pickStable(CHROME_PROFILES, seed, 0)
  const chromeMajor = browserProfile.chromeMajor

  return {
    profileId,
    windowName,
    impersonate: browserProfile.impersonate,
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`,
    viewport,
    locale: localeProfile.locale,
    timezoneId: localeProfile.timezoneId,
    extraHTTPHeaders: {
      'accept-language': localeProfile.acceptLanguage,
      'sec-ch-ua': browserProfile.secChUa,
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    },
    canvasNoiseSeed,
    userDataDir: buildBrowserProfileDir(profileId, input.email),
    proxyUrl: input.proxyUrl
  }
}

export type CleanupBrowserProfileResult = {
  deleted: boolean
  reason?: 'not_found' | 'outside_root'
  error?: string
}

export async function cleanupBrowserProfileDir(profileDir: string): Promise<CleanupBrowserProfileResult> {
  const root = path.resolve(getBrowserProfilesRoot())
  const target = path.resolve(profileDir)
  const relative = path.relative(root, target)

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { deleted: false, reason: 'outside_root' }
  }

  try {
    await fs.rm(target, { recursive: true, force: false })
    return { deleted: true }
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return { deleted: false, reason: 'not_found' }
    }

    return {
      deleted: false,
      error: error?.message || String(error)
    }
  }
}
