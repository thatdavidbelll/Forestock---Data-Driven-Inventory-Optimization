import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { captureEvent } from '../lib/analytics'
import { extractErrorMessage } from '../lib/errors'
import { isStrongPassword } from '../lib/passwordStrength'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator'

const commonTimezones = [
  'UTC',
  'Europe/Bucharest',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
]

interface StoreConfig {
  timezone: string
  currencySymbol: string
  forecastHorizonDays: number
  lookbackDays: number
  minHistoryDays: number
  seasonalityPeriod: number
  safetyStockMultiplier: number
  urgencyCriticalDays: number
  urgencyHighDays: number
  urgencyMediumDays: number
  autoForecastOnImport: boolean
}

interface CurrentUser {
  id: string
  username: string
  email: string | null
  role: string
  lastLoginAt: string | null
}

interface ShopifyConnection {
  id: string
  shopDomain: string
  active: boolean
  createdAt: string
  updatedAt: string
  hasCustomSecret: boolean
}

export default function SettingsPage() {
  const { username, role } = useAuth()

  // Store info (admin only)
  const [storeName, setStoreName] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [storeLoading, setStoreLoading] = useState(false)
  const [storeSaving, setStoreSaving] = useState(false)
  const [storeSuccess, setStoreSuccess] = useState('')
  const [storeError, setStoreError] = useState('')
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configSuccess, setConfigSuccess] = useState('')
  const [configError, setConfigError] = useState('')
  const [shopifyConnection, setShopifyConnection] = useState<ShopifyConnection | null>(null)
  const [shopifyDomain, setShopifyDomain] = useState('')
  const [shopifySecret, setShopifySecret] = useState('')
  const [shopifyLoading, setShopifyLoading] = useState(false)
  const [shopifySaving, setShopifySaving] = useState(false)
  const [shopifySuccess, setShopifySuccess] = useState('')
  const [shopifyError, setShopifyError] = useState('')

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [exportingData, setExportingData] = useState(false)
  const [exportError, setExportError] = useState('')
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const isAdmin = role === 'ROLE_ADMIN'

  useEffect(() => {
    void loadCurrentUser()
    if (isAdmin) {
      loadStore()
    }
  }, [isAdmin])

  async function loadCurrentUser() {
    try {
      const { data } = await api.get('/users/me')
      setCurrentUser(data.data ?? null)
    } catch {
      setCurrentUser(null)
    }
  }

  async function loadStore() {
    try {
      setStoreLoading(true)
      setConfigLoading(true)
      setShopifyLoading(true)
      const [{ data: storeData }, { data: configData }, { data: shopifyData }] = await Promise.all([
        api.get('/store'),
        api.get('/store/config'),
        api.get('/store/shopify'),
      ])
      setStoreName(storeData.data.name ?? '')
      setStoreSlug(storeData.data.slug ?? '')
      setConfig(configData.data ?? null)
      setShopifyConnection(shopifyData.data ?? null)
      setShopifyDomain(shopifyData.data?.shopDomain ?? '')
      setShopifySecret('')
    } catch (err) {
      setStoreError(extractErrorMessage(err, 'Failed to load store info'))
      setConfigError(extractErrorMessage(err, 'Failed to load store configuration'))
      setShopifyError(extractErrorMessage(err, 'Failed to load Shopify connection'))
    } finally {
      setStoreLoading(false)
      setConfigLoading(false)
      setShopifyLoading(false)
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

  async function handleSaveConfig(e: FormEvent) {
    e.preventDefault()
    if (!config) return

    setConfigError('')
    setConfigSuccess('')

    if (!(config.urgencyCriticalDays < config.urgencyHighDays && config.urgencyHighDays < config.urgencyMediumDays)) {
      setConfigError('Urgency thresholds must be in ascending order.')
      return
    }

    setConfigSaving(true)
    try {
      await api.put('/store/config', config)
      setConfigSuccess('Forecast & restocking settings updated.')
    } catch (err) {
      setConfigError(extractErrorMessage(err, 'Failed to update store configuration'))
    } finally {
      setConfigSaving(false)
    }
  }

  async function handleConnectShopify(e: FormEvent) {
    e.preventDefault()
    setShopifyError('')
    setShopifySuccess('')
    setShopifySaving(true)

    try {
      const payload = {
        shopDomain: shopifyDomain.trim(),
        webhookSecret: shopifySecret.trim() || undefined,
      }
      const { data } = await api.post('/store/shopify', payload)
      setShopifyConnection(data.data ?? null)
      setShopifyDomain(data.data?.shopDomain ?? payload.shopDomain)
      setShopifySecret('')
      setShopifySuccess('Shopify store connected.')
      captureEvent('shopify_connection_created')
    } catch (err) {
      setShopifyError(extractErrorMessage(err, 'Failed to connect Shopify store'))
    } finally {
      setShopifySaving(false)
    }
  }

  async function handleToggleShopify(active: boolean) {
    setShopifyError('')
    setShopifySuccess('')
    setShopifySaving(true)

    try {
      const { data } = await api.put(`/store/shopify/toggle?active=${active}`)
      setShopifyConnection(data.data ?? null)
      setShopifySuccess(active ? 'Shopify connection activated.' : 'Shopify connection paused.')
      captureEvent(active ? 'shopify_connection_activated' : 'shopify_connection_deactivated')
    } catch (err) {
      setShopifyError(extractErrorMessage(err, 'Failed to update Shopify connection'))
    } finally {
      setShopifySaving(false)
    }
  }

  async function handleDeleteShopify() {
    if (!window.confirm('Disconnect this Shopify store? New Shopify webhooks will stop being processed.')) {
      return
    }

    setShopifyError('')
    setShopifySuccess('')
    setShopifySaving(true)

    try {
      await api.delete('/store/shopify')
      setShopifyConnection(null)
      setShopifyDomain('')
      setShopifySecret('')
      setShopifySuccess('Shopify store disconnected.')
      captureEvent('shopify_connection_deleted')
    } catch (err) {
      setShopifyError(extractErrorMessage(err, 'Failed to disconnect Shopify store'))
    } finally {
      setShopifySaving(false)
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

      {/* Section 1: Store Profile */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Store Profile</h2>
          {storeLoading ? (
            <p className="text-sm text-gray-400" role="status" aria-label="Loading">Loading…</p>
          ) : (
            <form onSubmit={handleSaveStore} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  aria-required="true"
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
              {config && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                    <select
                      value={config.timezone}
                      onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {commonTimezones.map((timezone) => (
                        <option key={timezone} value={timezone}>
                          {timezone}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency Symbol</label>
                    <input
                      type="text"
                      maxLength={5}
                      value={config.currencySymbol}
                      onChange={(e) => setConfig({ ...config, currencySymbol: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
              {storeError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{storeError}</p>}
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

      {/* Section 2: Forecast & Restocking */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Forecast & Restocking</h2>
          {configLoading || !config ? (
            <p className="text-sm text-gray-400" role="status" aria-label="Loading">Loading…</p>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Forecast Horizon</label>
                  <span className="text-sm text-gray-500">{config.forecastHorizonDays} days</span>
                </div>
                <input
                  type="range"
                  min="7"
                  max="90"
                  value={config.forecastHorizonDays}
                  onChange={(e) => setConfig({ ...config, forecastHorizonDays: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Safety Stock Buffer</label>
                  <span className="text-sm text-gray-500">{Math.round(config.safetyStockMultiplier * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="200"
                  value={Math.round(config.safetyStockMultiplier * 100)}
                  onChange={(e) => setConfig({ ...config, safetyStockMultiplier: Number(e.target.value) / 100 })}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Critical &lt; days</label>
                  <input
                    type="number"
                    min="0"
                    value={config.urgencyCriticalDays}
                    onChange={(e) => setConfig({ ...config, urgencyCriticalDays: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">High &lt; days</label>
                  <input
                    type="number"
                    min="0"
                    value={config.urgencyHighDays}
                    onChange={(e) => setConfig({ ...config, urgencyHighDays: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medium &lt; days</label>
                  <input
                    type="number"
                    min="0"
                    value={config.urgencyMediumDays}
                    onChange={(e) => setConfig({ ...config, urgencyMediumDays: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Thresholds must be ascending: Critical &lt; High &lt; Medium.</p>

              <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={config.autoForecastOnImport}
                  onChange={(e) => setConfig({ ...config, autoForecastOnImport: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Run a forecast automatically after a successful sales import.
              </label>

              {configError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{configError}</p>}
              {configSuccess && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">✓ {configSuccess}</p>}

              <button
                type="submit"
                disabled={configSaving}
                className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {configSaving ? 'Saving…' : 'Save Forecast Settings'}
              </button>
            </form>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Shopify</h2>
              <p className="mt-1 text-sm text-gray-500">
                Connect Shopify first so new orders can flow into Forestock. Use CSV import to backfill older sales history.
              </p>
            </div>
            {shopifyConnection && (
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                shopifyConnection.active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {shopifyConnection.active ? 'Active' : 'Paused'}
              </span>
            )}
          </div>

          {shopifyLoading ? (
            <p className="mt-4 text-sm text-gray-400" role="status" aria-label="Loading">Loading…</p>
          ) : shopifyConnection ? (
            <div className="mt-5 space-y-5">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{shopifyConnection.shopDomain}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Connected {new Date(shopifyConnection.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Webhook secret: {shopifyConnection.hasCustomSecret ? 'custom secret configured' : 'using default app secret'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {shopifyConnection.active ? (
                      <button
                        type="button"
                        onClick={() => void handleToggleShopify(false)}
                        disabled={shopifySaving}
                        className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                      >
                        Pause Connection
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleToggleShopify(true)}
                        disabled={shopifySaving}
                        className="rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-50 disabled:opacity-50"
                      >
                        Reactivate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteShopify()}
                      disabled={shopifySaving}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
              {shopifyError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{shopifyError}</p>}
              {shopifySuccess && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">✓ {shopifySuccess}</p>}
            </div>
          ) : (
            <form onSubmit={handleConnectShopify} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shop Domain</label>
                  <input
                    type="text"
                    value={shopifyDomain}
                    onChange={(e) => setShopifyDomain(e.target.value)}
                    placeholder="example.myshopify.com"
                    required
                    aria-required="true"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret</label>
                  <input
                    type="password"
                    value={shopifySecret}
                    onChange={(e) => setShopifySecret(e.target.value)}
                    placeholder="Optional override"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Start with the shop domain. Add a webhook secret only if this store should use a secret different from the platform default.
              </p>
              {shopifyError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{shopifyError}</p>}
              {shopifySuccess && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">✓ {shopifySuccess}</p>}
              <button
                type="submit"
                disabled={shopifySaving}
                className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {shopifySaving ? 'Connecting…' : 'Connect Shopify'}
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

      {/* Section 3: Account */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Account</h2>
        <div className="flex items-center gap-3 mb-6">
          <div>
            <p className="text-sm font-medium text-gray-900">{username}</p>
            <p className="text-xs text-gray-400">{role}</p>
            <p className="mt-1 text-xs text-gray-500">
              Last signed in: {currentUser?.lastLoginAt ? new Date(currentUser.lastLoginAt).toLocaleString() : '—'}
            </p>
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
              aria-required="true"
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
              aria-required="true"
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
              aria-required="true"
              placeholder="Repeat new password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <PasswordStrengthIndicator password={newPassword} />
          {passwordError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{passwordError}</p>}
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

      {/* Section 4: Data & Privacy */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Data & Privacy</h2>
        <p className="mt-1 text-sm text-gray-500">
          Download a ZIP archive containing your profile, products, sales history, and current inventory snapshot.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportData}
            disabled={exportingData}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {exportingData ? 'Preparing export…' : 'Download my data'}
          </button>
          <button
            type="button"
            disabled
            title="Contact support to delete your account"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
          >
            Delete my account
          </button>
        </div>
        {exportError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{exportError}</p>}
      </div>
    </div>
  )
}
