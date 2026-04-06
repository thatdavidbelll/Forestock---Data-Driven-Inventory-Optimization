import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'

interface Transaction {
  id: string
  productSku: string
  productName: string
  saleDate: string
  quantitySold: number
}

interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

type ConfirmAction = {
  title: string
  message: string
  onConfirm: () => Promise<void>
}

export default function SalesPage() {
  const [searchParams] = useSearchParams()
  const [page, setPage] = useState<Page<Transaction> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const PAGE_SIZE = 50

  // Filters
  const [skuFilter, setSkuFilter] = useState(searchParams.get('sku') ?? '')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)

  useEffect(() => {
    fetchTransactions()
  }, [currentPage, skuFilter, fromDate, toDate])

  useEffect(() => {
    setSkuFilter(searchParams.get('sku') ?? '')
    setCurrentPage(0)
  }, [searchParams])

  async function fetchTransactions() {
    setLoading(true)
    setError('')
    try {
      if (fromDate && toDate && fromDate > toDate) {
        setError('Start date must be before end date.')
        return
      }
      const params: Record<string, string | number> = { page: currentPage, size: PAGE_SIZE }
      if (skuFilter.trim()) params.sku = skuFilter.trim()
      if (fromDate) params.from = fromDate
      if (toDate) params.to = toDate
      const { data } = await api.get('/sales', { params })
      setPage(data.data)
    } catch {
      setError('Failed to load transactions.')
    } finally {
      setLoading(false)
    }
  }

  function resetFilters() {
    setSkuFilter('')
    setFromDate('')
    setToDate('')
    setCurrentPage(0)
  }

  // ── Delete helpers ────────────────────────────────────────────────────────

  function askDeleteBySku() {
    if (!skuFilter.trim()) {
      setError('Enter a SKU in the filter to delete transactions for that product.')
      return
    }
    setConfirmAction({
      title: `Delete all transactions for SKU "${skuFilter}"`,
      message: `This will permanently delete ALL sales records for SKU "${skuFilter}". This cannot be undone.`,
      onConfirm: async () => {
        const { data } = await api.delete(`/sales/product/${skuFilter.trim()}`)
        setActionResult(`Deleted ${data.data?.deleted ?? '?'} transactions for "${skuFilter}".`)
        resetFilters()
        fetchTransactions()
      },
    })
  }

  function askDeleteByRange() {
    if (!fromDate || !toDate) {
      setError('Select both From and To dates to delete by date range.')
      return
    }
    setConfirmAction({
      title: `Delete transactions from ${fromDate} to ${toDate}`,
      message: `This will permanently delete ALL transactions in this date range for your store. This cannot be undone.`,
      onConfirm: async () => {
        const { data } = await api.delete('/sales/range', { params: { from: fromDate, to: toDate } })
        setActionResult(`Deleted ${data.data?.deleted ?? '?'} transactions between ${fromDate} and ${toDate}.`)
        resetFilters()
        fetchTransactions()
      },
    })
  }

  function askDeleteBySkuAndRange() {
    if (!skuFilter.trim() || !fromDate || !toDate) {
      setError('Enter a SKU, From date and To date to delete a specific product in a range.')
      return
    }
    setConfirmAction({
      title: `Delete "${skuFilter}" transactions from ${fromDate} to ${toDate}`,
      message: `This will permanently delete all transactions for SKU "${skuFilter}" between ${fromDate} and ${toDate}. This cannot be undone.`,
      onConfirm: async () => {
        const { data } = await api.delete(`/sales/product/${skuFilter.trim()}/range`, {
          params: { from: fromDate, to: toDate },
        })
        setActionResult(`Deleted ${data.data?.deleted ?? '?'} transactions for "${skuFilter}" in the selected range.`)
        resetFilters()
        fetchTransactions()
      },
    })
  }

  function askDeleteAll() {
    setConfirmAction({
      title: '⚠️ Delete ALL transactions',
      message:
        'This will permanently delete EVERY sales transaction for your store. The forecast engine will have no data to work with until you re-import. This cannot be undone.',
      onConfirm: async () => {
        const { data } = await api.delete('/sales/all')
        setActionResult(`Deleted ALL ${data.data?.deleted ?? '?'} transactions for this store.`)
        resetFilters()
        fetchTransactions()
      },
    })
  }

  const totalElements = page?.totalElements ?? 0
  const totalPages = page?.totalPages ?? 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sales Transactions</h1>
          {page && (
            <p className="text-sm text-gray-500 mt-0.5">
              {totalElements.toLocaleString()} transaction{totalElements !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter & Search</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">SKU</label>
            <input
              type="text"
              value={skuFilter}
              onChange={(e) => { setSkuFilter(e.target.value); setCurrentPage(0) }}
              placeholder="e.g. LAPTE-1L"
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setCurrentPage(0) }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setCurrentPage(0) }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={resetFilters}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            Clear
          </button>
        </div>

        {/* Delete actions */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2">
          <p className="w-full text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Delete</p>
          <button
            onClick={askDeleteBySku}
            className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete by SKU
          </button>
          <button
            onClick={askDeleteByRange}
            className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete by date range
          </button>
          <button
            onClick={askDeleteBySkuAndRange}
            className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete SKU + range
          </button>
          <button
            onClick={askDeleteAll}
            className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Delete ALL
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">{error}</p>
      )}
      {actionResult && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3 flex items-center justify-between">
          {actionResult}
          <button onClick={() => setActionResult(null)} className="text-green-500 hover:text-green-700 ml-4">&times;</button>
        </p>
      )}

      {/* Table */}
      {loading && <p className="text-gray-400 text-sm" role="status" aria-label="Loading">Loading…</p>}

      {!loading && page && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'SKU', 'Product', 'Qty Sold'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {page.content.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                page.content.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{t.saleDate}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.productSku}</td>
                    <td className="px-4 py-3 text-gray-900">{t.productName}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{t.quantitySold}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-400 text-xs">
                Page {currentPage + 1} of {totalPages} · {totalElements.toLocaleString()} rows
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{confirmAction.title}</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">{confirmAction.message}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setConfirmAction(null); setError('') }}
                className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await confirmAction.onConfirm()
                    setConfirmAction(null)
                    setError('')
                  } catch (e) {
                    setConfirmAction(null)
                    setError(extractErrorMessage(e, 'Operation failed. Please try again.'))
                  }
                }}
                className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
