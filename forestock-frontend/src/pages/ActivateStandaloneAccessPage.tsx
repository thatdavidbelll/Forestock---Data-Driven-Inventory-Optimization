import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import { isStrongPassword } from '../lib/passwordStrength'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator'

export default function ActivateStandaloneAccessPage() {
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
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 text-center shadow-2xl">
          <p className="mb-4 text-sm text-red-600" role="alert">Invalid or missing standalone access token.</p>
          <Link to="/request-standalone-access" className="text-sm font-medium text-[#4F46E5] hover:text-[#7C3AED] hover:underline">
            Request a new activation link
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
      await api.post('/auth/standalone-access/activate', { token, newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Activation failed. The link may have expired.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#38BDF8] px-6 py-6 text-white">
          <h1 className="text-2xl font-bold">Activate Forestock web access</h1>
          <p className="mt-2 text-sm text-white/90">
            Set your password to enable standalone Forestock access while keeping Shopify as your primary workspace.
          </p>
        </div>

        <div className="p-6">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-xl text-sky-600">
                ✓
              </div>
              <p className="text-sm font-medium text-slate-900">Standalone access activated.</p>
              <p className="text-sm text-slate-600">You can now sign in to the Forestock web app. Redirecting…</p>
              <Link to="/login" className="inline-flex text-sm font-medium text-[#4F46E5] hover:text-[#7C3AED] hover:underline">
                Sign in now
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Primary workflow:</span> continue using Forestock through Shopify for day-to-day setup and sync status. Web access is optional.
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    placeholder="Min. 8 characters"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repeat new password"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/40"
                  />
                </div>

                <PasswordStrengthIndicator password={newPassword} />

                {error && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4338CA] disabled:opacity-50"
                >
                  {loading ? 'Activating…' : 'Activate web access'}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-slate-500">
                <Link to="/request-standalone-access" className="font-medium text-[#4F46E5] hover:text-[#7C3AED] hover:underline">
                  Request a new link
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
