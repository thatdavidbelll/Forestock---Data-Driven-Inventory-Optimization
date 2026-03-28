import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { captureEvent } from '../lib/analytics'

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
  leadTimeDaysAtGeneration: number | null
  moqApplied: number | null
  estimatedOrderValue: number | null
  supplierName: string | null
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  acknowledged: boolean
  acknowledgedAt: string | null
  acknowledgedReason: string | null
  quantityOrdered: number | null
  expectedDelivery: string | null
  orderReference: string | null
}

interface DashboardSummary {
  totalActiveProducts: number
  lastRunStatus: string | null
}

const urgencyStyle: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800',
}

function formatCurrency(value: number | null) {
  if (value == null) return '—'
  return `£${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [ackForm, setAckForm] = useState({
    acknowledgedReason: '',
    quantityOrdered: '',
    expectedDelivery: '',
    orderReference: '',
  })
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [missingForecast, setMissingForecast] = useState(false)

  useEffect(() => {
    void fetchDashboardSummary()
    fetchSuggestions()
  }, [urgencyFilter, categoryFilter, showAcknowledged])

  async function fetchDashboardSummary() {
    try {
      const { data } = await api.get('/dashboard')
      setDashboard(data.data ?? null)
    } catch {
      setDashboard(null)
    }
  }

  async function fetchSuggestions() {
    setLoading(true)
    setError('')
    setMissingForecast(false)
    try {
      const params: Record<string, string> = {}
      if (urgencyFilter) params.urgency = urgencyFilter
      if (categoryFilter) params.category = categoryFilter
      if (showAcknowledged) params.includeAcknowledged = 'true'
      const { data } = await api.get('/suggestions', { params })
      setSuggestions(data.data ?? [])
      setSelectedIds([])
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      if ((msg ?? '').toLowerCase().includes('no completed forecast run')) {
        setSuggestions([])
        setMissingForecast(true)
      } else {
        setError(msg ?? 'No completed forecast run found. Run a forecast first.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function acknowledgeSuggestion(id: string) {
    setAcknowledgingId(id)
    setError('')
    try {
      const { data } = await api.patch(`/suggestions/${id}/acknowledge`, {
        acknowledgedReason: ackForm.acknowledgedReason || null,
        quantityOrdered: ackForm.quantityOrdered ? Number(ackForm.quantityOrdered) : null,
        expectedDelivery: ackForm.expectedDelivery || null,
        orderReference: ackForm.orderReference || null,
      })
      const updated = data.data as Suggestion
      captureEvent('suggestion_acknowledged', {
        urgency: updated.urgency,
        productSku: updated.productSku,
      })

      setSuggestions((current) => {
        if (showAcknowledged) {
          return current.map((suggestion) => (suggestion.id === id ? updated : suggestion))
        }

        return current.filter((suggestion) => suggestion.id !== id)
      })
      setAckForm({
        acknowledgedReason: '',
        quantityOrdered: '',
        expectedDelivery: '',
        orderReference: '',
      })
    } catch {
      setError('Failed to acknowledge suggestion.')
    } finally {
      setAcknowledgingId(null)
    }
  }

  async function acknowledgeBulk() {
    if (selectedIds.length === 0) return
    setBulkSaving(true)
    setError('')
    try {
      const { data } = await api.post('/suggestions/acknowledge-bulk', {
        suggestionIds: selectedIds,
        acknowledgedReason: ackForm.acknowledgedReason || null,
        quantityOrdered: ackForm.quantityOrdered ? Number(ackForm.quantityOrdered) : null,
        expectedDelivery: ackForm.expectedDelivery || null,
        orderReference: ackForm.orderReference || null,
      })
      const updated = data.data as Suggestion[]
      const updatedIds = new Set(updated.map((item) => item.id))
      setSuggestions((current) => {
        if (showAcknowledged) {
          return current.map((item) => updated.find((candidate) => candidate.id === item.id) ?? item)
        }
        return current.filter((item) => !updatedIds.has(item.id))
      })
      setSelectedIds([])
      setAckForm({
        acknowledgedReason: '',
        quantityOrdered: '',
        expectedDelivery: '',
        orderReference: '',
      })
    } catch {
      setError('Failed to acknowledge selected suggestions.')
    } finally {
      setBulkSaving(false)
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
      captureEvent('report_exported', { format: 'excel' })
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
      captureEvent('report_exported', { format: 'pdf' })
      downloadBlob(response.data, `forestock-suggestions-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch {
      setError('Failed to export PDF report.')
    } finally {
      setExportingPdf(false)
    }
  }

  const emptyState = !loading && !error && suggestions.length === 0
    ? dashboard?.totalActiveProducts === 0
      ? {
          title: 'No products yet.',
          description: 'Add your first product before running forecasts or reviewing suggestions.',
          actions: [
            <Link key="products" to="/products" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Add your first product
            </Link>,
          ],
        }
      : dashboard?.lastRunStatus == null || missingForecast
        ? {
            title: 'No suggestions yet.',
            description: 'Import sales data and run a forecast to generate your first restocking recommendations.',
            actions: [
              <Link key="forecast" to="/dashboard" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Run a forecast
              </Link>,
              <Link key="import" to="/import" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Import sales data
              </Link>,
            ],
          }
        : {
            title: 'Everything looks well-stocked.',
            description: 'Your latest completed forecast did not produce any active restocking suggestions. Check back after your next import.',
            actions: [],
          }
        : null

  const totalEstimatedOrderValue = suggestions.reduce((sum, suggestion) => {
    return sum + (suggestion.estimatedOrderValue ?? 0)
  }, 0)

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

      {!loading && !error && emptyState ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-semibold text-gray-900">{emptyState.title}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">{emptyState.description}</p>
          {emptyState.actions.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {emptyState.actions}
            </div>
          )}
        </div>
      ) : !loading && !error && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {selectedIds.length > 0 && (
            <div className="border-b border-gray-200 bg-indigo-50 px-4 py-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-sm font-medium text-indigo-900">{selectedIds.length} selected</p>
                  <p className="text-xs text-indigo-700">Bulk acknowledge with optional tracking fields.</p>
                </div>
                <input
                  type="text"
                  placeholder="Reason"
                  value={ackForm.acknowledgedReason}
                  onChange={(e) => setAckForm({ ...ackForm, acknowledgedReason: e.target.value })}
                  className="rounded-lg border border-indigo-200 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Qty ordered"
                  value={ackForm.quantityOrdered}
                  onChange={(e) => setAckForm({ ...ackForm, quantityOrdered: e.target.value })}
                  className="w-32 rounded-lg border border-indigo-200 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={ackForm.expectedDelivery}
                  onChange={(e) => setAckForm({ ...ackForm, expectedDelivery: e.target.value })}
                  className="rounded-lg border border-indigo-200 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Order ref"
                  value={ackForm.orderReference}
                  onChange={(e) => setAckForm({ ...ackForm, orderReference: e.target.value })}
                  className="rounded-lg border border-indigo-200 px-3 py-2 text-sm"
                />
                <button
                  onClick={acknowledgeBulk}
                  disabled={bulkSaving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {bulkSaving ? 'Saving…' : 'Acknowledge Selected'}
                </button>
              </div>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['', 'SKU', 'Product', 'Category', 'Supplier', 'Current Stock', 'Days Left', 'Lead Time', 'P50 / P90 (14d)', 'MOQ', 'Suggested Qty', 'Est. Value', 'Urgency', 'Status'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suggestions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={(e) => setSelectedIds((current) => e.target.checked ? [...current, s.id] : current.filter((id) => id !== s.id))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.productSku}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.productName}</td>
                    <td className="px-4 py-3 text-gray-500">{s.productCategory ?? '—'}</td>
                    <td className="max-w-44 px-4 py-3 text-gray-500">
                      <span className="block truncate">{s.supplierName?.trim() || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {s.currentStock != null ? `${s.currentStock} ${s.unit}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {s.daysOfStock != null ? `${Number(s.daysOfStock).toFixed(1)}d` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {s.leadTimeDaysAtGeneration != null ? `${s.leadTimeDaysAtGeneration}d` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {s.forecastP50 != null ? Number(s.forecastP50).toFixed(1) : '—'} /{' '}
                      {s.forecastP90 != null ? Number(s.forecastP90).toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {s.moqApplied != null ? (
                        <span title={`Rounded up to meet MOQ of ${s.moqApplied}`}>
                          {Number(s.moqApplied).toFixed(2)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {s.suggestedQty} {s.unit}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatCurrency(s.estimatedOrderValue)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${urgencyStyle[s.urgency]}`}>
                        {s.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.acknowledged ? (
                        <div className="space-y-1">
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            Acknowledged
                          </span>
                          {(s.acknowledgedReason || s.orderReference) && (
                            <p className="text-xs text-gray-500">
                              {[s.acknowledgedReason, s.orderReference].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Reason"
                            value={ackForm.acknowledgedReason}
                            onChange={(e) => setAckForm({ ...ackForm, acknowledgedReason: e.target.value })}
                            className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="Qty"
                            value={ackForm.quantityOrdered}
                            onChange={(e) => setAckForm({ ...ackForm, quantityOrdered: e.target.value })}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <input
                            type="date"
                            value={ackForm.expectedDelivery}
                            onChange={(e) => setAckForm({ ...ackForm, expectedDelivery: e.target.value })}
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Ref"
                            value={ackForm.orderReference}
                            onChange={(e) => setAckForm({ ...ackForm, orderReference: e.target.value })}
                            className="w-28 rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => acknowledgeSuggestion(s.id)}
                            disabled={acknowledgingId === s.id}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {acknowledgingId === s.id ? 'Saving…' : 'Acknowledge'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {suggestions.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
              <span>{suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}</span>
              <span className="font-medium text-gray-600">
                Total estimated order value: {formatCurrency(totalEstimatedOrderValue)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
