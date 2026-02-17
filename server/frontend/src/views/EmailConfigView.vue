<template>
  <div class="email-config-view">
    <el-card>
      <template #header>
        <span style="font-weight: 600;">邮箱配置</span>
      </template>

      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 24px;"
      >
        配置用于接收 AWS 验证码的邮箱
      </el-alert>

      <!-- QQ邮箱配置 -->
      <h3 style="margin: 20px 0 15px 0; color: #667eea;">QQ 邮箱配置</h3>

      <el-form :model="form" label-width="140px">
        <el-form-item label="QQ 邮箱">
          <el-input
            v-model="form.qqEmail"
            placeholder="your@qq.com"
            style="max-width: 400px;"
          />
        </el-form-item>

        <el-form-item label="授权码">
          <el-input
            v-model="form.authCode"
            type="password"
            placeholder="QQ邮箱授权码"
            show-password
            style="max-width: 400px;"
          />
        </el-form-item>

        <el-form-item label="邮箱域名">
          <el-input
            v-model="form.domains"
            placeholder="@xinc.shop,@qqximi.store,@kasxi.site"
            style="max-width: 600px;"
          />
          <div style="color: #6b7280; font-size: 13px; margin-top: 8px;">
            多个域名用逗号分隔
          </div>
        </el-form-item>

        <!-- 别名功能 -->
        <el-form-item label="使用邮箱别名">
          <el-switch v-model="form.useAlias" />
          <span style="color: #6b7280; font-size: 13px; margin-left: 12px;">
            推荐使用，可以用一个邮箱接收多个账号的验证码
          </span>
        </el-form-item>

        <!-- 别名配置 -->
        <template v-if="form.useAlias">
          <el-divider />
          <h3 style="margin: 20px 0 15px 0; color: #10b981;">别名配置</h3>

          <el-form-item label="别名类型">
            <el-radio-group v-model="form.aliasType">
              <el-radio value="gmail">Gmail 别名（无限个）</el-radio>
              <el-radio value="qq">QQ 邮箱别名（3-5个）</el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- Gmail 别名配置 -->
          <template v-if="form.aliasType === 'gmail'">
            <el-alert
              type="success"
              :closable="false"
              style="margin-bottom: 20px;"
            >
              <template #title>
                <div style="font-size: 14px;">
                  <strong>Gmail 别名优势：</strong>
                  <ul style="margin: 8px 0 0 20px; padding: 0;">
                    <li>完全免费，无限个别名</li>
                    <li>格式：yourname+aws1@gmail.com, yourname+aws2@gmail.com</li>
                    <li>所有邮件都发到基础邮箱</li>
                  </ul>
                </div>
              </template>
            </el-alert>

            <el-form-item label="Gmail 基础邮箱">
              <el-input
                v-model="form.gmailBase"
                placeholder="yourname@gmail.com"
                style="max-width: 400px;"
              />
            </el-form-item>

            <el-form-item label="应用专用密码">
              <el-input
                v-model="form.gmailAppPassword"
                type="password"
                placeholder="16位应用专用密码"
                show-password
                style="max-width: 400px;"
              />
              <div style="color: #6b7280; font-size: 13px; margin-top: 8px;">
                获取方式：Google账号 → 安全 → 两步验证 → 应用专用密码
              </div>
            </el-form-item>
          </template>

          <!-- QQ 别名配置 -->
          <template v-if="form.aliasType === 'qq'">
            <el-alert
              type="warning"
              :closable="false"
              style="margin-bottom: 20px;"
            >
              <template #title>
                <div style="font-size: 14px;">
                  <strong>QQ 邮箱别名说明：</strong>
                  <ul style="margin: 8px 0 0 20px; padding: 0;">
                    <li>需要先在QQ邮箱网页版创建英文别名</li>
                    <li>免费用户通常只能创建3-5个别名</li>
                    <li>所有邮件都发到主邮箱</li>
                  </ul>
                </div>
              </template>
            </el-alert>

            <el-form-item label="QQ 邮箱别名列表">
              <el-input
                v-model="form.qqAliases"
                placeholder="yourname@qq.com, myproject@qq.com"
                style="max-width: 600px;"
              />
              <div style="color: #6b7280; font-size: 13px; margin-top: 8px;">
                多个别名用逗号分隔，所有邮件都发到上面配置的QQ邮箱
              </div>
            </el-form-item>
          </template>
        </template>

        <el-divider />

        <!-- 操作按钮 -->
        <el-form-item>
          <el-button
            type="primary"
            :loading="testing"
            @click="handleTest"
          >
            🔍 测试邮箱连接
          </el-button>
          <el-button
            type="success"
            :loading="saving"
            @click="handleSave"
          >
            💾 保存配置
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 使用说明 -->
      <el-alert
        type="info"
        :closable="false"
        style="margin-top: 30px;"
      >
        <template #title>
          <div style="font-size: 14px;">
            <strong>📖 使用说明</strong>
            <ul style="margin: 8px 0 0 20px; padding: 0;">
              <li>配置一个QQ邮箱用于接收所有AWS验证码</li>
              <li>授权码获取：QQ邮箱设置 → 账户 → 开启IMAP/SMTP服务 → 生成授权码</li>
              <li>邮箱域名：配置你自己的域名（多个用逗号分隔），用于生成随机邮箱</li>
              <li><strong>推荐使用 Gmail 别名：</strong>完全免费，一个Gmail可生成无限个别名</li>
              <li>配置完成后，应用端可以使用这些配置进行账号注册</li>
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
import { useEmailConfigStore } from '../stores/emailConfig'
import '../styles/email-config-view.css'

const emailConfigStore = useEmailConfigStore()

const form = ref({
  qqEmail: '',
  authCode: '',
  domains: '@xinc.shop,@qqximi.store,@kasxi.site',
  useAlias: false,
  aliasType: 'gmail' as 'gmail' | 'qq',
  gmailBase: '',
  gmailAppPassword: '',
  qqAliases: ''
})

const testing = ref(false)
const saving = ref(false)

onMounted(async () => {
  const config = await emailConfigStore.loadConfig()
  if (config) {
    form.value = { ...form.value, ...config }
  }
})

const handleTest = async () => {
  testing.value = true
  try {
    const result = await emailConfigStore.testConnection()
    
    if (result.success && result.data) {
      let message = `✅ ${result.message}\n\n`
      message += `📧 邮箱: ${result.data.email}\n`
      message += `📬 未读邮件: ${result.data.unreadCount} 封`
      
      if (result.data.recentMessages && result.data.recentMessages.length > 0) {
        message += `\n\n最近的邮件：\n`
        result.data.recentMessages.forEach((msg: any, index: number) => {
          message += `${index + 1}. ${msg.subject}\n`
        })
      }
      
      ElMessageBox.alert(message, '测试成功', {
        confirmButtonText: '确定',
        type: 'success'
      })
    } else {
      let errorMsg = `❌ ${result.error}`
      if (result.suggestions && result.suggestions.length > 0) {
        errorMsg += '\n\n💡 解决建议：\n'
        result.suggestions.forEach((s: string) => s += `• ${s}\n`)
      }
      
      ElMessageBox.alert(errorMsg, '测试失败', {
        confirmButtonText: '确定',
        type: 'error'
      })
    }
  } catch (error: any) {
    ElMessage.error(error.message || '测试失败')
  } finally {
    testing.value = false
  }
}

const handleSave = async () => {
  // 验证必填字段
  if (!form.value.useAlias) {
    if (!form.value.qqEmail) {
      ElMessage.error('请输入QQ邮箱')
      return
    }
    if (!form.value.authCode) {
      ElMessage.error('请输入授权码')
      return
    }
    if (!form.value.domains) {
      ElMessage.error('请输入邮箱域名')
      return
    }
  } else {
    if (form.value.aliasType === 'gmail') {
      if (!form.value.gmailBase) {
        ElMessage.error('请输入 Gmail 基础邮箱')
        return
      }
      if (!form.value.gmailAppPassword) {
        ElMessage.error('请输入 Gmail 应用专用密码')
        return
      }
      if (!form.value.gmailBase.endsWith('@gmail.com')) {
        ElMessage.error('Gmail 邮箱必须以 @gmail.com 结尾')
        return
      }
    } else {
      if (!form.value.qqEmail) {
        ElMessage.error('请输入QQ邮箱（用于接收验证码）')
        return
      }
      if (!form.value.authCode) {
        ElMessage.error('请输入QQ邮箱授权码')
        return
      }
      if (!form.value.qqAliases) {
        ElMessage.error('请输入QQ邮箱别名列表')
        return
      }
    }
  }

  saving.value = true
  try {
    await emailConfigStore.saveConfig(form.value)
    ElMessage.success('✅ 邮箱配置保存成功！')
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>


