import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { AckForm, Suggestion } from './types'

interface SuggestionsListProps {
  suggestions: Suggestion[]
  loading: boolean
  error: string
  emptyState:
    | {
        title: string
        description: string
        actions: ReactNode[]
      }
    | null
  selectedIds: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  ackForm: AckForm
  setAckForm: Dispatch<SetStateAction<AckForm>>
  acknowledgingId: string | null
  onAcknowledgeSuggestion: (id: string) => void
  totalEstimatedOrderValue: number
  urgencyStyle: Record<string, string>
  formatCurrency: (value: number | null) => string
}

export default function SuggestionsList({
  suggestions,
  loading,
  error,
  emptyState,
  selectedIds,
  setSelectedIds,
  ackForm,
  setAckForm,
  acknowledgingId,
  onAcknowledgeSuggestion,
  totalEstimatedOrderValue,
  urgencyStyle,
  formatCurrency,
}: SuggestionsListProps) {
  if (loading) return <p className="text-sm text-gray-500" role="status" aria-label="Loading">Loading…</p>
  if (error) return <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700" role="alert">{error}</p>

  if (emptyState) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
        <h2 className="text-xl font-semibold text-gray-900">{emptyState.title}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">{emptyState.description}</p>
        {emptyState.actions.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {emptyState.actions}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            {['', 'SKU', 'Product', 'Category', 'Supplier', 'Current Stock', 'Days Left', 'Lead Time', 'P50 / P90 (14d)', 'MOQ', 'Suggested Qty', 'Est. Value', 'Urgency', 'Status'].map((heading) => (
              <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {suggestions.map((suggestion) => (
            <tr key={suggestion.id} className="transition-colors hover:bg-gray-50">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(suggestion.id)}
                  onChange={(e) =>
                    setSelectedIds((current) =>
                      e.target.checked ? [...current, suggestion.id] : current.filter((id) => id !== suggestion.id)
                    )
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-600">{suggestion.productSku}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{suggestion.productName}</td>
              <td className="px-4 py-3 text-gray-500">{suggestion.productCategory ?? '—'}</td>
              <td className="max-w-44 px-4 py-3 text-gray-500">
                <span className="block truncate">{suggestion.supplierName?.trim() || '—'}</span>
              </td>
              <td className="px-4 py-3 text-gray-700">
                {suggestion.currentStock != null ? `${suggestion.currentStock} ${suggestion.unit}` : '—'}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {suggestion.daysOfStock != null ? `${Number(suggestion.daysOfStock).toFixed(1)}d` : '—'}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {suggestion.leadTimeDaysAtGeneration != null ? `${suggestion.leadTimeDaysAtGeneration}d` : '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {suggestion.forecastP50 != null ? Number(suggestion.forecastP50).toFixed(1) : '—'} /{' '}
                {suggestion.forecastP90 != null ? Number(suggestion.forecastP90).toFixed(1) : '—'}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {suggestion.moqApplied != null ? (
                  <span title={`Rounded up to meet MOQ of ${suggestion.moqApplied}`}>
                    {Number(suggestion.moqApplied).toFixed(2)}
                  </span>
                ) : '—'}
              </td>
              <td className="px-4 py-3 font-semibold text-gray-900">
                {suggestion.suggestedQty} {suggestion.unit}
              </td>
              <td className="px-4 py-3 text-gray-700">{formatCurrency(suggestion.estimatedOrderValue)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${urgencyStyle[suggestion.urgency]}`}>
                  {suggestion.urgency}
                </span>
              </td>
              <td className="px-4 py-3">
                {suggestion.acknowledged ? (
                  <div className="space-y-1">
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      Acknowledged
                    </span>
                    {(suggestion.acknowledgedReason || suggestion.orderReference) && (
                      <p className="text-xs text-gray-500">
                        {[suggestion.acknowledgedReason, suggestion.orderReference].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Reason"
                      value={ackForm.acknowledgedReason}
                      onChange={(e) => setAckForm((current) => ({ ...current, acknowledgedReason: e.target.value }))}
                      className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={ackForm.quantityOrdered}
                      onChange={(e) => setAckForm((current) => ({ ...current, quantityOrdered: e.target.value }))}
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                    <input
                      type="date"
                      value={ackForm.expectedDelivery}
                      onChange={(e) => setAckForm((current) => ({ ...current, expectedDelivery: e.target.value }))}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Ref"
                      value={ackForm.orderReference}
                      onChange={(e) => setAckForm((current) => ({ ...current, orderReference: e.target.value }))}
                      className="w-28 rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => onAcknowledgeSuggestion(suggestion.id)}
                      disabled={acknowledgingId === suggestion.id}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {acknowledgingId === suggestion.id ? 'Saving…' : 'Acknowledge'}
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
  )
}
