<template>
  <div class="dashboard-view page-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">
        <span class="title-icon">📊</span>
        <span class="text-gradient">仪表盘</span>
      </h1>
      <p class="page-subtitle">系统概览与实时监控</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <StatsCard title="总任务数" :value="stats.totalTasks" icon="📝" />
      <StatsCard title="运行中" :value="stats.runningTasks" color="#3b82f6" icon="⚡" />
      <StatsCard title="总账号数" :value="stats.totalAccounts" color="#10b981" icon="👥" />
      <StatsCard title="活跃账号" :value="stats.activeAccounts" color="#f59e0b" icon="✨" />
    </div>

    <!-- 图表区域 - 上下布局 -->
    <!-- 域名分布饼图 -->
    <el-card class="gradient-card chart-card" style="margin-top: 24px;">
      <template #header>
        <div class="card-header">
          <span class="header-title">📧 邮箱域名分布</span>
          <el-tag v-if="domainStats.length > 0" type="info" size="small">
            {{ domainStats.length }} 个域名
          </el-tag>
        </div>
      </template>
      <div class="chart-container">
        <v-chart 
          ref="domainChartRef"
          v-if="domainChartOption" 
          :option="domainChartOption" 
          style="height: clamp(300px, 50vh, 380px); width: 100%;"
          autoresize
        />
        <el-empty 
          v-else 
          description="暂无数据,创建账号后将显示域名分布" 
          :image-size="100"
        >
          <el-button type="primary" @click="router.push('/accounts')">
            立即生成账号
          </el-button>
        </el-empty>
      </div>
    </el-card>

    <!-- 每日注册趋势图 -->
    <el-card class="gradient-card chart-card" style="margin-top: 24px;">
      <template #header>
        <div class="card-header">
          <span class="header-title">📈 每日注册趋势（最近7天）</span>
          <el-tag v-if="dailyStats.length > 0" type="success" size="small">
            {{ dailyStats.length }} 条记录
          </el-tag>
        </div>
      </template>
      <div class="chart-container">
        <v-chart 
          ref="dailyChartRef"
          v-if="dailyChartOption" 
          :option="dailyChartOption" 
          style="height: clamp(300px, 50vh, 380px); width: 100%;"
          autoresize
        />
        <el-empty 
          v-else 
          description="暂无数据,创建账号后将显示注册趋势" 
          :image-size="100"
        >
          <el-button type="primary" @click="router.push('/accounts')">
            立即生成账号
          </el-button>
        </el-empty>
      </div>
    </el-card>

    <!-- 快速操作 -->
    <el-card class="gradient-card" style="margin-top: 24px;">
      <template #header>
        <div class="card-header">
          <span class="header-title">快速操作</span>
        </div>
      </template>

      <div class="quick-actions">
        <el-button
          type="primary"
          class="btn-gradient action-btn"
          size="large"
          @click="router.push('/accounts')"
        >
          <span class="btn-icon">🎲</span>
          <span>生成账号</span>
        </el-button>
        <el-button
          type="primary"
          class="btn-gradient action-btn"
          size="large"
          @click="router.push('/tasks')"
        >
          <span class="btn-icon">📝</span>
          <span>创建任务</span>
        </el-button>
        <el-button
          type="primary"
          class="btn-gradient action-btn"
          size="large"
          @click="router.push('/check')"
        >
          <span class="btn-icon">🛡️</span>
          <span>基本检测</span>
        </el-button>
        <el-button
          type="primary"
          class="btn-gradient action-btn"
          size="large"
          @click="router.push('/token')"
        >
          <span class="btn-icon">🔑</span>
          <span>查看Token</span>
        </el-button>
      </div>
    </el-card>

    <!-- 最近任务 -->
    <el-card class="gradient-card" style="margin-top: 24px;">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="header-title">最近任务</span>
            <el-tag type="info" size="large">{{ recentTasks.length }} 条</el-tag>
          </div>
          <el-button type="primary" text @click="router.push('/tasks')">
            查看全部 →
          </el-button>
        </div>
      </template>

      <el-table
        v-if="recentTasks.length > 0"
        :data="recentTasks"
        stripe
        class="enhanced-table"
        style="width: 100%;"
      >
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-else description="暂无任务" />
    </el-card>

    <!-- 系统状态 -->
    <el-row :gutter="24" style="margin-top: 24px;">
      <el-col :xs="24" :sm="24" :md="12">
        <el-card class="gradient-card">
          <template #header>
            <span class="header-title">服务状态</span>
          </template>
          <div class="status-list">
            <div class="status-item">
              <span class="status-label">WebSocket</span>
              <el-tag :type="wsConnected ? 'success' : 'danger'">
                {{ wsConnected ? '✓ 已连接' : '✗ 断开' }}
              </el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">数据库</span>
              <el-tag type="success">✓ 正常</el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">邮箱服务</span>
              <el-tag type="success">✓ 正常</el-tag>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="12">
        <el-card class="gradient-card">
          <template #header>
            <span class="header-title">快速链接</span>
          </template>
          <div class="quick-links">
            <router-link to="/email" class="quick-link">
              <span class="link-icon">📧</span>
              <span>邮箱配置</span>
            </router-link>
            <router-link to="/browser" class="quick-link">
              <span class="link-icon">🌐</span>
              <span>浏览器配置</span>
            </router-link>
            <router-link to="/config" class="quick-link">
              <span class="link-icon">⚙️</span>
              <span>数据库配置</span>
            </router-link>
            <router-link to="/logs" class="quick-link">
              <span class="link-icon">📊</span>
              <span>实时日志</span>
            </router-link>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useWebSocketStore } from '../stores/websocket'
import StatsCard from '../components/StatsCard.vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import '../styles/dashboard-view.css'

// 注册 ECharts 组件
use([
  CanvasRenderer,
  PieChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

const router = useRouter()
const wsStore = useWebSocketStore()
const { connected: wsConnected } = storeToRefs(wsStore)

let unsubscribeTask: (() => void) | null = null
let unsubscribeAccount: (() => void) | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

// 图表引用
const domainChartRef = ref<InstanceType<typeof VChart> | null>(null)
const dailyChartRef = ref<InstanceType<typeof VChart> | null>(null)

const stats = ref({
  totalTasks: 0,
  runningTasks: 0,
  totalAccounts: 0,
  activeAccounts: 0
})

const recentTasks = ref<any[]>([])
const domainStats = ref<Array<{ domain: string; count: number }>>([])
const dailyStats = ref<Array<{ date: string; total: number; domain: string }>>([])

// 监听侧边栏状态变化，重新调整图表大小
const handleSidebarToggle = () => {
  nextTick(() => {
    if (domainChartRef.value) {
      domainChartRef.value.resize()
    }
    if (dailyChartRef.value) {
      dailyChartRef.value.resize()
    }
  })
}

// 监听窗口大小变化
const handleResize = () => {
  if (domainChartRef.value) {
    domainChartRef.value.resize()
  }
  if (dailyChartRef.value) {
    dailyChartRef.value.resize()
  }
}

onMounted(async () => {
  await loadStats()
  await loadRecentTasks()
  await loadDomainStats()
  await loadDailyStats()
  
  // 注册WebSocket监听器
  unsubscribeTask = wsStore.onTaskUpdate(() => {
    scheduleRefresh()
  })
  
  unsubscribeAccount = wsStore.onAccountUpdate(() => {
    scheduleRefresh()
  })

  // 监听侧边栏状态变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        handleSidebarToggle()
      }
    })
  })

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  })

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)

  // 清理函数
  onUnmounted(() => {
    observer.disconnect()
    window.removeEventListener('resize', handleResize)
  })
})

onUnmounted(() => {
  // 清理监听器
  if (unsubscribeTask) {
    unsubscribeTask()
  }
  if (unsubscribeAccount) {
    unsubscribeAccount()
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }
})

// 域名分布饼图配置
const domainChartOption = computed(() => {
  if (domainStats.value.length === 0) return null
  
  // 精心挑选的渐变色方案
  const colors = [
    { start: '#667eea', end: '#764ba2' },
    { start: '#f093fb', end: '#f5576c' },
    { start: '#4facfe', end: '#00f2fe' },
    { start: '#43e97b', end: '#38f9d7' },
    { start: '#fa709a', end: '#fee140' },
    { start: '#30cfd0', end: '#330867' }
  ]
  
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#1e293b',
        fontSize: 14
      },
      padding: [10, 15],
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;'
    },
    legend: {
      orient: 'vertical',
      right: 20,
      top: 'center',
      itemGap: 16,
      itemWidth: 14,
      itemHeight: 14,
      textStyle: {
        color: '#475569',
        fontSize: 14,
        fontWeight: 500
      },
      formatter: (name: string) => {
        const item = domainStats.value.find(d => d.domain === name)
        return `${name}  ${item?.count || 0}`
      }
    },
    series: [
      {
        name: '域名分布',
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 3
        },
        label: {
          show: true,
          formatter: '{d}%',
          fontSize: 14,
          fontWeight: 'bold',
          color: '#1e293b'
        },
        labelLine: {
          show: true,
          length: 15,
          length2: 10,
          lineStyle: {
            color: '#cbd5e1',
            width: 2
          }
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold'
          },
          itemStyle: {
            shadowBlur: 20,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          }
        },
        data: domainStats.value.map((item, index) => {
          const colorScheme = colors[index % colors.length]!
          return {
            name: item.domain,
            value: item.count,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: colorScheme.start },
                  { offset: 1, color: colorScheme.end }
                ]
              }
            }
          }
        })
      }
    ]
  }
})

// 每日注册趋势图配置
const dailyChartOption = computed(() => {
  // 生成最近7天的日期列表
  const generateLast7Days = () => {
    const dates = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }
    return dates
  }
  
  const allDates = generateLast7Days()
  
  // 按日期分组
  const dateMap = new Map<string, Map<string, number>>()
  const domains = new Set<string>()
  
  dailyStats.value.forEach(item => {
    const date = item.date?.split('T')[0] // 提取日期部分
    if (!date) return
    if (!dateMap.has(date)) {
      dateMap.set(date, new Map())
    }
    dateMap.get(date)!.set(item.domain, item.total)
    domains.add(item.domain)
  })
  
  // 构建系列数据
  const series: any[] = []
  
  // 总计系列 - 面积图
  series.push({
    name: '总计',
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 8,
    lineStyle: {
      width: 3,
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 1,
        y2: 0,
        colorStops: [
          { offset: 0, color: '#667eea' },
          { offset: 1, color: '#764ba2' }
        ]
      }
    },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
          { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
        ]
      }
    },
    emphasis: {
      focus: 'series'
    },
    data: allDates.map(date => {
      if (!date) return 0
      const domainMap = dateMap.get(date)
      if (!domainMap) return 0
      return Array.from(domainMap.values()).reduce((sum, val) => sum + val, 0)
    })
  })
  
  // 各域名系列 - 普通折线图（使用渐变色）
  const colorSchemes = [
    ['#10b981', '#059669'],
    ['#f59e0b', '#d97706'],
    ['#ef4444', '#dc2626'],
    ['#8b5cf6', '#7c3aed'],
    ['#06b6d4', '#0891b2'],
    ['#ec4899', '#db2777']
  ]
  let colorIndex = 0
  
  domains.forEach(domain => {
    const colors = colorSchemes[colorIndex % colorSchemes.length]!
    colorIndex++
    
    series.push({
      name: domain,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        width: 2,
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 1,
          y2: 0,
          colorStops: [
            { offset: 0, color: colors[0] },
            { offset: 1, color: colors[1] }
          ]
        }
      },
      emphasis: {
        focus: 'series'
      },
      data: allDates.map(date => {
        if (!date) return 0
        const domainMap = dateMap.get(date)
        return domainMap?.get(domain) || 0
      })
    })
  })
  
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#1e293b',
        fontSize: 14
      },
      padding: [10, 15],
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#cbd5e1'
        },
        lineStyle: {
          color: '#cbd5e1',
          type: 'dashed'
        }
      }
    },
    legend: {
      data: ['总计', ...Array.from(domains)],
      top: 10,
      left: 'center',
      itemGap: 20,
      itemWidth: 14,
      itemHeight: 14,
      textStyle: {
        color: '#475569',
        fontSize: 13,
        fontWeight: 500
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '5%',
      top: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: allDates.map(date => {
        if (!date) return ''
        // 格式化日期为 MM-DD
        const d = new Date(date)
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }),
      axisLine: {
        lineStyle: {
          color: '#cbd5e1'
        }
      },
      axisLabel: {
        color: '#64748b',
        fontSize: 12
      },
      axisTick: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: {
        show: false
      },
      axisLabel: {
        color: '#64748b',
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: '#f1f5f9',
          type: 'dashed'
        }
      }
    },
    series
  }
})

// 防抖刷新函数
const scheduleRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }
  refreshTimer = setTimeout(async () => {
    await loadStats()
    await loadRecentTasks()
    await loadDomainStats()
    await loadDailyStats()
  }, 1000) // 1秒防抖
}

onMounted(async () => {
  await loadStats()
  await loadRecentTasks()
  await loadDomainStats()
  await loadDailyStats()
  
  // 注册WebSocket监听器
  unsubscribeTask = wsStore.onTaskUpdate(() => {
    scheduleRefresh()
  })
  
  unsubscribeAccount = wsStore.onAccountUpdate(() => {
    scheduleRefresh()
  })
})

onUnmounted(() => {
  // 清理监听器
  if (unsubscribeTask) {
    unsubscribeTask()
  }
  if (unsubscribeAccount) {
    unsubscribeAccount()
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }
})

const loadStats = async () => {
  try {
    // 加载任务统计
    const tasksRes = await fetch('/api/tasks/stats')
    const tasksData = await tasksRes.json()
    if (tasksData.success) {
      stats.value.totalTasks = tasksData.stats.total || 0
      stats.value.runningTasks = tasksData.stats.running || 0
    }

    // 加载账号统计
    const accountsRes = await fetch('/api/accounts')
    const accountsData = await accountsRes.json()
    if (accountsData.success) {
      stats.value.totalAccounts = accountsData.accounts?.length || 0
      stats.value.activeAccounts = accountsData.accounts?.filter((a: any) => a.status === 'active').length || 0
    }
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

const loadRecentTasks = async () => {
  try {
    const res = await fetch('/api/tasks')
    const data = await res.json()
    if (data.success) {
      recentTasks.value = (data.tasks || []).slice(0, 5)
    }
  } catch (error) {
    console.error('加载最近任务失败:', error)
  }
}

const loadDomainStats = async () => {
  try {
    const res = await fetch('/api/accounts/stats/domain')
    const data = await res.json()
    if (data.success) {
      domainStats.value = data.stats || []
    }
  } catch (error) {
    console.error('加载域名统计失败:', error)
  }
}

const loadDailyStats = async () => {
  try {
    const res = await fetch('/api/accounts/stats/daily?days=7')
    const data = await res.json()
    if (data.success) {
      dailyStats.value = data.stats || []
    }
  } catch (error) {
    console.error('加载每日统计失败:', error)
  }
}

const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    pending: 'warning',
    running: 'primary',
    success: 'success',
    failed: 'danger'
  }
  return types[status] || 'info'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '待处理',
    running: '运行中',
    success: '已成功',
    failed: '已失败'
  }
  return texts[status] || status
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>


