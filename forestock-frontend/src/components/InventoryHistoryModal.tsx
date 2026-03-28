import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'

export interface InventoryHistoryItem {
  id: string
  productId: string
  productSku: string
  productName: string
  productCategory: string | null
  unit: string
  quantity: number
  reorderPoint: number | null
  belowReorderPoint: boolean
  p50Daily: number | null
  adjustmentReason: string | null
  adjustmentNote: string | null
  adjustedBy: string | null
  recordedAt: string
}

interface InventoryHistoryModalProps {
  isOpen: boolean
  productId: string | null
  productName: string
  onClose: () => void
}

function formatReason(reason: string | null) {
  if (!reason) return '—'
  return reason
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

export default function InventoryHistoryModal({
  isOpen,
  productId,
  productName,
  onClose,
}: InventoryHistoryModalProps) {
  const [history, setHistory] = useState<InventoryHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !productId) return

    async function fetchHistory() {
      setLoading(true)
      setError('')
      try {
        const { data } = await api.get(`/inventory/${productId}/history`)
        setHistory(data.data ?? [])
      } catch (e) {
        setError(extractErrorMessage(e, 'Failed to load inventory history.'))
      } finally {
        setLoading(false)
      }
    }

    void fetchHistory()
  }, [isOpen, productId])

  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const chartData = [...history]
    .reverse()
    .map((item) => ({
      date: new Date(item.recordedAt).toLocaleDateString(),
      quantity: item.quantity,
    }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 px-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inventory History</h2>
            <p className="mt-1 text-sm text-gray-500">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {loading && <p className="text-sm text-gray-500">Loading history…</p>}
          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {!loading && !error && history.length <= 1 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
              <h3 className="text-lg font-semibold text-gray-900">Update stock to start tracking history</h3>
              <p className="mt-2 text-sm text-gray-500">
                This product needs more than one snapshot before a stock trend chart becomes useful.
              </p>
            </div>
          )}

          {!loading && !error && history.length > 1 && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="quantity"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Quantity', 'Reason', 'Note', 'Who'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(item.recordedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatReason(item.adjustmentReason)}</td>
                      <td className="px-4 py-3 text-gray-600">{item.adjustmentNote || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{item.adjustedBy || 'system'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
