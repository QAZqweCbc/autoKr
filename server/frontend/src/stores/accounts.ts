import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAccounts, exportAccounts, type Account } from '../api/accounts'

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref<Account[]>([])
  const loading = ref(false)

  // 静默刷新标志（用于WebSocket触发的后台更新）
  let silentRefreshTimer: ReturnType<typeof setTimeout> | null = null

  const loadAccounts = async (silent = false) => {
    if (!silent) {
      loading.value = true
    }
    try {
      const data = await getAccounts()
      if (data.success) {
        accounts.value = data.accounts
      }
    } finally {
      if (!silent) {
        loading.value = false
      }
    }
  }

  // 静默刷新（防抖，避免频繁请求）
  const silentRefresh = () => {
    if (silentRefreshTimer) {
      clearTimeout(silentRefreshTimer)
    }
    silentRefreshTimer = setTimeout(() => {
      loadAccounts(true)
    }, 500) // 500ms 防抖
  }

  const exportAccountsData = async (format: 'json' | 'csv') => {
    const blob = await exportAccounts(format)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `accounts_${Date.now()}.${format}`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  return {
    accounts,
    loading,
    loadAccounts,
    silentRefresh,
    exportAccounts: exportAccountsData
  }
})
