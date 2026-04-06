export interface Suggestion {
  id: string
  productSku: string
  productName: string
  productCategory: string | null
  unit: string
  suggestedQty: number
  forecastP50: number | null
  forecastP90: number | null
  currentStock: number | null
  daysOfStock: number | null
  leadTimeDaysAtGeneration: number | null
  moqApplied: number | null
  estimatedOrderValue: number | null
  supplierName: string | null
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  acknowledged: boolean
  acknowledgedAt: string | null
  acknowledgedReason: string | null
  quantityOrdered: number | null
  expectedDelivery: string | null
  orderReference: string | null
}

export interface DashboardSummary {
  totalActiveProducts: number
  lastRunStatus: string | null
}

export interface AckForm {
  acknowledgedReason: string
  quantityOrdered: string
  expectedDelivery: string
  orderReference: string
}
