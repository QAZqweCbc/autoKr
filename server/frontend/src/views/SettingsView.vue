<template>
  <div class="settings-view">
    <div class="header">
      <h1>⚙️ 设置</h1>
      <p class="subtitle">配置服务器和自动化功能</p>
    </div>

    <div class="settings-container">
      <!-- Token 自动刷新设置 -->
      <div class="settings-section">
        <div class="section-header">
          <h2>🔄 Token 自动刷新</h2>
          <p class="section-desc">自动刷新即将过期的账号 Token，保持账号活跃</p>
        </div>

        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">
                <span class="label-icon">🔄</span>
                <span class="label-text">启用自动刷新</span>
              </div>
              <p class="setting-desc">自动检测并刷新即将过期的 Token（需要账号有完整的 OAuth 凭证）</p>
            </div>
            <el-switch
              v-model="autoRefreshEnabled"
              size="large"
              :loading="saving"
              @change="saveAutoRefreshSettings"
            />
          </div>

          <div v-if="autoRefreshEnabled" class="setting-item">
            <div class="setting-info">
              <div class="setting-label">
                <span class="label-icon">⏱️</span>
                <span class="label-text">刷新间隔</span>
              </div>
              <p class="setting-desc">每隔多久检查一次 Token 是否需要刷新</p>
            </div>
            <el-select
              v-model="refreshInterval"
              size="large"
              style="width: 200px"
              @change="saveAutoRefreshSettings"
            >
              <el-option label="5 分钟" :value="5" />
              <el-option label="10 分钟" :value="10" />
              <el-option label="15 分钟" :value="15" />
              <el-option label="30 分钟" :value="30" />
              <el-option label="1 小时" :value="60" />
            </el-select>
          </div>

          <div v-if="autoRefreshEnabled" class="setting-item">
            <div class="setting-info">
              <div class="setting-label">
                <span class="label-icon">🚀</span>
                <span class="label-text">并发数量</span>
              </div>
              <p class="setting-desc">同时刷新的最大账号数量</p>
            </div>
            <el-input-number
              v-model="refreshConcurrency"
              :min="1"
              :max="100"
              size="large"
              @change="saveAutoRefreshSettings"
            />
          </div>

          <div class="refresh-status">
            <div class="status-item">
              <span class="status-label">上次刷新时间:</span>
              <span class="status-value">{{ lastRefreshTime || '从未刷新' }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">支持自动刷新的账号:</span>
              <span class="status-value">{{ refreshableAccounts }} 个</span>
            </div>
            <div class="status-item status-warning">
              <span class="status-label">⚠️ 被标记异常的账号:</span>
              <span class="status-value">{{ errorAccounts }} 个</span>
            </div>
          </div>

          <div class="action-buttons">
            <el-button
              type="primary"
              :loading="refreshing"
              @click="triggerManualRefresh"
            >
              <span v-if="!refreshing">🔄 立即刷新所有账号</span>
              <span v-else>刷新中...</span>
            </el-button>
            <el-button
              v-if="errorAccounts > 0"
              type="warning"
              :loading="resettingErrors"
              @click="handleResetErrors"
            >
              <span v-if="!resettingErrors">🔧 清除所有错误标记</span>
              <span v-else>清除中...</span>
            </el-button>
          </div>

          <el-alert
            v-if="errorAccounts > 0"
            type="warning"
            :closable="false"
            style="margin-top: 20px;"
          >
            <template #title>
              <div style="font-size: 14px;">
                <strong>⚠️ 账号异常提示</strong>
                <p style="margin: 8px 0 0 0;">
                  有 {{ errorAccounts }} 个账号因连续刷新失败被标记为异常，已暂停自动刷新。
                </p>
                <p style="margin: 4px 0 0 0; color: #666;">
                  💡 建议：检查账号凭证是否正确，然后点击"清除所有错误标记"重新启用自动刷新。
                </p>
              </div>
            </template>
          </el-alert>
        </div>
      </div>

      <!-- 数据库配置 -->
      <div class="settings-section">
        <div class="section-header">
          <h2>🗄️ 数据库配置</h2>
          <p class="section-desc">配置数据库连接信息</p>
        </div>

        <div class="settings-card">
          <el-alert
            type="warning"
            :closable="false"
            style="margin-bottom: 24px;"
          >
            <template #title>
              <strong>⚠️ 注意：</strong> 修改配置后需要重启服务器才能生效
            </template>
          </el-alert>

          <!-- 配置来源提示 -->
          <el-alert
            v-if="dbConfigSource && !editingDb"
            type="info"
            :closable="false"
            style="margin-bottom: 20px;"
          >
            <template #title>
              <div style="font-size: 14px;">
                <strong>📌 配置来源：</strong>
                <ul style="margin: 8px 0 0 20px; padding: 0;">
                  <li>存储类型: <el-tag size="small">{{ getSourceLabel(dbConfigSource.storage) }}</el-tag></li>
                  <li>MySQL: <el-tag size="small">{{ getSourceLabel(dbConfigSource.mysql) }}</el-tag></li>
                  <li>Redis: <el-tag size="small">{{ getSourceLabel(dbConfigSource.redis) }}</el-tag></li>
                </ul>
                <div style="margin-top: 8px; color: #606266;">
                  💡 优先级: 环境变量 > 配置文件 > 默认值
                </div>
              </div>
            </template>
          </el-alert>

          <!-- 配置概览 -->
          <div v-if="!editingDb" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h3 style="margin: 0;">当前配置</h3>
              <el-button type="primary" @click="editingDb = true">
                ✏️ 编辑配置
              </el-button>
            </div>

            <div style="display: grid; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="color: #6b7280; min-width: 100px;">存储模式:</span>
                <el-tag :type="dbConfig.storage === 'mysql' ? 'success' : 'info'">
                  {{ dbConfig.storage === 'mysql' ? 'MySQL 数据库' : dbConfig.storage === 'redis' ? 'Redis 存储' : 'JSON 文件' }}
                </el-tag>
              </div>

              <template v-if="dbConfig.storage === 'mysql'">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="color: #6b7280; min-width: 100px;">MySQL 地址:</span>
                  <span>{{ dbConfig.mysql.host }}:{{ dbConfig.mysql.port }}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="color: #6b7280; min-width: 100px;">用户/密码:</span>
                  <span style="font-family: monospace;">{{ dbConfig.mysql.user }} / {{ maskPassword(dbConfig.mysql.password) }}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="color: #6b7280; min-width: 100px;">数据库:</span>
                  <span>{{ dbConfig.mysql.database }}</span>
                </div>

                <template v-if="dbConfig.redis.host">
                  <el-divider />
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="color: #6b7280; min-width: 100px;">Redis 地址:</span>
                    <span>{{ dbConfig.redis.host }}:{{ dbConfig.redis.port }} (DB {{ dbConfig.redis.db }})</span>
                  </div>
                  <div v-if="dbConfig.redis.password" style="display: flex; align-items: center; gap: 12px;">
                    <span style="color: #6b7280; min-width: 100px;">密码:</span>
                    <span style="font-family: monospace;">{{ maskPassword(dbConfig.redis.password) }}</span>
                  </div>
                </template>
              </template>
            </div>
          </div>

          <!-- 配置编辑表单 -->
          <div v-else class="db-config-form">
            <!-- 存储模式 -->
            <div class="form-section">
              <label class="form-label">存储模式</label>
              <el-select v-model="dbForm.storage" size="large" style="width: 100%;">
                <el-option label="JSON 文件存储" value="json" />
                <el-option label="MySQL 数据库" value="mysql" />
                <el-option label="Redis 存储" value="redis" />
              </el-select>
            </div>

            <!-- JSON 模式提示 -->
            <template v-if="dbForm.storage === 'json'">
              <el-alert
                type="info"
                :closable="false"
                style="margin-top: 20px;"
              >
                <template #title>
                  <div style="font-size: 14px;">
                    <strong>📁 JSON 文件存储</strong>
                    <p style="margin: 8px 0 0 0;">数据将存储在本地 JSON 文件中，适合小规模使用和开发测试。</p>
                    <p style="margin: 4px 0 0 0; color: #666;">无需额外配置，开箱即用。</p>
                  </div>
                </template>
              </el-alert>
            </template>

            <!-- MySQL 配置 -->
            <template v-if="dbForm.storage === 'mysql'">
              <div class="form-row">
                <div class="form-section">
                  <label class="form-label">主机地址</label>
                  <el-input
                    v-model="dbForm.mysql.host"
                    placeholder="192.168.226.128"
                    size="large"
                  />
                </div>
                <div class="form-section">
                  <label class="form-label">端口</label>
                  <el-input-number
                    v-model="dbForm.mysql.port"
                    :min="1"
                    :max="65535"
                    size="large"
                    style="width: 100%;"
                    :controls="false"
                  />
                </div>
              </div>

              <div class="form-section">
                <label class="form-label">数据库名</label>
                <el-input
                  value="KrioServer"
                  disabled
                  size="large"
                />
              </div>

              <div class="form-row">
                <div class="form-section">
                  <label class="form-label">用户名</label>
                  <el-input
                    v-model="dbForm.mysql.user"
                    placeholder="admin"
                    size="large"
                  />
                </div>
                <div class="form-section">
                  <label class="form-label">密码</label>
                  <el-input
                    v-model="dbForm.mysql.password"
                    type="password"
                    placeholder="••••••••"
                    show-password
                    size="large"
                  />
                </div>
              </div>

              <div class="form-actions">
                <el-button
                  type="primary"
                  size="large"
                  :loading="testingMySQL"
                  @click="handleTestMySQL"
                >
                  测试连接
                </el-button>
              </div>
            </template>

            <!-- Redis 独立存储模式 -->
            <template v-if="dbForm.storage === 'redis'">
              <div class="form-row">
                <div class="form-section">
                  <label class="form-label">主机地址</label>
                  <el-input
                    v-model="dbForm.redis.host"
                    placeholder="192.168.226.128"
                    size="large"
                  />
                </div>
                <div class="form-section">
                  <label class="form-label">端口</label>
                  <el-input-number
                    v-model="dbForm.redis.port"
                    :min="1"
                    :max="65535"
                    size="large"
                    style="width: 100%;"
                    :controls="false"
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-section">
                  <label class="form-label">密码（可选）</label>
                  <el-input
                    v-model="dbForm.redis.password"
                    type="password"
                    placeholder="••••••••"
                    show-password
                    size="large"
                  />
                </div>
                <div class="form-section">
                  <label class="form-label">数据库编号</label>
                  <el-input-number
                    v-model="dbForm.redis.db"
                    :min="0"
                    :max="15"
                    size="large"
                    style="width: 100%;"
                    :controls="false"
                  />
                </div>
              </div>

              <div class="form-actions">
                <el-button
                  type="primary"
                  size="large"
                  :loading="testingRedis"
                  @click="handleTestRedis"
                >
                  测试连接
                </el-button>
              </div>
            </template>

            <!-- 操作按钮 -->
            <div class="form-actions" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1;">
              <el-button
                type="success"
                size="large"
                :loading="savingDb"
                @click="handleSaveDb"
              >
                保存配置
              </el-button>
              <el-button size="large" @click="handleCancelDb">
                取消
              </el-button>
            </div>
          </div>

          <!-- 使用说明 -->
          <el-alert
            type="info"
            :closable="false"
            style="margin-top: 30px;"
          >
            <template #title>
              <div style="font-size: 14px;">
                <strong>📖 配置说明</strong>
                <ul style="margin: 8px 0 0 20px; padding: 0;">
                  <li><strong>JSON 模式:</strong> 数据存储在本地文件，适合小规模使用</li>
                  <li><strong>MySQL 模式:</strong> 数据存储在 MySQL 数据库，支持高并发和大数据量</li>
                  <li><strong>Redis 模式:</strong> 数据存储在 Redis，适合高性能场景</li>
                  <li><strong>环境变量:</strong> 敏感信息（密码）建议使用环境变量配置</li>
                  <li><strong>配置文件:</strong> 位于 server/config/database.config.json</li>
                </ul>
              </div>
            </template>
          </el-alert>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDatabaseConfig, saveDatabaseConfig, testConnection, type DatabaseConfig, type ConfigSource } from '../api/databaseConfig'
import '../styles/settings-view.css'

// Token 自动刷新设置
const autoRefreshEnabled = ref(false)
const refreshInterval = ref(30)
const refreshConcurrency = ref(10)
const lastRefreshTime = ref('')
const refreshableAccounts = ref(0)
const errorAccounts = ref(0)
const refreshing = ref(false)
const saving = ref(false)
const resettingErrors = ref(false)

// 数据库配置
const editingDb = ref(false)
const savingDb = ref(false)
const testingMySQL = ref(false)
const testingRedis = ref(false)
const dbConfigSource = ref<ConfigSource | null>(null)

// 保存原始密码（用于测试连接）
const originalPasswords = ref({
  mysql: '',
  redis: ''
})

const dbConfig = ref<DatabaseConfig>({
  storage: 'json',
  mysql: {
    host: '',
    port: 3306,
    user: '',
    password: '',
    database: 'KrioServer'
  },
  redis: {
    host: '',
    port: 6379,
    password: '',
    db: 0
  }
})

const dbForm = ref<DatabaseConfig>({
  storage: 'json',
  mysql: {
    host: '',
    port: 3306,
    user: '',
    password: '',
    database: 'KrioServer'
  },
  redis: {
    host: '',
    port: 6379,
    password: '',
    db: 0
  }
})

// 加载自动刷新设置
async function loadAutoRefreshSettings() {
  try {
    const response = await axios.get('/api/config/auto-refresh')
    if (response.data.success) {
      autoRefreshEnabled.value = response.data.enabled
      refreshInterval.value = response.data.interval || 30
      refreshConcurrency.value = response.data.concurrency || 10
      lastRefreshTime.value = response.data.lastRefreshTime || ''
    }
  } catch (error) {
    console.error('加载自动刷新设置失败:', error)
  }
}

// 加载可刷新账号数量
async function loadRefreshableAccounts() {
  try {
    const response = await axios.get('/api/accounts')
    if (response.data.success) {
      const accounts = response.data.accounts
      
      // 统计有完整 OAuth 凭证的账号
      refreshableAccounts.value = accounts.filter(
        (acc: any) => acc.refresh_token && acc.client_id && acc.client_secret
      ).length
      
      // 统计被标记异常的账号（连续失败次数 >= 3）
      errorAccounts.value = accounts.filter(
        (acc: any) => (acc.consecutive_failures || 0) >= 3
      ).length
    }
  } catch (error) {
    console.error('加载账号信息失败:', error)
  }
}

// 保存自动刷新设置
async function saveAutoRefreshSettings() {
  saving.value = true
  try {
    const response = await axios.post('/api/config/auto-refresh', {
      enabled: autoRefreshEnabled.value,
      interval: refreshInterval.value,
      concurrency: refreshConcurrency.value
    })
    
    if (response.data.success) {
      ElMessage.success('自动刷新设置已保存')
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

// 手动触发刷新
async function triggerManualRefresh() {
  refreshing.value = true
  try {
    const response = await axios.post('/api/token/refresh-all')
    
    if (response.data.success) {
      ElMessage.success(`刷新完成：成功 ${response.data.success} 个，失败 ${response.data.failed} 个`)
      lastRefreshTime.value = new Date().toLocaleString('zh-CN')
      // 重新加载账号统计
      await loadRefreshableAccounts()
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '刷新失败')
  } finally {
    refreshing.value = false
  }
}

// 清除所有错误标记
async function handleResetErrors() {
  try {
    await ElMessageBox.confirm(
      `确定要清除所有账号的错误标记吗？这将重新启用 ${errorAccounts.value} 个账号的自动刷新。`,
      '确认清除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    resettingErrors.value = true
    
    // 获取所有被标记异常的账号ID
    const accountsResponse = await axios.get('/api/accounts')
    if (!accountsResponse.data.success) {
      throw new Error('获取账号列表失败')
    }
    
    const errorAccountIds = accountsResponse.data.accounts
      .filter((acc: any) => (acc.consecutive_failures || 0) >= 3)
      .map((acc: any) => acc.id)
    
    if (errorAccountIds.length === 0) {
      ElMessage.info('没有需要清除的错误标记')
      return
    }
    
    // 批量重置错误状态
    const response = await axios.post('/api/accounts/reset-errors', {
      accountIds: errorAccountIds
    })
    
    if (response.data.success) {
      ElMessage.success(`✅ 已清除 ${response.data.count} 个账号的错误标记`)
      // 重新加载账号统计
      await loadRefreshableAccounts()
    } else {
      throw new Error(response.data.error || '清除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || error.message || '清除失败')
    }
  } finally {
    resettingErrors.value = false
  }
}

// 数据库配置相关函数
async function loadDatabaseConfig() {
  try {
    const data = await getDatabaseConfig()
    if (data.success && data.config) {
      dbConfig.value = data.config
      dbForm.value = JSON.parse(JSON.stringify(data.config))
      dbConfigSource.value = data.source || null
    }
  } catch (error) {
    console.error('加载数据库配置失败:', error)
  }
}

const getSourceLabel = (source: string) => {
  const labels: Record<string, string> = {
    'env': '环境变量',
    'file': '配置文件',
    'default': '默认值'
  }
  return labels[source] || source
}

const maskPassword = (password: string) => {
  if (!password) return '未设置'
  if (password.length <= 3) return '***'
  return password.substring(0, 3) + '*'.repeat(Math.min(password.length - 3, 8))
}

const handleTestMySQL = async () => {
  testingMySQL.value = true
  try {
    let result
    
    // 如果密码是脱敏的，使用后端的 test-current API（使用配置文件中的真实密码）
    if (dbForm.value.mysql.password === '******') {
      const { data } = await axios.post('/api/database/test-current', { type: 'mysql' })
      result = data
    } else {
      // 否则使用前端提供的配置测试
      result = await testConnection('mysql', dbForm.value.mysql)
    }
    
    if (result.success) {
      ElMessage.success(result.message || 'MySQL 连接成功')
    } else {
      ElMessage.error(result.error || 'MySQL 连接失败')
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || error.message || 'MySQL 连接测试失败')
  } finally {
    testingMySQL.value = false
  }
}

const handleTestRedis = async () => {
  testingRedis.value = true
  try {
    let result
    
    // 如果密码是脱敏的，使用后端的 test-current API（使用配置文件中的真实密码）
    if (dbForm.value.redis.password === '******') {
      const { data } = await axios.post('/api/database/test-current', { type: 'redis' })
      result = data
    } else {
      // 否则使用前端提供的配置测试
      result = await testConnection('redis', dbForm.value.redis)
    }
    
    if (result.success) {
      ElMessage.success(result.message || 'Redis 连接成功')
    } else {
      ElMessage.error(result.error || 'Redis 连接失败')
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || error.message || 'Redis 连接测试失败')
  } finally {
    testingRedis.value = false
  }
}

const handleSaveDb = async () => {
  savingDb.value = true
  try {
    // 保存原始密码（用于后续测试连接）
    if (dbForm.value.mysql.password && dbForm.value.mysql.password !== '******') {
      originalPasswords.value.mysql = dbForm.value.mysql.password
    }
    if (dbForm.value.redis.password && dbForm.value.redis.password !== '******') {
      originalPasswords.value.redis = dbForm.value.redis.password
    }
    
    const result = await saveDatabaseConfig(dbForm.value)
    if (result.success) {
      // 检查是否进行了热重载
      const reloadInfo = (result as any).reload
      let message = result.message || '配置保存成功'
      
      if (reloadInfo?.reloaded) {
        message = `✅ 配置已保存并自动切换存储模式！\n\n从 ${reloadInfo.oldStorage.toUpperCase()} 切换到 ${reloadInfo.newStorage.toUpperCase()}\n\n无需重启服务器，更改已立即生效。`
      } else if (reloadInfo?.error) {
        message = `⚠️ 配置已保存，但热重载失败：\n\n${reloadInfo.error}\n\n请手动重启服务器使配置生效。`
      }
      
      ElMessageBox.alert(
        message,
        reloadInfo?.reloaded ? '🎉 热重载成功' : '保存成功',
        {
          confirmButtonText: '确定',
          type: reloadInfo?.error ? 'warning' : 'success',
          dangerouslyUseHTMLString: false
        }
      )
      dbConfig.value = JSON.parse(JSON.stringify(dbForm.value))
      editingDb.value = false
    } else {
      ElMessage.error(result.error || '保存失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingDb.value = false
  }
}

const handleCancelDb = () => {
  dbForm.value = JSON.parse(JSON.stringify(dbConfig.value))
  editingDb.value = false
}

onMounted(() => {
  loadAutoRefreshSettings()
  loadRefreshableAccounts()
  loadDatabaseConfig()
})
</script>


