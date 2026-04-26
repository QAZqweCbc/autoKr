<template>
  <div class="database-config-view">
    <el-card>
      <template #header>
        <span style="font-weight: 600;">数据库配置</span>
      </template>

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
        v-if="configSource && !editing"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #title>
          <div style="font-size: 14px;">
            <strong>📌 配置来源：</strong>
            <ul style="margin: 8px 0 0 20px; padding: 0;">
              <li>存储类型: <el-tag size="small">{{ getSourceLabel(configSource.storage) }}</el-tag></li>
              <li>MySQL: <el-tag size="small">{{ getSourceLabel(configSource.mysql) }}</el-tag></li>
              <li>Redis: <el-tag size="small">{{ getSourceLabel(configSource.redis) }}</el-tag></li>
            </ul>
            <div style="margin-top: 8px; color: #606266;">
              💡 优先级: 环境变量 > 配置文件 > 默认值
            </div>
          </div>
        </template>
      </el-alert>

      <!-- 配置概览 -->
      <div v-if="!editing" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">当前配置</h3>
          <el-button type="primary" @click="editing = true">
            ✏️ 编辑配置
          </el-button>
        </div>

        <div style="display: grid; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="color: #6b7280; min-width: 100px;">存储模式:</span>
            <el-tag :type="currentConfig.storage === 'mysql' ? 'success' : 'info'">
              {{ currentConfig.storage === 'mysql' ? 'MySQL 数据库' : 'JSON 文件' }}
            </el-tag>
          </div>

          <template v-if="currentConfig.storage === 'mysql'">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="color: #6b7280; min-width: 100px;">MySQL 地址:</span>
              <span>{{ currentConfig.mysql.host }}:{{ currentConfig.mysql.port }}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="color: #6b7280; min-width: 100px;">用户/密码:</span>
              <span style="font-family: monospace;">{{ currentConfig.mysql.user }} / {{ maskPassword(currentConfig.mysql.password) }}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="color: #6b7280; min-width: 100px;">数据库:</span>
              <span>{{ currentConfig.mysql.database }}</span>
            </div>

            <template v-if="currentConfig.redis.host">
              <el-divider />
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="color: #6b7280; min-width: 100px;">Redis 地址:</span>
                <span>{{ currentConfig.redis.host }}:{{ currentConfig.redis.port }} (DB {{ currentConfig.redis.db }})</span>
              </div>
              <div v-if="currentConfig.redis.password" style="display: flex; align-items: center; gap: 12px;">
                <span style="color: #6b7280; min-width: 100px;">密码:</span>
                <span style="font-family: monospace;">{{ maskPassword(currentConfig.redis.password) }}</span>
              </div>
            </template>
          </template>
        </div>
      </div>

      <!-- 配置编辑表单 -->
      <div v-else>
        <el-form :model="form" label-width="140px">
          <el-form-item label="存储模式">
            <el-select v-model="form.storage" @change="handleStorageChange">
              <el-option label="JSON 文件存储" value="json" />
              <el-option label="MySQL 数据库" value="mysql" />
              <el-option label="Redis 存储" value="redis" />
            </el-select>
          </el-form-item>

          <!-- MySQL 配置 -->
          <template v-if="form.storage === 'mysql'">
            <el-divider />
            <h3 style="margin: 20px 0 15px 0; color: #667eea;">MySQL 配置</h3>

            <el-form-item label="主机地址">
              <el-input
                v-model="form.mysql.host"
                placeholder="192.168.226.128"
                style="max-width: 400px;"
              />
            </el-form-item>

            <el-form-item label="端口">
              <el-input-number
                v-model="form.mysql.port"
                :min="1"
                :max="65535"
                style="width: 200px;"
              />
            </el-form-item>

            <el-form-item label="用户名">
              <el-input
                v-model="form.mysql.user"
                placeholder="admin"
                style="max-width: 400px;"
              />
            </el-form-item>

            <el-form-item label="密码">
              <el-input
                v-model="form.mysql.password"
                type="password"
                placeholder="密码"
                show-password
                style="max-width: 400px;"
              />
            </el-form-item>

            <el-alert
              type="info"
              :closable="false"
              style="margin-bottom: 20px;"
            >
              <strong>📌 数据库名称:</strong> KrioServer (固定，自动创建)
            </el-alert>

            <el-button
              type="primary"
              :loading="testingMySQL"
              @click="handleTestMySQL"
            >
              🔍 测试 MySQL 连接
            </el-button>

            <!-- Redis 配置 -->
            <el-divider />
            <h3 style="margin: 20px 0 15px 0; color: #667eea;">Redis 配置（可选）</h3>

            <el-form-item label="主机地址">
              <el-input
                v-model="form.redis.host"
                placeholder="192.168.226.128"
                style="max-width: 400px;"
              />
            </el-form-item>

            <el-form-item label="端口">
              <el-input-number
                v-model="form.redis.port"
                :min="1"
                :max="65535"
                style="width: 200px;"
              />
            </el-form-item>

            <el-form-item label="密码（可选）">
              <el-input
                v-model="form.redis.password"
                type="password"
                placeholder="密码"
                show-password
                style="max-width: 400px;"
              />
            </el-form-item>

            <el-form-item label="数据库编号">
              <el-input-number
                v-model="form.redis.db"
                :min="0"
                :max="15"
                style="width: 200px;"
              />
            </el-form-item>

            <el-button
              type="primary"
              :loading="testingRedis"
              @click="handleTestRedis"
            >
              🔍 测试 Redis 连接
            </el-button>
          </template>

          <el-divider />

          <el-form-item>
            <el-button
              type="success"
              :loading="saving"
              @click="handleSave"
            >
              💾 保存配置
            </el-button>
            <el-button @click="handleCancel">
              ❌ 取消
            </el-button>
          </el-form-item>
        </el-form>
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
              <li><strong>重要:</strong> 修改配置后必须重启服务器才能生效</li>
            </ul>
          </div>
        </template>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDatabaseConfig, saveDatabaseConfig, testConnection, type DatabaseConfig, type ConfigSource } from '../api/databaseConfig'
import '../styles/database-config-view.css'

const editing = ref(false)
const saving = ref(false)
const testingMySQL = ref(false)
const testingRedis = ref(false)
const configSource = ref<ConfigSource | null>(null)

const currentConfig = ref<DatabaseConfig>({
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

const form = ref<DatabaseConfig>({
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

onMounted(async () => {
  try {
    const data = await getDatabaseConfig()
    if (data.success && data.config) {
      currentConfig.value = data.config
      form.value = JSON.parse(JSON.stringify(data.config))
      configSource.value = data.source || null
    }
  } catch (error) {
    console.error('加载配置失败:', error)
  }
})

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

const handleStorageChange = () => {
  // 存储模式改变时的处理
}

const handleTestMySQL = async () => {
  testingMySQL.value = true
  try {
    const result = await testConnection('mysql', form.value.mysql)
    if (result.success) {
      ElMessage.success(result.message || 'MySQL 连接成功')
    } else {
      ElMessage.error(result.error || 'MySQL 连接失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || 'MySQL 连接测试失败')
  } finally {
    testingMySQL.value = false
  }
}

const handleTestRedis = async () => {
  testingRedis.value = true
  try {
    const result = await testConnection('redis', form.value.redis)
    if (result.success) {
      ElMessage.success(result.message || 'Redis 连接成功')
    } else {
      ElMessage.error(result.error || 'Redis 连接失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || 'Redis 连接测试失败')
  } finally {
    testingRedis.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    const result = await saveDatabaseConfig(form.value)
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
      currentConfig.value = JSON.parse(JSON.stringify(form.value))
      editing.value = false
    } else {
      ElMessage.error(result.error || '保存失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const handleCancel = () => {
  form.value = JSON.parse(JSON.stringify(currentConfig.value))
  editing.value = false
}
</script>


