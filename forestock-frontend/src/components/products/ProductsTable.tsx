import { type Product, type SortField, type VisibleColumns } from './types'

interface ProductsTableProps {
  products: Product[]
  sortedProducts: Product[]
  visibleColumns: VisibleColumns
  sortField: SortField
  sortDirection: 'asc' | 'desc'
  onSort: (field: SortField) => void
  onEdit: (product: Product) => void
  onDeactivate: (product: Product) => void
  onRestore: (product: Product) => void
  onDelete: (product: Product) => void
}

export default function ProductsTable({
  products,
  sortedProducts,
  visibleColumns,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onDeactivate,
  onRestore,
  onDelete,
}: ProductsTableProps) {
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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            {tableHeaders.map((heading) => (
              typeof heading === 'string' ? (
                <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  {heading}
                </th>
              ) : (
                <th key={heading.label} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <button
                    type="button"
                    onClick={() => onSort(heading.field)}
                    className="inline-flex items-center gap-1 hover:text-gray-700"
                  >
                    {heading.label}
                    <span className="text-[10px]">
                      {sortField === heading.field ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
              )
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortedProducts.map((product) => (
            <tr key={product.id} className={`transition-colors hover:bg-gray-50 ${!product.active ? 'opacity-50' : ''}`}>
              <td className="px-4 py-3 font-mono text-xs text-gray-600">{product.sku}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
              <td className="px-4 py-3 text-gray-500">{product.category ?? '—'}</td>
              <td className="px-4 py-3 text-gray-500">{product.unit}</td>
              <td className="px-4 py-3 text-gray-500">{product.reorderPoint ?? '—'}</td>
              <td className="px-4 py-3 text-gray-500">{product.maxStock ?? '—'}</td>
              {visibleColumns.supplier && (
                <td className="max-w-48 px-4 py-3 text-gray-500">
                  <span className="block truncate">{product.supplierName?.trim() || '—'}</span>
                </td>
              )}
              {visibleColumns.leadTime && (
                <td className="px-4 py-3 text-gray-500">
                  {product.leadTimeDays != null ? `${product.leadTimeDays} days` : '—'}
                </td>
              )}
              <td className="px-4 py-3 text-xs text-gray-500">{new Date(product.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    product.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {product.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => onEdit(product)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                    Edit
                  </button>
                  {product.active ? (
                    <button onClick={() => onDeactivate(product)} className="text-xs font-medium text-amber-600 hover:text-amber-800">
                      Deactivate
                    </button>
                  ) : (
                    <button onClick={() => onRestore(product)} className="text-xs font-medium text-green-600 hover:text-green-800">
                      Restore
                    </button>
                  )}
                  <button onClick={() => onDelete(product)} className="text-xs font-medium text-red-500 hover:text-red-700">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {products.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
          {products.length} product{products.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
