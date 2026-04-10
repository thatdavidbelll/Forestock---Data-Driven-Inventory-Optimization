import axios, { type InternalAxiosRequestConfig } from 'axios'

// Extend AxiosRequestConfig to track retry attempts
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let refreshPromise: Promise<string> | null = null
let authHandlers: {
  logout: (() => Promise<void>) | null
  updateAccessToken: ((token: string) => void) | null
} = {
  logout: null,
  updateAccessToken: null,
}

export function setApiAuthHandlers(handlers: {
  logout: () => Promise<void>
  updateAccessToken: (token: string) => void
}) {
  authHandlers = handlers
}

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`,
  timeout: 30000,
})

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
      const refreshToken = sessionStorage.getItem('refreshToken')

      if (refreshToken) {
        originalRequest._retry = true
        try {
          if (!refreshPromise) {
            refreshPromise = axios
              .post(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/auth/refresh`, null, {
                headers: { Authorization: `Bearer ${refreshToken}` },
              })
              .then((response) => response.data.data.accessToken as string)
              .finally(() => {
                refreshPromise = null
              })
          }

          const newAccessToken = await refreshPromise
          authHandlers.updateAccessToken?.(newAccessToken)
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return api(originalRequest)
        } catch {
          await authHandlers.logout?.()
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('username')
          localStorage.removeItem('role')
          sessionStorage.removeItem('refreshToken')
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
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('username')
      localStorage.removeItem('role')
      sessionStorage.removeItem('refreshToken')
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default api
