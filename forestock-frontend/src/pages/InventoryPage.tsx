import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import InventoryHistoryModal, { type InventoryHistoryItem } from '../components/InventoryHistoryModal'
import { extractErrorMessage } from '../lib/errors'

type InventoryItem = InventoryHistoryItem

function stockStatus(item: InventoryItem): 'critical' | 'low' | 'ok' {
  if (item.reorderPoint == null) return 'ok'
  if (item.quantity === 0) return 'critical'
  if (item.quantity <= item.reorderPoint) return 'low'
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

const adjustmentReasons = [
  { value: 'MANUAL', label: 'Manual Update' },
  { value: 'DELIVERY_RECEIVED', label: 'Delivery Received' },
  { value: 'PHYSICAL_COUNT', label: 'Physical Count' },
  { value: 'DAMAGE', label: 'Damage / Write-off' },
  { value: 'SHRINKAGE', label: 'Shrinkage' },
  { value: 'RETURN', label: 'Customer Return' },
]

function formatDaysOfStock(item: InventoryItem) {
  if (item.p50Daily == null || item.p50Daily <= 0) return '—'
  return `${(item.quantity / item.p50Daily).toFixed(1)} days`
}

function formatReason(reason: string | null) {
  if (!reason) return '—'
  return reason
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [alertsOnly, setAlertsOnly] = useState(false)

  // Inline stock edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('MANUAL')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [historyProduct, setHistoryProduct] = useState<{ id: string; name: string } | null>(null)

  const fetchInventory = useCallback(async () => {
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
  }, [alertsOnly])

  useEffect(() => {
    void fetchInventory()
  }, [fetchInventory])

  function startEdit(item: InventoryItem) {
    setEditingId(item.productId)
    setEditValue(String(item.quantity))
    setEditReason(item.adjustmentReason ?? 'MANUAL')
    setEditNote('')
    setSaveError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
    setEditReason('MANUAL')
    setEditNote('')
    setSaveError('')
  }

  async function saveStock(productId: string) {
    const qty = Number(editValue)
    if (Number(editValue) < 0) {
      setError('Stock quantity cannot be negative.')
      return
    }
    if (isNaN(qty) || qty < 0) {
      setSaveError('Enter a valid non-negative number.')
      return
    }
    setSaving(true)
    setSaveError('')
    setError('')
    try {
      await api.put(`/inventory/${productId}`, {
        quantity: qty,
        adjustmentReason: editReason,
        adjustmentNote: editNote || null,
      })
      cancelEdit()
      void fetchInventory()
    } catch (e) {
      setSaveError(extractErrorMessage(e, 'Failed to update stock.'))
    } finally {
      setSaving(false)
    }
  }

  const alertCount = items.filter((i) => stockStatus(i) !== 'ok').length

  return (
    <div className="space-y-4">
      <InventoryHistoryModal
        isOpen={historyProduct != null}
        productId={historyProduct?.id ?? null}
        productName={historyProduct?.name ?? ''}
        onClose={() => setHistoryProduct(null)}
      />

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

      {loading && <p className="text-gray-400 text-sm" role="status" aria-label="Loading">Loading…</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3" role="alert">{error}</p>}

      {!loading && items.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {alertsOnly ? 'No stock alerts right now.' : 'No inventory data yet.'}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            {alertsOnly
              ? 'All tracked products are currently above their reorder thresholds.'
              : 'Add products first, then import sales or update stock manually to start tracking inventory.'}
          </p>
          {!alertsOnly && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                to="/products"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Add products
              </Link>
            </div>
          )}
        </div>
      ) : !loading && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['SKU', 'Product', 'Category', 'Current Stock', 'Days of Stock', 'Reorder Point', 'Status', 'Last Updated', 'Actions'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                  const status = stockStatus(item)
                  const isEditing = editingId === item.productId
                  return (
                    <tr key={item.productId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.productSku}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                      <td className="px-4 py-3 text-gray-500">{item.productCategory ?? '—'}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex max-w-sm flex-col gap-2">
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
                            <select
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              {adjustmentReasons.map((reason) => (
                                <option key={reason.value} value={reason.value}>
                                  {reason.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              placeholder="e.g. PO #4521 received"
                              className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {saveError && <p className="text-xs text-red-600" role="alert">{saveError}</p>}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setHistoryProduct({ id: item.productId, name: item.productName })}
                            className={`font-semibold hover:underline ${status === 'critical' ? 'text-red-600' : status === 'low' ? 'text-orange-600' : 'text-gray-900'}`}
                          >
                            {item.quantity} {item.unit}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDaysOfStock(item)}</td>
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
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setHistoryProduct({ id: item.productId, name: item.productName })}
                              className="text-xs text-gray-500 hover:text-gray-700"
                              title="View history"
                            >
                              📈 History
                            </button>
                            <button
                              onClick={() => startEdit(item)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Update stock
                            </button>
                          </div>
                        )}
                        {!isEditing && (item.adjustmentReason || item.adjustmentNote) && (
                          <div className="mt-2 max-w-xs text-xs text-gray-400">
                            {formatReason(item.adjustmentReason)}
                            {item.adjustmentNote ? ` · ${item.adjustmentNote}` : ''}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
          {items.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              {items.length} product{items.length !== 1 ? 's' : ''}
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
