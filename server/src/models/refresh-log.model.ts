/**
 * 刷新日志数据模型
 * 用于记录 Token 自动刷新的历史记录和详细信息
 */

/**
 * 刷新详情 - 单个账号的刷新结果
 */
export interface RefreshDetail {
  accountId: string                     // 账号ID
  email: string                         // 邮箱
  success: boolean                      // 是否成功
  error?: string                        // 错误信息
  duration: number                      // 耗时（毫秒）
  skipped?: boolean                     // 是否跳过
  skipReason?: string                   // 跳过原因
  timestamp: number                     // 刷新时间戳
}

/**
 * 刷新日志 - 批次刷新记录
 */
export interface RefreshLog {
  id: string                            // 日志ID（UUID）
  timestamp: number                     // 刷新开始时间戳
  totalAccounts: number                 // 总账号数
  successCount: number                  // 成功数
  failedCount: number                   // 失败数
  skippedCount: number                  // 跳过数
  duration: number                      // 总耗时（毫秒）
  details: RefreshDetail[]              // 详细结果
  createdAt: number                     // 创建时间戳
}

/**
 * 刷新日志创建 DTO
 */
export interface RefreshLogCreateDTO {
  timestamp: number
  totalAccounts: number
  successCount: number
  failedCount: number
  skippedCount: number
  duration: number
  details: RefreshDetail[]
}

/**
 * 刷新日志查询参数
 */
export interface RefreshLogQuery {
  limit?: number                        // 返回数量限制（默认10）
  offset?: number                       // 偏移量（默认0）
  startDate?: number                    // 开始时间戳
  endDate?: number                      // 结束时间戳
  minSuccessRate?: number               // 最小成功率（0-1）
  maxSuccessRate?: number               // 最大成功率（0-1）
}

/**
 * 刷新日志查询结果
 */
export interface RefreshLogQueryResult {
  logs: RefreshLog[]                    // 日志列表
  total: number                         // 总数
  hasMore: boolean                      // 是否有更多
}

/**
 * 刷新日志统计
 */
export interface RefreshLogStats {
  totalLogs: number                     // 总日志数
  totalRefreshes: number                // 总刷新次数
  totalSuccess: number                  // 总成功次数
  totalFailed: number                   // 总失败次数
  totalSkipped: number                  // 总跳过次数
  averageSuccessRate: number            // 平均成功率
  averageDuration: number               // 平均耗时（毫秒）
  lastRefreshTime?: number              // 最后刷新时间
}

/**
 * 数据库扁平化字段（用于 MySQL 存储）
 */
export interface RefreshLogFlatDB {
  id: string
  timestamp: number
  total_accounts: number
  success_count: number
  failed_count: number
  skipped_count: number
  duration: number
  details: string                       // JSON string
  created_at: number
}

/**
 * 刷新详情扁平化字段（用于 MySQL 存储 - 可选的独立表）
 */
export interface RefreshDetailFlatDB {
  id: string                            // 详情ID（UUID）
  log_id: string                        // 关联的日志ID
  account_id: string
  email: string
  success: boolean
  error?: string
  duration: number
  skipped: boolean
  skip_reason?: string
  timestamp: number
}
