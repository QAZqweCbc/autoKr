<template>
  <div class="accounts-view">
    <div class="accounts-header">
      <div>
        <h1 class="page-title">账号管理</h1>
        <p class="page-subtitle">统一查看账号列表、批量生成结果和注册任务创建。</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="accountsStore.loading" @click="accountsStore.loadAccounts()">刷新列表</el-button>
      </div>
    </div>

    <div class="stats-strip">
      <div class="stat-card">
        <span class="stat-label">账号总数</span>
        <span class="stat-value">{{ accountsStore.accounts.length }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">搜索结果</span>
        <span class="stat-value">{{ filteredAccounts.length }}</span>
      </div>
      <div class="stat-card highlight">
        <span class="stat-label">快捷入口</span>
        <span class="stat-link" @click="activeTab = 'generator'">切换到账号生成</span>
      </div>
    </div>

    <el-card class="accounts-main-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="账号列表" name="list">
          <div class="toolbar-row">
            <el-input
              v-model="searchText"
              placeholder="搜索邮箱"
              :prefix-icon="Search"
              clearable
              class="search-input"
            />
          </div>

          <el-table v-if="filteredAccounts.length > 0" :data="filteredAccounts" stripe class="accounts-table">
            <el-table-column type="index" label="序号" width="70" />
            <el-table-column prop="email" label="邮箱" min-width="240">
              <template #default="{ row }">
                <div class="copy-cell">
                  <span class="mono">{{ row.email }}</span>
                  <el-button :icon="CopyDocument" size="small" text @click="copyToClipboard(row.email)" />
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="password" label="密码" min-width="200">
              <template #default="{ row }">
                <div class="copy-cell">
                  <span class="mono">{{ showPasswords[row.id] ? row.password : '••••••••••••' }}</span>
                  <el-button :icon="showPasswords[row.id] ? Hide : View" size="small" text @click="togglePassword(row.id)" />
                  <el-button :icon="CopyDocument" size="small" text @click="copyToClipboard(row.password)" />
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="region" label="区域" width="130">
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

          <el-empty v-else-if="!accountsStore.loading" description="暂无账号数据" :image-size="120" />
        </el-tab-pane>

        <el-tab-pane label="账号生成" name="generator">
          <AccountGeneratorPanel />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Hide, Refresh, Search, View } from '@element-plus/icons-vue'
import { useAccountsStore } from '../stores/accounts'
import { useWebSocketStore } from '../stores/websocket'
import AccountGeneratorPanel from '../components/AccountGeneratorPanel.vue'
import '../styles/accounts-view.css'

const accountsStore = useAccountsStore()
const websocketStore = useWebSocketStore()
const activeTab = ref<'list' | 'generator'>('list')
const searchText = ref('')
const showPasswords = ref<Record<string, boolean>>({})

let unsubscribe: (() => void) | null = null

onMounted(() => {
  accountsStore.loadAccounts()
  unsubscribe = websocketStore.onAccountUpdate(() => {
    accountsStore.silentRefresh()
  })
})

onUnmounted(() => {
  unsubscribe?.()
})

const filteredAccounts = computed(() => {
  if (!searchText.value) return accountsStore.accounts
  const keyword = searchText.value.toLowerCase()
  return accountsStore.accounts.filter(account => account.email.toLowerCase().includes(keyword))
})

const togglePassword = (id: string) => {
  showPasswords.value[id] = !showPasswords.value[id]
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString('zh-CN')
</script>
