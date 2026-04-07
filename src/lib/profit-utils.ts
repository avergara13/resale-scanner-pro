import { calculateProfitFallback } from './ebay-service'
import type { ScannedItem, AppSettings } from '@/types'

export function getNetProfit(
  item: ScannedItem,
  settings: AppSettings
): { netProfit: number; totalFees: number; shippingCost: number } {
  const soldPrice = item.soldPrice || 0
  const shippingCost = item.actualShippingCost ?? settings.defaultShippingCost ?? 5.0

  // Only eBay has configured fees; other marketplaces default to 0% for now
  const feePercent = item.soldOn === 'ebay' ? (settings.ebayFeePercent ?? 12.9) : 0
  const perOrderFee = item.soldOn === 'ebay' ? 0.30 : 0

  const { netProfit, totalFees } = calculateProfitFallback(
    item.purchasePrice,
    soldPrice,
    shippingCost,
    feePercent,
    perOrderFee,
  )
  return { netProfit, totalFees, shippingCost }
}

export type UrgencyLevel = 'ok' | 'warning' | 'urgent' | 'overdue'

export function getShippingUrgency(soldDate?: number): {
  level: UrgencyLevel
  label: string
} {
  if (!soldDate) return { level: 'ok', label: '' }

  const hoursElapsed = (Date.now() - soldDate) / (1000 * 60 * 60)

  if (hoursElapsed > 24) {
    return { level: 'overdue', label: `LATE ${Math.round(hoursElapsed - 24)}h` }
  }
  if (hoursElapsed > 12) {
    return { level: 'urgent', label: 'OVERDUE — Ship NOW' }
  }
  if (hoursElapsed > 4) {
    return { level: 'warning', label: 'Ship today!' }
  }
  return { level: 'ok', label: `Sold ${Math.max(1, Math.round(hoursElapsed))}h ago` }
}
