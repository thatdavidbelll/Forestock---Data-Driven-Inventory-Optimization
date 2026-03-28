import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'

interface AuditLog {
  id: string
  actorUsername: string
  action: string
  entityType: string | null
  entityId: string | null
  detail: string | null
  occurredAt: string
}

interface AuditLogPageData {
  content: AuditLog[]
  number: number
  totalPages: number
  totalElements: number
  first: boolean
  last: boolean
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  useEffect(() => {
    void loadLogs(page)
  }, [page])

  async function loadLogs(targetPage: number) {
    try {
      setLoading(true)
      setError('')
      const { data } = await api.get('/audit-logs', {
        params: {
          page: targetPage,
          size: 20,
          action: actionFilter || undefined,
          actor: actorFilter || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      })

      const pageData = data.data as AuditLogPageData
      setLogs(pageData.content ?? [])
      setTotalPages(pageData.totalPages ?? 0)
      setTotalElements(pageData.totalElements ?? 0)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load audit logs'))
    } finally {
      setLoading(false)
    }
  }

  async function applyFilters() {
    setPage(0)
    await loadLogs(0)
  }

  async function exportCsv() {
    try {
      const response = await api.get('/audit-logs/export/csv', {
        params: {
          action: actionFilter || undefined,
          actor: actorFilter || undefined,
          from: from || undefined,
          to: to || undefined,
        },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'audit-logs.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to export audit logs'))
    }
  }

  function renderDetail(detail: string | null, entityId: string | null) {
    if (!detail) return entityId ?? '—'
    try {
      const parsed = JSON.parse(detail) as {
        before?: Record<string, unknown>
        after?: Record<string, unknown>
        reason?: string
        note?: string
      }
      if (parsed.before || parsed.after) {
        const keys = Array.from(new Set([
          ...Object.keys(parsed.before ?? {}),
          ...Object.keys(parsed.after ?? {}),
        ]))
        const parts = keys.map((key) => {
          const before = parsed.before?.[key]
          const after = parsed.after?.[key]
          return `${key}: ${before ?? '—'} → ${after ?? '—'}`
        })
        if (parsed.reason) parts.push(`reason: ${parsed.reason}`)
        if (parsed.note) parts.push(`note: ${parsed.note}`)
        return parts.join(' · ')
      }
      return JSON.stringify(parsed)
    } catch {
      return detail
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">Track changes made across your store.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void exportCsv()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
          <Link
            to="/settings"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Back to Settings
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="e.g. USER_CREATED"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actor</label>
            <input
              type="text"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder="username contains…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => void applyFilters()}
              className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Events</h2>
          <span className="text-sm text-gray-400">{totalElements} total</span>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-gray-400 text-center">Loading…</div>
        ) : error ? (
          <div className="px-6 py-4 text-sm text-red-600">{error}</div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-400 text-center">No audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">When</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Entity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.occurredAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{log.actorUsername}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {log.entityType ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 min-w-80">
                      {renderDetail(log.detail, log.entityId)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          disabled={page === 0 || loading}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
        >
          Previous
        </button>
        <p className="text-sm text-gray-500">
          Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
        </p>
        <button
          onClick={() => setPage((current) => (current + 1 < totalPages ? current + 1 : current))}
          disabled={loading || totalPages === 0 || page + 1 >= totalPages}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
