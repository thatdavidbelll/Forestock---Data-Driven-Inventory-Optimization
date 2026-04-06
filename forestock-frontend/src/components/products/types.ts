export interface Product {
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

export interface ProductFormValues {
  sku: string
  name: string
  category: string
  unit: string
  reorderPoint: string
  maxStock: string
  leadTimeDays: string
  minimumOrderQty: string
  unitCost: string
  supplierName: string
  supplierContact: string
  barcode: string
  storageLocation: string
  notes: string
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export type SortField = 'name' | 'sku' | 'category' | 'createdAt'

export interface VisibleColumns {
  supplier: boolean
  leadTime: boolean
}

export const emptyProductForm: ProductFormValues = {
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
