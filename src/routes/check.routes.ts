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

// ============================================
// IP/域名检测路由（认证已禁用 - 个人使用）
// ============================================

router.post('/ip', checkIPStatus)
router.post('/domains', analyzeDomains)
router.get('/records', getCheckRecords)
router.get('/records/:id', getCheckRecordDetail)
router.get('/stats', getCheckStatistics)
router.delete('/records/:id', deleteCheckRecordById)
router.delete('/records', clearCheckRecords)

export default router
