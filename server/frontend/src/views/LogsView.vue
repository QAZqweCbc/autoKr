<template>
  <div class="logs-view">
    <el-card>
      <template #header>
        <div class="logs-header">
          <div class="logs-title-group">
            <span class="logs-title">实时日志中心</span>
            <el-tag :type="wsStore.connected ? 'success' : 'danger'" size="small">
              {{ wsStore.connected ? '已连接' : '未连接' }}
            </el-tag>
          </div>
          <div class="logs-actions">
            <el-tag effect="plain" type="info">总计 {{ wsStore.logs.length }} 条</el-tag>
            <el-button :icon="Delete" @click="wsStore.clearLogs()">清空日志</el-button>
          </div>
        </div>
      </template>

      <div class="log-tabs">
        <button
          v-for="item in logTabs"
          :key="item.key"
          type="button"
          class="log-tab"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key"
        >
          <span class="tab-name">{{ item.label }}</span>
          <span class="tab-count">{{ item.count }}</span>
        </button>
      </div>

      <div class="log-panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">{{ activeTabMeta.label }}</div>
            <div class="panel-subtitle">{{ activeTabMeta.description }}</div>
          </div>
          <el-tag :type="activeTabMeta.tagType" size="small">{{ activeLogs.length }}</el-tag>
        </div>

        <!-- 注册账户日志：分两个区块展示 -->
        <template v-if="activeTab === 'account'">
          <!-- 区块1：注册信息表格（按行展示） -->
          <div v-if="accountRecords.length > 0" class="account-section">
            <div
              v-for="(record, idx) in accountRecords"
              :key="idx"
              class="account-block"
            >
              <!-- 标题行 -->
              <div class="block-title">注册信息</div>

              <!-- 邮箱账号行 -->
              <div class="table-row">
                <div class="table-cell col-span-2">{{ getLabel(record) }}</div>
                <div class="table-cell">邮箱账号:</div>
                <div class="table-cell col-span-2">{{ record.email || '-' }}</div>
              </div>

              <!-- 账户名字 / 账户密码 / 验证码 -->
              <div class="table-row">
                <div class="table-cell">账户名字</div>
                <div class="table-cell">{{ record.name || 'null' }}</div>
                <div class="table-cell">账户密码</div>
                <div class="table-cell">{{ record.password || '-' }}</div>
                <div class="table-cell">验证码</div>
                <div class="table-cell">{{ record.verification || 'null' }}</div>
              </div>

              <!-- 预留行 -->
              <div class="table-row">
                <div class="table-cell" colspan="6">预留: null</div>
              </div>

              <div v-if="idx < accountRecords.length - 1" class="block-divider" />
            </div>
          </div>

          <!-- 区块2：信息模块（成功/失败日志） -->
          <div v-if="accountInfoLogs.length > 0" class="account-info-module">
            <div class="section-label">信息模块成功/失败</div>
            <el-table
              :data="accountInfoLogs"
              stripe
              height="200"
            >
              <el-table-column prop="time" label="时间" width="110" />
              <el-table-column prop="source" label="来源" width="120" />
              <el-table-column label="级别" width="100">
                <template #default="{ row }">
                  <el-tag :type="getLevelType(row.level)" size="small">{{ getLevelText(row.level) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="message" label="内容" min-width="420" show-overflow-tooltip />
            </el-table>
          </div>

          <!-- 两个区块都为空 -->
          <el-empty v-if="accountRecords.length === 0 && accountInfoLogs.length === 0" :description="activeTabMeta.emptyText" />
        </template>

        <!-- 其他日志类型：统一表格 -->
        <template v-else>
          <el-table :data="activeLogs" stripe height="420" :empty-text="activeTabMeta.emptyText">
            <el-table-column prop="time" label="时间" width="110" />
            <el-table-column prop="source" label="来源" width="120" />
            <el-table-column label="级别" width="100">
              <template #default="{ row }">
                <el-tag :type="getLevelType(row.level)" size="small">{{ getLevelText(row.level) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="内容" min-width="420" show-overflow-tooltip />
          </el-table>
        </template>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { useWebSocketStore, type LogCategory, type LogLevel } from '../stores/websocket'
import '../styles/logs-view.css'

const wsStore = useWebSocketStore()
const activeTab = ref<LogCategory>('register')

const levelText: Record<LogLevel, string> = {
  info: '信息',
  success: '成功',
  warning: '警告',
  error: '错误'
}

const tabMeta: Record<LogCategory, { label: string; description: string; emptyText: string; tagType: 'warning' | 'primary' | 'success' | 'info' }> = {
  register: {
    label: '注册日志',
    description: '查看注册任务、运行状态和处理过程。',
    emptyText: '暂无注册日志',
    tagType: 'warning'
  },
  config: {
    label: '配置保存日志',
    description: '查看邮箱、浏览器、数据库等配置的保存变化。',
    emptyText: '暂无配置日志',
    tagType: 'primary'
  },
  account: {
    label: '注册账户日志',
    description: '查看账号同步、Token 刷新和凭证状态。',
    emptyText: '暂无账户日志',
    tagType: 'success'
  },
  connection: {
    label: '连接日志',
    description: '查看 WebSocket 连接、断开和重连状态。',
    emptyText: '暂无连接日志',
    tagType: 'info'
  }
}

const logTabs = computed(() => [
  { key: 'register' as const, label: '注册日志', count: wsStore.categorizedLogs.register.length },
  { key: 'config' as const, label: '配置保存日志', count: wsStore.categorizedLogs.config.length },
  { key: 'account' as const, label: '注册账户日志', count: wsStore.categorizedLogs.account.length },
  { key: 'connection' as const, label: '连接日志', count: wsStore.categorizedLogs.connection.length }
])

const activeTabMeta = computed(() => tabMeta[activeTab.value])
const activeLogs = computed(() => wsStore.categorizedLogs[activeTab.value])

// 账号记录
interface AccountRecord {
  taskId: string
  email: string
  password: string
  name: string | null
  verification: string | null
  status: 'success' | 'failure' | 'info'
  type: string
}

// 获取记录标签
function getLabel(record: AccountRecord): string {
  if (record.status === 'success') return '注册成功'
  if (record.status === 'failure') return '注册失败'
  return '注册账户信息'
}

// 账号信息模块：按 taskId 聚合
const accountRecords = computed<AccountRecord[]>(() => {
  const map = new Map<string, AccountRecord>()

  for (const log of activeLogs.value) {
    // 1. 优先使用 payload 结构化数据
    if (log.payload?.type === 'registration_success') {
      const key = log.payload.taskId || log.id
      map.set(key, {
        taskId: log.payload.taskId || '',
        email: log.payload.email || '',
        password: log.payload.password || '',
        name: log.payload.name || null,
        verification: null,
        status: 'success',
        type: log.payload.taskId || ''
      })
    } else if (log.payload?.type === 'registration_failure') {
      const key = log.payload.taskId || log.id
      map.set(key, {
        taskId: log.payload.taskId || '',
        email: log.payload.email || '',
        password: log.payload.password || '',
        name: log.payload.name || null,
        verification: null,
        status: 'failure',
        type: log.payload.taskId || ''
      })
    }
    // 2. 兼容无 payload 的 task:log 消息
    else if (log.category === 'account' && log.source === '任务日志' && /\[.+\]/.test(log.message)) {
      const msg = log.message.replace(/^\[[\w-]+\]\s*/, '')
      if (/注册账户信息|注册账号|账号密码/.test(msg)) {
        const emailMatch = msg.match(/注册账号[：:]\s*(\S+)/)
        const email = emailMatch?.[1] ?? ''
        const passwordMatch = msg.match(/账号密码[：:]\s*(\S+)/)
        const password = passwordMatch?.[1] ?? ''
        const nameMatch = msg.match(/账号名[：:]\s*(.+?)(?:\s*$)/)
        const name = nameMatch ? (nameMatch[1] || null) : null

        const taskIdMatch = log.message.match(/^\[([\w-]+)\]/)
        const taskId = taskIdMatch?.[1] ?? log.id

        const existing = map.get(taskId)
        if (existing) {
          if (!existing.email && email) existing.email = email
          if (!existing.password && password) existing.password = password
          if (!existing.name && name) existing.name = name
        } else {
          map.set(taskId, {
            taskId,
            email,
            password,
            name,
            verification: null,
            status: 'info',
            type: taskId
          })
        }
      }
    }
  }

  return Array.from(map.values())
})

// 信息模块日志（排除已归入上方表格的 payload 消息）
const accountInfoLogs = computed(() => {
  return activeLogs.value.filter(log => {
    if (log.payload?.type === 'registration_success') return false
    if (log.payload?.type === 'registration_failure') return false
    return true
  })
})

const getLevelText = (level: LogLevel) => levelText[level]

const getLevelType = (level: LogLevel) => {
  const typeMap: Record<LogLevel, 'info' | 'success' | 'warning' | 'danger'> = {
    info: 'info',
    success: 'success',
    warning: 'warning',
    error: 'danger'
  }
  return typeMap[level]
}
</script>
