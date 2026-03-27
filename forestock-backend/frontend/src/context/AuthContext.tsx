import { createContext, useContext, useState, type ReactNode } from 'react'
import api from '../lib/api'

interface AuthState {
  username: string | null
  role: string | null
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const token = localStorage.getItem('accessToken')
    const username = localStorage.getItem('username')
    const role = localStorage.getItem('role')
    return { isAuthenticated: !!token, username, role }
  })

  async function login(username: string, password: string) {
    const { data } = await api.post('/auth/login', { username, password })
    const { accessToken, refreshToken, username: user, role } = data.data
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('username', user)
    localStorage.setItem('role', role)
    setAuth({ isAuthenticated: true, username: user, role })
  }

  function logout() {
    localStorage.clear()
    setAuth({ isAuthenticated: false, username: null, role: null })
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
