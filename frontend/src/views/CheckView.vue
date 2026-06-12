<template>
  <div class="check-view">
    <el-card>
      <template #header>
        <span style="font-weight: 600;">基本检测</span>
      </template>

      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 24px;"
      >
        检测 IP 状态、AWS 连接、邮箱服务和域名信誉度
      </el-alert>

      <!-- 代理设置 -->
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <el-form-item label="代理地址（可选）" label-width="140px">
          <el-input
            v-model="proxyUrl"
            placeholder="http://127.0.0.1:7890"
            style="max-width: 400px;"
          />
          <div style="color: #6b7280; font-size: 13px; margin-top: 8px;">
            留空则使用直连，填写则通过代理检测
          </div>
        </el-form-item>

        <el-button
          type="primary"
          :loading="checking"
          @click="handleCheck"
        >
          🛡️ 开始检测
        </el-button>
      </div>

      <!-- 检测结果 -->
      <div v-if="checkResult" style="margin-bottom: 20px;">
        <el-row :gutter="20">
          <!-- IP 信息 -->
          <el-col :span="12">
            <el-card shadow="hover">
              <template #header>
                <span style="color: #667eea; font-weight: 600;">🌐 IP 信息</span>
              </template>
              <div class="info-item">
                <span class="label">当前 IP</span>
                <span class="value">{{ checkResult.ip }}</span>
              </div>
              <div class="info-item">
                <span class="label">位置</span>
                <span class="value">{{ formatLocation(checkResult.location) }}</span>
              </div>
              <div class="info-item">
                <span class="label">ISP</span>
                <span class="value">{{ checkResult.location.isp }}</span>
              </div>
            </el-card>
          </el-col>

          <!-- AWS 连接 -->
          <el-col :span="12">
            <el-card shadow="hover">
              <template #header>
                <span style="color: #667eea; font-weight: 600;">☁️ AWS 连接</span>
              </template>
              <div class="info-item">
                <span class="label">状态</span>
                <el-tag :type="checkResult.aws.accessible ? 'success' : 'danger'">
                  {{ checkResult.aws.accessible ? '✓ 可访问' : '✗ 受限' }}
                </el-tag>
              </div>
              <div class="info-item">
                <span class="label">延迟</span>
                <span class="value">{{ checkResult.aws.latency }} ms</span>
              </div>
              <div class="info-item">
                <span class="label">风险等级</span>
                <el-tag :type="getAwsLevelType(checkResult.aws.level)">
                  {{ getAwsLevelText(checkResult.aws.level) }}
                </el-tag>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="20" style="margin-top: 20px;">
          <!-- 邮箱服务 -->
          <el-col :span="12">
            <el-card shadow="hover">
              <template #header>
                <span style="color: #667eea; font-weight: 600;">📧 邮箱服务</span>
              </template>
              <div class="info-item">
                <span class="label">QQ邮箱</span>
                <el-tag :type="checkResult.qqEmail.accessible ? 'success' : 'danger'">
                  {{ checkResult.qqEmail.accessible ? '✓ 连接成功' : '✗ 连接失败' }}
                </el-tag>
              </div>
              <div class="info-item">
                <span class="label">延迟</span>
                <span class="value">{{ checkResult.qqEmail.latency }} ms</span>
              </div>
            </el-card>
          </el-col>

          <!-- IP 信誉 -->
          <el-col :span="12">
            <el-card shadow="hover">
              <template #header>
                <span style="color: #667eea; font-weight: 600;">🎯 IP 信誉</span>
              </template>
              <div class="info-item">
                <span class="label">评分</span>
                <span :style="{ color: getScoreColor(checkResult.reputation.score), fontWeight: 600, fontSize: '18px' }">
                  {{ checkResult.reputation.score }}/100
                </span>
              </div>
              <div class="info-item">
                <span class="label">风险因素</span>
                <span :style="{ color: checkResult.reputation.blacklist.length > 0 ? '#ef4444' : '#10b981' }">
                  {{ checkResult.reputation.blacklist.length > 0 ? checkResult.reputation.blacklist.join(', ') : '✓ 无风险' }}
                </span>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 综合判定 -->
        <el-card shadow="hover" style="margin-top: 20px;">
          <template #header>
            <span style="color: #667eea; font-weight: 600; font-size: 18px;">📊 综合判定</span>
          </template>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 10px;" :style="{ color: getVerdictColor(checkResult.verdict) }">
            {{ getVerdictText(checkResult.verdict) }}
          </div>
          <div style="color: #6b7280; line-height: 1.6;">
            {{ checkResult.suggestion }}
          </div>
        </el-card>
      </div>

      <!-- 检测日志 -->
      <el-card shadow="hover" style="margin-top: 20px;">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600;">📋 检测日志</span>
            <el-button
              :icon="CopyDocument"
              size="small"
              @click="copyLogs"
            >
              复制
            </el-button>
          </div>
        </template>
        <div class="log-container">
          {{ checkLogs || '等待开始检测...' }}
        </div>
      </el-card>
    </el-card>

    <!-- 检测历史 -->
    <el-card style="margin-top: 24px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600;">📜 检测历史</span>
          <div style="display: flex; gap: 10px;">
            <el-button
              :icon="Refresh"
              size="small"
              @click="loadHistory"
            >
              刷新
            </el-button>
            <el-button
              :icon="Delete"
              size="small"
              type="danger"
              @click="handleClearHistory"
            >
              清空历史
            </el-button>
          </div>
        </div>
      </template>

      <!-- 统计信息 -->
      <el-row :gutter="15" style="margin-bottom: 20px;">
        <el-col :span="4">
          <div class="stat-box">
            <div class="stat-label">总检测</div>
            <div class="stat-value" style="color: #667eea;">{{ stats.total }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-box">
            <div class="stat-label">安全</div>
            <div class="stat-value" style="color: #10b981;">{{ stats.safe }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-box">
            <div class="stat-label">警告</div>
            <div class="stat-value" style="color: #f59e0b;">{{ stats.warning }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-box">
            <div class="stat-label">风险</div>
            <div class="stat-value" style="color: #f59e0b;">{{ stats.risky }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-box">
            <div class="stat-label">拉黑</div>
            <div class="stat-value" style="color: #ef4444;">{{ stats.blocked }}</div>
          </div>
        </el-col>
      </el-row>

      <!-- 记录列表 -->
      <div v-if="records.length > 0">
        <div
          v-for="(record, index) in records"
          :key="index"
          class="record-card"
        >
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <div>
              <div style="font-weight: 600; margin-bottom: 4px;">{{ record.result.ip }}</div>
              <div style="font-size: 13px; color: #6b7280;">{{ formatDate(record.timestamp) }}</div>
            </div>
            <div style="text-align: right;">
              <el-tag :type="getVerdictTagType(record.result.verdict)">
                {{ getVerdictText(record.result.verdict) }}
              </el-tag>
              <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
                代理: {{ record.proxyUrl || '直连' }}
              </div>
            </div>
          </div>
          <el-row :gutter="12" style="font-size: 13px;">
            <el-col :span="8">
              <span style="color: #6b7280;">位置:</span>
              <span style="margin-left: 4px;">{{ formatLocation(record.result.location) }}</span>
            </el-col>
            <el-col :span="8">
              <span style="color: #6b7280;">AWS:</span>
              <span :style="{ color: record.result.aws.accessible ? '#10b981' : '#ef4444', fontWeight: 600, marginLeft: '4px' }">
                {{ record.result.aws.accessible ? '✓ 可访问' : '✗ 受限' }} ({{ record.result.aws.latency }}ms)
              </span>
            </el-col>
            <el-col :span="8">
              <span style="color: #6b7280;">信誉:</span>
              <span :style="{ color: getScoreColor(record.result.reputation.score), fontWeight: 600, marginLeft: '4px' }">
                {{ record.result.reputation.score }}/100
              </span>
            </el-col>
          </el-row>
        </div>
      </div>
      <el-empty v-else description="暂无检测记录" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Refresh, Delete } from '@element-plus/icons-vue'
import { startCheck, getCheckRecords, getCheckStats, clearCheckHistory, type CheckResult, type CheckRecord } from '../api/check'
import '../styles/check-view.css'

const proxyUrl = ref('')
const checking = ref(false)
const checkResult = ref<CheckResult | null>(null)
const checkLogs = ref('')
const records = ref<CheckRecord[]>([])
const stats = ref({
  total: 0,
  safe: 0,
  warning: 0,
  risky: 0,
  blocked: 0
})

onMounted(() => {
  loadHistory()
  loadStats()
})

const handleCheck = async () => {
  checking.value = true
  checkLogs.value = '开始检测...\n'
  checkResult.value = null

  try {
    const result = await startCheck(proxyUrl.value || undefined)
    
    if (result.success && result.result) {
      checkResult.value = result.result
      if (result.logs) {
        checkLogs.value = result.logs.join('\n')
      }
      ElMessage.success('检测完成')
      loadHistory()
      loadStats()
    } else {
      checkLogs.value += '\n✗ 检测失败: ' + (result.error || '未知错误')
      ElMessage.error(result.error || '检测失败')
    }
  } catch (error: any) {
    checkLogs.value += '\n✗ 检测出错: ' + error.message
    ElMessage.error(error.message || '检测失败')
  } finally {
    checking.value = false
  }
}

const loadHistory = async () => {
  try {
    const data = await getCheckRecords(20)
    if (data.success) {
      records.value = data.records
    }
  } catch (error) {
    console.error('加载检测记录失败:', error)
  }
}

const loadStats = async () => {
  try {
    const data = await getCheckStats()
    if (data.success) {
      stats.value = data.stats
    }
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

const handleClearHistory = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有检测历史记录吗？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const data = await clearCheckHistory()
    if (data.success) {
      ElMessage.success('检测历史已清空')
      loadHistory()
      loadStats()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '清空失败')
    }
  }
}

const copyLogs = async () => {
  try {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(checkLogs.value)
      ElMessage.success('已复制到剪贴板')
    } else {
      // 备用方案：使用传统的 execCommand
      const textarea = document.createElement('textarea')
      textarea.value = checkLogs.value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      
      if (success) {
        ElMessage.success('已复制到剪贴板')
      } else {
        ElMessage.error('复制失败，请手动复制')
      }
    }
  } catch (error) {
    // 最后的备用方案
    try {
      const textarea = document.createElement('textarea')
      textarea.value = checkLogs.value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      ElMessage.success('已复制到剪贴板')
    } catch (e) {
      ElMessage.error('复制失败，请手动复制')
    }
  }
}

const formatLocation = (location: any) => {
  const parts = [location.country, location.region, location.city].filter(p => p && p !== '未知')
  return parts.length > 0 ? parts.join(' ') : '-'
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

const getAwsLevelType = (level: string) => {
  const types: Record<string, any> = {
    normal: 'success',
    captcha: 'warning',
    rate_limit: 'warning',
    blocked: 'danger'
  }
  return types[level] || 'info'
}

const getAwsLevelText = (level: string) => {
  const texts: Record<string, string> = {
    normal: '✓ 正常',
    captcha: '⚠ 验证码',
    rate_limit: '⚠ 限流',
    blocked: '✗ 拉黑'
  }
  return texts[level] || level
}

const getScoreColor = (score: number) => {
  if (score >= 70) return '#10b981'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

const getVerdictColor = (verdict: string) => {
  const colors: Record<string, string> = {
    safe: '#10b981',
    warning: '#f59e0b',
    risky: '#f59e0b',
    blocked: '#ef4444'
  }
  return colors[verdict] || '#6b7280'
}

const getVerdictText = (verdict: string) => {
  const texts: Record<string, string> = {
    safe: '✓ 安全 - 可以正常使用',
    warning: '⚠ 警告 - 建议谨慎使用',
    risky: '⚠ 风险 - 不建议使用',
    blocked: '✗ 拉黑 - 禁止使用'
  }
  return texts[verdict] || verdict
}

const getVerdictTagType = (verdict: string) => {
  const types: Record<string, any> = {
    safe: 'success',
    warning: 'warning',
    risky: 'warning',
    blocked: 'danger'
  }
  return types[verdict] || 'info'
}
</script>


