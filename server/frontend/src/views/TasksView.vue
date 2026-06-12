<template>
  <div class="tasks-view page-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">
        <span class="title-icon">📋</span>
        <span class="text-gradient">任务管理</span>
      </h1>
      <p class="page-subtitle">实时监控和管理所有注册任务</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <StatsCard title="总任务数" :value="tasksStore.stats.total" />
      <StatsCard title="待处理" :value="tasksStore.stats.pending" color="#f59e0b" />
      <StatsCard title="运行中" :value="tasksStore.stats.running" color="#3b82f6" />
      <StatsCard title="已成功" :value="tasksStore.stats.success" color="#10b981" />
      <StatsCard title="已失败" :value="tasksStore.stats.failed" color="#ef4444" />
      <StatsCard title="已暂停" :value="tasksStore.stats.paused" color="#8b5cf6" />
    </div>

    <!-- 快速提示 -->
    <el-alert
      type="info"
      :closable="false"
      class="quick-tip alert-gradient"
    >
      <template #title>
        <div class="quick-tip-content">
          <div class="tip-icon">🎲</div>
          <div class="tip-text">
            <div class="tip-title">快速创建注册任务</div>
            <div class="tip-desc">前往"账号生成"页面，生成账号后可一键批量创建注册任务</div>
          </div>
          <el-button type="primary" class="btn-gradient" @click="router.push('/accounts')">
            前往生成账号 →
          </el-button>
        </div>
      </template>
    </el-alert>

    <!-- 任务列表 -->
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="header-title">任务列表</span>
            <el-tag v-if="filteredTasks.length > 0" type="info" size="small">
              {{ filteredTasks.length }} 条记录
            </el-tag>
          </div>
          
          <div class="header-center">
            <el-select
              v-model="statusFilter"
              placeholder="筛选任务状态"
              clearable
              style="width: 180px"
              size="default"
              @change="handleFilterChange"
            >
              <el-option label="全部状态" value="" />
              <el-option label="待处理" value="pending" />
              <el-option label="运行中" value="running" />
              <el-option label="已成功" value="success" />
              <el-option label="已失败" value="failed" />
              <el-option label="已暂停" value="paused" />
            </el-select>
          </div>
          
          <div class="header-right">
            <el-button
              v-if="selectedTasks.length > 0"
              type="danger"
              size="default"
              :icon="Delete"
              @click="handleBatchDelete"
            >
              批量删除 ({{ selectedTasks.length }})
            </el-button>
            <el-button
              type="primary"
              class="btn-gradient"
              :icon="Refresh"
              :loading="tasksStore.loading"
              @click="tasksStore.loadTasks()"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        v-if="filteredTasks.length > 0"
        ref="tableRef"
        :data="filteredTasks"
        stripe
        class="enhanced-table"
        style="width: 100%"
        :row-class-name="getTaskRowClassName"
        @selection-change="handleSelectionChange"
        @row-click="handleTaskRowClick"
      >
        <el-table-column type="selection" width="55" />
        
        <el-table-column prop="email" label="邮箱" min-width="200">
          <template #default="{ row }">
            <div class="email-cell">
              <span class="email-icon">📧</span>
              <span>{{ row.email }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag
              :class="getStatusClass(row.status)"
              size="small"
            >
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            <div class="time-cell">
              <span class="time-icon">🕐</span>
              <span>{{ formatDate(row.created_at) }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="error" label="错误信息" min-width="200">
          <template #default="{ row }">
            <span class="error-text">{{ row.error || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                v-if="row.status === 'pending' || row.status === 'running'"
                type="warning"
                size="small"
                :icon="VideoPause"
                @click="handlePause(row.id)"
              >
                暂停
              </el-button>
              
              <el-button
                v-if="row.status === 'paused'"
                type="success"
                size="small"
                :icon="VideoPlay"
                @click="handleResume(row.id)"
              >
                恢复
              </el-button>
              
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                @click="handleDelete(row.id)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-else
        description="暂无任务"
        :image-size="120"
      >
        <template #description>
          <div class="empty-desc">
            <p>{{ statusFilter ? '没有符合条件的任务' : '还没有任何任务' }}</p>
            <el-button v-if="!statusFilter" type="primary" class="btn-gradient" @click="router.push('/accounts')">
              立即创建
            </el-button>
          </div>
        </template>
      </el-empty>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTasksStore } from '../stores/tasks'
import { useWebSocketStore } from '../stores/websocket'
import { Refresh, Delete, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import StatsCard from '../components/StatsCard.vue'
import type { Task } from '../api/tasks'
import '../styles/tasks-view.css'

const router = useRouter()
const tasksStore = useTasksStore()
const websocketStore = useWebSocketStore()

// 筛选
const statusFilter = ref('')
const selectedTasks = ref<Task[]>([])
const tableRef = ref<any>(null)

let unsubscribe: (() => void) | null = null

// 过滤后的任务列表
const filteredTasks = computed(() => {
  let result = tasksStore.tasks

  // 状态筛选
  if (statusFilter.value) {
    result = result.filter(task => task.status === statusFilter.value)
  }

  return result
})

onMounted(() => {
  tasksStore.loadTasks()
  
  // 注册WebSocket任务更新监听
  unsubscribe = websocketStore.onTaskUpdate(() => {
    tasksStore.silentRefresh()
  })
})

onUnmounted(() => {
  // 清理监听器
  if (unsubscribe) {
    unsubscribe()
  }
})

const handleFilterChange = () => {
  // 筛选变化时清空选择
  selectedTasks.value = []
}

const handleSelectionChange = (selection: Task[]) => {
  selectedTasks.value = selection
}

const handleTaskRowClick = (row: Task, _column: unknown, event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, textarea, label, .el-button, .el-checkbox, .el-select, .el-dropdown')) {
    return
  }

  tableRef.value?.toggleRowSelection(row)
}

const getTaskRowClassName = ({ row }: { row: Task }) => {
  return selectedTasks.value.some(task => task.id === row.id) ? 'task-row is-selected' : 'task-row'
}

const handleDelete = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个任务吗？', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    
    await tasksStore.removeTask(id)
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedTasks.value.length} 个任务吗？`,
      '批量删除',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )
    
    const ids = selectedTasks.value.map(task => task.id)
    await tasksStore.removeTasks(ids)
    selectedTasks.value = []
    ElMessage.success(`已删除 ${ids.length} 个任务`)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  }
}

const handlePause = async (id: string) => {
  try {
    await tasksStore.pause(id)
    ElMessage.success('任务已暂停')
  } catch (error) {
    ElMessage.error('暂停失败')
  }
}

const handleResume = async (id: string) => {
  try {
    await tasksStore.resume(id)
    ElMessage.success('任务已恢复')
  } catch (error) {
    ElMessage.error('恢复失败')
  }
}

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: 'tag-warning',
    running: 'tag-info',
    success: 'tag-success',
    failed: 'tag-danger',
    paused: 'tag-purple'
  }
  return classes[status] || ''
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '待处理',
    running: '运行中',
    success: '已成功',
    failed: '已失败',
    paused: '已暂停'
  }
  return texts[status] || status
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>


