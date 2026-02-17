import { defineStore } from 'pinia'
import { ref } from 'vue'
import { generateAccounts, type GeneratedAccount } from '../api/generator'

export const useGeneratorStore = defineStore('generator', () => {
  const accounts = ref<GeneratedAccount[]>([])
  const loading = ref(false)

  const generate = async (count: number, emailLength: number, passwordLength: number) => {
    loading.value = true
    try {
      const result = await generateAccounts({
        count,
        email_length: emailLength,
        password_length: passwordLength,
        use_random_name: true
      })
      
      if (result.success) {
        accounts.value = result.accounts
        return { success: true, count: result.count }
      } else {
        throw new Error(result.error || '生成失败')
      }
    } finally {
      loading.value = false
    }
  }

  const clear = () => {
    accounts.value = []
  }

  const exportAccounts = () => {
    const csv = [
      ['邮箱', '密码', '姓名'].join(','),
      ...accounts.value.map(acc => 
        [acc.email, acc.password, acc.name || ''].join(',')
      )
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `generated_accounts_${Date.now()}.csv`
    link.click()
  }

  return {
    accounts,
    loading,
    generate,
    clear,
    exportAccounts
  }
})
