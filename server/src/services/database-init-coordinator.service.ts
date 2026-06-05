/**
 * 数据库初始化协调器
 * 用于多个服务进程共享数据库初始化状态
 */

import fs from 'fs'
import path from 'path'

const INIT_STATE_FILE = path.join(__dirname, '../../.db-init-state.json')
const LOCK_TIMEOUT = 30000 // 30秒超时

interface InitState {
  initialized: boolean
  storageMode: 'mysql' | 'redis'
  timestamp: number
  preCheckDone: boolean
  initializingPid?: number
}

/**
 * 等待数据库初始化完成（被动等待模式）
 */
export async function waitForDatabaseInit(): Promise<InitState> {
  const startTime = Date.now()

  while (Date.now() - startTime < LOCK_TIMEOUT) {
    try {
      if (fs.existsSync(INIT_STATE_FILE)) {
        const content = fs.readFileSync(INIT_STATE_FILE, 'utf-8')
        const state: InitState = JSON.parse(content)

        // 检查初始化是否完成
        if (state.initialized) {
          console.log('ℹ️  检测到数据库已由其他服务初始化完成')
          console.log(`   存储模式: ${state.storageMode.toUpperCase()}`)
          return state
        }

        // 检查是否有进程正在初始化
        if (state.initializingPid) {
          console.log(`ℹ️  进程 ${state.initializingPid} 正在初始化数据库，等待中...`)
        }
      }
    } catch (error) {
      // 文件可能正在写入，忽略错误继续等待
    }

    // 等待100ms后重试
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error('等待数据库初始化超时')
}

/**
 * 尝试成为主初始化进程
 */
export function tryBecomeInitializer(): boolean {
  try {
    // 如果状态文件已存在且已初始化，返回false
    if (fs.existsSync(INIT_STATE_FILE)) {
      const content = fs.readFileSync(INIT_STATE_FILE, 'utf-8')
      const state: InitState = JSON.parse(content)

      if (state.initialized) {
        return false
      }

      // 检查是否有其他进程正在初始化（超时检查）
      if (state.initializingPid && state.timestamp > Date.now() - LOCK_TIMEOUT) {
        return false
      }
    }

    // 写入初始化标记
    const state: InitState = {
      initialized: false,
      storageMode: 'mysql',
      timestamp: Date.now(),
      preCheckDone: false,
      initializingPid: process.pid
    }

    fs.writeFileSync(INIT_STATE_FILE, JSON.stringify(state, null, 2))
    console.log('✅ 当前进程被选为数据库初始化进程')
    return true
  } catch (error) {
    console.warn('⚠️  无法获取初始化锁，将等待其他进程完成')
    return false
  }
}

/**
 * 标记预检已完成
 */
export function markPreCheckDone(storageMode: 'mysql' | 'redis') {
  try {
    if (fs.existsSync(INIT_STATE_FILE)) {
      const content = fs.readFileSync(INIT_STATE_FILE, 'utf-8')
      const state: InitState = JSON.parse(content)

      state.preCheckDone = true
      state.storageMode = storageMode
      state.timestamp = Date.now()

      fs.writeFileSync(INIT_STATE_FILE, JSON.stringify(state, null, 2))
    }
  } catch (error) {
    console.warn('⚠️  标记预检完成失败:', error)
  }
}

/**
 * 标记数据库初始化完成
 */
export function markInitDone(storageMode: 'mysql' | 'redis') {
  try {
    const state: InitState = {
      initialized: true,
      storageMode,
      timestamp: Date.now(),
      preCheckDone: true,
      initializingPid: process.pid
    }

    fs.writeFileSync(INIT_STATE_FILE, JSON.stringify(state, null, 2))
    console.log('✅ 数据库初始化状态已共享给其他服务')
  } catch (error) {
    console.warn('⚠️  标记初始化完成失败:', error)
  }
}

/**
 * 清理初始化状态（服务关闭时调用）
 */
export function cleanupInitState() {
  try {
    if (fs.existsSync(INIT_STATE_FILE)) {
      fs.unlinkSync(INIT_STATE_FILE)
      console.log('🧹 清理数据库初始化状态文件')
    }
  } catch (error) {
    // 忽略清理错误
  }
}

/**
 * 获取当前初始化状态
 */
export function getInitState(): InitState | null {
  try {
    if (fs.existsSync(INIT_STATE_FILE)) {
      const content = fs.readFileSync(INIT_STATE_FILE, 'utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    // 忽略错误
  }
  return null
}
