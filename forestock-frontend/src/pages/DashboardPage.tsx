import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../lib/api'
import { captureEvent } from '../lib/analytics'

interface Dashboard {
  totalActiveProducts: number
  alertsCount: number
  criticalCount: number
  highCount: number
  slowMoversCount: number
  deadStockCount: number
  lastRunStatus: string | null
  lastRunAt: string | null
  accuracyScore?: {
    lastRunMape: number | null
    trend: string
    evaluatedForecasts: number
  } | null
  alertTrend: Array<{ date: string; critical: number; high: number }>
  topCritical: Array<{ productName: string; sku: string; daysOfStock: number | null; suggestedQty: number; estimatedOrderValue: number | null }>
  salesVelocityTrend: Array<{ date: string; totalUnitsSold: number }>
  dataQualityWarnings: string[]
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
    const controller = new AbortController()
    void loadDashboard(controller.signal)

    return () => {
      controller.abort()
      stopPolling()
    }
  }, [])

  async function loadDashboard(signal?: AbortSignal) {
    try {
      const response = await api.get('/dashboard', { signal })
      const nextData = response.data.data as Dashboard
      setData(nextData)
      setForecastStatus(nextData.lastRunStatus)
      setForecastStatusAt(nextData.lastRunAt)
    } catch (e) {
      if (
        (e as { name?: string; code?: string }).name === 'AbortError' ||
        (e as { name?: string; code?: string }).code === 'ERR_CANCELED'
      ) {
        return
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  async function triggerForecast() {
    setTriggering(true)
    setTriggerMsg('')
    try {
      await api.post('/forecast/run')
      captureEvent('forecast_run_triggered')
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
        durationSeconds: number | null
        productsWithInsufficientData: number | null
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
  const accuracy = data.accuracyScore
  const accuracyValue = accuracy?.lastRunMape != null
    ? `${Math.max(0, 100 - Number(accuracy.lastRunMape)).toFixed(1)}%`
    : '—'
  const accuracySub = accuracy?.lastRunMape != null
    ? `Based on ${accuracy.evaluatedForecasts} forecast${accuracy.evaluatedForecasts !== 1 ? 's' : ''} evaluated`
    : 'Accuracy calculated after the forecast window closes'
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
          <Kard
            label="Forecast Accuracy"
            value={accuracyValue}
            sub={accuracySub}
            accent={accuracy?.lastRunMape != null && accuracy.lastRunMape <= 10 ? 'green' : 'default'}
          />
        </div>
      )}

      {!showOnboarding && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Link to="/slow-movers" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 transition-colors hover:bg-amber-100">
            <p className="text-sm font-semibold text-amber-900">Slow Movers</p>
            <p className="mt-2 text-3xl font-bold text-amber-800">{data.slowMoversCount}</p>
            <p className="mt-1 text-xs text-amber-700">Products with no sales in the last 30 days</p>
          </Link>
          <Link to="/slow-movers?inactiveDays=90" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 transition-colors hover:bg-rose-100">
            <p className="text-sm font-semibold text-rose-900">Dead Stock</p>
            <p className="mt-2 text-3xl font-bold text-rose-800">{data.deadStockCount}</p>
            <p className="mt-1 text-xs text-rose-700">Products with no sales in the last 90 days</p>
          </Link>
        </div>
      )}

      {!showOnboarding && (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Alert History</h2>
                  <p className="text-xs text-gray-500">Critical and high-priority alerts over the last 10 completed runs.</p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.alertTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="critical" stackId="alerts" fill="#dc2626" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="high" stackId="alerts" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Top 5 Critical</h2>
                <p className="text-xs text-gray-500">Products that need immediate attention from the latest run.</p>
              </div>
              {data.topCritical.length === 0 ? (
                <p className="text-sm text-gray-400">No critical products right now.</p>
              ) : (
                <div className="space-y-3">
                  {data.topCritical.map((item) => (
                    <div key={item.sku} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.sku}</p>
                        </div>
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          {item.daysOfStock != null ? `${Number(item.daysOfStock).toFixed(1)}d left` : 'No stock data'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                        <span>Suggested: {item.suggestedQty}</span>
                        <span>{item.estimatedOrderValue != null ? `£${item.estimatedOrderValue.toFixed(2)}` : 'No cost set'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Sales Volume</h2>
                <p className="text-xs text-gray-500">Total units sold per day across the last 30 days.</p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.salesVelocityTrend}>
                    <defs>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="totalUnitsSold" stroke="#2563eb" fill="url(#salesFill)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-gray-900">Data Quality</h2>
                <p className="mt-1 text-xs text-gray-500">Warnings that can reduce forecast quality.</p>
                {data.dataQualityWarnings.length === 0 ? (
                  <p className="mt-4 text-sm text-green-700">No data quality warnings.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {data.dataQualityWarnings.map((warning) => (
                      <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-gray-900">Last Forecast Run</h2>
                {forecastStatus ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-4">
                      <StatusBadge status={forecastStatus} />
                      <span className="text-sm text-gray-500">
                        {forecastStatusAt ? new Date(forecastStatusAt).toLocaleString() : '—'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>Forecast accuracy trend: {accuracy?.trend ?? 'pending'}</span>
                      <span>Evaluated forecasts: {accuracy?.evaluatedForecasts ?? 0}</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">No forecast runs yet.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
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
