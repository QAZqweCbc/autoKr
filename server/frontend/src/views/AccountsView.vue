<template>
  <div class="accounts-view">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: 600;">账号管理</span>
            <el-tag type="info" size="small" style="margin-left: 12px;">
              共 {{ accountsStore.accounts.length }} 个账号
            </el-tag>
          </div>
          <div style="display: flex; gap: 10px;">
            <el-button
              :icon="Refresh"
              :loading="accountsStore.loading"
              @click="accountsStore.loadAccounts()"
            >
              刷新
            </el-button>
            <el-button
              type="primary"
              :icon="Download"
              :disabled="accountsStore.accounts.length === 0"
              @click="handleExport('json')"
            >
              导出 JSON
            </el-button>
            <el-button
              :icon="Download"
              :disabled="accountsStore.accounts.length === 0"
              @click="handleExport('csv')"
            >
              导出 CSV
            </el-button>
          </div>
        </div>
      </template>

      <!-- 搜索过滤 -->
      <div style="margin-bottom: 20px;">
        <el-input
          v-model="searchText"
          placeholder="搜索邮箱..."
          :prefix-icon="Search"
          clearable
          style="max-width: 400px;"
        />
      </div>

      <!-- 账号表格 -->
      <el-table
        v-if="filteredAccounts.length > 0"
        :data="filteredAccounts"
        stripe
        style="width: 100%;"
      >
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column prop="email" label="邮箱" min-width="250">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-family: monospace;">{{ row.email }}</span>
              <el-button
                :icon="CopyDocument"
                size="small"
                text
                @click="copyToClipboard(row.email)"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="password" label="密码" min-width="200">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span v-if="showPasswords[row.id]" style="font-family: monospace;">
                {{ row.password }}
              </span>
              <span v-else style="font-family: monospace;">
                ••••••••••••
              </span>
              <el-button
                :icon="showPasswords[row.id] ? Hide : View"
                size="small"
                text
                @click="togglePassword(row.id)"
              />
              <el-button
                :icon="CopyDocument"
                size="small"
                text
                @click="copyToClipboard(row.password)"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="region" label="区域" width="120">
          <template #default="{ row }">
            {{ row.region || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-else-if="!accountsStore.loading"
        description="暂无账号"
        :image-size="120"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Download, Search, CopyDocument, View, Hide } from '@element-plus/icons-vue'
import { useAccountsStore } from '../stores/accounts'
import { useWebSocketStore } from '../stores/websocket'
import '../styles/accounts-view.css'

const accountsStore = useAccountsStore()
const websocketStore = useWebSocketStore()
const searchText = ref('')
const showPasswords = ref<Record<string, boolean>>({})

let unsubscribe: (() => void) | null = null

onMounted(() => {
  accountsStore.loadAccounts()
  
  // 注册WebSocket账号更新监听
  unsubscribe = websocketStore.onAccountUpdate(() => {
    accountsStore.silentRefresh()
  })
})

onUnmounted(() => {
  // 清理监听器
  if (unsubscribe) {
    unsubscribe()
  }
})

const filteredAccounts = computed(() => {
  if (!searchText.value) return accountsStore.accounts
  
  const search = searchText.value.toLowerCase()
  return accountsStore.accounts.filter(acc => 
    acc.email.toLowerCase().includes(search)
  )
})

const togglePassword = (id: string) => {
  showPasswords.value[id] = !showPasswords.value[id]
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const handleExport = async (format: 'json' | 'csv') => {
  try {
    await accountsStore.exportAccounts(format)
    ElMessage.success(`导出 ${format.toUpperCase()} 成功`)
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败')
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>


