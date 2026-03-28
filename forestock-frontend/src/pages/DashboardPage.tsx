import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

interface Dashboard {
  totalActiveProducts: number
  alertsCount: number
  criticalCount: number
  highCount: number
  lastRunStatus: string | null
  lastRunAt: string | null
}

interface KardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'red' | 'orange' | 'green' | 'default'
}

function Kard({ label, value, sub, accent = 'default' }: KardProps) {
  const colors = {
    red: 'border-red-200 bg-red-50',
    orange: 'border-orange-200 bg-orange-50',
    green: 'border-green-200 bg-green-50',
    default: 'border-gray-200 bg-white',
  }
  const valueColors = {
    red: 'text-red-700',
    orange: 'text-orange-700',
    green: 'text-green-700',
    default: 'text-gray-900',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[accent]}`}>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColors[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState('')
  const [forecastStatus, setForecastStatus] = useState<string | null>(null)
  const [forecastStatusAt, setForecastStatusAt] = useState<string | null>(null)
  const pollIntervalRef = useRef<number | null>(null)
  const pollTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    void loadDashboard()

    return () => {
      stopPolling()
    }
  }, [])

  async function loadDashboard() {
    try {
      const response = await api.get('/dashboard')
      const nextData = response.data.data as Dashboard
      setData(nextData)
      setForecastStatus(nextData.lastRunStatus)
      setForecastStatusAt(nextData.lastRunAt)
    } finally {
      setLoading(false)
    }
  }

  async function triggerForecast() {
    setTriggering(true)
    setTriggerMsg('')
    try {
      await api.post('/forecast/run')
      setForecastStatus('RUNNING')
      setForecastStatusAt(new Date().toISOString())
      setTriggerMsg('Forecast started in background.')
      startPolling()
    } catch {
      setTriggerMsg('Failed to trigger forecast.')
    } finally {
      setTriggering(false)
    }
  }

  function startPolling() {
    stopPolling()

    pollIntervalRef.current = window.setInterval(() => {
      void pollLatestRun()
    }, 3000)

    pollTimeoutRef.current = window.setTimeout(() => {
      stopPolling()
      setTriggerMsg('Forecast is taking longer than expected. Refresh the page later.')
    }, 60000)
  }

  function stopPolling() {
    if (pollIntervalRef.current != null) {
      window.clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (pollTimeoutRef.current != null) {
      window.clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }

  async function pollLatestRun() {
    try {
      const response = await api.get('/forecast/runs')
      const latestRun = (response.data.data as Array<{
        status: string
        startedAt: string | null
        finishedAt: string | null
        errorMessage: string | null
      }>)?.[0]

      if (!latestRun) {
        return
      }

      setForecastStatus(latestRun.status)
      setForecastStatusAt(latestRun.finishedAt ?? latestRun.startedAt)

      if (latestRun.status === 'COMPLETED' || latestRun.status === 'FAILED') {
        stopPolling()
        await loadDashboard()
        setTriggerMsg(
          latestRun.status === 'COMPLETED'
            ? 'Forecast completed successfully.'
            : (latestRun.errorMessage || 'Forecast failed.')
        )
      }
    } catch {
      stopPolling()
      setTriggerMsg('Unable to refresh forecast status. Refresh the page later.')
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>
  if (!data) return <p className="text-red-500 text-sm">Failed to load dashboard.</p>

  const showOnboarding = data.lastRunStatus == null
  const onboardingSteps = data.totalActiveProducts === 0
    ? [
        {
          title: 'Add your products',
          description: 'Create the items you want Forestock to track and forecast.',
          action: <Link to="/products" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Go to Products</Link>,
        },
        {
          title: 'Import sales data',
          description: 'Upload a CSV export from your POS so the forecast has history to learn from.',
          action: <Link to="/import" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Go to Import</Link>,
        },
        {
          title: 'Run a forecast',
          description: 'Generate your first restocking suggestions once products and sales are in place.',
          action: (
            <button
              onClick={triggerForecast}
              disabled={triggering}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              {triggering ? 'Starting…' : 'Run Forecast'}
            </button>
          ),
        },
      ]
    : [
        {
          title: 'Import sales data',
          description: 'Upload recent sales so the engine has enough history to produce useful output.',
          action: <Link to="/import" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Go to Import</Link>,
        },
        {
          title: 'Run a forecast',
          description: 'Kick off your first forecast and come back here for inventory signals.',
          action: (
            <button
              onClick={triggerForecast}
              disabled={triggering}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              {triggering ? 'Starting…' : 'Run Forecast'}
            </button>
          ),
        },
      ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          {triggerMsg && (
            <span className={`text-sm ${
              triggerMsg.toLowerCase().includes('failed') || triggerMsg.toLowerCase().includes('unable')
                ? 'text-red-600'
                : triggerMsg.toLowerCase().includes('completed')
                  ? 'text-green-600'
                  : 'text-gray-500'
            }`}>
              {triggerMsg}
            </span>
          )}
          <button
            onClick={triggerForecast}
            disabled={triggering || forecastStatus === 'RUNNING'}
            className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {triggering ? 'Starting…' : forecastStatus === 'RUNNING' ? 'Forecast Running…' : 'Run Forecast'}
          </button>
        </div>
      </div>

      {showOnboarding ? (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Getting Started</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">
              {data.totalActiveProducts === 0 ? 'Set up your store in three steps.' : 'You are one forecast away from live suggestions.'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {data.totalActiveProducts === 0
                ? 'Add products, import historical sales, and run the first forecast to unlock the dashboard.'
                : 'Your products are ready. Import sales history and run the first forecast to populate alerts and recommendations.'}
            </p>
          </div>
          <div className={`mt-6 grid gap-4 ${onboardingSteps.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            {onboardingSteps.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold text-indigo-600">Step {index + 1}</p>
                <h3 className="mt-2 text-base font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{step.description}</p>
                <div className="mt-4">{step.action}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kard label="Active Products" value={data.totalActiveProducts} />
          <Kard
            label="Low Stock Alerts"
            value={data.alertsCount}
            accent={data.alertsCount > 0 ? 'orange' : 'green'}
          />
          <Kard
            label="CRITICAL"
            value={data.criticalCount}
            sub="need immediate restocking"
            accent={data.criticalCount > 0 ? 'red' : 'default'}
          />
          <Kard
            label="HIGH"
            value={data.highCount}
            sub="restock soon"
            accent={data.highCount > 0 ? 'orange' : 'default'}
          />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Last Forecast Run</h2>
        {forecastStatus ? (
          <div className="flex items-center gap-4">
            <StatusBadge status={forecastStatus} />
            <span className="text-sm text-gray-500">
              {forecastStatusAt ? new Date(forecastStatusAt).toLocaleString() : '—'}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No forecast runs yet.</p>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}
