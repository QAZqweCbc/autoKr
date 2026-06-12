<template>
  <div class="deletion-logs-view">
    <el-card class="header-card">
      <div class="header-content">
        <div>
          <h2>账号删除日志</h2>
          <p class="subtitle">查看因邮件检测而自动删除的账号记录</p>
        </div>
        <el-button type="primary" @click="handleTriggerDetection" :loading="triggering">
          <el-icon><Refresh /></el-icon>
          手动触发检测
        </el-button>
      </div>
    </el-card>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalDeleted }}</div>
            <div class="stat-label">总删除数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value">{{ stats.last24Hours }}</div>
            <div class="stat-label">最近24小时</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value">{{ stats.last7Days }}</div>
            <div class="stat-label">最近7天</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value">{{ stats.last30Days }}</div>
            <div class="stat-label">最近30天</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选器 -->
    <el-card class="filter-card">
      <el-form :inline="true" :model="filters">
        <el-form-item label="邮箱">
          <el-input v-model="filters.email" placeholder="搜索邮箱" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 300px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 日志列表 -->
    <el-card class="table-card">
      <el-table :data="logs" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="email" label="账号邮箱" width="200" />
        <el-table-column label="删除原因" width="150">
          <template #default="{ row }">
            <el-tag type="warning">{{ formatReason(row.deletion_reason) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detected_email" label="检测邮箱" width="200" />
        <el-table-column prop="email_subject" label="邮件标题" min-width="250" show-overflow-tooltip />
        <el-table-column prop="email_from" label="发件人" width="200" show-overflow-tooltip />
        <el-table-column label="删除时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.deleted_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleViewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="删除日志详情" width="800px">
      <el-descriptions :column="2" border v-if="currentLog">
        <el-descriptions-item label="日志ID">{{ currentLog.id }}</el-descriptions-item>
        <el-descriptions-item label="账号ID">{{ currentLog.account_id }}</el-descriptions-item>
        <el-descriptions-item label="账号邮箱">{{ currentLog.email }}</el-descriptions-item>
        <el-descriptions-item label="删除原因">
          <el-tag type="warning">{{ formatReason(currentLog.deletion_reason) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="检测邮箱">{{ currentLog.detected_email }}</el-descriptions-item>
        <el-descriptions-item label="邮件标题">{{ currentLog.email_subject }}</el-descriptions-item>
        <el-descriptions-item label="邮件发件人">{{ currentLog.email_from }}</el-descriptions-item>
        <el-descriptions-item label="邮件日期">
          {{ currentLog.email_date ? formatDate(currentLog.email_date) : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="邮件UID">{{ currentLog.email_uid || '-' }}</el-descriptions-item>
        <el-descriptions-item label="检测时间">{{ formatDate(currentLog.detected_at) }}</el-descriptions-item>
        <el-descriptions-item label="删除时间">{{ formatDate(currentLog.deleted_at) }}</el-descriptions-item>
        <el-descriptions-item label="详细信息" v-if="currentLog.details">
          <pre>{{ JSON.stringify(currentLog.details, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getDeletionLogs, getDeletionStats, triggerDetection, type DeletionLog, type DeletionStats } from '@/api/deletionLogs'

const loading = ref(false)
const triggering = ref(false)
const logs = ref<DeletionLog[]>([])
const stats = ref<DeletionStats>({
  totalDeleted: 0,
  last24Hours: 0,
  last7Days: 0,
  last30Days: 0,
  byReason: {}
})

const filters = ref({
  email: ''
})

const dateRange = ref<[Date, Date] | null>(null)

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const detailVisible = ref(false)
const currentLog = ref<DeletionLog | null>(null)

// 加载统计数据
async function loadStats() {
  try {
    stats.value = await getDeletionStats()
  } catch (error: any) {
    console.error('加载统计失败:', error)
  }
}

// 加载日志列表
async function loadLogs() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    }

    if (filters.value.email) {
      params.email = filters.value.email
    }

    if (dateRange.value) {
      params.startDate = dateRange.value[0].getTime()
      params.endDate = dateRange.value[1].getTime()
    }

    const result = await getDeletionLogs(params)
    logs.value = result.logs
    pagination.value.total = result.total
  } catch (error: any) {
    ElMessage.error('加载日志失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 搜索
function handleSearch() {
  pagination.value.page = 1
  loadLogs()
}

// 重置
function handleReset() {
  filters.value.email = ''
  dateRange.value = null
  pagination.value.page = 1
  loadLogs()
}

// 分页变化
function handlePageChange(page: number) {
  pagination.value.page = page
  loadLogs()
}

function handleSizeChange(size: number) {
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadLogs()
}

// 查看详情
function handleViewDetail(log: DeletionLog) {
  currentLog.value = log
  detailVisible.value = true
}

// 手动触发检测
async function handleTriggerDetection() {
  triggering.value = true
  try {
    const result = await triggerDetection()
    ElMessage.success(`检测完成！删除了 ${result.accountsDeleted} 个账号`)
    // 刷新数据
    await loadStats()
    await loadLogs()
  } catch (error: any) {
    ElMessage.error('触发检测失败: ' + error.message)
  } finally {
    triggering.value = false
  }
}

// 格式化删除原因
function formatReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    'email_response_required': '邮件响应要求'
  }
  return reasonMap[reason] || reason
}

// 格式化日期
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => {
  loadStats()
  loadLogs()
})
</script>

<style scoped>
.deletion-logs-view {
  padding: 20px;
}

.header-card {
  margin-bottom: 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
}

.subtitle {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.filter-card {
  margin-bottom: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

pre {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
}
</style>
