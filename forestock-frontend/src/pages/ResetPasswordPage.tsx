import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import { isStrongPassword } from '../lib/passwordStrength'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm text-center">
          <p className="text-sm text-red-600 mb-4">Invalid or missing reset token.</p>
          <Link to="/forgot-password" className="text-sm text-indigo-600 hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!isStrongPassword(newPassword)) {
      setError('Password must include uppercase, lowercase, number, and special character.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Reset failed. The link may have expired.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-indigo-600 mb-1">Forestock</h1>
          <p className="text-sm text-gray-500">Set a new password</p>
        </div>

        {success ? (
          <div className="text-center space-y-3">
            <div className="text-4xl">✓</div>
            <p className="text-sm text-green-700 font-medium">Password reset successfully!</p>
            <p className="text-sm text-gray-500">Redirecting to sign in…</p>
            <Link to="/login" className="block text-sm text-indigo-600 hover:underline">
              Sign in now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                placeholder="Min. 8 characters"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat new password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <PasswordStrengthIndicator password={newPassword} />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
            <p className="text-center text-sm text-gray-500">
              <Link to="/forgot-password" className="text-indigo-600 hover:underline">
                Request a new link
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
