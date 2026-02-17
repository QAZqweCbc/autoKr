/**
 * 检测路由
 */

import { Router } from 'express'
import { 
  checkIPStatus, 
  analyzeDomains,
  getCheckRecords,
  getCheckRecordDetail,
  deleteCheckRecordById,
  clearCheckRecords,
  getCheckStatistics
} from '../controllers/check.controller'

const router = Router()

// IP 状态检测
router.post('/ip', checkIPStatus)

// 域名分析
router.post('/domains', analyzeDomains)

// 检测记录管理
router.get('/records', getCheckRecords)
router.get('/records/:id', getCheckRecordDetail)
router.delete('/records/:id', deleteCheckRecordById)
router.delete('/records', clearCheckRecords)

// 检测统计
router.get('/stats', getCheckStatistics)

export default router
