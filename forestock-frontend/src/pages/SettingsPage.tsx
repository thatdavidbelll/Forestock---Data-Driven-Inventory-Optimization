import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import { isStrongPassword } from '../lib/passwordStrength'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator'

export default function SettingsPage() {
  const { username, role } = useAuth()

  // Store info (admin only)
  const [storeName, setStoreName] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [storeLoading, setStoreLoading] = useState(false)
  const [storeSaving, setStoreSaving] = useState(false)
  const [storeSuccess, setStoreSuccess] = useState('')
  const [storeError, setStoreError] = useState('')

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [exportingData, setExportingData] = useState(false)
  const [exportError, setExportError] = useState('')

  const isAdmin = role === 'ROLE_ADMIN'

  useEffect(() => {
    if (isAdmin) {
      loadStore()
    }
  }, [isAdmin])

  async function loadStore() {
    try {
      setStoreLoading(true)
      const { data } = await api.get('/store')
      setStoreName(data.data.name ?? '')
      setStoreSlug(data.data.slug ?? '')
    } catch (err) {
      setStoreError(extractErrorMessage(err, 'Failed to load store info'))
    } finally {
      setStoreLoading(false)
    }
  }

  async function handleSaveStore(e: FormEvent) {
    e.preventDefault()
    setStoreError('')
    setStoreSuccess('')
    setStoreSaving(true)
    try {
      await api.put('/store', { name: storeName })
      setStoreSuccess('Store name updated.')
    } catch (err) {
      setStoreError(extractErrorMessage(err, 'Failed to update store'))
    } finally {
      setStoreSaving(false)
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    if (!isStrongPassword(newPassword)) {
      setPasswordError('Password must include uppercase, lowercase, number, and special character.')
      return
    }
    setPasswordSaving(true)
    try {
      await api.put('/users/me/password', { currentPassword, newPassword })
      setPasswordSuccess('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(extractErrorMessage(err, 'Failed to change password'))
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleExportData() {
    setExportError('')
    setExportingData(true)
    try {
      const response = await api.get('/users/me/export', { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'forestock-data-export.zip'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(extractErrorMessage(err, 'Failed to export your data'))
    } finally {
      setExportingData(false)
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your store and account settings.</p>
      </div>

      {/* Store Info — admin only */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Store Information</h2>
          {storeLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <form onSubmit={handleSaveStore} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug <span className="text-gray-400 font-normal">(read-only)</span>
                </label>
                <input
                  type="text"
                  value={storeSlug}
                  readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 font-mono"
                />
              </div>
              {storeError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{storeError}</p>}
              {storeSuccess && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">✓ {storeSuccess}</p>}
              <button
                type="submit"
                disabled={storeSaving}
                className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {storeSaving ? 'Saving…' : 'Save Store Name'}
              </button>
            </form>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
            <p className="text-sm text-gray-500 mt-1">Review changes made by your team across the store.</p>
          </div>
          <Link
            to="/audit"
            className="shrink-0 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            View Audit Log
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Privacy & Data</h2>
        <p className="mt-1 text-sm text-gray-500">
          Download a ZIP archive containing your profile, products, sales history, and current inventory snapshot.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleExportData}
            disabled={exportingData}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {exportingData ? 'Preparing export…' : 'Download my data'}
          </button>
        </div>
        {exportError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{exportError}</p>}
      </div>

      {/* My Account */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">My Account</h2>
        <div className="flex items-center gap-3 mb-6">
          <div>
            <p className="text-sm font-medium text-gray-900">{username}</p>
            <p className="text-xs text-gray-400">{role}</p>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-gray-700 mb-4">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min. 8 characters"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <PasswordStrengthIndicator password={newPassword} />
          {passwordError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">✓ {passwordSuccess}</p>}
          <button
            type="submit"
            disabled={passwordSaving}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {passwordSaving ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
