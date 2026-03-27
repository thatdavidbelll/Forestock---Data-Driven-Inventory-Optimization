import axios, { type InternalAxiosRequestConfig } from 'axios'

// Extend AxiosRequestConfig to track retry attempts
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config as RetryConfig

    // Attempt silent token refresh on first 401
    // But never retry the refresh or login calls themselves
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      const refreshToken = localStorage.getItem('refreshToken')

      if (refreshToken) {
        originalRequest._retry = true
        try {
          const { data } = await axios.post('/api/auth/refresh', null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          })
          const newAccessToken = data.data.accessToken
          localStorage.setItem('accessToken', newAccessToken)
          // Retry the original request with the new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return api(originalRequest)
        } catch {
          // Refresh failed — clear everything and go to login
          localStorage.clear()
          window.location.href = '/login'
          return Promise.reject(error)
        }
      }
    }

    // No refresh token available, or second 401 — force logout
    // But don't intercept the login page's own 401 (wrong credentials)
    if (
      error.response?.status === 401 &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      localStorage.clear()
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default api
