<template>
  <div class="user-management-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <div>
        <h2 style="margin: 0;">用户管理</h2>
        <p style="margin: 8px 0 0 0; color: #909399; font-size: 14px;">
          管理用户申请、配额和Token分配
        </p>
      </div>
      <el-button type="danger" @click="logout">
        退出登录
      </el-button>
    </div>

    <!-- AWS账户统计 -->
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <el-icon :size="24"><Document /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ accountStats.total }}</div>
              <div class="stat-label">总账户数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <el-icon :size="24"><CircleCheck /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ accountStats.available }}</div>
              <div class="stat-label">可分配账户</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
              <el-icon :size="24"><Link /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ accountStats.assigned }}</div>
              <div class="stat-label">已分配账户</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
              <el-icon :size="24"><Warning /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ accountStats.unavailable }}</div>
              <div class="stat-label">不可用账户</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Token额度信息条 -->
    <div v-if="accountStats.tokens" class="token-info-bar">
      <div class="info-item">
        <span class="info-label">AWS Access Token 额度统计</span>
      </div>
      <div class="info-item">
        <span class="info-label">总额度:</span>
        <span class="info-value">{{ formatNumber(accountStats.tokens.total) }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">已使用:</span>
        <span class="info-value warning">{{ formatNumber(accountStats.tokens.used) }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">可用额度:</span>
        <span class="info-value success">{{ formatNumber(accountStats.tokens.available) }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">使用率:</span>
        <span class="info-value" :class="getUsageClass(accountStats.tokens.usagePercent)">
          {{ accountStats.tokens.usagePercent }}%
        </span>
      </div>
    </div>

    <!-- AWS账户详细列表 -->
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: 600;">AWS账户详细列表</span>
            <el-tag type="info" size="small" style="margin-left: 12px;">
              共 {{ accountDetails.length }} 个账户
            </el-tag>
          </div>
          <el-button
            :icon="Refresh"
            :loading="loading"
            @click="loadAccountDetails"
          >
            刷新
          </el-button>
        </div>
      </template>

      <el-table
        v-if="accountDetails.length > 0"
        :data="accountDetails"
        stripe
        style="width: 100%;"
      >
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column label="Token额度" width="220">
          <template #default="{ row }">
            <div v-if="row.usage_limit && row.usage_limit > 0">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 12px; color: #606266;">
                  {{ formatNumber(row.usage_current) }} / {{ formatNumber(row.usage_limit) }}
                </span>
                <span style="font-size: 12px; color: #909399;">
                  ({{ row.usage_percent }}%)
                </span>
              </div>
              <el-progress
                :percentage="row.usage_percent"
                :color="getProgressColor(row.usage_percent)"
                :stroke-width="6"
              />
            </div>
            <span v-else style="color: #909399; font-size: 12px;">无额度数据</span>
          </template>
        </el-table-column>
        <el-table-column label="可用状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.usage_percent < 85 && row.usage_limit > 0 ? 'success' : 'danger'"
              size="small"
            >
              {{ row.usage_percent < 85 && row.usage_limit > 0 ? '可用' : '不可用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分配状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="row.allocation_status === 'available'"
              type="success"
              size="small"
            >
              可分配
            </el-tag>
            <el-tag
              v-else-if="row.allocation_status === 'assigned'"
              type="primary"
              size="small"
            >
              已分配
            </el-tag>
            <el-tooltip
              v-else
              :content="getUnavailableReason(row)"
              placement="top"
            >
              <el-tag
                type="info"
                size="small"
              >
                不可分配
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="分配给" min-width="150">
          <template #default="{ row }">
            <span v-if="row.assigned_username" style="color: #409eff;">
              {{ row.assigned_username }}
            </span>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="订阅类型" width="120">
          <template #default="{ row }">
            <el-tag
              v-if="row.subscription_type"
              :type="row.subscription_type === 'Free' ? 'info' : 'success'"
              size="small"
            >
              {{ row.subscription_type }}
            </el-tag>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-else
        description="暂无账户数据"
        :image-size="100"
      />
    </el-card>

    <!-- 待审批申请 -->
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: 600;">待审批申请</span>
            <el-tag type="warning" size="small" style="margin-left: 12px;">
              {{ pendingRequests.length }} 个待处理
            </el-tag>
          </div>
          <el-button
            :icon="Refresh"
            :loading="loading"
            @click="loadPendingRequests"
          >
            刷新
          </el-button>
        </div>
      </template>

      <el-table
        v-if="pendingRequests.length > 0"
        :data="pendingRequests"
        stripe
        style="width: 100%;"
      >
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column label="申请时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.requested_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              type="success"
              size="small"
              :loading="approving === row.id"
              @click="handleApprove(row.id)"
            >
              批准
            </el-button>
            <el-button
              type="danger"
              size="small"
              :loading="rejecting === row.id"
              @click="handleReject(row.id)"
            >
              拒绝
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-else
        description="暂无待审批申请"
        :image-size="100"
      />
    </el-card>

    <!-- 用户列表 -->
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: 600;">用户列表</span>
            <el-tag type="info" size="small" style="margin-left: 12px;">
              共 {{ users.length }} 个用户
            </el-tag>
          </div>
          <el-button
            :icon="Refresh"
            :loading="loading"
            @click="loadUsers"
          >
            刷新
          </el-button>
        </div>
      </template>

      <!-- 搜索过滤 -->
      <div style="margin-bottom: 20px;">
        <el-input
          v-model="searchText"
          placeholder="搜索用户名或邮箱..."
          :prefix-icon="Search"
          clearable
          style="max-width: 400px;"
        />
      </div>

      <el-table
        v-if="filteredUsers.length > 0"
        :data="filteredUsers"
        stripe
        style="width: 100%;"
      >
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'active' ? 'success' : row.status === 'suspended' ? 'warning' : 'danger'"
              size="small"
            >
              {{ getUserStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="配额" width="120">
          <template #default="{ row }">
            <el-tag type="info" size="small">
              {{ row.max_tokens }} 个
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="180">
          <template #default="{ row }">
            {{ row.last_login_at ? formatTime(row.last_login_at) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="350" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              @click="handleAssignAccount(row)"
              :disabled="row.status !== 'active'"
            >
              分配账号
            </el-button>
            <el-button
              size="small"
              @click="handleEditQuota(row)"
            >
              调整配额
            </el-button>
            <el-button
              :type="row.status === 'active' ? 'warning' : 'success'"
              size="small"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 'active' ? '封禁' : '解封' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-else
        description="暂无用户"
        :image-size="100"
      />
    </el-card>

    <!-- Token分配记录 -->
    <el-card style="margin-top: 20px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: 600;">Token分配记录</span>
            <el-tag type="info" size="small" style="margin-left: 12px;">
              共 {{ allocations.length }} 条记录
            </el-tag>
          </div>
          <el-button
            :icon="Refresh"
            :loading="loading"
            @click="loadAllocations"
          >
            刷新
          </el-button>
        </div>
      </template>

      <el-table
        v-if="allocations.length > 0"
        :data="allocations"
        stripe
        style="width: 100%;"
      >
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column prop="username" label="用户" width="150" />
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column prop="account_email" label="分配账户" min-width="200" />
        <el-table-column label="Token使用量" width="200">
          <template #default="{ row }">
            <div v-if="row.usage_limit && row.usage_current !== null && row.usage_current !== undefined">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 12px; color: #606266;">
                  {{ formatNumber(row.usage_current) }} / {{ formatNumber(row.usage_limit) }}
                </span>
              </div>
              <el-progress
                :percentage="row.usage_percent || 0"
                :color="getProgressColor(row.usage_percent || 0)"
                :stroke-width="6"
              />
            </div>
            <span v-else style="color: #909399; font-size: 12px;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="getAllocationStatusType(row.status)"
              size="small"
            >
              {{ getAllocationStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.requested_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'active'"
              type="danger"
              size="small"
              @click="handleRevoke(row.id)"
            >
              释放
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-else
        description="暂无分配记录"
        :image-size="100"
      />
    </el-card>

    <!-- 调整配额对话框 -->
    <el-dialog
      v-model="quotaDialogVisible"
      title="调整用户配额"
      width="400px"
    >
      <el-form label-width="100px">
        <el-form-item label="用户">
          <span>{{ currentUser?.username }} ({{ currentUser?.email }})</span>
        </el-form-item>
        <el-form-item label="当前配额">
          <span>{{ currentUser?.max_tokens }} 个</span>
        </el-form-item>
        <el-form-item label="新配额">
          <el-input-number
            v-model="newQuota"
            :min="0"
            :max="10"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quotaDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveQuota">确定</el-button>
      </template>
    </el-dialog>

    <!-- 拒绝申请对话框 -->
    <el-dialog
      v-model="rejectDialogVisible"
      title="拒绝申请"
      width="400px"
    >
      <el-form label-width="100px">
        <el-form-item label="拒绝原因">
          <el-input
            v-model="rejectReason"
            type="textarea"
            :rows="3"
            placeholder="请输入拒绝原因..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleConfirmReject">确定</el-button>
      </template>
    </el-dialog>

    <!-- 分配账号对话框 -->
    <el-dialog
      v-model="assignDialogVisible"
      title="分配AWS账号"
      width="600px"
    >
      <el-form label-width="100px">
        <el-form-item label="用户">
          <span>{{ currentUser?.username }} ({{ currentUser?.email }})</span>
        </el-form-item>
        <el-form-item label="当前配额">
          <span>{{ currentUser?.max_tokens }} 个</span>
        </el-form-item>
        <el-form-item label="选择账号">
          <el-select
            v-model="selectedAccountEmail"
            placeholder="请选择可用的AWS账号"
            style="width: 100%;"
            filterable
          >
            <el-option
              v-for="account in availableAccounts"
              :key="account.email"
              :label="`${account.email} (${account.usage_percent}% 使用率)`"
              :value="account.email"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>{{ account.email }}</span>
                <el-tag size="small" :type="account.usage_percent < 50 ? 'success' : 'warning'">
                  {{ account.usage_percent }}%
                </el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmAssign" :loading="assigning">确定分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search, Document, CircleCheck, Link, Warning } from '@element-plus/icons-vue'
import { adminApi, type User, type PendingRequest, type TokenAllocation, type AccountStats, type AccountDetail } from '../api/admin'
import { useAdmin } from '../composables/useAdmin'
import {
  formatTime,
  formatNumber,
  getUsageClass,
  getProgressColor,
  getUserStatusText,
  getAllocationStatusText,
  getAllocationStatusType
} from '../utils/format'
import '../styles/user-management.css'

// 使用管理员认证
const { logout, requireAuth } = useAdmin()

// 状态
const loading = ref(false)
const approving = ref<string | null>(null)
const rejecting = ref<string | null>(null)
const searchText = ref('')

// 数据
const pendingRequests = ref<PendingRequest[]>([])
const users = ref<User[]>([])
const allocations = ref<TokenAllocation[]>([])
const accountDetails = ref<AccountDetail[]>([])
const accountStats = ref<AccountStats>({
  total: 0,
  available: 0,
  assigned: 0,
  unavailable: 0,
  tokens: {
    total: 0,
    used: 0,
    available: 0,
    usagePercent: 0
  }
})

// 对话框
const quotaDialogVisible = ref(false)
const rejectDialogVisible = ref(false)
const assignDialogVisible = ref(false)
const currentUser = ref<User | null>(null)
const currentRequestId = ref<string>('')
const newQuota = ref(2)
const rejectReason = ref('')
const selectedAccountEmail = ref('')
const assigning = ref(false)

// 计算属性 - 过滤用户
const filteredUsers = computed(() => {
  if (!searchText.value) return users.value
  const search = searchText.value.toLowerCase()
  return users.value.filter(user =>
    user.username.toLowerCase().includes(search) ||
    user.email.toLowerCase().includes(search)
  )
})

// 计算属性 - 可分配的账号
const availableAccounts = computed(() => {
  return accountDetails.value.filter(account => 
    account.allocation_status === 'available' &&
    account.usage_percent < 85 &&
    account.usage_limit > 0
  )
})

// 加载待审批申请
async function loadPendingRequests() {
  try {
    loading.value = true
    const { data } = await adminApi.getPendingRequests()
    if (data.success) {
      pendingRequests.value = data.requests
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

// 加载用户列表
async function loadUsers() {
  try {
    loading.value = true
    const { data } = await adminApi.getUsers()
    if (data.success) {
      users.value = data.users
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

// 加载分配记录
async function loadAllocations() {
  try {
    loading.value = true
    const { data } = await adminApi.getAllocations()
    if (data.success) {
      allocations.value = data.allocations
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

// 加载账户统计
async function loadAccountStats() {
  try {
    const { data } = await adminApi.getAccountStats()
    if (data.success) {
      accountStats.value = data.stats
    }
  } catch (error: any) {
    console.error('加载账户统计失败:', error)
  }
}

// 加载账户详细列表
async function loadAccountDetails() {
  try {
    const { data } = await adminApi.getAccountDetails()
    if (data.success) {
      accountDetails.value = data.accounts
    }
  } catch (error: any) {
    console.error('加载账户详细列表失败:', error)
  }
}

// 批准申请
async function handleApprove(id: string) {
  try {
    approving.value = id
    const { data } = await adminApi.approveRequest(id)
    if (data.success) {
      ElMessage.success('批准成功')
      await Promise.all([
        loadPendingRequests(),
        loadAllocations()
      ])
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '批准失败')
  } finally {
    approving.value = null
  }
}

// 拒绝申请
function handleReject(id: string) {
  currentRequestId.value = id
  rejectReason.value = ''
  rejectDialogVisible.value = true
}

// 确认拒绝
async function handleConfirmReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请输入拒绝原因')
    return
  }

  try {
    rejecting.value = currentRequestId.value
    const { data } = await adminApi.rejectRequest(currentRequestId.value, rejectReason.value)
    if (data.success) {
      ElMessage.success('已拒绝')
      rejectDialogVisible.value = false
      await loadPendingRequests()
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '操作失败')
  } finally {
    rejecting.value = null
  }
}

// 调整配额
function handleEditQuota(user: User) {
  currentUser.value = user
  newQuota.value = user.max_tokens
  quotaDialogVisible.value = true
}

// 保存配额
async function handleSaveQuota() {
  if (!currentUser.value) return

  try {
    const { data } = await adminApi.updateUserQuota(currentUser.value.id, newQuota.value)
    if (data.success) {
      ElMessage.success('配额已更新')
      quotaDialogVisible.value = false
      await loadUsers()
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '更新失败')
  }
}

// 切换用户状态
async function handleToggleStatus(user: User) {
  const newStatus = user.status === 'active' ? 'banned' : 'active'
  const action = newStatus === 'banned' ? '封禁' : '解封'

  try {
    await ElMessageBox.confirm(`确定要${action}用户 ${user.username} 吗？`, '确认操作', {
      type: 'warning'
    })

    const { data } = await adminApi.updateUserStatus(user.id, newStatus)
    if (data.success) {
      ElMessage.success(`${action}成功`)
      await loadUsers()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '操作失败')
    }
  }
}

// 释放Token
async function handleRevoke(id: string) {
  try {
    await ElMessageBox.confirm('确定要释放此Token吗？', '确认操作', {
      type: 'warning'
    })

    const { data } = await adminApi.revokeAllocation(id)
    if (data.success) {
      ElMessage.success('已释放')
      await loadAllocations()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '操作失败')
    }
  }
}

// 分配账号
function handleAssignAccount(user: User) {
  currentUser.value = user
  selectedAccountEmail.value = ''
  assignDialogVisible.value = true
}

// 确认分配账号
async function handleConfirmAssign() {
  if (!currentUser.value || !selectedAccountEmail.value) {
    ElMessage.warning('请选择要分配的账号')
    return
  }

  try {
    assigning.value = true
    const { data } = await adminApi.assignAccount(currentUser.value.id, selectedAccountEmail.value)
    if (data.success) {
      ElMessage.success('账号分配成功')
      assignDialogVisible.value = false
      await Promise.all([
        loadAllocations(),
        loadAccountDetails(),
        loadAccountStats()
      ])
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '分配失败')
  } finally {
    assigning.value = false
  }
}

// 获取不可分配原因
function getUnavailableReason(account: AccountDetail): string {
  const reasons: string[] = []
  
  if (!account.usage_limit || account.usage_limit === 0) {
    reasons.push('缺少额度数据')
  }
  
  if (account.usage_percent >= 85) {
    reasons.push(`使用率过高(${account.usage_percent}%)`)
  }
  
  if (!account.subscription_type) {
    reasons.push('无订阅类型')
  }
  
  if (account.subscription_status !== 'active') {
    reasons.push(`订阅状态: ${account.subscription_status || '未知'}`)
  }
  
  return reasons.length > 0 ? reasons.join(', ') : '不满足分配条件'
}

// 初始化
onMounted(async () => {
  // 检查认证状态
  if (!requireAuth()) return

  await Promise.all([
    loadPendingRequests(),
    loadUsers(),
    loadAllocations(),
    loadAccountStats(),
    loadAccountDetails()
  ])
})
</script>
