// Real post-sale reconciliation from eBay's Finances + Analytics APIs.
// Requires user-scoped OAuth (sell.finances, sell.analytics.readonly) — the
// server refreshes tokens automatically via getValidEbayToken().

export interface EbayTransaction {
  transactionId: string
  transactionDate: string
  transactionType: 'SALE' | 'REFUND' | 'CREDIT' | 'DISPUTE' | 'NON_SALE_CHARGE' | 'PAYOUT' | string
  amount: { value: string; currency: string }
  feeType?: string
  orderId?: string
  orderLineItems?: Array<{ lineItemId: string; title?: string }>
  bookingEntry?: 'DEBIT' | 'CREDIT'
}

export interface EbayTransactionsResponse {
  transactions?: EbayTransaction[]
  total?: number
  href?: string
  next?: string
}

export interface EbayPayout {
  payoutId: string
  payoutDate: string
  payoutStatus: 'INITIATED' | 'SUCCEEDED' | 'REVERSED' | 'FAILED' | 'RETRYABLE_FAILED' | 'TERMINAL_FAILED' | string
  amount: { value: string; currency: string }
  transactionCount?: number
  payoutInstrument?: { instrumentType?: string; nickname?: string; accountLastFourDigits?: string }
}

export interface EbayPayoutsResponse {
  payouts?: EbayPayout[]
  total?: number
}

export interface EbaySellerStandards {
  program: string
  cycle: { cycleType: string; evaluationDate?: string }
  standardsLevel: 'TOP_RATED' | 'ABOVE_STANDARD' | 'BELOW_STANDARD' | string
  defaultProgram?: boolean
  metrics?: Array<{
    name: string
    value?: number | string
    threshold?: { level: string; numerator?: number; denominator?: number }
  }>
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      console.warn(`${url} returned ${resp.status}`)
      return null
    }
    return (await resp.json()) as T
  } catch (error) {
    console.warn(`${url} unreachable`, error)
    return null
  }
}

export function fetchEbayTransactions(daysBack = 30): Promise<EbayTransactionsResponse | null> {
  return getJson<EbayTransactionsResponse>(
    `/api/ebay/finances/transactions?daysBack=${encodeURIComponent(String(daysBack))}`,
  )
}

export function fetchEbayPayouts(daysBack = 90): Promise<EbayPayoutsResponse | null> {
  return getJson<EbayPayoutsResponse>(
    `/api/ebay/finances/payouts?daysBack=${encodeURIComponent(String(daysBack))}`,
  )
}

export function fetchSellerStandards(): Promise<EbaySellerStandards | null> {
  return getJson<EbaySellerStandards>('/api/ebay/seller-standards')
}

/**
 * Summarize a transactions response for dashboard display. Splits into gross
 * sales, fees (negative bookings), and net. Dollar amounts are parsed from
 * the eBay value strings which are always USD-like decimals.
 */
export function summarizeTransactions(resp: EbayTransactionsResponse) {
  const txs = resp.transactions || []
  let grossSales = 0
  let fees = 0
  let refunds = 0
  let other = 0
  for (const tx of txs) {
    const amount = parseFloat(tx.amount?.value) || 0
    switch (tx.transactionType) {
      case 'SALE':
        grossSales += amount
        break
      case 'NON_SALE_CHARGE':
        fees += amount
        break
      case 'REFUND':
      case 'DISPUTE':
        refunds += amount
        break
      default:
        other += amount
    }
  }
  return {
    count: txs.length,
    grossSales: Math.round(grossSales * 100) / 100,
    fees: Math.round(fees * 100) / 100,
    refunds: Math.round(refunds * 100) / 100,
    other: Math.round(other * 100) / 100,
    net: Math.round((grossSales - fees - refunds) * 100) / 100,
  }
}
