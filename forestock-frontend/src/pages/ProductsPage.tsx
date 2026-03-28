import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'

interface Product {
  id: string
  sku: string
  name: string
  category: string | null
  unit: string
  reorderPoint: number | null
  maxStock: number | null
  leadTimeDays: number | null
  minimumOrderQty: number | null
  unitCost: number | null
  supplierName: string | null
  supplierContact: string | null
  barcode: string | null
  storageLocation: string | null
  notes: string | null
  active: boolean
  createdAt: string
}

const emptyForm = {
  sku: '',
  name: '',
  category: '',
  unit: 'buc',
  reorderPoint: '',
  maxStock: '',
  leadTimeDays: '',
  minimumOrderQty: '',
  unitCost: '',
  supplierName: '',
  supplierContact: '',
  barcode: '',
  storageLocation: '',
  notes: '',
}

const defaultColumns = {
  supplier: false,
  leadTime: false,
}

type SortField = 'name' | 'sku' | 'category' | 'createdAt'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
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

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
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

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<null | {
    message: string
    onConfirm: () => Promise<void>
  }>(null)
  const [confirmError, setConfirmError] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [includeInactive, search])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  async function fetchProducts() {
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
  }

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
    setForm(emptyForm)
    setFormError('')
    setShowAdvanced(false)
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditingId(p.id)
    setForm({
      sku: p.sku,
      name: p.name,
      category: p.category ?? '',
      unit: p.unit,
      reorderPoint: p.reorderPoint != null ? String(p.reorderPoint) : '',
      maxStock: p.maxStock != null ? String(p.maxStock) : '',
      leadTimeDays: p.leadTimeDays != null ? String(p.leadTimeDays) : '',
      minimumOrderQty: p.minimumOrderQty != null ? String(p.minimumOrderQty) : '',
      unitCost: p.unitCost != null ? String(p.unitCost) : '',
      supplierName: p.supplierName ?? '',
      supplierContact: p.supplierContact ?? '',
      barcode: p.barcode ?? '',
      storageLocation: p.storageLocation ?? '',
      notes: p.notes ?? '',
    })
    setFormError('')
    setShowAdvanced(Boolean(
      p.leadTimeDays != null ||
      p.minimumOrderQty != null ||
      p.unitCost != null ||
      p.supplierName ||
      p.supplierContact ||
      p.barcode ||
      p.storageLocation ||
      p.notes
    ))
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

  function confirmDeactivate(p: Product) {
    setConfirmError('')
    setConfirmAction({
      message: `Deactivate "${p.name}" (${p.sku})? It will be hidden from forecasts until restored.`,
      onConfirm: async () => {
        await api.delete(`/products/${p.id}`)
        setConfirmAction(null)
        fetchProducts()
      },
    })
  }

  function confirmRestore(p: Product) {
    setConfirmError('')
    setConfirmAction({
      message: `Restore "${p.name}" (${p.sku})? It will be included in forecasts again.`,
      onConfirm: async () => {
        await api.put(`/products/${p.id}/restore`)
        setConfirmAction(null)
        fetchProducts()
      },
    })
  }

  function confirmHardDelete(p: Product) {
    setConfirmError('')
    setConfirmAction({
      message: `⚠️ Permanently delete "${p.name}" (${p.sku})?\n\nThis will also delete ALL sales transactions, inventory history and order suggestions for this product. This cannot be undone.`,
      onConfirm: async () => {
        await api.delete(`/products/${p.id}/hard`)
        setConfirmAction(null)
        fetchProducts()
      },
    })
  }

  const activeCount = products.filter((p) => p.active).length
  const inactiveCount = products.filter((p) => !p.active).length
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
  const tableHeaders = [
    { label: 'SKU', sortable: true, field: 'sku' as SortField },
    { label: 'Name', sortable: true, field: 'name' as SortField },
    { label: 'Category', sortable: true, field: 'category' as SortField },
    'Unit',
    'Reorder Point',
    'Max Stock',
    ...(visibleColumns.supplier ? ['Supplier'] : []),
    ...(visibleColumns.leadTime ? ['Lead Time'] : []),
    { label: 'Created', sortable: true, field: 'createdAt' as SortField },
    'Status',
    'Actions',
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">
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
                    onChange={(e) =>
                      setVisibleColumns((current) => ({ ...current, supplier: e.target.checked }))
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Supplier
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={visibleColumns.leadTime}
                    onChange={(e) =>
                      setVisibleColumns((current) => ({ ...current, leadTime: e.target.checked }))
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Lead Time
                </label>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
            className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            + New Product
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      {/* Table */}
      {!loading && products.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-semibold text-gray-900">No products yet.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            Add your first product to start importing sales, tracking stock, and generating forecasts.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={openCreate}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Create your first product
            </button>
          </div>
        </div>
      ) : !loading && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {tableHeaders.map((h) => (
                  typeof h === 'string' ? (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ) : (
                    <th key={h.label} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <button
                        type="button"
                        onClick={() => toggleSort(h.field)}
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                      >
                        {h.label}
                        <span className="text-[10px]">
                          {sortField === h.field ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  )
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedProducts.map((p) => (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.category ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                    <td className="px-4 py-3 text-gray-500">{p.reorderPoint ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.maxStock ?? '—'}</td>
                    {visibleColumns.supplier && (
                      <td className="max-w-48 px-4 py-3 text-gray-500">
                        <span className="block truncate">{p.supplierName?.trim() || '—'}</span>
                      </td>
                    )}
                    {visibleColumns.leadTime && (
                      <td className="px-4 py-3 text-gray-500">{p.leadTimeDays != null ? `${p.leadTimeDays} days` : '—'}</td>
                    )}
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          p.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Edit
                        </button>
                        {p.active ? (
                          <button
                            onClick={() => confirmDeactivate(p)}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => confirmRestore(p)}
                            className="text-xs text-green-600 hover:text-green-800 font-medium"
                          >
                            Restore
                          </button>
                        )}
                        <button
                          onClick={() => confirmHardDelete(p)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {products.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              {products.length} product{products.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editingId ? 'Edit Product' : 'New Product'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto px-6 py-4 space-y-3">
              {formError && (
                <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">SKU *</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    disabled={!!editingId}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="LAPTE-1L"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit *</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="buc / kg / L"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Lapte 1L"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Lactate"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reorder Point</label>
                  <input
                    type="number"
                    min="0"
                    value={form.reorderPoint}
                    onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Max Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={form.maxStock}
                    onChange={(e) => setForm({ ...form, maxStock: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="500"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((current) => !current)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">Advanced</p>
                    <p className="text-xs text-gray-500">Supplier, lead time, costing, and storage details.</p>
                  </div>
                  <span className="text-lg text-gray-400">{showAdvanced ? '−' : '+'}</span>
                </button>
                {showAdvanced && (
                  <div className="space-y-3 border-t border-gray-200 px-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Lead Time (days)</label>
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={form.leadTimeDays}
                          onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g. 7"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Minimum Order Qty</label>
                        <input
                          type="number"
                          min="0"
                          value={form.minimumOrderQty}
                          onChange={(e) => setForm({ ...form, minimumOrderQty: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g. 200"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Unit Cost</label>
                        <div className="flex items-center rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                          <span className="px-3 text-sm text-gray-500">£</span>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={form.unitCost}
                            onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                            className="w-full rounded-r-lg px-3 py-2 text-sm focus:outline-none"
                            placeholder="e.g. 4.99"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Storage Location</label>
                        <input
                          value={form.storageLocation}
                          onChange={(e) => setForm({ ...form, storageLocation: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g. A-12"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Supplier Name</label>
                        <input
                          value={form.supplierName}
                          onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g. Metro Cash & Carry"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Supplier Contact</label>
                        <input
                          value={form.supplierContact}
                          onChange={(e) => setForm({ ...form, supplierContact: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="email or phone"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Barcode</label>
                        <input
                          value={form.barcode}
                          onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Optional barcode"
                        />
                      </div>
                      <div />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Optional internal notes"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveProduct}
                disabled={saving}
                className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Import Products CSV</h2>
              <p className="mt-1 text-sm text-gray-500">
                Upload a product catalogue CSV with supplier and replenishment fields.
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
                <p className="text-sm font-medium text-gray-700">
                  {importFile ? importFile.name : 'Drop a CSV here or choose a file'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Expected columns: sku, name, category, unit, reorder_point, max_stock, lead_time_days, minimum_order_qty, unit_cost, supplier_name
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="mx-auto mt-4 block text-sm text-gray-600"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Update existing products with matching SKUs
                </label>
                <button
                  type="button"
                  onClick={() => void exportCsv(true)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Download template
                </button>
              </div>

              {importError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{importError}</p>}
              {importResult && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <p>Imported: {importResult.imported}</p>
                  <p>Skipped: {importResult.skipped}</p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-red-700">Errors</p>
                      <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5 text-xs text-red-600">
                        {importResult.errors.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportFile(null)
                  setImportResult(null)
                  setImportError('')
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => void importProducts()}
                disabled={importing}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {importing ? 'Importing…' : 'Import CSV'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 whitespace-pre-line">{confirmAction.message}</p>
            </div>
            {confirmError && (
              <p className="px-6 pb-2 text-sm text-red-700">{confirmError}</p>
            )}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setConfirmAction(null); setConfirmError('') }}
                className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await confirmAction.onConfirm()
                  } catch (e) {
                    setConfirmError(extractErrorMessage(e, 'Operation failed. Please try again.'))
                  }
                }}
                className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
