import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'

interface User {
  id: string
  username: string
  email: string | null
  role: string
  active: boolean
  createdAt: string
}

interface Invite {
  id: string
  email: string
  role: string
  invitedBy: string | null
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ROLE_ADMIN:   { label: 'Admin',   color: 'bg-purple-100 text-purple-700' },
  ROLE_MANAGER: { label: 'Manager', color: 'bg-blue-100 text-blue-700' },
  ROLE_VIEWER:  { label: 'Viewer',  color: 'bg-gray-100 text-gray-600' },
}

export default function UsersPage() {
  const { username: currentUsername } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invites, setInvites] = useState<Invite[]>([])

  // Invite modal
  const [showModal, setShowModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('ROLE_MANAGER')
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { void Promise.all([loadUsers(), loadInvites()]) }, [])

  async function loadUsers() {
    try {
      setLoading(true)
      const { data } = await api.get('/users')
      setUsers(data.data)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load users'))
    } finally {
      setLoading(false)
    }
  }

  async function loadInvites() {
    try {
      const { data } = await api.get('/users/invites')
      setInvites(data.data)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load invites'))
    }
  }

  async function handleInviteUser(e: FormEvent) {
    e.preventDefault()
    setModalError('')
    setSaving(true)
    try {
      await api.post('/users/invite', {
        email: newEmail || undefined,
        role: newRole,
      })
      setShowModal(false)
      setNewEmail('')
      setNewRole('ROLE_MANAGER')
      await loadInvites()
    } catch (err) {
      setModalError(extractErrorMessage(err, 'Failed to send invite'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteInvite(invite: Invite) {
    if (!confirm(`Delete invite for "${invite.email}"?`)) return
    try {
      await api.delete(`/users/invites/${invite.id}`)
      await loadInvites()
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to delete invite'))
    }
  }

  async function handleRoleChange(user: User, role: string) {
    try {
      await api.put(`/users/${user.id}`, { role })
      loadUsers()
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to update role'))
    }
  }

  async function handleToggleActive(user: User) {
    const action = user.active ? 'deactivate' : 'activate'
    if (!confirm(`Are you sure you want to ${action} "${user.username}"?`)) return
    try {
      if (user.active) {
        await api.delete(`/users/${user.id}`)
      } else {
        await api.put(`/users/${user.id}`, { active: true })
      }
      loadUsers()
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to update user'))
    }
  }

  const roleInfo = (role: string) => ROLE_LABELS[role] ?? { label: role, color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">Manage who has access to your store.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Invite Team Member
        </button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-12">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Username</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Role</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => {
                const isMe = user.username === currentUsername
                const { label, color } = roleInfo(user.role)
                return (
                  <tr key={user.id} className={`hover:bg-gray-50 ${!user.active ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {user.username}
                      {isMe && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{user.email ?? '—'}</td>
                    <td className="px-6 py-3">
                      {isMe ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                          {label}
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          disabled={!user.active}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 focus:ring-2 focus:ring-indigo-500 cursor-pointer ${color}`}
                        >
                          <option value="ROLE_ADMIN">Admin</option>
                          <option value="ROLE_MANAGER">Manager</option>
                          <option value="ROLE_VIEWER">Viewer</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {isMe ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                            user.active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {user.active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Pending Invites</h2>
          <p className="mt-1 text-sm text-gray-500">Invited team members who have not accepted yet.</p>
        </div>
        {invites.length === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-500">No pending invites.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Role</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Invited</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Expires</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invites.map((invite) => {
                const { label, color } = roleInfo(invite.role)
                return (
                  <tr key={invite.id}>
                    <td className="px-6 py-3 text-gray-900">{invite.email}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-500">{new Date(invite.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-gray-500">{new Date(invite.expiresAt).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleDeleteInvite(invite)}
                        className="text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg px-3 py-1.5"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h2>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="user@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ROLE_MANAGER">Manager — full access, no user management</option>
                  <option value="ROLE_VIEWER">Viewer — read-only access</option>
                </select>
              </div>
              {modalError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{modalError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Sending…' : 'Send Invite'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setModalError('') }}
                  className="flex-1 bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
