import { useEffect, useState } from 'react'
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

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data.data)).finally(() => setLoading(false))
  }, [])

  async function triggerForecast() {
    setTriggering(true)
    setTriggerMsg('')
    try {
      await api.post('/forecast/run')
      setTriggerMsg('Forecast started in background. Refresh in a minute.')
    } catch {
      setTriggerMsg('Failed to trigger forecast.')
    } finally {
      setTriggering(false)
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>
  if (!data) return <p className="text-red-500 text-sm">Failed to load dashboard.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          {triggerMsg && <span className="text-sm text-gray-500">{triggerMsg}</span>}
          <button
            onClick={triggerForecast}
            disabled={triggering}
            className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {triggering ? 'Starting…' : 'Run Forecast'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Last Forecast Run</h2>
        {data.lastRunStatus ? (
          <div className="flex items-center gap-4">
            <StatusBadge status={data.lastRunStatus} />
            <span className="text-sm text-gray-500">
              {data.lastRunAt ? new Date(data.lastRunAt).toLocaleString() : '—'}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No forecast runs yet. Click "Run Forecast" to start.</p>
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
