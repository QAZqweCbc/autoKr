/**
 * Unified Axios Instance Configuration
 * 
 * Provides a pre-configured axios instance with:
 * - Performance monitoring
 * - Error handling
 * - Request/response logging (development only)
 * 
 * All API modules should import and use this instance instead of creating their own.
 */

import axios from 'axios'

// Create axios instance with default configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add request interceptor to inject admin token
api.interceptors.request.use(
  (config) => {
    // 从localStorage获取管理员token
    const adminToken = localStorage.getItem('admin_token')
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`
    }
    
    // Development logging
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`)
    }
    
    return config
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('[API Request Error]', error)
    }
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data)
    }
    return response
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('[API Response Error]', error)
    }
    
    // Handle 401 Unauthorized - clear token and redirect to login
    if (error.response?.status === 401) {
      console.warn('[Auth] Token expired or invalid, clearing localStorage')
      localStorage.removeItem('admin_token')
      
      // Redirect to login page if not already there
      if (!window.location.pathname.includes('/admin/login')) {
        window.location.href = '/admin/login'
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
