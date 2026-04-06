import { useState, useEffect, type FormEvent } from 'react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import { isStrongPassword } from '../lib/passwordStrength'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator'

interface Store {
  id: string
  name: string
  slug: string
  active: boolean
  createdAt: string
}

export default function AdminPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create store form
  const [storeName, setStoreName] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  useEffect(() => { loadStores() }, [])

  // Auto-generate slug from store name
  function handleStoreName(value: string) {
    setStoreName(value)
    const slug = value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, '')
    setStoreSlug(slug)
  }

  async function loadStores() {
    try {
      setLoading(true)
      const { data } = await api.get('/admin/stores')
      setStores(data.data)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load stores'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateStore(e: FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess('')
    if (!isStrongPassword(adminPassword)) {
      setCreateError('Password must include uppercase, lowercase, number, and special character.')
      return
    }
    setCreating(true)
    try {
      await api.post('/register', {
        storeName,
        storeSlug,
        username: adminUsername,
        password: adminPassword,
        email: adminEmail,
      })
      setCreateSuccess(`Store "${storeName}" created with admin "${adminUsername}". Verification email sent to ${adminEmail}.`)
      setStoreName('')
      setStoreSlug('')
      setAdminUsername('')
      setAdminPassword('')
      setAdminEmail('')
      loadStores()
    } catch (err) {
      setCreateError(extractErrorMessage(err, 'Failed to create store'))
    } finally {
      setCreating(false)
    }
  }

  async function toggleStore(store: Store) {
    try {
      const endpoint = store.active
        ? `/admin/stores/${store.id}/deactivate`
        : `/admin/stores/${store.id}/activate`
      await api.put(endpoint)
      await loadStores()
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to update store'))
    }
  }

  async function deleteStore(store: Store) {
    const confirmed = window.confirm(
      `Permanently delete "${store.name}"?\n\nThis will remove the store, its users, products, sales, inventory, forecasts and suggestions. This cannot be undone.`
    )

    if (!confirmed) {
      return
    }

    try {
      await api.delete(`/admin/stores/${store.id}`)
      await loadStores()
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to delete store'))
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Manage all stores on the Forestock platform.</p>
      </div>

      {/* Create Store */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Store</h2>
        <form onSubmit={handleCreateStore} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => handleStoreName(e.target.value)}
              required
              aria-required="true"
              placeholder="My Shop"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store Slug
              <span className="text-gray-400 font-normal ml-1">(URL identifier, auto-generated)</span>
            </label>
            <input
              type="text"
              value={storeSlug}
              onChange={(e) => setStoreSlug(e.target.value)}
              required
              aria-required="true"
              placeholder="my-shop"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Username</label>
            <input
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              required
              aria-required="true"
              placeholder="store_admin"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
              aria-required="true"
              minLength={8}
              placeholder="Min. 8 characters"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="sm:col-span-2">
            <PasswordStrengthIndicator password={adminPassword} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
              aria-required="true"
              placeholder="owner@myshop.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {createError && (
            <div className="sm:col-span-2">
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{createError}</p>
            </div>
          )}
          {createSuccess && (
            <div className="sm:col-span-2">
              <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">✓ {createSuccess}</p>
            </div>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating…' : 'Create Store'}
            </button>
          </div>
        </form>
      </div>

      {/* Stores List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">All Stores ({stores.length})</h2>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400" role="status" aria-label="Loading">Loading…</div>
        ) : error ? (
          <div className="px-6 py-4 text-sm text-red-600" role="alert">{error}</div>
        ) : stores.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">No stores yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Store Name</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Slug</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stores.map((store) => (
                <tr key={store.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{store.name}</td>
                  <td className="px-6 py-3 font-mono text-gray-500">{store.slug}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      store.active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {store.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {new Date(store.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => toggleStore(store)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        store.active
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {store.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteStore(store)}
                      className="ml-2 text-xs font-medium px-3 py-1.5 rounded-lg text-red-700 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
