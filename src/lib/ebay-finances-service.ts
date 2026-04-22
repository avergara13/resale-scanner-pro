// Real post-sale reconciliation from eBay's Finances + Analytics APIs.
// Requires user-scoped OAuth (sell.finances, sell.analytics.readonly) — the
// server refreshes tokens automatically via getValidEbayToken().

export interface EbayTransaction {
  transactionId: string
  transactionDate: string
  transactionType: 'SALE' | 'REFUND' | 'CREDIT' | 'DISPUTE' | 'NON_SALE_CHARGE' | 'PAYOUT' | 'SHIPPING_LABEL' | string
  amount: { value: string; currency: string }
  feeType?: string
  orderId?: string
  orderLineItems?: Array<{ lineItemId: string; title?: string }>
  // CRITICAL: eBay Finances always returns amount.value as a POSITIVE decimal
  // string. The sign is encoded in bookingEntry: CREDIT = money in (sale,
  // refund-of-fee), DEBIT = money out (fee, refund-to-buyer, label purchase).
  // Treating amount.value as signed produces wrong totals — always multiply
  // by bookingEntry.
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

// Tagged fetch result so callers can distinguish "not authed yet" from
// "real error" from "empty payload". Returning `null` on every failure
// (old behavior) collapsed these cases into one, leaving the UI unable to
// render a useful next-step message.
export type FinancesFetch<T> =
  | { status: 'ok'; data: T }
  | { status: 'auth_required' }
  | { status: 'error'; httpStatus: number; message: string }

// ── Module-level cache ──────────────────────────────────────────────────────
// eBay Finances API is rate-limited (~10k req/day). SoldScreen remounts on
// every tab switch; without a shared cache a quick tab-dance can burn hundreds
// of requests for the same window. 5-minute TTL is long enough to absorb
// navigation, short enough that a manual refresh reflects fresh payouts.
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { expiresAt: number; value: FinancesFetch<unknown> }>()

function cacheGet<T>(key: string): FinancesFetch<T> | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.value as FinancesFetch<T>
}

function cacheSet<T>(key: string, value: FinancesFetch<T>) {
  // Only cache successful results. An auth_required or error response can
  // flip quickly (user just connected, server just recovered) — we don't
  // want to mask recovery with a 5-minute stale error.
  if (value.status === 'ok') {
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value })
  }
}

/** Clears every cached Finances response. Call after a manual refresh. */
export function clearFinancesCache() {
  cache.clear()
}

async function getJson<T>(url: string, cacheKey: string): Promise<FinancesFetch<T>> {
  const cached = cacheGet<T>(cacheKey)
  if (cached) return cached

  try {
    const resp = await fetch(url)
    if (resp.status === 503 || resp.status === 401) {
      // 503 EBAY_OAUTH_NOT_COMPLETED (fresh install) / 401 (token rejected).
      // Both are "needs to (re-)auth" from the UI's perspective.
      return { status: 'auth_required' }
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      const result: FinancesFetch<T> = {
        status: 'error',
        httpStatus: resp.status,
        message: text.slice(0, 200) || `${resp.status}`,
      }
      return result
    }
    const data = (await resp.json()) as T
    const result: FinancesFetch<T> = { status: 'ok', data }
    cacheSet(cacheKey, result)
    return result
  } catch (error) {
    return { status: 'error', httpStatus: 0, message: (error as Error).message }
  }
}

export function fetchEbayTransactions(
  daysBack = 30,
): Promise<FinancesFetch<EbayTransactionsResponse>> {
  return getJson<EbayTransactionsResponse>(
    `/api/ebay/finances/transactions?daysBack=${encodeURIComponent(String(daysBack))}`,
    `tx:${daysBack}`,
  )
}

export function fetchEbayPayouts(
  daysBack = 90,
): Promise<FinancesFetch<EbayPayoutsResponse>> {
  return getJson<EbayPayoutsResponse>(
    `/api/ebay/finances/payouts?daysBack=${encodeURIComponent(String(daysBack))}`,
    `po:${daysBack}`,
  )
}

export function fetchSellerStandards(): Promise<FinancesFetch<EbaySellerStandards>> {
  return getJson<EbaySellerStandards>('/api/ebay/seller-standards', 'standards')
}

// ── Transaction math (corrected) ────────────────────────────────────────────
// Prior bug: amount was parsed as signed, then refunds/fees were subtracted
// again — double-counting in both directions (net off by 5–15%). Fixed by
// honoring eBay's actual contract: amount.value is always positive; the
// sign comes from bookingEntry (CREDIT = in, DEBIT = out).

function parseAmount(tx: EbayTransaction): number {
  const raw = parseFloat(tx.amount?.value || '0')
  return Number.isFinite(raw) ? Math.abs(raw) : 0
}

function isDebit(tx: EbayTransaction): boolean {
  return tx.bookingEntry === 'DEBIT'
}

export interface TransactionsSummary {
  count: number
  grossSales: number
  fees: number
  refunds: number
  other: number
  net: number
}

/**
 * Split the window into human-readable buckets, using bookingEntry as the
 * sign of truth. Any transaction that doesn't match a known bucket falls
 * into `other` so net still adds up correctly.
 */
export function summarizeTransactions(
  resp: EbayTransactionsResponse,
): TransactionsSummary {
  const txs = resp.transactions || []
  let grossSales = 0
  let fees = 0
  let refunds = 0
  let other = 0

  for (const tx of txs) {
    const amount = parseAmount(tx)
    const debit = isDebit(tx)
    switch (tx.transactionType) {
      case 'SALE':
        // SALE is always a CREDIT (money in). Treat any oddball DEBIT SALE
        // as a partial adjustment and fold into `other`.
        if (!debit) grossSales += amount
        else other -= amount
        break
      case 'NON_SALE_CHARGE':
        // eBay fees, promoted-listings ads, store subscription, shipping
        // label purchases — always DEBITs.
        if (debit) fees += amount
        else other += amount
        break
      case 'REFUND':
      case 'DISPUTE':
        // Money paid BACK to a buyer is DEBIT. Oddball CREDIT refund means
        // eBay returned a fee to the seller — show that in `other`.
        if (debit) refunds += amount
        else other += amount
        break
      default:
        other += debit ? -amount : amount
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    count: txs.length,
    grossSales: round(grossSales),
    fees: round(fees),
    refunds: round(refunds),
    other: round(other),
    net: round(grossSales - fees - refunds + other),
  }
}

export interface OrderReconciliation {
  orderId: string
  sale: number       // sum of CREDIT SALE amounts for this order
  fees: number       // sum of DEBIT NON_SALE_CHARGE amounts linked to this order
  refunds: number    // sum of DEBIT REFUND/DISPUTE amounts for this order
  net: number        // sale - fees - refunds (what actually hit payout)
  transactions: EbayTransaction[]
}

/**
 * Group transactions by eBay orderId for per-listing reconciliation.
 * Orders without `orderId` (e.g. account-level NON_SALE_CHARGE) are skipped —
 * they aggregate into `summarizeTransactions().fees` instead.
 */
export function groupTransactionsByOrder(
  resp: EbayTransactionsResponse,
): Map<string, OrderReconciliation> {
  const map = new Map<string, OrderReconciliation>()
  const txs = resp.transactions || []
  for (const tx of txs) {
    const orderId = tx.orderId?.trim()
    if (!orderId) continue
    const amount = parseAmount(tx)
    const debit = isDebit(tx)

    let bucket = map.get(orderId)
    if (!bucket) {
      bucket = { orderId, sale: 0, fees: 0, refunds: 0, net: 0, transactions: [] }
      map.set(orderId, bucket)
    }
    bucket.transactions.push(tx)

    switch (tx.transactionType) {
      case 'SALE':
        if (!debit) bucket.sale += amount
        break
      case 'NON_SALE_CHARGE':
        if (debit) bucket.fees += amount
        break
      case 'REFUND':
      case 'DISPUTE':
        if (debit) bucket.refunds += amount
        break
    }
  }
  // Finalize net per bucket.
  for (const bucket of map.values()) {
    bucket.net = Math.round((bucket.sale - bucket.fees - bucket.refunds) * 100) / 100
    bucket.sale = Math.round(bucket.sale * 100) / 100
    bucket.fees = Math.round(bucket.fees * 100) / 100
    bucket.refunds = Math.round(bucket.refunds * 100) / 100
  }
  return map
}

/**
 * Normalize an order-id-ish string for matching. eBay order IDs come in a
 * few formats (legacy 9-12 digits, hyphenated managed-payments). Users may
 * paste them into Notion with stray spaces or trailing punctuation.
 */
export function normalizeOrderId(input?: string | null): string {
  if (!input) return ''
  return String(input)
    .trim()
    .replace(/\s+/g, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .toLowerCase()
}

export function lookupReconciliation(
  byOrderId: Map<string, OrderReconciliation>,
  rawOrderNumber?: string | null,
): OrderReconciliation | null {
  const key = normalizeOrderId(rawOrderNumber)
  if (!key) return null
  // Exact match first, then case-insensitive scan — the map is small enough
  // (a few hundred orders in a 90-day window) that an O(n) fallback is fine.
  const direct = byOrderId.get(key) || byOrderId.get(rawOrderNumber || '')
  if (direct) return direct
  for (const [k, v] of byOrderId) {
    if (normalizeOrderId(k) === key) return v
  }
  return null
}
