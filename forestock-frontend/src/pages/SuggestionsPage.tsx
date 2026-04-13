import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { captureEvent } from '../lib/analytics'
import { extractErrorMessage } from '../lib/errors'
import SuggestionActions from '../components/suggestions/SuggestionActions'
import SuggestionsList from '../components/suggestions/SuggestionsList'
import type { AckForm, DashboardSummary, Suggestion } from '../components/suggestions/types'

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
  const [reportLoading, setReportLoading] = useState<string | null>(null)
  const [salesReportFrom, setSalesReportFrom] = useState('')
  const [salesReportTo, setSalesReportTo] = useState('')
  const [slowMoverDays, setSlowMoverDays] = useState('30')
  const [showAcknowledged, setShowAcknowledged] = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [generatingPo, setGeneratingPo] = useState(false)
  const [ackForm, setAckForm] = useState<AckForm>({
    acknowledgedReason: '',
    quantityOrdered: '',
    expectedDelivery: '',
    orderReference: '',
  })
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [missingForecast, setMissingForecast] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get('/dashboard')
        setDashboard(data.data ?? null)
      } catch {
        setDashboard(null)
      }
    })()

    void (async () => {
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
        const msg = extractErrorMessage(e, 'No completed forecast run found. Run a forecast first.')
        if ((msg ?? '').toLowerCase().includes('no completed forecast run')) {
          setSuggestions([])
          setMissingForecast(true)
        } else {
          setError(msg ?? 'No completed forecast run found. Run a forecast first.')
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [urgencyFilter, categoryFilter, showAcknowledged])

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

  async function generatePurchaseOrder() {
    if (selectedIds.length === 0) return
    setGeneratingPo(true)
    setError('')
    try {
      const response = await api.post('/suggestions/purchase-order', selectedIds, { responseType: 'blob' })
      downloadBlob(response.data, `forestock-purchase-order-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch {
      setError('Failed to generate purchase order.')
    } finally {
      setGeneratingPo(false)
    }
  }

  async function downloadReport(endpoint: string, filename: string, params?: Record<string, string | number>) {
    setReportLoading(filename)
    try {
      const response = await api.get(endpoint, { params, responseType: 'blob' })
      downloadBlob(response.data, filename)
    } catch {
      setError('Failed to download report.')
    } finally {
      setReportLoading(null)
    }
  }

  const emptyState =
    !loading && !error && suggestions.length === 0
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

  const totalEstimatedOrderValue = suggestions.reduce((sum, suggestion) => sum + (suggestion.estimatedOrderValue ?? 0), 0)
  const forecastGeneratedAt = suggestions[0]?.generatedAt ?? null

  return (
    <div className="space-y-4">
      {forecastGeneratedAt ? (
        <p className="text-sm text-gray-500">
          Forecast last updated: {new Date(forecastGeneratedAt).toLocaleString()}
        </p>
      ) : null}
      <SuggestionActions
        urgencyFilter={urgencyFilter}
        setUrgencyFilter={setUrgencyFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        showAcknowledged={showAcknowledged}
        setShowAcknowledged={setShowAcknowledged}
        exportingExcel={exportingExcel}
        exportingPdf={exportingPdf}
        reportLoading={reportLoading}
        salesReportFrom={salesReportFrom}
        setSalesReportFrom={setSalesReportFrom}
        salesReportTo={salesReportTo}
        setSalesReportTo={setSalesReportTo}
        slowMoverDays={slowMoverDays}
        setSlowMoverDays={setSlowMoverDays}
        selectedCount={selectedIds.length}
        ackForm={ackForm}
        setAckForm={setAckForm}
        bulkSaving={bulkSaving}
        generatingPo={generatingPo}
        onExportExcel={exportExcel}
        onExportPdf={exportPdf}
        onDownloadInventoryValuation={(format) =>
          void downloadReport('/reports/inventory-valuation', `inventory-valuation-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`, { format })
        }
        onDownloadSalesReport={(format) =>
          void downloadReport('/reports/sales', `sales-performance-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`, {
            from: salesReportFrom,
            to: salesReportTo,
            format,
          })
        }
        onDownloadSlowMovers={(format) =>
          void downloadReport('/reports/slow-movers', `slow-movers-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`, {
            inactiveDays: Number(slowMoverDays || '30'),
            format,
          })
        }
        onAcknowledgeBulk={acknowledgeBulk}
        onGeneratePurchaseOrder={generatePurchaseOrder}
      />

      <SuggestionsList
        suggestions={suggestions}
        loading={loading}
        error={error}
        emptyState={emptyState}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        ackForm={ackForm}
        setAckForm={setAckForm}
        acknowledgingId={acknowledgingId}
        onAcknowledgeSuggestion={acknowledgeSuggestion}
        totalEstimatedOrderValue={totalEstimatedOrderValue}
        urgencyStyle={urgencyStyle}
        formatCurrency={formatCurrency}
      />
    </div>
  )
}
