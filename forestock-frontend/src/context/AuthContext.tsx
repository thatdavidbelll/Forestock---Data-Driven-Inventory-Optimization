/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import api, { setApiAuthHandlers } from '../lib/api'
import { identifyUser, resetAnalytics } from '../lib/analytics'

interface AuthState {
  username: string | null
  role: string | null
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<string>  // returns role
  logout: () => Promise<void>
  updateAccessToken: (token: string) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const token = localStorage.getItem('accessToken')
    const username = localStorage.getItem('username')
    const role = localStorage.getItem('role')
    return { isAuthenticated: !!token, username, role }
  })

  /** Returns the role so callers can decide where to redirect. */
  async function login(username: string, password: string): Promise<string> {
    const { data } = await api.post('/auth/login', { username, password })
    const { accessToken, refreshToken, username: user, role } = data.data
    localStorage.setItem('accessToken', accessToken)
    sessionStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('username', user)
    localStorage.setItem('role', role)
    setAuth({ isAuthenticated: true, username: user, role })
    identifyUser(user, { role })
    return role
  }

  async function logout() {
    const refreshToken = sessionStorage.getItem('refreshToken')
    try {
      if (localStorage.getItem('accessToken')) {
        await api.post('/auth/logout', refreshToken ? { refreshToken } : {})
      }
    } catch {
      // Client logout should still complete even if token revocation fails.
    } finally {
      resetAnalytics()
      localStorage.removeItem('accessToken')
      localStorage.removeItem('username')
      localStorage.removeItem('role')
      sessionStorage.removeItem('refreshToken')
      setAuth({ isAuthenticated: false, username: null, role: null })
    }
  }

  /** Called by the api interceptor after a silent token refresh. */
  function updateAccessToken(token: string) {
    localStorage.setItem('accessToken', token)
    // username and role don't change on refresh — no state update needed
  }

  useEffect(() => {
    setApiAuthHandlers({ logout, updateAccessToken })
  }, [])

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, updateAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
