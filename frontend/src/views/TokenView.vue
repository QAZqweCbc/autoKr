<template>
  <div class="token-view">
    <el-card class="token-card">
      <template #header>
        <div class="token-header">
          <div>
            <span class="token-title">Token 管理</span>
            <div class="token-subtitle">查看账号 Token、额度信息，并支持快速导入凭证</div>
          </div>
          <div class="token-actions">
            <el-button type="warning" :icon="Upload" @click="openImportDrawer">
              导入凭证
            </el-button>
            <el-button
              type="success"
              :icon="Download"
              :disabled="selectedAccountIds.size === 0"
              @click="showExportDialog"
            >
              导出 Token ({{ selectedAccountIds.size }})
            </el-button>
            <el-button type="primary" :icon="Refresh" :loading="refreshingAll" :disabled="selectedAccountIds.size === 0" @click="handleRefreshAll">
              批量刷新额度 ({{ selectedAccountIds.size }})
            </el-button>
            <el-button :icon="Refresh" @click="loadTokens">刷新列表</el-button>
          </div>
        </div>
      </template>

      <el-alert type="info" :closable="false" class="summary-alert">
        <div class="summary-row">
          <span>查看已注册账号的 AWS Access Token、SSO Token 和使用额度</span>
          <div class="summary-stats">
            <span>总账号: <strong>{{ accounts.length }}</strong></span>
            <span>可自动刷新: <strong>{{ refreshableCount }}</strong></span>
            <span>有额度信息: <strong>{{ accountsWithUsage }}</strong></span>
          </div>
        </div>
      </el-alert>

      <div class="sync-row">
        <el-button
          type="success"
          :icon="Refresh"
          :loading="syncingAll"
          @click="handleSyncAllUsage"
        >
          同步所有使用量
        </el-button>
        <el-alert type="info" :closable="false" class="sync-tip">
          提示：刷新 Token 会自动同步使用量。如果只需要更新额度信息，使用“同步使用量”功能。
        </el-alert>
      </div>

      <el-form label-width="120px" class="detail-form">
        <el-form-item label="选择账号">
          <el-select
            v-model="selectedEmail"
            placeholder="请选择账号"
            filterable
            style="width: 100%;"
            @change="handleEmailChange"
          >
            <el-option
              v-for="account in accounts"
              :key="account.email"
              :label="`${account.email} (${account.status})`"
              :value="account.email"
            >
              <div class="account-option">
                <span>{{ account.email }}</span>
                <el-tag :type="getStatusType(account.status)" size="small">
                  {{ account.status }}
                </el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item v-if="selectedToken" label="Access Token">
          <div class="token-meta">
            <el-tag size="small" type="success">用于 API 调用</el-tag>
            <span class="token-tip">格式: AWS SSO Token (以 aoa 开头，200-300 字符)</span>
          </div>
          <el-input
            :model-value="selectedToken"
            type="textarea"
            :rows="4"
            readonly
            class="mono-input"
          />
          <div class="inline-actions">
            <el-button type="primary" :icon="CopyDocument" @click="copyToken">复制 Access Token</el-button>
            <el-button type="warning" :icon="Refresh" @click="handleRefreshToken">刷新 Token</el-button>
          </div>
        </el-form-item>

        <el-form-item v-if="selectedAccount && selectedAccount.sso_token" label="SSO Token">
          <div class="token-meta">
            <el-tag size="small" type="info">x_amz_sso_authn</el-tag>
            <span class="token-tip">格式: JWT（用于设备授权流程，不能直接调用 API）</span>
          </div>
          <el-input
            :model-value="selectedAccount.sso_token"
            type="textarea"
            :rows="4"
            readonly
            class="mono-input"
          />
          <div class="inline-actions">
            <el-button type="primary" :icon="CopyDocument" @click="copySsoToken">复制 SSO Token</el-button>
          </div>
        </el-form-item>

        <el-form-item v-if="selectedAccount" label="账号信息">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="邮箱">{{ selectedAccount.email }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getStatusType(selectedAccount.status)">
                {{ selectedAccount.status }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="用户ID">{{ selectedAccount.user_id || '-' }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ selectedAccount.nickname || '-' }}</el-descriptions-item>
            <el-descriptions-item label="IDP">{{ selectedAccount.idp || '-' }}</el-descriptions-item>
            <el-descriptions-item label="区域">{{ selectedAccount.region || 'us-east-1' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDate(selectedAccount.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatDate(selectedAccount.updatedAt) }}</el-descriptions-item>
          </el-descriptions>
        </el-form-item>

        <el-form-item v-if="selectedAccount && selectedAccount.subscription_type" label="订阅信息">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="订阅类型">
              <el-tag :type="selectedAccount.subscription_type === 'Free' ? 'info' : 'success'">
                {{ selectedAccount.subscription_title || selectedAccount.subscription_type }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="剩余天数">
              <span :style="{ color: getDaysRemainingColor(selectedAccount.days_remaining) }">
                {{ selectedAccount.days_remaining !== undefined ? `${selectedAccount.days_remaining} 天` : '-' }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="升级能力">{{ selectedAccount.upgrade_capability || '-' }}</el-descriptions-item>
            <el-descriptions-item label="超额能力">{{ selectedAccount.overage_capability || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-form-item>

        <el-form-item v-if="selectedAccount && selectedAccount.usage_limit !== undefined" label="使用额度">
          <div class="usage-panel">
            <div class="usage-block">
              <div class="usage-head">
                <span>总额度</span>
                <span>{{ selectedAccount.usage_current || 0 }} / {{ selectedAccount.usage_limit || 0 }}</span>
              </div>
              <el-progress
                :percentage="selectedAccount.usage_percent || 0"
                :color="getUsageColor(selectedAccount.usage_percent || 0)"
                :stroke-width="20"
              />
            </div>

            <div v-if="selectedAccount.base_limit !== undefined" class="usage-block">
              <div class="usage-head">
                <span>基础额度</span>
                <span>{{ selectedAccount.base_current || 0 }} / {{ selectedAccount.base_limit || 0 }}</span>
              </div>
              <el-progress
                :percentage="calculatePercent(selectedAccount.base_current, selectedAccount.base_limit)"
                :stroke-width="16"
                :show-text="false"
              />
            </div>

            <div v-if="selectedAccount.free_trial_limit !== undefined" class="usage-block">
              <div class="usage-head">
                <span>免费试用额度</span>
                <span>{{ selectedAccount.free_trial_current || 0 }} / {{ selectedAccount.free_trial_limit || 0 }}</span>
              </div>
              <el-progress
                :percentage="calculatePercent(selectedAccount.free_trial_current, selectedAccount.free_trial_limit)"
                :stroke-width="16"
                :show-text="false"
                color="#67c23a"
              />
              <div v-if="selectedAccount.free_trial_expiry" class="usage-note">
                过期时间: {{ formatDate(selectedAccount.free_trial_expiry) }}
              </div>
            </div>

            <div v-if="selectedAccount.resource_type" class="resource-grid">
              <div><span class="resource-label">资源类型</span><span>{{ selectedAccount.resource_display_name }}</span></div>
              <div><span class="resource-label">单位</span><span>{{ selectedAccount.resource_unit }}</span></div>
              <div v-if="selectedAccount.next_reset_date"><span class="resource-label">下次重置</span><span>{{ formatDate(selectedAccount.next_reset_date) }}</span></div>
              <div v-if="selectedAccount.overage_rate !== undefined"><span class="resource-label">超额费率</span><span>{{ selectedAccount.resource_currency }} {{ selectedAccount.overage_rate }}</span></div>
            </div>
          </div>
        </el-form-item>

        <el-form-item v-if="selectedAccount" label="自动刷新">
          <el-tag v-if="canAutoRefresh(selectedAccount)" type="success" size="large">支持自动刷新</el-tag>
          <el-tag v-else type="warning" size="large">不支持自动刷新（缺少 OAuth 凭证）</el-tag>
          <div class="refresh-meta">
            <div>Refresh Token: {{ selectedAccount.refresh_token ? '有' : '无' }}</div>
            <div>Client ID: {{ selectedAccount.client_id ? '有' : '无' }}</div>
            <div>Client Secret: {{ selectedAccount.client_secret ? '有' : '无' }}</div>
          </div>
        </el-form-item>
      </el-form>

      <el-divider />
      <div class="table-toolbar">
        <span class="section-title">所有账号 ({{ accounts.length }})</span>
        <div class="inline-actions">
          <el-button v-if="selectedAccountIds.size > 0" size="small" @click="clearSelection">取消选择</el-button>
          <el-button size="small" type="primary" @click="selectAll">全选 ({{ accounts.length }})</el-button>
        </div>
      </div>

      <el-table
        ref="tableRef"
        :data="accounts"
        stripe
        style="width: 100%;"
        :row-class-name="getAccountRowClassName"
        @selection-change="handleSelectionChange"
        @row-click="handleAccountRowClick"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column label="订阅" width="140">
          <template #default="{ row }">
            <el-tag v-if="row.subscription_type" :type="row.subscription_type === 'Free' ? 'info' : 'success'" size="small">
              {{ row.subscription_title || row.subscription_type }}
            </el-tag>
            <span v-else class="muted-text">-</span>
          </template>
        </el-table-column>
        <el-table-column label="使用额度" width="200">
          <template #default="{ row }">
            <div v-if="row.usage_limit !== undefined">
              <div class="quota-text">
                {{ row.usage_current || 0 }} / {{ row.usage_limit || 0 }}
                <span class="muted-text">({{ row.usage_percent || 0 }}%)</span>
              </div>
              <el-progress
                :percentage="row.usage_percent || 0"
                :color="getUsageColor(row.usage_percent || 0)"
                :stroke-width="6"
                :show-text="false"
              />
            </div>
            <span v-else class="muted-text">无数据</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="自动刷新" width="100">
          <template #default="{ row }">
            <el-tag v-if="canAutoRefresh(row)" type="success" size="small">支持</el-tag>
            <el-tag v-else type="info" size="small">不支持</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Token" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.access_token" type="success" size="small">已保存</el-tag>
            <el-tag v-else type="info" size="small">未保存</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="inline-actions">
              <el-button v-if="row.access_token" type="primary" size="small" @click="viewToken(row.email)">查看</el-button>
              <el-button
                v-if="canAutoRefresh(row)"
                type="success"
                size="small"
                :icon="Refresh"
                :loading="refreshingIds.has(row.id)"
                @click="refreshAccountQuota(row)"
              >
                刷新额度
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-divider />
      <el-alert type="warning" :closable="false">
        <template #title>
          <div class="notice-box">
            <strong>注意事项</strong>
            <ul>
              <li>Access Token 由自动注册流程生成并保存，或通过导入凭证获得</li>
              <li>Token 具有时效性，建议启用自动刷新功能保持活跃</li>
              <li>只有具备完整 OAuth 凭证的账号才支持自动刷新</li>
              <li>使用额度信息来自应用端导入，需要定期同步</li>
              <li>请勿将 Token 分享给他人</li>
            </ul>
          </div>
        </template>
      </el-alert>
    </el-card>

    <AccountImportDrawer v-model="showImportDrawer" @imported="handleImported" />

    <TokenExportDialog
      v-model="showExport"
      :selected-account-ids="Array.from(selectedAccountIds)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, CopyDocument, Download, Upload } from '@element-plus/icons-vue'
import axios from 'axios'
import { getAccounts } from '../api/accounts'
import type { Account } from '../api/accounts'
import AccountImportDrawer from '../components/AccountImportDrawer.vue'
import TokenExportDialog from '../components/TokenExportDialog.vue'
import '../styles/token-view.css'

const route = useRoute()
const router = useRouter()

const accounts = ref<Account[]>([])
const selectedEmail = ref('')
const selectedToken = ref('')
const selectedAccount = ref<Account | null>(null)
const refreshingAll = ref(false)
const refreshingIds = ref(new Set<string>())
const syncingAll = ref(false)
const selectedAccountIds = ref(new Set<string>())
const showExport = ref(false)
const showImportDrawer = ref(false)
const tableRef = ref<any>(null)

const refreshableCount = computed(() => accounts.value.filter(acc => canAutoRefresh(acc)).length)
const accountsWithUsage = computed(() => accounts.value.filter(acc => acc.usage_limit !== undefined).length)

onMounted(() => {
  loadTokens()
  syncImportQuery()
})

watch(() => route.query.import, () => {
  syncImportQuery()
})

const syncImportQuery = () => {
  if (route.query.import === '1') {
    showImportDrawer.value = true
  }
}

const openImportDrawer = () => {
  showImportDrawer.value = true
}

const handleImported = async () => {
  await loadTokens()
  if (route.query.import) {
    const nextQuery = { ...route.query }
    delete nextQuery.import
    router.replace({ query: nextQuery })
  }
  ElMessage.success('导入完成，列表已刷新')
}

const loadTokens = async () => {
  try {
    const data = await getAccounts()
    if (data.success) {
      accounts.value = data.accounts || []
      if (selectedEmail.value) {
        handleEmailChange(selectedEmail.value)
      }
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载账号失败')
  }
}

const handleEmailChange = (email: string) => {
  const account = accounts.value.find(a => a.email === email)
  selectedAccount.value = account || null
  selectedToken.value = account?.access_token || ''
}

const viewToken = (email: string) => {
  selectedEmail.value = email
  handleEmailChange(email)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleRefreshToken = async () => {
  if (!selectedAccount.value) {
    ElMessage.warning('请先选择账号')
    return
  }
  await refreshAccountToken(selectedAccount.value)
}

const refreshAccountToken = async (account: Account) => {
  if (!canAutoRefresh(account)) {
    ElMessage.warning('该账号缺少 OAuth 凭证，无法自动刷新')
    return
  }

  try {
    await ElMessageBox.confirm(`确定要刷新账号 ${account.email} 的 Token 吗？`, '确认刷新', {
      type: 'warning',
      confirmButtonText: '刷新',
      cancelButtonText: '取消'
    })

    refreshingIds.value.add(account.id)
    const response = await axios.post(`/api/token/${account.id}/refresh`)

    if (response.data.success) {
      ElMessage.success(response.data.message || 'Token 刷新成功')
      await loadTokens()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      const errorMsg = error.response?.data?.error || error.message || '刷新失败'
      ElMessage.error(errorMsg)

      if (error.response?.data?.needReimport) {
        ElMessageBox.alert('该账号缺少完整的 OAuth 凭证，无法自动刷新。请使用“导入凭证”重新导入该账号。', '需要重新导入', {
          type: 'warning',
          confirmButtonText: '知道了'
        })
      }
    }
  } finally {
    refreshingIds.value.delete(account.id)
  }
}

const refreshAccountQuota = async (account: Account) => {
  if (!canAutoRefresh(account)) {
    ElMessage.warning('该账号缺少 OAuth 凭证，无法自动刷新')
    return
  }

  try {
    await ElMessageBox.confirm(`确定要刷新账号 ${account.email} 的额度吗？这将先刷新 Token，然后获取最新的额度信息。`, '确认刷新额度', {
      type: 'warning',
      confirmButtonText: '刷新',
      cancelButtonText: '取消'
    })

    refreshingIds.value.add(account.id)

    const refreshResponse = await axios.post(`/api/token/${account.id}/refresh`)
    if (!refreshResponse.data.success) {
      throw new Error(refreshResponse.data.error || 'Token 刷新失败')
    }

    const syncResponse = await axios.post(`/api/token/${account.id}/sync-usage`)
    if (!syncResponse.data.success) {
      throw new Error(syncResponse.data.error || '额度同步失败')
    }

    ElMessage.success('额度刷新成功')
    await loadTokens()
  } catch (error: any) {
    if (error !== 'cancel') {
      const errorMsg = error.response?.data?.error || error.message || '刷新额度失败'
      ElMessage.error(errorMsg)

      if (error.response?.data?.needReimport) {
        ElMessageBox.alert('该账号缺少完整的 OAuth 凭证，无法自动刷新。请使用“导入凭证”重新导入该账号。', '需要重新导入', {
          type: 'warning',
          confirmButtonText: '知道了'
        })
      }
    }
  } finally {
    refreshingIds.value.delete(account.id)
  }
}

const handleRefreshAll = async () => {
  const selectedAccounts = accounts.value.filter(acc => selectedAccountIds.value.has(acc.id))
  if (selectedAccounts.length === 0) {
    ElMessage.warning('请先选择要刷新额度的账号')
    return
  }

  const refreshableAccounts = selectedAccounts.filter(acc => canAutoRefresh(acc))
  if (refreshableAccounts.length === 0) {
    ElMessage.warning('选中的账号没有支持刷新额度的账号')
    return
  }

  try {
    await ElMessageBox.confirm(`将刷新选中的 ${refreshableAccounts.length} 个账号额度，未选中的账号不会处理，是否继续？`, '批量刷新额度确认', {
      type: 'warning',
      confirmButtonText: '刷新额度',
      cancelButtonText: '取消'
    })

    refreshingAll.value = true
    const details: Array<{ email: string; success: boolean; error?: string }> = []

    for (const account of refreshableAccounts) {
      try {
        refreshingIds.value.add(account.id)

        const refreshResponse = await axios.post(`/api/token/${account.id}/refresh`)
        if (!refreshResponse.data.success) {
          throw new Error(refreshResponse.data.error || 'Token 刷新失败')
        }

        const syncResponse = await axios.post(`/api/token/${account.id}/sync-usage`)
        if (!syncResponse.data.success) {
          throw new Error(syncResponse.data.error || '额度同步失败')
        }

        details.push({ email: account.email, success: true })
      } catch (error: any) {
        details.push({
          email: account.email,
          success: false,
          error: error.response?.data?.error || error.message || '刷新额度失败'
        })
      } finally {
        refreshingIds.value.delete(account.id)
      }
    }

    await loadTokens()

    const successCount = details.filter(item => item.success).length
    const failedDetails = details.filter(item => !item.success)
    ElMessage.success(`选中账号额度刷新完成：成功 ${successCount} 个，失败 ${failedDetails.length} 个`)

    if (failedDetails.length > 0) {
      ElMessageBox.alert(
        failedDetails.map(item => `${item.email}: ${item.error}`).join('\n'),
        `刷新额度失败的账号 (${failedDetails.length})`,
        {
          type: 'warning',
          confirmButtonText: '知道了'
        }
      )
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || error.message || '批量刷新额度失败')
    }
  } finally {
    refreshingAll.value = false
  }
}

const handleSyncAllUsage = async () => {
  const syncableAccounts = accounts.value.filter(acc => acc.access_token)
  if (syncableAccounts.length === 0) {
    ElMessage.warning('没有可同步的账号')
    return
  }

  try {
    await ElMessageBox.confirm(`将同步 ${syncableAccounts.length} 个账号的使用量，是否继续？`, '批量同步确认', {
      type: 'info',
      confirmButtonText: '开始同步',
      cancelButtonText: '取消'
    })

    syncingAll.value = true
    const response = await axios.post('/api/token/sync-all-usage')

    if (response.data.success) {
      const { successCount, failedCount } = response.data
      ElMessage.success(`同步完成：成功 ${successCount} 个，失败 ${failedCount} 个`)
      await loadTokens()

      if (failedCount > 0 && response.data.details) {
        const failedAccounts = response.data.details
          .filter((d: any) => !d.success)
          .map((d: any) => `${d.email}: ${d.error}`)
          .join('\n')

        ElMessageBox.alert(failedAccounts, `同步失败的账号 (${failedCount})`, {
          type: 'warning',
          confirmButtonText: '知道了'
        })
      }
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || error.message || '批量同步失败')
    }
  } finally {
    syncingAll.value = false
  }
}

const copyText = async (text: string, message: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(message)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success(message)
  }
}

const copyToken = async () => {
  if (!selectedToken.value) {
    ElMessage.warning('没有可复制的 Token')
    return
  }
  await copyText(selectedToken.value, 'Access Token 已复制到剪贴板')
}

const copySsoToken = async () => {
  if (!selectedAccount.value?.sso_token) {
    ElMessage.warning('该账号没有 SSO Token')
    return
  }
  await copyText(selectedAccount.value.sso_token, 'SSO Token 已复制到剪贴板')
}

const canAutoRefresh = (account: Account): boolean => !!(account.refresh_token && account.client_id && account.client_secret)

const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    active: 'success',
    pending: 'warning',
    failed: 'danger',
    success: 'success'
  }
  return types[status] || 'info'
}

const getUsageColor = (percent: number) => {
  if (percent >= 90) return '#f56c6c'
  if (percent >= 70) return '#e6a23c'
  return '#409eff'
}

const getDaysRemainingColor = (days: number | undefined) => {
  if (days === undefined) return '#909399'
  if (days <= 7) return '#f56c6c'
  if (days <= 30) return '#e6a23c'
  return '#67c23a'
}

const calculatePercent = (current: number | undefined, limit: number | undefined): number => {
  if (!limit || limit === 0) return 0
  return Math.round(((current || 0) / limit) * 100)
}

const formatDate = (dateStr: string | number | undefined) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const handleSelectionChange = (selection: Account[]) => {
  selectedAccountIds.value = new Set(selection.map(acc => acc.id))
}

const handleAccountRowClick = (row: Account, _column: unknown, event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, textarea, label, .el-button, .el-checkbox, .el-select, .el-dropdown')) {
    return
  }

  tableRef.value?.toggleRowSelection(row)
}

const getAccountRowClassName = ({ row }: { row: Account }) => {
  return selectedAccountIds.value.has(row.id) ? 'token-account-row is-selected' : 'token-account-row'
}

const selectAll = () => {
  selectedAccountIds.value = new Set(accounts.value.map(acc => acc.id))
  accounts.value.forEach(row => {
    tableRef.value?.toggleRowSelection(row, true)
  })
}

const clearSelection = () => {
  selectedAccountIds.value.clear()
  tableRef.value?.clearSelection()
}

const showExportDialog = () => {
  if (selectedAccountIds.value.size === 0) {
    ElMessage.warning('请先选择要导出的账号')
    return
  }
  showExport.value = true
}
</script>
