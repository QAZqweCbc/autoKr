<template>
  <div class="token-view">
    <el-card>
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 600;">Token 管理</span>
          <div style="display: flex; gap: 12px;">
            <el-button
              type="success"
              :icon="Download"
              :disabled="selectedAccountIds.size === 0"
              @click="showExportDialog"
            >
              导出 Token ({{ selectedAccountIds.size }})
            </el-button>
            <el-button type="primary" :icon="Refresh" :loading="refreshingAll" @click="handleRefreshAll">
              批量刷新
            </el-button>
            <el-button :icon="Refresh" @click="loadTokens">刷新列表</el-button>
          </div>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 24px;"
      >
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>查看已注册账号的 AWS Access Token 和使用额�?/span>
          <div style="display: flex; gap: 16px; font-size: 13px;">
            <span>总账�? <strong>{{ accounts.length }}</strong></span>
            <span>可自动刷�? <strong>{{ refreshableCount }}</strong></span>
            <span>有额度信�? <strong>{{ accountsWithUsage }}</strong></span>
          </div>
        </div>
      </el-alert>

      <!-- 批量操作按钮 -->
      <div style="margin-bottom: 16px; display: flex; gap: 12px;">
        <el-button 
          type="success" 
          :icon="Refresh" 
          :loading="syncingAll" 
          @click="handleSyncAllUsage"
        >
          同步所有使用量
        </el-button>
        <el-alert
          type="info"
          :closable="false"
          style="flex: 1; margin: 0;"
        >
          <span style="font-size: 13px;">
            💡 提示：刷�?Token 会自动同步使用量。如果只需要更新额度信息，使用"同步使用�?功能�?
          </span>
        </el-alert>
      </div>

      <!-- 账号选择 -->
      <el-form label-width="120px" style="max-width: 800px;">
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
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>{{ account.email }}</span>
                <el-tag :type="getStatusType(account.status)" size="small">
                  {{ account.status }}
                </el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <!-- Access Token 显示 -->
        <el-form-item v-if="selectedToken" label="Access Token">
          <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            <el-tag size="small" type="success">用于 API 调用</el-tag>
            <span style="font-size: 12px; color: #909399;">
              格式: AWS SSO Token (�?aoa 开头，200-300字符)
            </span>
          </div>
          <el-input
            :model-value="selectedToken"
            type="textarea"
            :rows="4"
            readonly
            style="font-family: monospace; font-size: 13px;"
          />
          <div style="margin-top: 8px; display: flex; gap: 12px;">
            <el-button
              type="primary"
              :icon="CopyDocument"
              @click="copyToken"
            >
              复制 Access Token
            </el-button>
            <el-button
              type="warning"
              :icon="Refresh"
              @click="handleRefreshToken"
            >
              刷新 Token
            </el-button>
          </div>
        </el-form-item>

        <!-- SSO Token 显示 -->
        <el-form-item v-if="selectedAccount && selectedAccount.sso_token" label="SSO Token">
          <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            <el-tag size="small" type="info">x_amz_sso_authn</el-tag>
            <span style="font-size: 12px; color: #909399;">
              格式: JWT (用于设备授权流程，不能直接调�?API)
            </span>
          </div>
          <el-input
            :model-value="selectedAccount.sso_token"
            type="textarea"
            :rows="4"
            readonly
            style="font-family: monospace; font-size: 13px;"
          />
          <div style="margin-t 8px;">
            <el-button
              type="primary"
              :icon="CopyDocument"
              @click="copySsoToken"
            >
              复制 SSO Token
            </el-button>
          </div>
        </el-form-item>

        <!-- 账号详情 -->
        <el-form-item v-if="selectedAccount" label="账号信息">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="邮箱">{{ selectedAccount.email }}</el-descriptions-item>
            <el-descriptions-item label="状�?>
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

        <!-- 订阅信息 -->
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

        <!-- 使用量信�?-->
        <el-form-item v-if="selectedAccount && selectedAccount.usage_limit !== undefined" label="使用额度">
          <div style="background: #f5f7fa; padding: 16px; border-radius: 8px;">
            <!-- 总额�?-->
            <div style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: 600;">总额�?/span>
                <span>{{ selectedAccount.usage_current || 0 }} / {{ selectedAccount.usage_limit || 0 }}</span>
              </div>
              <el-progress
                :percentage="selectedAccount.usage_percent || 0"
                :color="getUsageColor(selectedAccount.usage_percent || 0)"
                :stroke-width="20"
              />
            </div>

            <!-- 基础额度 -->
            <div v-if="selectedAccount.base_limit !== undefined" style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>基础额度</span>
                <span>{{ selectedAccount.base_current || 0 }} / {{ selectedAccount.base_limit || 0 }}</span>
              </div>
              <el-progress
                :percentage="calculatePercent(selectedAccount.base_current, selectedAccount.base_limit)"
                :stroke-width="16"
                :show-text="false"
              />
            </div>

            <!-- 免费试用额度 -->
            <div v-if="selectedAccount.free_trial_limit !== undefined" style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>免费试用额度</span>
                <span>{{ selectedAccount.free_trial_current || 0 }} / {{ selectedAccount.free_trial_limit || 0 }}</span>
              </div>
              <el-progress
                :percentage="calculatePercent(selectedAccount.free_trial_current, selectedAccount.free_trial_limit)"
                :stroke-width="16"
                :show-text="false"
                color="#67c23a"
              />
              <div v-if="selectedAccount.free_trial_expiry" style="font-size: 12px; color: #909399; margin-top: 4px;">
                过期时间: {{ formatDate(selectedAccount.free_trial_expiry) }}
              </div>
            </div>

            <!-- 资源详情 -->
            <div v-if="selectedAccount.resource_type" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #dcdfe6;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                <div>
                  <span style="color: #909399;">资源类型:</span>
                  <span style="margin-left: 8px; font-weight: 600;">{{ selectedAccount.resource_display_name }}</span>
                </div>
                <div>
                  <span style="color: #909399;">单位:</span>
                  <span style="margin-left: 8px;">{{ selectedAccount.resource_unit }}</span>
                </div>
                <div v-if="selectedAccount.next_reset_date">
                  <span style="color: #909399;">下次重置:</span>
                  <span style="margin-left: 8px;">{{ formatDate(selectedAccount.next_reset_date) }}</span>
                </div>
                <div v-if="selectedAccount.overage_rate !== undefined">
                  <span style="color: #909399;">超额费率:</span>
                  <span style="margin-left: 8px;">{{ selectedAccount.resource_currency }} {{ selectedAccount.overage_rate }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>

        <!-- OAuth 凭证状�?-->
        <el-form-item v-if="selectedAccount" label="自动刷新">
          <el-tag v-if="canAutoRefresh(selectedAccount)" type="success" size="large">
            �?支持自动刷新
          </el-tag>
          <el-tag v-else type="warning" size="large">
            �?不支持自动刷新（缺少 OAuth 凭证�?
          </el-tag>
          <div style="margin-top: 8px; font-size: 13px; color: #909399;">
            <div>Refresh Token: {{ selectedAccount.refresh_token ? '�? : '�? }}</div>
            <div>Client ID: {{ selectedAccount.client_id ? '�? : '�? }}</div>
            <div>Client Secret: {{ selectedAccount.client_secret ? '�? : '�? }}</div>
          </div>
        </el-form-item>
      </el-form>

      <!-- 账号列表 -->
      <el-divider />
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600; font-size: 16px;">所有账�?({{ accounts.length }})</span>
        <div style="display: flex; gap: 12px; align-items: center;">
          <el-button
            v-if="selectedAccountIds.size > 0"
            size="small"
            @click="clearSelection"
          >
            取消选择
          </el-button>
          <el-button
            size="small"
            type="primary"
            @click="selectAll"
          >
            全�?({{ accounts.length }})
          </el-button>
        </div>
      </div>

      <el-table
        ref="tableRef"
        :data="accounts"
        stripe
        style="width: 100%;"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column label="订阅" width="140">
          <template #default="{ row }">
            <el-tag v-if="row.subscription_type" :type="row.subscription_type === 'Free' ? 'info' : 'success'" size="small">
              {{ row.subscription_title || row.subscription_type }}
            </el-tag>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="使用额度" width="200">
          <template #default="{ row }">
            <div v-if="row.usage_limit !== undefined">
              <div style="font-size: 12px; margin-bottom: 4px;">
                {{ row.usage_current || 0 }} / {{ row.usage_limit || 0 }}
                <span style="color: #909399;">({{ row.usage_percent || 0 }}%)</span>
              </div>
              <el-progress
                :percentage="row.usage_percent || 0"
                :color="getUsageColor(row.usage_percent || 0)"
                :stroke-width="6"
                :show-text="false"
              />
            </div>
            <span v-else style="color: #909399; font-size: 12px;">无数�?/span>
          </template>
        </el-table-column>
        <el-table-column label="状�? width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="自动刷新" width="100">
          <template #default="{ row }">
            <el-tag v-if="canAutoRefresh(row)" type="success" size="small">�?/el-tag>
            <el-tag v-else type="info" size="small">�?/el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Token" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.access_token" type="success" size="small">�?已保�?/el-tag>
            <el-tag v-else type="info" size="small">未保�?/el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div style="displayflex; gap: 8px;">
              <el-button
                v-if="row.access_token"
                type="primary"
                size="small"
                @click="viewToken(row.email)"
              >
                查看
              </el-button>
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

      <!-- 使用说明 -->
      <el-divider />
      <el-alert
        type="warning"
        :closable="false"
      >
        <template #title>
          <div style="font-size: 14px;">
            <strong>⚠️ 注意事项</strong>
            <ul style="margin: 8px 0 0 20px; padding: 0;">
              <li>Access Token 由自动注册流程生成并保存，或通过导入获得</li>
              <li>Token 具有时效性，建议启用自动刷新功能保持活跃</li>
              <li>只有具备完整 OAuth 凭证的账号才支持自动刷新</li>
              <li>使用额度信息来自应用端导入，需要定期同�?/li>
              <li>请勿�?Token 分享给他�?/li>
            </ul>
          </div>
        </template>
      </el-alert>
    </el-card>

    <!-- Token 导出对话�?-->
    <TokenExportDialog
      v-model="showExport"
      :selected-account-ids="Array.from(selectedAccountIds)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, CopyDocument, Download } from '@element-plus/icons-vue'
import { getAccounts } from '../api/accounts'
import axios from 'axios'
import TokenExportDialog from '../components/TokenExportDialog.vue'

// Using Account type from API
import type { Account } from '../api/accounts'
import '../styles/token-view.css'

const accounts = ref<Account[]>([])
const selectedEmail = ref('')
const selectedToken = ref('')
const selectedAccount = ref<Account | null>(null)
const refreshingAll = ref(false)
const refreshingIds = ref(new Set<string>())
const syncingAll = ref(false)

// 导出功能相关
const selectedAccountIds = ref(new Set<string>())
const showExport = ref(false)
const tableRef = ref<any>(null)

// 计算可自动刷新的账号数量
const refreshableCount = computed(() => {
  return accounts.value.filter(acc => canAutoRefresh(acc)).length
})

// 计算有使用量信息的账号数�?
const accountsWithUsage = computed(() => {
  return accounts.value.filter(acc => acc.usage_limit !== undefined).length
})

onMounted(() => {
  loadTokens()
})

const loadTokens = async () => {
  try {
    const data = await getAccounts()
    if (data.success) {
      accounts.value = data.accounts || []
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载账号失败')
  }
}

const handleEmailChange = (email: string) => {
  const account = accounts.value.find(a => a.email === email)
  if (account) {
    selectedAccount.value = account
    selectedToken.value = account.access_token || ''
  }
}

const viewToken = (email: string) => {
  selectedEmail.value = email
  handleEmailChange(email)
  // 滚动到顶�?
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
    ElMessage.warning('该账号缺�?OAuth 凭证，无法自动刷�?)
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要刷新账�?${account.email} �?Token 吗？`,
      '确认刷新',
      {
        type: 'warning',
        confirmButtonText: '刷新',
        cancelButtonText: '取消'
      }
    )

    refreshingIds.value.add(account.id)

    const response = await axios.post(`/api/token/${account.id}/refresh`)
    
    if (response.data.success) {
      ElMessage.success(response.data.message || 'Token 刷新成功')
      // 重新加载账号列表
      await loadTokens()
      // 如果当前选中的是这个账号，更新显�?
      if (selectedAccount.value?.id === account.id) {
        handleEmailChange(account.email)
      }
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      const errorMsg = error.response?.data?.error || error.message || '刷新失败'
      ElMessage.error(errorMsg)
      
      // 如果需要重新导入，提示用户
      if (error.response?.data?.needReimport) {
        ElMessageBox.alert(
          '该账号缺少完整的 OAuth 凭证，无法自动刷新。请�?导入账号"页面重新导入该账号�?,
          '需要重新导�?,
          {
            type: 'warning',
            confirmButtonText: '知道�?
          }
        )
      }
    }
  } finally {
    refreshingIds.value.delete(account.id)
  }
}

const refreshAccountQuota = async (account: Account) => {
  if (!canAutoRefresh(account)) {
    ElMessage.warning('该账号缺�?OAuth 凭证，无法自动刷�?)
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要刷新账�?${account.email} 的额度吗？这将先刷新 Token，然后获取最新的额度信息。`,
      '确认刷新额度',
      {
        type: 'warning',
        confirmButtonText: '刷新',
        cancelButtonText: '取消'
      }
    )

    refreshingIds.value.add(account.id)

    // 第一步：刷新 Token
    const refreshResponse = await axios.post(`/api/token/${account.id}/refresh`)

    if (!refreshResponse.data.success) {
      throw new Error(refreshResponse.data.error || 'Token 刷新失败')
    }

    // 第二步：同步额度信息
    const syncResponse = await axios.post(`/api/token/${account.id}/sync-usage`)

    if (syncResponse.data.success) {
      ElMessage.success('额度刷新成功')
      // 重新加载账号列表
      await loadTokens()
      // 如果当前选中的是这个账号，更新显�?
      if (selectedAccount.value?.id === account.id) {
        handleEmailChange(account.email)
      }
    } else {
      throw new Error(syncResponse.data.error || '额度同步失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      const errorMsg = error.response?.data?.error || error.message || '刷新额度失败'
      ElMessage.error(errorMsg)

      // 如果需要重新导入，提示用户
      if (error.response?.data?.needReimport) {
        ElMessageBox.alert(
          '该账号缺少完整的 OAuth 凭证，无法自动刷新。请�?导入账号"页面重新导入该账号�?,
          '需要重新导�?,
          {
            type: 'warning',
            confirmButtonText: '知道�?
          }
        )
      }
    }
  } finally {
    refreshingIds.value.delete(account.id)
  }
}

const handleRefreshAll = async () => {
  const refreshableAccounts = accounts.value.filter(acc => canAutoRefresh(acc))
  
  if (refreshableAccounts.length === 0) {
    ElMessage.warning('没有支持自动刷新的账�?)
    return
  }

  try {
    await ElMessageBox.confirm(
      `将刷�?${refreshableAccounts.length} 个账号的 Token，是否继续？`,
      '批量刷新确认',
      {
        type: 'warning',
        confirmButtonText: '开始刷�?,
        cancelButtonText: '取消'
      }
    )

    refreshingAll.value = true

    const response = await axios.post('/api/token/refresh-all')
    
    if (response.data.success) {
      const { successCount, failedCount } = response.data
      
      // 重新加载账号列表（包含最新的额度数据�?
      await loadTokens()
      
      // 显示成功消息（明确提示额度已同步�?
      ElMessage.success(`刷新完成：成�?${successCount} 个，失败 ${failedCount} 个（额度数据已同步）`)
      
      // 如果有失败的，显示详�?
      if (failedCount > 0 && response.data.details) {
        const failedAccounts = response.data.details
          .filter((d: any) => !d.success)
          .map((d: any) => `${d.email}: ${d.error}`)
          .join('\n')
        
        ElMessageBox.alert(
          failedAccounts,
          `刷新失败的账�?(${failedCount})`,
          {
            type: 'warning',
            confirmButtonText: '知道�?
          }
        )
      }
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      const errorMsg = error.response?.data?.error || error.message || '批量刷新失败'
      ElMessage.error(errorMsg)
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
    await ElMessageBox.confirm(
      `将同�?${syncableAccounts.length} 个账号的使用量，是否继续？`,
      '批量同步确认',
      {
        type: 'info',
        confirmButtonText: '开始同�?,
        cancelButtonText: '取消'
      }
    )

    syncingAll.value = true

    const response = await axios.post('/api/token/sync-all-usage')
    
    if (response.data.success) {
      const { successCount, failedCount } = response.data
      ElMessage.success(`同步完成：成�?${successCount} 个，失败 ${failedCount} 个`)
      
      // 重新加载账号列表
      await loadTokens()
      
      // 如果有失败的，显示详�?
      if (failedCount > 0 && response.data.details) {
        const failedAccounts = response.data.details
          .filter((d: any) => !d.success)
          .map((d: any) => `${d.email}: ${d.error}`)
          .join('\n')
        
        ElMessageBox.alert(
          failedAccounts,
          `同步失败的账�?(${failedCount})`,
          {
            type: 'warning',
            confirmButtonText: '知道�?
          }
        )
      }
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      const errorMsg = error.response?.data?.error || error.message || '批量同步失败'
      ElMessage.error(errorMsg)
    }
  } finally {
    syncingAll.value = false
  }
}

const copyToken = async () => {
  if (!selectedToken.value) {
    ElMessage.warning('没有可复制的 Token')
    return
  }

  try {
    await navigator.clipboard.writeText(selectedToken.value)
    ElMessage.success('Access Token 已复制到剪贴�?)
  } catch (error) {
    // 备用方案
    const textarea = document.createElement('textarea')
    textarea.value = selectedToken.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('Access Token 已复制到剪贴�?)
  }
}

const copySsoToken = async () => {
  if (!selectedAccount.value?.sso_token) {
    ElMessage.warning('该账号没�?SSO Token')
    return
  }

  try {
    await navigator.clipboard.writeText(selectedAccount.value.sso_token)
    ElMessage.success('SSO Token (x_amz_sso_authn) 已复制到剪贴�?)
  } catch (error) {
    // 备用方案
    const textarea = document.createElement('textarea')
    textarea.value = selectedAccount.value.sso_token
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('SSO Token (x_amz_sso_authn) 已复制到剪贴�?)
  }
}

const canAutoRefresh = (account: Account): boolean => {
  return !!(account.refresh_token && account.client_id && account.client_secret)
}

const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    'active': 'success',
    'pending': 'warning',
    'failed': 'danger',
    'success': 'success'
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

// 表格选择处理
const handleSelectionChange = (selection: Account[]) => {
  selectedAccountIds.value = new Set(selection.map(acc => acc.id))
}

// 全�?
const selectAll = () => {
  selectedAccountIds.value = new Set(accounts.value.map(acc => acc.id))
  // 触发表格的全�?
  accounts.value.forEach(row => {
    tableRef.value?.toggleRowSelection(row, true)
  })
}

// 清除选择
const clearSelection = () => {
  selectedAccountIds.value.clear()
  tableRef.value?.clearSelection()
}

// 显示导出对话�?
const showExportDialog = () => {
  if (selectedAccountIds.value.size === 0) {
    ElMessage.warning('请先选择要导出的账号')
    return
  }
  showExport.value = true
}
</script>


