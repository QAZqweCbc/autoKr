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
