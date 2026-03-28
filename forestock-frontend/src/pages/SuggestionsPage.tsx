import { useEffect, useState } from 'react'
import api from '../lib/api'

interface Suggestion {
  id: string
  productSku: string
  productName: string
  productCategory: string | null
  unit: string
  suggestedQty: number
  forecastP50: number | null
  forecastP90: number | null
  currentStock: number | null
  daysOfStock: number | null
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  acknowledged: boolean
  acknowledgedAt: string | null
}

const urgencyStyle: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800',
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [showAcknowledged, setShowAcknowledged] = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)

  useEffect(() => {
    fetchSuggestions()
  }, [urgencyFilter, categoryFilter, showAcknowledged])

  async function fetchSuggestions() {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (urgencyFilter) params.urgency = urgencyFilter
      if (categoryFilter) params.category = categoryFilter
      if (showAcknowledged) params.includeAcknowledged = 'true'
      const { data } = await api.get('/suggestions', { params })
      setSuggestions(data.data ?? [])
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'No completed forecast run found. Run a forecast first.')
    } finally {
      setLoading(false)
    }
  }

  async function acknowledgeSuggestion(id: string) {
    setAcknowledgingId(id)
    setError('')
    try {
      const { data } = await api.patch(`/suggestions/${id}/acknowledge`)
      const updated = data.data as Suggestion

      setSuggestions((current) => {
        if (showAcknowledged) {
          return current.map((suggestion) => (suggestion.id === id ? updated : suggestion))
        }

        return current.filter((suggestion) => suggestion.id !== id)
      })
    } catch {
      setError('Failed to acknowledge suggestion.')
    } finally {
      setAcknowledgingId(null)
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportExcel() {
    setExportingExcel(true)
    try {
      const params: Record<string, string> = {}
      if (urgencyFilter) params.urgency = urgencyFilter
      if (categoryFilter) params.category = categoryFilter
      const response = await api.get('/suggestions/export/excel', { params, responseType: 'blob' })
      downloadBlob(response.data, `forestock-suggestions-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch {
      setError('Failed to export Excel report.')
    } finally {
      setExportingExcel(false)
    }
  }

  async function exportPdf() {
    setExportingPdf(true)
    try {
      const params: Record<string, string> = {}
      if (urgencyFilter) params.urgency = urgencyFilter
      if (categoryFilter) params.category = categoryFilter
      const response = await api.get('/suggestions/export/pdf', { params, responseType: 'blob' })
      downloadBlob(response.data, `forestock-suggestions-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch {
      setError('Failed to export PDF report.')
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Restock Suggestions</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All urgencies</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <input
            type="text"
            placeholder="Filter by category…"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showAcknowledged}
              onChange={(e) => setShowAcknowledged(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Show acknowledged
          </label>
          <button
            onClick={exportExcel}
            disabled={exportingExcel}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingExcel ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            onClick={exportPdf}
            disabled={exportingPdf}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingPdf ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {error && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">{error}</p>}

      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['SKU', 'Product', 'Category', 'Current Stock', 'Days Left', 'P50 / P90 (14d)', 'Suggested Qty', 'Urgency', 'Status'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suggestions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No suggestions found.
                  </td>
                </tr>
              ) : (
                suggestions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.productSku}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.productName}</td>
                    <td className="px-4 py-3 text-gray-500">{s.productCategory ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {s.currentStock != null ? `${s.currentStock} ${s.unit}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {s.daysOfStock != null ? `${Number(s.daysOfStock).toFixed(1)}d` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {s.forecastP50 != null ? Number(s.forecastP50).toFixed(1) : '—'} /{' '}
                      {s.forecastP90 != null ? Number(s.forecastP90).toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {s.suggestedQty} {s.unit}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${urgencyStyle[s.urgency]}`}>
                        {s.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.acknowledged ? (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          Acknowledged
                        </span>
                      ) : (
                        <button
                          onClick={() => acknowledgeSuggestion(s.id)}
                          disabled={acknowledgingId === s.id}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {acknowledgingId === s.id ? 'Saving…' : 'Acknowledge'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {suggestions.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
