import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator'

interface InviteDetails {
  email: string
  role: string
  storeName: string
  expiresAt: string
  valid: boolean
}

export default function AcceptInvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void (async () => {
      if (!token) {
        setError('Missing invite token.')
        setLoading(false)
        return
      }
      try {
        const { data } = await api.get('/auth/invite/verify', { params: { token } })
        setInvite(data.data)
      } catch (err) {
        setError(extractErrorMessage(err, 'Invalid invite.'))
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    try {
      await api.post('/auth/invite/accept', { token, username, password })
      setSuccess('Invite accepted. Redirecting to login…')
      window.setTimeout(() => navigate('/login'), 1200)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to accept invite.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Accept Invite</h1>
        <p className="mt-1 text-sm text-gray-500">Create your Forestock account to join the invited store.</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500" role="status" aria-label="Loading">Loading…</div>
      ) : error && !invite ? (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700" role="alert">{error}</p>
          <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Back to login</Link>
        </div>
      ) : invite ? (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Invited email: <span className="font-medium text-gray-900">{invite.email}</span></p>
            <p className="text-sm text-gray-600">Store: <span className="font-medium text-gray-900">{invite.storeName}</span></p>
            <p className="text-sm text-gray-600">Role: <span className="font-medium text-gray-900">{invite.role}</span></p>
            <p className="text-xs text-gray-400">Expires {new Date(invite.expiresAt).toLocaleString()}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <PasswordStrengthIndicator password={password} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{error}</p>}
            {success && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{success}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Creating account…' : 'Accept Invite'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
