<template>
  <div class="logs-view">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: 600;">实时日志</span>
            <el-tag
              :type="wsStore.connected ? 'success' : 'danger'"
              size="small"
              style="margin-left: 12px;"
            >
              {{ wsStore.connected ? '已连接' : '未连接' }}
            </el-tag>
          </div>
          <el-button
            :icon="Delete"
            @click="wsStore.clearLogs()"
          >
            清空日志
          </el-button>
        </div>
      </template>

      <div class="log-container">
        <div
          v-for="(log, index) in wsStore.logs"
          :key="index"
          class="log-entry"
        >
          <span class="log-time">[{{ log.time }}]</span>
          {{ log.message }}
        </div>
        <div v-if="wsStore.logs.length === 0" class="log-empty">
          等待日志...
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useWebSocketStore } from '../stores/websocket'
import { Delete } from '@element-plus/icons-vue'
import '../styles/logs-view.css'

const wsStore = useWebSocketStore()
</script>


