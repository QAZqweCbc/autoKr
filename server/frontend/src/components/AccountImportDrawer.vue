<template>
  <el-drawer
    :model-value="modelValue"
    title="文字导入"
    size="720px"
    destroy-on-close
    @close="handleClose"
  >
    <div class="import-drawer">
      <el-alert type="info" :closable="false" class="import-tip">
        通过文字粘贴导入账号凭证，支持完整 JSON 导入和 SSO Token 导入。
      </el-alert>

      <el-tabs v-model="importMode" class="import-tabs">
        <el-tab-pane label="文字导入（推荐）" name="json">
          <div class="import-section">
            <el-alert type="success" :closable="false" class="import-hint">
              <template #title>
                <div class="hint-title">如何从 Kiro IDE 导出账号</div>
                <ol class="hint-list">
                  <li>在 Kiro IDE 中打开“账号管理”</li>
                  <li>选择需要导出的账号</li>
                  <li>点击“导出账号”按钮</li>
                  <li>将导出的 JSON 内容粘贴到下方文本框</li>
                </ol>
              </template>
            </el-alert>

            <el-form label-position="top">
              <el-form-item label="账号 JSON 数据">
                <el-input
                  v-model="jsonData"
                  type="textarea"
                  :rows="14"
                  resize="vertical"
                  placeholder="粘贴从 Kiro IDE 导出的 JSON 数据"
                  @input="validateJson"
                />
                <div v-if="jsonData" class="field-status">
                  <span>已输入 {{ jsonData.length }} 个字符</span>
                  <el-tag v-if="jsonValid === true" type="success" size="small">JSON 格式正确</el-tag>
                  <el-tag v-else-if="jsonValid === false" type="danger" size="small">JSON 格式错误</el-tag>
                </div>
              </el-form-item>
            </el-form>

            <el-card v-if="parsedData" shadow="never" class="preview-card">
              <template #header>
                <span>导入预览</span>
              </template>
              <div class="preview-grid">
                <div><span class="preview-label">邮箱</span><span>{{ parsedData.account?.email || '未知' }}</span></div>
                <div><span class="preview-label">用户 ID</span><span>{{ parsedData.account?.userId || '-' }}</span></div>
                <div><span class="preview-label">昵称</span><span>{{ parsedData.account?.nickname || '-' }}</span></div>
                <div><span class="preview-label">订阅</span><span>{{ parsedData.account?.subscription?.title || parsedData.account?.subscription?.type || '-' }}</span></div>
                <div><span class="preview-label">使用量</span><span>{{ parsedUsageText }}</span></div>
                <div><span class="preview-label">自动刷新</span><span>{{ canAutoRefresh ? '支持' : '不支持' }}</span></div>
              </div>
            </el-card>

            <div class="drawer-actions">
              <el-button type="primary" :loading="importing" :disabled="!jsonData || !jsonValid" @click="importFromJson">
                导入账号
              </el-button>
              <el-button @click="resetJsonForm">清空文本</el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="SSO Token" name="sso">
          <div class="import-section">
            <el-alert type="warning" :closable="false" class="import-hint">
              <template #title>
                <div class="hint-title">SSO Token 导入限制</div>
                <ul class="hint-list">
                  <li>不包含 Refresh Token、Client ID、Client Secret</li>
                  <li>不支持自动刷新 Token</li>
                  <li>Token 过期后需要重新导入</li>
                </ul>
              </template>
            </el-alert>

            <el-form label-position="top">
              <el-form-item label="邮箱地址">
                <el-input v-model="ssoEmail" placeholder="user@example.com" />
              </el-form-item>
              <el-form-item label="SSO Token">
                <el-input
                  v-model="ssoToken"
                  type="textarea"
                  :rows="7"
                  resize="vertical"
                  placeholder="粘贴 x-amz-sso_authn 的值"
                />
              </el-form-item>
              <el-form-item label="区域">
                <el-select v-model="region" style="width: 100%;">
                  <el-option label="us-east-1 (N. Virginia)" value="us-east-1" />
                  <el-option label="us-west-2 (Oregon)" value="us-west-2" />
                  <el-option label="eu-west-1 (Ireland)" value="eu-west-1" />
                </el-select>
              </el-form-item>
            </el-form>

            <div class="drawer-actions">
              <el-button type="primary" :loading="importing" :disabled="!ssoEmail || !ssoToken" @click="importFromSso">
                绑定 Token
              </el-button>
              <el-button @click="resetSsoForm">清空文本</el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <el-result
        v-if="result"
        :icon="result.success ? 'success' : 'error'"
        :title="result.success ? '导入成功' : '导入失败'"
        :sub-title="result.message"
        class="result-card"
      >
        <template #extra>
          <el-button v-if="result.success" type="primary" @click="handleImported">刷新 Token 列表</el-button>
          <el-button @click="clearResult">关闭结果</el-button>
        </template>
      </el-result>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import axios from 'axios'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  imported: []
}>()

const importMode = ref<'json' | 'sso'>('json')
const jsonData = ref('')
const jsonValid = ref<boolean | null>(null)
const parsedData = ref<any>(null)
const ssoEmail = ref('')
const ssoToken = ref('')
const region = ref('us-east-1')
const importing = ref(false)
const result = ref<{ success: boolean; message: string } | null>(null)

const canAutoRefresh = computed(() => {
  const credentials = parsedData.value?.account?.credentials
  return !!(credentials?.refreshToken && credentials?.clientId && credentials?.clientSecret)
})

const parsedUsageText = computed(() => {
  const usage = parsedData.value?.account?.usage
  if (!usage) return '-'
  return `${usage.current || 0}/${usage.limit || 0} (${usage.percentUsed || 0}%)`
})

const handleClose = () => {
  emit('update:modelValue', false)
}

const validateJson = () => {
  try {
    if (!jsonData.value.trim()) {
      jsonValid.value = null
      parsedData.value = null
      return
    }

    const data = JSON.parse(jsonData.value)
    if (!data.account || !data.account.email || !data.account.credentials) {
      jsonValid.value = false
      parsedData.value = null
      return
    }

    jsonValid.value = true
    parsedData.value = data
  } catch {
    jsonValid.value = false
    parsedData.value = null
  }
}

const importFromJson = async () => {
  if (!jsonData.value || !jsonValid.value) return

  importing.value = true
  result.value = null

  try {
    const payload = JSON.parse(jsonData.value)
    const response = await axios.post('/api/token/import-from-app', payload)
    result.value = {
      success: true,
      message: response.data.message || '账号导入成功'
    }
  } catch (error: any) {
    result.value = {
      success: false,
      message: error.response?.data?.error || error.message || '账号导入失败'
    }
  } finally {
    importing.value = false
  }
}

const importFromSso = async () => {
  if (!ssoEmail.value || !ssoToken.value) return

  importing.value = true
  result.value = null

  try {
    const response = await axios.post('/api/token/submit', {
      email: ssoEmail.value,
      x_amz_sso_authn: ssoToken.value,
      region: region.value
    })
    result.value = {
      success: true,
      message: response.data.message || 'Token 绑定成功'
    }
  } catch (error: any) {
    result.value = {
      success: false,
      message: error.response?.data?.error || error.message || 'Token 绑定失败'
    }
  } finally {
    importing.value = false
  }
}

const resetJsonForm = () => {
  jsonData.value = ''
  jsonValid.value = null
  parsedData.value = null
}

const resetSsoForm = () => {
  ssoEmail.value = ''
  ssoToken.value = ''
  region.value = 'us-east-1'
}

const clearResult = () => {
  result.value = null
}

const handleImported = () => {
  emit('imported')
  clearResult()
  emit('update:modelValue', false)
}
</script>

<style scoped>
.import-drawer {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.import-tip,
.import-hint,
.preview-card,
.result-card {
  margin-bottom: 0;
}

.hint-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.hint-list {
  margin: 0;
  padding-left: 18px;
  line-height: 1.8;
}

.field-status {
  width: 100%;
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-secondary);
  font-size: 12px;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
}

.preview-grid > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.drawer-actions {
  display: flex;
  gap: 12px;
}

@media (max-width: 767px) {
  .preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
