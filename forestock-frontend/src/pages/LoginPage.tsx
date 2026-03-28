import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendingVerification, setResendingVerification] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setVerificationMessage('')
    setLoading(true)
    try {
      const role = await login(username, password)
      // Super admins go to the platform admin panel; everyone else to dashboard
      navigate(role === 'ROLE_SUPER_ADMIN' ? '/admin' : '/dashboard')
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(message ?? 'Sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    if (!username) {
      setError('Enter your username first so we know which verification email to resend.')
      return
    }

    setResendingVerification(true)
    setVerificationMessage('')
    try {
      const { data } = await api.post('/auth/resend-verification', { username })
      setVerificationMessage(data.message ?? 'Verification email sent.')
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(message ?? 'Unable to resend verification email.')
    } finally {
      setResendingVerification(false)
    }
  }

  const canResendVerification = error.toLowerCase().includes('verify your email')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-indigo-600 mb-1">Forestock</h1>
          <p className="text-sm text-gray-500">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {error && (
            <div className="space-y-3">
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              {canResendVerification && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                  className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50"
                >
                  {resendingVerification ? 'Resending verification email…' : 'Resend verification email'}
                </button>
              )}
            </div>
          )}
          {verificationMessage && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{verificationMessage}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/forgot-password" className="text-indigo-600 hover:underline">
            Forgot your password?
          </Link>
        </p>
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-400">
          <a
            href="https://forestock.app/privacy-policy"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-600"
          >
            Privacy Policy
          </a>
          <a
            href="https://forestock.app/terms-of-service"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-600"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  )
}
