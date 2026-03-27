import { useEffect, useState } from 'react'
import api from '../lib/api'

interface InventoryItem {
  productId: string
  productSku: string
  productName: string
  productCategory: string | null
  unit: string
  currentStock: number
  reorderPoint: number | null
  recordedAt: string
}

function stockStatus(item: InventoryItem): 'critical' | 'low' | 'ok' {
  if (item.reorderPoint == null) return 'ok'
  if (item.currentStock === 0) return 'critical'
  if (item.currentStock <= item.reorderPoint) return 'low'
  return 'ok'
}

const statusStyle = {
  critical: 'bg-red-100 text-red-800',
  low: 'bg-orange-100 text-orange-800',
  ok: 'bg-green-100 text-green-800',
}
const statusLabel = {
  critical: 'Out of stock',
  low: 'Low stock',
  ok: 'OK',
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [alertsOnly, setAlertsOnly] = useState(false)

  // Inline stock edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchInventory()
  }, [alertsOnly])

  async function fetchInventory() {
    setLoading(true)
    setError('')
    try {
      const url = alertsOnly ? '/inventory/alerts' : '/inventory'
      const { data } = await api.get(url)
      setItems(data.data ?? [])
    } catch {
      setError('Failed to load inventory.')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(item: InventoryItem) {
    setEditingId(item.productId)
    setEditValue(String(item.currentStock))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  async function saveStock(productId: string) {
    const qty = Number(editValue)
    if (isNaN(qty) || qty < 0) return
    setSaving(true)
    try {
      await api.put(`/inventory/${productId}`, { quantity: qty })
      setEditingId(null)
      fetchInventory()
    } catch {
      // keep editing open on error
    } finally {
      setSaving(false)
    }
  }

  const displayed = items

  const alertCount = items.filter((i) => stockStatus(i) !== 'ok').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {items.length} products{alertCount > 0 ? ` · ${alertCount} alert${alertCount !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alertsOnly}
              onChange={(e) => setAlertsOnly(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Alerts only
          </label>
          <button
            onClick={fetchInventory}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      {!loading && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['SKU', 'Product', 'Category', 'Current Stock', 'Reorder Point', 'Status', 'Last Updated', 'Actions'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    {alertsOnly ? 'No stock alerts.' : 'No inventory data.'}
                  </td>
                </tr>
              ) : (
                displayed.map((item) => {
                  const status = stockStatus(item)
                  const isEditing = editingId === item.productId
                  return (
                    <tr key={item.productId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.productSku}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                      <td className="px-4 py-3 text-gray-500">{item.productCategory ?? '—'}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveStock(item.productId)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              className="w-24 border border-indigo-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                            <span className="text-gray-400 text-xs">{item.unit}</span>
                          </div>
                        ) : (
                          <span className={`font-semibold ${status === 'critical' ? 'text-red-600' : status === 'low' ? 'text-orange-600' : 'text-gray-900'}`}>
                            {item.currentStock} {item.unit}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {item.reorderPoint != null ? `${item.reorderPoint} ${item.unit}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle[status]}`}>
                          {statusLabel[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(item.recordedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveStock(item.productId)}
                              disabled={saving}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(item)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Update stock
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          {displayed.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              {displayed.length} product{displayed.length !== 1 ? 's' : ''}
              {alertCount > 0 && !alertsOnly && (
                <span className="ml-2 text-orange-600 font-medium">{alertCount} below reorder point</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
