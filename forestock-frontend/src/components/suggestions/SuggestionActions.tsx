import type { Dispatch, SetStateAction } from 'react'
import type { AckForm } from './types'

interface SuggestionActionsProps {
  urgencyFilter: string
  setUrgencyFilter: Dispatch<SetStateAction<string>>
  categoryFilter: string
  setCategoryFilter: Dispatch<SetStateAction<string>>
  showAcknowledged: boolean
  setShowAcknowledged: Dispatch<SetStateAction<boolean>>
  exportingExcel: boolean
  exportingPdf: boolean
  reportLoading: string | null
  salesReportFrom: string
  setSalesReportFrom: Dispatch<SetStateAction<string>>
  salesReportTo: string
  setSalesReportTo: Dispatch<SetStateAction<string>>
  slowMoverDays: string
  setSlowMoverDays: Dispatch<SetStateAction<string>>
  selectedCount: number
  ackForm: AckForm
  setAckForm: Dispatch<SetStateAction<AckForm>>
  bulkSaving: boolean
  onExportExcel: () => void
  onExportPdf: () => void
  onDownloadInventoryValuation: (format: 'excel' | 'pdf') => void
  onDownloadSalesReport: (format: 'excel' | 'pdf') => void
  onDownloadSlowMovers: (format: 'excel' | 'pdf') => void
  onAcknowledgeBulk: () => void
}

export default function SuggestionActions({
  urgencyFilter,
  setUrgencyFilter,
  categoryFilter,
  setCategoryFilter,
  showAcknowledged,
  setShowAcknowledged,
  exportingExcel,
  exportingPdf,
  reportLoading,
  salesReportFrom,
  setSalesReportFrom,
  salesReportTo,
  setSalesReportTo,
  slowMoverDays,
  setSlowMoverDays,
  selectedCount,
  ackForm,
  setAckForm,
  bulkSaving,
  onExportExcel,
  onExportPdf,
  onDownloadInventoryValuation,
  onDownloadSalesReport,
  onDownloadSlowMovers,
  onAcknowledgeBulk,
}: SuggestionActionsProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Restock Suggestions</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="w-44 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Download Reports</h2>
            <p className="mt-1 text-xs text-gray-500">Operational exports for restocking, valuation, sales, and slow movers.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Restocking Suggestions</p>
              <div className="mt-3 flex gap-2">
                <button onClick={onExportExcel} disabled={exportingExcel} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50">
                  {exportingExcel ? 'Exporting…' : 'Excel'}
                </button>
                <button onClick={onExportPdf} disabled={exportingPdf} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50">
                  {exportingPdf ? 'Exporting…' : 'PDF'}
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inventory Valuation</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => onDownloadInventoryValuation('excel')} disabled={reportLoading != null} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50">
                  {reportLoading?.includes('inventory-valuation') ? 'Working…' : 'Excel'}
                </button>
                <button onClick={() => onDownloadInventoryValuation('pdf')} disabled={reportLoading != null} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50">
                  {reportLoading?.includes('inventory-valuation') ? 'Working…' : 'PDF'}
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales Performance</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input type="date" value={salesReportFrom} onChange={(e) => setSalesReportFrom(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs" />
                <input type="date" value={salesReportTo} onChange={(e) => setSalesReportTo(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs" />
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => onDownloadSalesReport('excel')} disabled={!salesReportFrom || !salesReportTo || reportLoading != null} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50">
                  Excel
                </button>
                <button onClick={() => onDownloadSalesReport('pdf')} disabled={!salesReportFrom || !salesReportTo || reportLoading != null} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50">
                  PDF
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Slow Movers</p>
              <input type="number" min="1" value={slowMoverDays} onChange={(e) => setSlowMoverDays(e.target.value)} className="mt-2 w-24 rounded border border-gray-300 px-2 py-1 text-xs" />
              <div className="mt-3 flex gap-2">
                <button onClick={() => onDownloadSlowMovers('excel')} disabled={reportLoading != null} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50">
                  Excel
                </button>
                <button onClick={() => onDownloadSlowMovers('pdf')} disabled={reportLoading != null} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50">
                  PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-sm font-medium text-indigo-900">{selectedCount} selected</p>
              <p className="text-xs text-indigo-700">Bulk acknowledge with optional tracking fields.</p>
            </div>
            <input
              type="text"
              placeholder="Reason"
              value={ackForm.acknowledgedReason}
              onChange={(e) => setAckForm((current) => ({ ...current, acknowledgedReason: e.target.value }))}
              className="rounded-lg border border-indigo-200 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              placeholder="Qty ordered"
              value={ackForm.quantityOrdered}
              onChange={(e) => setAckForm((current) => ({ ...current, quantityOrdered: e.target.value }))}
              className="w-32 rounded-lg border border-indigo-200 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={ackForm.expectedDelivery}
              onChange={(e) => setAckForm((current) => ({ ...current, expectedDelivery: e.target.value }))}
              className="rounded-lg border border-indigo-200 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Order ref"
              value={ackForm.orderReference}
              onChange={(e) => setAckForm((current) => ({ ...current, orderReference: e.target.value }))}
              className="rounded-lg border border-indigo-200 px-3 py-2 text-sm"
            />
            <button
              onClick={onAcknowledgeBulk}
              disabled={bulkSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {bulkSaving ? 'Saving…' : 'Acknowledge Selected'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
