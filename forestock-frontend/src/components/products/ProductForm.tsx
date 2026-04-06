import type { Dispatch, SetStateAction } from 'react'
import type { ProductFormValues } from './types'

interface ProductFormProps {
  isOpen: boolean
  editingId: string | null
  form: ProductFormValues
  setForm: Dispatch<SetStateAction<ProductFormValues>>
  saving: boolean
  formError: string
  showAdvanced: boolean
  onClose: () => void
  onSave: () => void
  onToggleAdvanced: () => void
}

export default function ProductForm({
  isOpen,
  editingId,
  form,
  setForm,
  saving,
  formError,
  showAdvanced,
  onClose,
  onSave,
  onToggleAdvanced,
}: ProductFormProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">{editingId ? 'Edit Product' : 'New Product'}</h2>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>
        <div className="max-h-[80vh] space-y-3 overflow-y-auto px-6 py-4">
          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">SKU *</label>
              <input
                value={form.sku}
                onChange={(e) => setForm((current) => ({ ...current, sku: e.target.value }))}
                disabled={!!editingId}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="LAPTE-1L"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Unit *</label>
              <input
                value={form.unit}
                onChange={(e) => setForm((current) => ({ ...current, unit: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="buc / kg / L"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Lapte 1L"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Category</label>
            <input
              value={form.category}
              onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Dairy"
            />
          </div>

          <button
            onClick={onToggleAdvanced}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            {showAdvanced ? 'Hide advanced fields' : 'Show advanced fields'}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Reorder Point</label>
                <input
                  type="number"
                  min="0"
                  value={form.reorderPoint}
                  onChange={(e) => setForm((current) => ({ ...current, reorderPoint: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Max Stock</label>
                <input
                  type="number"
                  min="0"
                  value={form.maxStock}
                  onChange={(e) => setForm((current) => ({ ...current, maxStock: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Lead Time Days</label>
                <input
                  type="number"
                  min="0"
                  value={form.leadTimeDays}
                  onChange={(e) => setForm((current) => ({ ...current, leadTimeDays: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">MOQ</label>
                <input
                  type="number"
                  min="0"
                  value={form.minimumOrderQty}
                  onChange={(e) => setForm((current) => ({ ...current, minimumOrderQty: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Unit Cost</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => setForm((current) => ({ ...current, unitCost: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Supplier</label>
                <input
                  value={form.supplierName}
                  onChange={(e) => setForm((current) => ({ ...current, supplierName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Supplier Contact</label>
                <input
                  value={form.supplierContact}
                  onChange={(e) => setForm((current) => ({ ...current, supplierContact: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Barcode</label>
                <input
                  value={form.barcode}
                  onChange={(e) => setForm((current) => ({ ...current, barcode: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Storage Location</label>
                <input
                  value={form.storageLocation}
                  onChange={(e) => setForm((current) => ({ ...current, storageLocation: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  )
}
