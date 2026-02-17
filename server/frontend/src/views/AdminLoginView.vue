<template>
  <div class="admin-login-view">
    <el-card style="max-width: 400px; margin: 100px auto;">
      <template #header>
        <div style="text-align: center;">
          <h2 style="margin: 0;">🔐 管理员登录</h2>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
        @submit.prevent="handleLogin"
      >
        <el-form-item label="邮箱" prop="email">
          <el-input
            v-model="form.email"
            placeholder="admin@user.com"
            clearable
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            clearable
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            style="width: 100%;"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="loginStatus"
        :title="loginStatus.message"
        :type="loginStatus.type"
        :closable="false"
        style="margin-top: 10px;"
      />

      <div style="margin-top: 20px; text-align: center; color: #909399; font-size: 12px;">
        <p>默认账户：admin@user.com</p>
        <p>默认密码：cbc123123</p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import axios from 'axios'
import '../styles/admin-login-view.css'

const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)
const loginStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null)

const form = reactive({
  email: 'admin@user.com',
  password: ''
})

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ]
}

async function handleLogin() {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    loading.value = true
    loginStatus.value = null

    const { data } = await axios.post('http://localhost:3000/api/admin/login', {
      email: form.email,
      password: form.password
    })

    if (data.success) {
      // 保存token到localStorage
      localStorage.setItem('admin_token', data.token)
      localStorage.setItem('admin_info', JSON.stringify(data.admin))

      loginStatus.value = {
        type: 'success',
        message: '登录成功！正在跳转...'
      }

      ElMessage.success('登录成功')

      // 跳转到用户管理页面
      setTimeout(() => {
        router.push('/user-management')
      }, 1000)
    }
  } catch (error: any) {
    const message = error.response?.data?.message || '登录失败'
    loginStatus.value = {
      type: 'error',
      message
    }
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}
</script>


