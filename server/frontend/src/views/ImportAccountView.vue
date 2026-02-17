<template>
  <div class="import-account-view">
    <div class="header">
      <h1>📥 导入账号</h1>
      <p class="subtitle">从 Kiro IDE 导出的 JSON 文件导入完整账号信息</p>
    </div>

    <div class="import-container">
      <!-- 导入方式选择 -->
      <div class="import-mode-tabs">
        <button 
          :class="['tab', { active: importMode === 'json' }]"
          @click="importMode = 'json'"
        >
          📄 JSON 导入（推荐）
        </button>
        <button 
          :class="['tab', { active: importMode === 'sso' }]"
          @click="importMode = 'sso'"
        >
          🔑 SSO Token
        </button>
      </div>

      <!-- JSON 导入模式 -->
      <div v-if="importMode === 'json'" class="import-section">
        <div class="info-box">
          <div class="info-icon">ℹ️</div>
          <div class="info-content">
            <h3>如何从 Kiro IDE 导出账号？</h3>
            <ol>
              <li>在 Kiro IDE 中打开"账号管理"</li>
              <li>选择要导出的账号</li>
              <li>点击"导出账号"按钮</li>
              <li>将导出的 JSON 内容粘贴到下方</li>
            </ol>
            <div class="feature-list">
              <div class="feature-item">✅ 完整的凭证信息（AccessToken, RefreshToken, ClientID, ClientSecret）</div>
              <div class="feature-item">✅ 订阅信息（类型、到期时间、剩余天数）</div>
              <div class="feature-item">✅ 使用量信息（当前使用、限额、百分比）</div>
              <div class="feature-item">✅ 奖励额度（Bonuses）</div>
              <div class="feature-item">✅ 支持自动刷新 Token</div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>账号 JSON 数据</label>
          <textarea
            v-model="jsonData"
            placeholder='粘贴从 Kiro IDE 导出的 JSON 数据...

示例格式：
{
  "version": "1.0",
  "exportedAt": 1234567890,
  "account": {
    "email": "user@example.com",
    "userId": "d-xxx",
    "credentials": { ... },
    "subscription": { ... },
    "usage": { ... }
  }
}'
            rows="15"
            class="json-input"
            @input="validateJson"
          ></textarea>
          <div v-if="jsonData" class="input-hint">
            <span>已输入 {{ jsonData.length }} 个字符</span>
            <span v-if="jsonValid === true" class="valid">✅ JSON 格式正确</span>
            <span v-else-if="jsonValid === false" class="invalid">❌ JSON 格式错误</span>
          </div>
        </div>

        <!-- JSON 预览 -->
        <div v-if="parsedData" class="preview-box">
          <h3>📋 导入预览</h3>
          <div class="preview-content">
            <div class="preview-row">
              <span class="label">邮箱:</span>
              <span class="value">{{ parsedData.account?.email || '未知' }}</span>
            </div>
            <div class="preview-row">
              <span class="label">用户ID:</span>
              <span class="value">{{ parsedData.account?.userId || '未提供' }}</span>
            </div>
            <div class="preview-row">
              <span class="label">昵称:</span>
              <span class="value">{{ parsedData.account?.nickname || '未提供' }}</span>
            </div>
            <div class="preview-row">
              <span class="label">IDP:</span>
              <span class="value">{{ parsedData.account?.idp || 'BuilderId' }}</span>
            </div>
            <div class="preview-row">
              <span class="label">订阅类型:</span>
              <span class="value">{{ parsedData.account?.subscription?.title || parsedData.account?.subscription?.type || '未知' }}</span>
            </div>
            <div class="preview-row">
              <span class="label">使用量:</span>
              <span class="value">{{ parsedData.account?.usage?.current || 0 }}/{{ parsedData.account?.usage?.limit || 0 }} ({{ parsedData.account?.usage?.percentUsed || 0 }}%)</span>
            </div>
            <div class="preview-row">
              <span class="label">RefreshToken:</span>
              <span class="value">{{ parsedData.account?.credentials?.refreshToken ? '✅ 有' : '❌ 无' }}</span>
            </div>
            <div class="preview-row">
              <span class="label">ClientID:</span>
              <span class="value">{{ parsedData.account?.credentials?.clientId ? '✅ 有' : '❌ 无' }}</span>
            </div>
            <div class="preview-row">
              <span class="label">ClientSecret:</span>
              <span class="value">{{ parsedData.account?.credentials?.clientSecret ? '✅ 有' : '❌ 无' }}</span>
            </div>
            <div class="preview-row">
              <span class="label">支持自动刷新:</span>
              <span class="value">{{ canAutoRefresh ? '✅ 是' : '❌ 否' }}</span>
            </div>
            <div v-if="parsedData.account?.usage?.bonuses && parsedData.account.usage.bonuses.length > 0" class="preview-row">
              <span class="label">奖励额度:</span>
              <span class="value">{{ parsedData.account.usage.bonuses.length }} 个</span>
            </div>
          </div>
        </div>

        <button 
          @click="importFromJson" 
          :disabled="!jsonData || !jsonValid || importing"
          class="btn-primary"
        >
          <span v-if="importing">⏳ 导入中...</span>
          <span v-else>✅ 导入账号</span>
        </button>
      </div>

      <!-- SSO Token 导入模式 -->
      <div v-if="importMode === 'sso'" class="import-section">
        <div class="info-box warning">
          <div class="info-icon">⚠️</div>
          <div class="info-content">
            <h3>注意：SSO Token 导入的限制</h3>
            <ul>
              <li>❌ 不包含 RefreshToken、ClientID、ClientSecret</li>
              <li>❌ 不支持自动刷新 Token</li>
              <li>❌ Token 过期后需要手动重新导入</li>
              <li>✅ 推荐使用"JSON 导入"方式获取完整功能</li>
            </ul>
          </div>
        </div>

        <div class="info-box">
          <div class="info-icon">ℹ️</div>
          <div class="info-content">
            <h3>如何获取 SSO Token？</h3>
            <ol>
              <li>在浏览器中访问并登录: <a href="https://view.awsapps.com/start" target="_blank">view.awsapps.com/start</a></li>
              <li>按 F12 打开开发者工具 → Application → Cookies</li>
              <li>找到并复制 <code>x-amz-sso_authn</code> 的值</li>
            </ol>
          </div>
        </div>

        <div class="form-group">
          <label>邮箱地址</label>
          <input
            v-model="ssoEmail"
            type="email"
            placeholder="user@example.com"
            class="text-input"
          />
        </div>

        <div class="form-group">
          <label>SSO Token (x-amz-sso_authn)</label>
          <textarea
            v-model="ssoToken"
            placeholder="粘贴 x-amz-sso_authn 的值..."
            rows="6"
            class="json-input"
          ></textarea>
        </div>

        <div class="form-group">
          <label>AWS Region</label>
          <select v-model="region" class="select-input">
            <option value="us-east-1">us-east-1 (N. Virginia)</option>
            <option value="us-west-2">us-west-2 (Oregon)</option>
            <option value="eu-west-1">eu-west-1 (Ireland)</option>
          </select>
        </div>

        <button 
          @click="importFromSso" 
          :disabled="!ssoEmail || !ssoToken || importing"
          class="btn-primary"
        >
          <span v-if="importing">⏳ 导入中...</span>
          <span v-else>✅ 导入账号</span>
        </button>
      </div>

      <!-- 导入结果 -->
      <div v-if="result" :class="['result-box', result.success ? 'success' : 'error']">
        <div class="result-icon">{{ result.success ? '✅' : '❌' }}</div>
        <div class="result-content">
          <h3>{{ result.success ? '导入成功' : '导入失败' }}</h3>
          <p>{{ result.message }}</p>
          <div v-if="result.account" class="account-info">
            <div class="info-row">
              <span class="label">邮箱:</span>
              <span class="value">{{ result.account.email }}</span>
            </div>
            <div v-if="result.account.userId" class="info-row">
              <span class="label">用户ID:</span>
              <span class="value">{{ result.account.userId }}</span>
            </div>
            <div v-if="result.account.nickname" class="info-row">
              <span class="label">昵称:</span>
              <span class="value">{{ result.account.nickname }}</span>
            </div>
            <div v-if="result.account.idp" class="info-row">
              <span class="label">IDP:</span>
              <span class="value">{{ result.account.idp }}</span>
            </div>
            <div v-if="result.account.subscription" class="info-row">
              <span class="label">订阅:</span>
              <span class="value">{{ result.account.subscription.title || result.account.subscription.type }}</span>
            </div>
            <div v-if="result.account.subscription?.daysRemaining !== undefined" class="info-row">
              <span class="label">剩余天数:</span>
              <span class="value">{{ result.account.subscription.daysRemaining }} 天</span>
            </div>
            <div v-if="result.account.usage" class="info-row">
              <span class="label">使用量:</span>
              <span class="value">{{ result.account.usage.current }}/{{ result.account.usage.limit }} ({{ result.account.usage.percentUsed }}%)</span>
            </div>
            <div class="info-row">
              <span class="label">自动刷新:</span>
              <span :class="['value', result.account.canAutoRefresh ? 'success' : 'warning']">
                {{ result.account.canAutoRefresh ? '✅ 支持' : '❌ 不支持' }}
              </span>
            </div>
          </div>
          <div v-if="result.success" class="action-buttons">
            <button @click="goToAccounts" class="btn-secondary">查看账号列表</button>
            <button @click="resetForm" class="btn-secondary">继续导入</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import '../styles/import-account-view.css'

const router = useRouter()

const importMode = ref<'json' | 'sso'>('json')
const jsonData = ref('')
const jsonValid = ref<boolean | null>(null)
const parsedData = ref<any>(null)
const ssoEmail = ref('')
const ssoToken = ref('')
const region = ref('us-east-1')
const importing = ref(false)
const result = ref<any>(null)

const canAutoRefresh = computed(() => {
  if (!parsedData.value?.account?.credentials) return false
  const cred = parsedData.value.account.credentials
  return !!(cred.refreshToken && cred.clientId && cred.clientSecret)
})

function validateJson() {
  try {
    if (!jsonData.value.trim()) {
      jsonValid.value = null
      parsedData.value = null
      return
    }
    
    const data = JSON.parse(jsonData.value)
    
    // 验证必填字段
    if (!data.account || !data.account.email || !data.account.credentials) {
      jsonValid.value = false
      parsedData.value = null
      return
    }
    
    jsonValid.value = true
    parsedData.value = data
  } catch (error) {
    jsonValid.value = false
    parsedData.value = null
  }
}

async function importFromJson() {
  if (!jsonData.value || !jsonValid.value) return
  
  importing.value = true
  result.value = null
  
  try {
    const data = JSON.parse(jsonData.value)
    
    const response = await axios.post('/api/token/import-from-app', data)
    
    result.value = {
      success: true,
      message: response.data.message || '账号导入成功',
      account: response.data.account
    }
    
    // 不清空输入，让用户可以看到导入的内容
  } catch (error: any) {
    console.error('导入失败:', error)
    result.value = {
      success: false,
      message: error.response?.data?.error || error.message || '导入失败'
    }
  } finally {
    importing.value = false
  }
}

async function importFromSso() {
  if (!ssoEmail.value || !ssoToken.value) return
  
  importing.value = true
  result.value = null
  
  try {
    const response = await axios.post('/api/token/submit', {
      email: ssoEmail.value,
      x_amz_sso_authn: ssoToken.value
    })
    
    result.value = {
      success: true,
      message: response.data.message || 'Token 绑定成功',
      account: {
        email: ssoEmail.value,
        canAutoRefresh: response.data.can_auto_refresh || false
      }
    }
    
    // 清空输入
    ssoEmail.value = ''
    ssoToken.value = ''
  } catch (error: any) {
    console.error('导入失败:', error)
    result.value = {
      success: false,
      message: error.response?.data?.error || error.message || '导入失败'
    }
  } finally {
    importing.value = false
  }
}

function resetForm() {
  jsonData.value = ''
  jsonValid.value = null
  parsedData.value = null
  result.value = null
}

function goToAccounts() {
  router.push('/accounts')
}
</script>


