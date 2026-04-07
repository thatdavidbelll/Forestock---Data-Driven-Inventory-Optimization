import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import ProductForm from '../components/products/ProductForm'
import ProductImportModal from '../components/products/ProductImportModal'
import ProductsTable from '../components/products/ProductsTable'
import {
  emptyProductForm,
  type ImportResult,
  type Product,
  type ProductFormValues,
  type SortField,
  type VisibleColumns,
} from '../components/products/types'

const defaultColumns: VisibleColumns = {
  supplier: false,
  leadTime: false,
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductFormValues>(emptyProductForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(defaultColumns)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [confirmAction, setConfirmAction] = useState<null | { message: string; onConfirm: () => Promise<void> }>(null)
  const [confirmError, setConfirmError] = useState('')

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string | boolean> = { includeInactive }
      if (search) params.search = search
      const { data } = await api.get('/products', { params })
      setProducts(data.data ?? [])
    } catch {
      setError('Failed to load products.')
    } finally {
      setLoading(false)
    }
  }, [includeInactive, search])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDirection(field === 'createdAt' ? 'desc' : 'asc')
  }

  async function exportCsv(templateOnly = false) {
    try {
      const response = await api.get('/products/export/csv', {
        params: { templateOnly },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = templateOnly ? 'products-template.csv' : 'products.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to export products CSV.'))
    }
  }

  async function importProducts() {
    if (!importFile) {
      setImportError('Choose a CSV file to import.')
      return
    }

    setImporting(true)
    setImportError('')
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const { data } = await api.post('/products/import', formData, {
        params: { updateExisting },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(data.data ?? null)
      void fetchProducts()
    } catch (e) {
      setImportError(extractErrorMessage(e, 'Failed to import products.'))
    } finally {
      setImporting(false)
    }
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyProductForm)
    setFormError('')
    setShowAdvanced(false)
    setShowModal(true)
  }

  function openEdit(product: Product) {
    setEditingId(product.id)
    setForm({
      sku: product.sku,
      name: product.name,
      category: product.category ?? '',
      unit: product.unit,
      reorderPoint: product.reorderPoint != null ? String(product.reorderPoint) : '',
      maxStock: product.maxStock != null ? String(product.maxStock) : '',
      leadTimeDays: product.leadTimeDays != null ? String(product.leadTimeDays) : '',
      minimumOrderQty: product.minimumOrderQty != null ? String(product.minimumOrderQty) : '',
      unitCost: product.unitCost != null ? String(product.unitCost) : '',
      supplierName: product.supplierName ?? '',
      supplierContact: product.supplierContact ?? '',
      barcode: product.barcode ?? '',
      storageLocation: product.storageLocation ?? '',
      notes: product.notes ?? '',
    })
    setFormError('')
    setShowAdvanced(
      Boolean(
        product.leadTimeDays != null ||
          product.minimumOrderQty != null ||
          product.unitCost != null ||
          product.supplierName ||
          product.supplierContact ||
          product.barcode ||
          product.storageLocation ||
          product.notes
      )
    )
    setShowModal(true)
  }

  async function saveProduct() {
    if (!form.sku.trim() || !form.name.trim() || !form.unit.trim()) {
      setFormError('SKU, Name and Unit are required.')
      return
    }
    setSaving(true)
    setFormError('')
    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category.trim() || null,
      unit: form.unit.trim(),
      reorderPoint: form.reorderPoint !== '' ? Number(form.reorderPoint) : null,
      maxStock: form.maxStock !== '' ? Number(form.maxStock) : null,
      leadTimeDays: form.leadTimeDays !== '' ? Number(form.leadTimeDays) : null,
      minimumOrderQty: form.minimumOrderQty !== '' ? Number(form.minimumOrderQty) : null,
      unitCost: form.unitCost !== '' ? Number(form.unitCost) : null,
      supplierName: form.supplierName.trim() || null,
      supplierContact: form.supplierContact.trim() || null,
      barcode: form.barcode.trim() || null,
      storageLocation: form.storageLocation.trim() || null,
      notes: form.notes.trim() || null,
      active: editingId ? products.find((product) => product.id === editingId)?.active ?? true : true,
    }
    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, payload)
      } else {
        await api.post('/products', payload)
      }
      setShowModal(false)
      fetchProducts()
    } catch (e: unknown) {
      setFormError(extractErrorMessage(e, 'Failed to save product.'))
    } finally {
      setSaving(false)
    }
  }

  function confirmDeactivate(product: Product) {
    setConfirmError('')
    setConfirmAction({
      message: `Deactivate "${product.name}" (${product.sku})? It will be hidden from forecasts until restored.`,
      onConfirm: async () => {
        await api.delete(`/products/${product.id}`)
        setConfirmAction(null)
        fetchProducts()
      },
    })
  }

  function confirmRestore(product: Product) {
    setConfirmError('')
    setConfirmAction({
      message: `Restore "${product.name}" (${product.sku})? It will be included in forecasts again.`,
      onConfirm: async () => {
        await api.put(`/products/${product.id}/restore`)
        setConfirmAction(null)
        fetchProducts()
      },
    })
  }

  function confirmHardDelete(product: Product) {
    setConfirmError('')
    setConfirmAction({
      message: `⚠️ Permanently delete "${product.name}" (${product.sku})?\n\nThis will also delete ALL sales transactions, inventory history and order suggestions for this product. This cannot be undone.`,
      onConfirm: async () => {
        await api.delete(`/products/${product.id}/hard`)
        setConfirmAction(null)
        fetchProducts()
      },
    })
  }

  const activeCount = products.filter((product) => product.active).length
  const inactiveCount = products.filter((product) => !product.active).length
  const sortedProducts = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    return [...products].sort((left, right) => {
      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = left.name.localeCompare(right.name)
          break
        case 'sku':
          comparison = left.sku.localeCompare(right.sku)
          break
        case 'category':
          comparison = (left.category ?? '').localeCompare(right.category ?? '')
          break
        case 'createdAt':
          comparison = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
          break
      }
      return comparison * direction
    })
  }, [products, sortDirection, sortField])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Products</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {activeCount} active{inactiveCount > 0 ? `, ${inactiveCount} inactive` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="relative">
            <button
              onClick={() => setShowColumnMenu((current) => !current)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Columns
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 z-10 mt-2 w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Optional columns</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={visibleColumns.supplier}
                    onChange={(e) => setVisibleColumns((current) => ({ ...current, supplier: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Supplier
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={visibleColumns.leadTime}
                    onChange={(e) => setVisibleColumns((current) => ({ ...current, leadTime: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Lead Time
                </label>
              </div>
            )}
          </div>
          <label className="cursor-pointer select-none items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Show inactive
          </label>
          <button
            onClick={() => setShowImportModal(true)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Import CSV
          </button>
          <button
            onClick={() => void exportCsv(false)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={openCreate}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            + New Product
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400" role="status" aria-label="Loading">Loading…</p>}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      {!loading && products.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-semibold text-gray-900">No products yet.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            Add your first product to start importing sales, tracking stock, and generating forecasts.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={openCreate}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Create your first product
            </button>
          </div>
        </div>
      ) : !loading && (
        <ProductsTable
          products={products}
          sortedProducts={sortedProducts}
          visibleColumns={visibleColumns}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={toggleSort}
          onEdit={openEdit}
          onDeactivate={confirmDeactivate}
          onRestore={confirmRestore}
          onDelete={confirmHardDelete}
        />
      )}

      <ProductForm
        isOpen={showModal}
        editingId={editingId}
        form={form}
        setForm={setForm}
        saving={saving}
        formError={formError}
        showAdvanced={showAdvanced}
        onClose={() => setShowModal(false)}
        onSave={saveProduct}
        onToggleAdvanced={() => setShowAdvanced((current) => !current)}
      />

      <ProductImportModal
        isOpen={showImportModal}
        importFile={importFile}
        setImportFile={setImportFile}
        updateExisting={updateExisting}
        setUpdateExisting={setUpdateExisting}
        importing={importing}
        importError={importError}
        importResult={importResult}
        onClose={() => setShowImportModal(false)}
        onImport={importProducts}
      />

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Confirm Action</h2>
            </div>
            <div className="px-6 py-4">
              <p className="whitespace-pre-line text-sm text-gray-600">{confirmAction.message}</p>
              {confirmError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {confirmError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setConfirmAction(null)
                  setConfirmError('')
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await confirmAction.onConfirm()
                    setConfirmAction(null)
                    setConfirmError('')
                  } catch (e) {
                    setConfirmAction(null)
                    setConfirmError(extractErrorMessage(e, 'Operation failed. Please try again.'))
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
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
