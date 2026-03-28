import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'

interface SlowMover {
  productId: string
  sku: string
  name: string
  category: string | null
  currentStock: number
  lastSaleDate: string | null
  daysSinceLastSale: number | null
  estimatedStockValue: number | null
}

type SortKey = 'daysSinceLastSale' | 'estimatedStockValue'

function formatCurrency(value: number | null) {
  if (value == null) return '—'
  return `£${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SlowMoversPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialInactiveDays = searchParams.get('inactiveDays') ?? '30'
  const presetValues = ['30', '60', '90']

  const [items, setItems] = useState<SlowMover[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inactiveDays, setInactiveDays] = useState(initialInactiveDays)
  const [rangeMode, setRangeMode] = useState(presetValues.includes(initialInactiveDays) ? initialInactiveDays : 'custom')
  const [sortBy, setSortBy] = useState<SortKey>('daysSinceLastSale')
  const [disablingId, setDisablingId] = useState<string | null>(null)

  useEffect(() => {
    void fetchSlowMovers()
  }, [inactiveDays])

  async function fetchSlowMovers() {
    setLoading(true)
    setError('')
    try {
      const normalizedDays = Number(inactiveDays) > 0 ? inactiveDays : '30'
      setSearchParams({ inactiveDays: normalizedDays })
      const { data } = await api.get('/inventory/slow-movers', {
        params: { inactiveDays: normalizedDays },
      })
      setItems(data.data ?? [])
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to load slow movers.'))
    } finally {
      setLoading(false)
    }
  }

  async function markAsDiscontinued(productId: string) {
    setDisablingId(productId)
    setError('')
    try {
      await api.delete(`/products/${productId}`)
      setItems((current) => current.filter((item) => item.productId !== productId))
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to discontinue product.'))
    } finally {
      setDisablingId(null)
    }
  }

  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => {
      if (sortBy === 'estimatedStockValue') {
        return (right.estimatedStockValue ?? -1) - (left.estimatedStockValue ?? -1)
      }
      return (right.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER) - (left.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER)
    })
  }, [items, sortBy])

  const totalEstimatedValue = sortedItems.reduce((sum, item) => sum + (item.estimatedStockValue ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Slow Movers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Products with stock on hand but no recent sales activity.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Days inactive</label>
            <select
              value={rangeMode}
              onChange={(e) => {
                const next = e.target.value
                setRangeMode(next)
                if (next !== 'custom') {
                  setInactiveDays(next)
                }
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="90">90</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {rangeMode === 'custom' && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Custom</label>
              <input
                type="number"
                min="1"
                value={inactiveDays}
                onChange={(e) => setInactiveDays(e.target.value)}
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="daysSinceLastSale">Days Inactive</option>
              <option value="estimatedStockValue">Est. Value</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading slow movers…</p>}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!loading && !error && sortedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-semibold text-gray-900">No slow-moving stock right now.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            Every stocked active product has recorded sales within the selected inactivity window.
          </p>
        </div>
      ) : !loading && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                {['Product', 'SKU', 'Category', 'Current Stock', 'Last Sale Date', 'Days Inactive', 'Est. Value', 'Actions'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedItems.map((item) => (
                <tr key={item.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.sku}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{item.currentStock}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.lastSaleDate ? new Date(item.lastSaleDate).toLocaleDateString() : 'Never sold'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {item.daysSinceLastSale != null ? item.daysSinceLastSale : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(item.estimatedStockValue)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void markAsDiscontinued(item.productId)}
                        disabled={disablingId === item.productId}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {disablingId === item.productId ? 'Discontinuing…' : 'Mark as Discontinued'}
                      </button>
                      <Link
                        to={`/sales?sku=${encodeURIComponent(item.sku)}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        View Sales History
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
            Total capital tied up in slow-moving stock: <span className="font-semibold text-gray-900">{formatCurrency(totalEstimatedValue)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
