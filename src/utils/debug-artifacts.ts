import * as fs from 'fs'
import * as path from 'path'

export type DebugArtifactType = 'image' | 'html' | 'metadata'

const LOGS_DIR = path.resolve(__dirname, '../../logs')
const DEBUG_HTML_DIR = path.join(LOGS_DIR, 'debug-html')
const DEBUG_IMAGE_DIR = path.join(LOGS_DIR, 'debug-img')

export function getDebugHtmlDir(): string {
  return DEBUG_HTML_DIR
}

export function getDebugImageDir(): string {
  return DEBUG_IMAGE_DIR
}

export function sanitizeDebugName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 80)
}

export function ensureDebugArtifactDirs(): void {
  fs.mkdirSync(DEBUG_HTML_DIR, { recursive: true })
  fs.mkdirSync(DEBUG_IMAGE_DIR, { recursive: true })
}

export function createDebugArtifactBasename(description: string, date = new Date()): string {
  const safeDescription = sanitizeDebugName(description)
  const timestamp = date.toISOString().replace(/[:.]/g, '-')

  return `debug-${safeDescription}-${timestamp}`
}

export function buildDebugArtifactPath(filename: string, type: DebugArtifactType): string {
  const targetDir = type === 'image' ? DEBUG_IMAGE_DIR : DEBUG_HTML_DIR

  // 只保留文件名，避免调用方传入相对路径导致产物散落到 logs 外。
  return path.join(targetDir, path.basename(filename))
}
