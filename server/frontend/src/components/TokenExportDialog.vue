<template>
  <el-dialog
    v-model="visible"
    title="导出 Token"
    width="600px"
    :before-close="handleClose"
  >
    <el-form label-width="100px">
      <!-- 导出范围 -->
      <el-form-item label="导出范围">
        <el-tag type="info">已选择 {{ selectedCount }} 个账号</el-tag>
      </el-form-item>

      <!-- 导出格式 -->
      <el-form-item label="导出格式">
        <el-radio-group v-model="exportFormat">
          <el-radio value="aiclient2api">
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 600;">AIClient2API 格式</span>
              <span style="font-size: 12px; color: #909399;">
                标准 OAuth 凭据格式，兼容 AIClient2API
              </span>
            </div>
          </el-radio>
          <el-radio value="json" style="margin-top: 12px;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 600;">JSON 自定义格式</span>
              <span style="font-size: 12px; color: #909399;">
                选择需要导出的字段
              </span>
            </div>
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 自定义字段选择 -->
      <el-form-item v-if="exportFormat === 'json'" label="导出字段">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <el-checkbox-group v-model="selectedFields">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <el-checkbox label="email">邮箱</el-checkbox>
              <el-checkbox label="password">密码</el-checkbox>
              <el-checkbox label="access_token">Access Token</el-checkbox>
              <el-checkbox label="refresh_token">Refresh Token</el-checkbox>
              <el-checkbox label="csrf_token">CSRF Token</el-checkbox>
              <el-checkbox label="sso_token">SSO Token</el-checkbox>
              <el-checkbox label="client_id">Client ID</el-checkbox>
              <el-checkbox label="client_secret">Client Secret</el-checkbox>
              <el-checkbox label="region">区域</el-checkbox>
              <el-checkbox label="expires_at">过期时间</el-checkbox>
              <el-checkbox label="subscription_type">订阅类型</el-checkbox>
              <el-checkbox label="usage_current">当前用量</el-checkbox>
              <el-checkbox label="usage_limit">用量限制</el-checkbox>
              <el-checkbox label="status">状态</el-checkbox>
              <el-checkbox label="nickname">昵称</el-checkbox>
              <el-checkbox label="user_id">用户ID</el-checkbox>
            </div>
          </el-checkbox-group>
          <el-button size="small" @click="selectAllFields">全选</el-button>
        </div>
      </el-form-item>

      <!-- 过滤选项 -->
      <el-form-item label="过滤选项">
        <el-checkbox v-model="onlyWithToken">仅导出有 Token 的账号</el-checkbox>
        <el-checkbox v-model="includeExpired">包含已过期的 Token</el-checkbox>
      </el-form-item>

      <!-- AIClient2API 格式说明 -->
      <el-alert
        v-if="exportFormat === 'aiclient2api'"
        type="info"
        :closable="false"
        style="margin-top: 16px;"
      >
        <template #title>
          <div style="font-size: 13px;">
            <strong>AIClient2API 格式说明</strong>
            <ul style="margin: 8px 0 0 20px; padding: 0;">
              <li>包含完整的 OAuth 凭据信息</li>
              <li>可直接导入到支持 AIClient2API 的工具</li>
              <li>包含字段: email, access_token, refresh_token, client_id, client_secret, region 等</li>
            </ul>
          </div>
        </template>
      </el-alert>
    </el-form>

    <template #footer>
      <div style="display: flex; justify-content: space-between;">
        <el-button @click="handleClose">取消</el-button>
        <div style="display: flex; gap: 12px;">
          <el-button
            type="primary"
            :icon="CopyDocument"
            :loading="copying"
            @click="handleCopy"
          >
            复制到剪贴板
          </el-button>
          <el-button
            type="success"
            :icon="Download"
            :loading="downloading"
            @click="handleDownload"
          >
            下载文件
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Download } from '@element-plus/icons-vue'
import axios from 'axios'

interface Props {
  modelValue: boolean
  selectedAccountIds: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const selectedCount = computed(() => props.selectedAccountIds.length)

// 导出格式
const exportFormat = ref<'aiclient2api' | 'json'>('aiclient2api')
const selectedFields = ref<string[]>([
  'email',
  'access_token',
  'refresh_token',
  'client_id',
  'client_secret',
  'region'
])
const onlyWithToken = ref(true)
const includeExpired = ref(false)

// 操作状态
const copying = ref(false)
const downloading = ref(false)

// 全选字段
const selectAllFields = () => {
  selectedFields.value = [
    'email',
    'password',
    'access_token',
    'refresh_token',
    'csrf_token',
    'sso_token',
    'client_id',
    'client_secret',
    'region',
    'expires_at',
    'subscription_type',
    'usage_current',
    'usage_limit',
    'status',
    'nickname',
    'user_id'
  ]
}

// 获取导出数据
const getExportData = async (): Promise<string> => {
  const requestData: any = {
    accountIds: props.selectedAccountIds,
    format: exportFormat.value,
    onlyWithToken: onlyWithToken.value,
    includeExpired: includeExpired.value
  }

  // JSON 格式需要传递字段配置
  if (exportFormat.value === 'json') {
    const fields: Record<string, boolean> = {}
    selectedFields.value.forEach(field => {
      fields[field] = true
    })
    requestData.fields = fields
  }

  const response = await axios.post('/api/accounts/export-tokens', requestData, {
    responseType: 'text'
  })

  return response.data
}

// 复制到剪贴板
const handleCopy = async () => {
  if (selectedCount.value === 0) {
    ElMessage.warning('请先选择要导出的账号')
    return
  }

  if (exportFormat.value === 'json' && selectedFields.value.length === 0) {
    ElMessage.warning('请至少选择一个导出字段')
    return
  }

  try {
    copying.value = true
    const data = await getExportData()

    await navigator.clipboard.writeText(data)
    ElMessage.success('已复制到剪贴板')
    handleClose()
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || '复制失败'
    ElMessage.error(errorMsg)
  } finally {
    copying.value = false
  }
}

// 下载文件
const handleDownload = async () => {
  if (selectedCount.value === 0) {
    ElMessage.warning('请先选择要导出的账号')
    return
  }

  if (exportFormat.value === 'json' && selectedFields.value.length === 0) {
    ElMessage.warning('请至少选择一个导出字段')
    return
  }

  try {
    downloading.value = true
    const data = await getExportData()

    // 创建 Blob 并下载
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const prefix = exportFormat.value === 'aiclient2api' ? 'aiclient2api-tokens' : 'tokens'
    link.download = `${prefix}_${selectedCount.value}_${timestamp}.json`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    ElMessage.success('文件下载成功')
    handleClose()
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || '下载失败'
    ElMessage.error(errorMsg)
  } finally {
    downloading.value = false
  }
}

const handleClose = () => {
  visible.value = false
}

// 监听格式变化，自动选择默认字段
watch(exportFormat, (newFormat) => {
  if (newFormat === 'json' && selectedFields.value.length === 0) {
    selectedFields.value = [
      'email',
      'access_token',
      'refresh_token',
      'client_id',
      'client_secret',
      'region'
    ]
  }
})
</script>
