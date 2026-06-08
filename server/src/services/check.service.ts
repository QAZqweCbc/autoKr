/**
 * 检测记录服务 - 支持 JSON 和 MySQL
 */

import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { CheckRecord, CheckRecordCreateDTO, CheckStats } from '../models/check.model'
import { getDB } from './database.adapter'

const DATA_DIR = path.join(process.cwd(), 'data')
const CHECK_RECORDS_FILE = path.join(DATA_DIR, 'check_records.json')

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// 初始化文件
if (!fs.existsSync(CHECK_RECORDS_FILE)) {
  fs.writeFileSync(CHECK_RECORDS_FILE, JSON.stringify({ records: [] }, null, 2))
}

/**
 * 读取所有检测记录（JSON 文件）
 */
function readRecords(): CheckRecord[] {
  try {
    const data = fs.readFileSync(CHECK_RECORDS_FILE, 'utf-8')
    const json = JSON.parse(data)
    return json.records || []
  } catch (error) {
    console.error('读取检测记录失败:', error)
    return []
  }
}

/**
 * 保存检测记录（JSON 文件）
 */
function saveRecords(records: CheckRecord[]): void {
  try {
    fs.writeFileSync(CHECK_RECORDS_FILE, JSON.stringify({ records }, null, 2))
  } catch (error) {
    console.error('保存检测记录失败:', error)
    throw error
  }
}

/**
 * 创建检测记录
 */
export async function createCheckRecord(dto: CheckRecordCreateDTO): Promise<CheckRecord> {
  const db = getDB()
  
  if (db.CheckDB) {
    // 使用 MySQL
    const record = {
      ip: dto.result.ip,
      proxyUrl: dto.proxyUrl,
      verdict: dto.result.verdict,
      suggestion: dto.result.suggestion,
      result: dto.result
    }
    const mysqlRecord = await db.CheckDB.create(record)
    
    // 转换为前端期望的格式
    return {
      id: mysqlRecord.id?.toString() || '',
      timestamp: new Date(mysqlRecord.timestamp).getTime(),
      proxyUrl: mysqlRecord.proxyUrl,
      result: mysqlRecord.result
    }
  } else {
    // 使用 JSON 文件
    const records = readRecords()
    
    const record: CheckRecord = {
      id: uuidv4(),
      timestamp: Date.now(),
      proxyUrl: dto.proxyUrl,
      result: dto.result
    }
    
    records.unshift(record) // 新记录放在最前面
    
    // 只保留最近 100 条记录
    if (records.length > 100) {
      records.splice(100)
    }
    
    saveRecords(records)
    
    return record
  }
}

/**
 * 获取所有检测记录
 */
export async function getAllCheckRecords(limit?: number): Promise<CheckRecord[]> {
  const db = getDB()
  
  if (db.CheckDB) {
    // 使用 MySQL
    const records = await db.CheckDB.getRecords(limit || 20)
    // 转换格式以匹配前端期望
    return records.map(r => ({
      id: r.id?.toString() || '',
      timestamp: new Date(r.timestamp).getTime(),
      proxyUrl: r.proxyUrl,
      result: r.result
    }))
  } else {
    // 使用 JSON 文件
    const records = readRecords()
    
    if (limit && limit > 0) {
      return records.slice(0, limit)
    }
    
    return records
  }
}

/**
 * 获取检测记录详情
 */
export async function getCheckRecordById(id: string): Promise<CheckRecord | null> {
  const db = getDB()

  if (db.CheckDB) {
    // 使用 MySQL
    try {
      const record = await db.CheckDB.getById(parseInt(id))
      if (!record) return null
      return {
        id: record.id?.toString() || '',
        timestamp: new Date(record.timestamp).getTime(),
        proxyUrl: record.proxyUrl,
        result: record.result
      }
    } catch {
      return null
    }
  } else {
    // 使用 JSON 文件
    const records = readRecords()
    return records.find(r => r.id === id) || null
  }
}


/**
 * 删除检测记录
 */
export async function deleteCheckRecord(id: string): Promise<void> {
  const db = getDB()

  if (db.CheckDB) {
    // 使用 MySQL
    await db.CheckDB.delete(parseInt(id))
    return
  } else {
    // 使用 JSON 文件
    const records = readRecords()
    const filtered = records.filter(r => r.id !== id)
    saveRecords(filtered)
  }
}


/**
 * 清空所有检测记录
 */
export async function clearAllCheckRecords(): Promise<void> {
  const db = getDB()
  
  if (db.CheckDB) {
    // 使用 MySQL
    await db.CheckDB.clear()
  } else {
    // 使用 JSON 文件
    saveRecords([])
  }
}

/**
 * 获取检测统计
 */
export async function getCheckStats(): Promise<CheckStats> {
  const db = getDB()
  
  if (db.CheckDB) {
    // 使用 MySQL
    return await db.CheckDB.getStats()
  } else {
    // 使用 JSON 文件
    const records = readRecords()
    
    return {
      total: records.length,
      safe: records.filter(r => r.result.verdict === 'safe').length,
      warning: records.filter(r => r.result.verdict === 'warning').length,
      risky: records.filter(r => r.result.verdict === 'risky').length,
      blocked: records.filter(r => r.result.verdict === 'blocked').length
    }
  }
}
