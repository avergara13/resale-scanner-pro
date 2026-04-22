import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clearFinancesCache,
  fetchEbayPayouts,
  fetchEbayTransactions,
  groupTransactionsByOrder,
  summarizeTransactions,
  type EbayPayout,
  type OrderReconciliation,
  type TransactionsSummary,
} from '@/lib/ebay-finances-service'

export type FinancesAuthStatus = 'ok' | 'auth_required' | 'error' | 'loading'

export interface UseEbayFinancesResult {
  authStatus: FinancesAuthStatus
  errorMessage?: string
  summary: TransactionsSummary | null
  payouts: EbayPayout[]
  lastSucceededPayout: EbayPayout | null
  byOrderId: Map<string, OrderReconciliation>
  /** Manually re-fetch (clears cache first). */
  refresh: () => void
}

const EMPTY_MAP: Map<string, OrderReconciliation> = new Map()

/**
 * Fetches eBay transactions + payouts for a rolling window and exposes a
 * per-order reconciliation map. Both requests run in parallel; caching is
 * handled inside ebay-finances-service (5-min TTL), so this hook can remount
 * freely without spamming eBay.
 */
export function useEbayFinances(daysBack = 30): UseEbayFinancesResult {
  const [authStatus, setAuthStatus] = useState<FinancesAuthStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [summary, setSummary] = useState<TransactionsSummary | null>(null)
  const [payouts, setPayouts] = useState<EbayPayout[]>([])
  const [byOrderId, setByOrderId] = useState<Map<string, OrderReconciliation>>(EMPTY_MAP)
  const [refreshCounter, setRefreshCounter] = useState(0)

  const load = useCallback(async () => {
    setAuthStatus('loading')
    setErrorMessage(undefined)
    const [txRes, payoutsRes] = await Promise.all([
      fetchEbayTransactions(daysBack),
      // Payout window is intentionally wider — a 30-day transaction window
      // might not contain the last payout, which users still want to see.
      fetchEbayPayouts(Math.max(daysBack, 90)),
    ])

    // If either call says auth_required we surface that — net effect is
    // identical (nothing to show). If one errors and the other doesn't,
    // prefer the successful one's data and only flag an error if both fail.
    if (txRes.status === 'auth_required' || payoutsRes.status === 'auth_required') {
      setAuthStatus('auth_required')
      setSummary(null)
      setPayouts([])
      setByOrderId(EMPTY_MAP)
      return
    }

    if (txRes.status === 'error' && payoutsRes.status === 'error') {
      setAuthStatus('error')
      setErrorMessage(txRes.message || payoutsRes.message)
      setSummary(null)
      setPayouts([])
      setByOrderId(EMPTY_MAP)
      return
    }

    setAuthStatus('ok')
    if (txRes.status === 'ok') {
      setSummary(summarizeTransactions(txRes.data))
      setByOrderId(groupTransactionsByOrder(txRes.data))
    } else {
      setSummary(null)
      setByOrderId(EMPTY_MAP)
    }
    if (payoutsRes.status === 'ok') {
      setPayouts(payoutsRes.data.payouts || [])
    } else {
      setPayouts([])
    }
  }, [daysBack])

  useEffect(() => {
    let cancelled = false
    load().catch(err => {
      if (cancelled) return
      setAuthStatus('error')
      setErrorMessage((err as Error).message)
    })
    return () => {
      cancelled = true
    }
  }, [load, refreshCounter])

  const refresh = useCallback(() => {
    clearFinancesCache()
    setRefreshCounter(n => n + 1)
  }, [])

  const lastSucceededPayout = useMemo(() => {
    const successes = payouts.filter(p => p.payoutStatus === 'SUCCEEDED')
    if (successes.length === 0) return null
    return successes.reduce((latest, curr) =>
      new Date(curr.payoutDate).getTime() > new Date(latest.payoutDate).getTime() ? curr : latest,
    )
  }, [payouts])

  return {
    authStatus,
    errorMessage,
    summary,
    payouts,
    lastSucceededPayout,
    byOrderId,
    refresh,
  }
}
