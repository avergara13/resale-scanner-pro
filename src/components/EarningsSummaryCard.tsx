import { ArrowClockwise, Warning } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FinancesAuthStatus } from '@/hooks/use-ebay-finances'
import type { EbayPayout, TransactionsSummary } from '@/lib/ebay-finances-service'

export type EarningsPeriod = 30 | 60 | 90

interface EarningsSummaryCardProps {
  authStatus: FinancesAuthStatus
  errorMessage?: string
  summary: TransactionsSummary | null
  lastSucceededPayout: EbayPayout | null
  reconciledCount: number
  totalCount: number
  period: EarningsPeriod
  onPeriodChange: (next: EarningsPeriod) => void
  onRefresh: () => void
}

const PERIODS: EarningsPeriod[] = [30, 60, 90]

function formatMoney(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`
}

function formatPayoutDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function AuthBanner({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="material-thin mx-3 mt-2 rounded-xl border border-amber/40 bg-amber-bg/30 p-3">
      <div className="flex items-start gap-2">
        <Warning size={16} weight="fill" className="mt-0.5 flex-shrink-0 text-amber" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-wide text-t1">
            Connect eBay Finances
          </div>
          <p className="mt-1 text-[10px] leading-tight text-t3">
            Authorize eBay to see real payouts and reconcile fees against predicted profit.
          </p>
          <div className="mt-2 flex gap-2">
            <a
              href="/api/ebay/auth-url"
              className="text-[10px] font-bold text-b1 uppercase tracking-wide underline underline-offset-2"
            >
              Open eBay authorization
            </a>
            <button
              type="button"
              onClick={onRefresh}
              className="text-[10px] font-bold uppercase tracking-wide text-t3"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorBanner({ message, onRefresh }: { message?: string; onRefresh: () => void }) {
  return (
    <div className="material-thin mx-3 mt-2 rounded-xl border border-red/40 bg-red-bg/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-wide text-t1">
            eBay Finances unavailable
          </div>
          <p className="mt-1 text-[10px] leading-tight text-t3">
            {message || 'Could not reach eBay. Try again in a moment.'}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onRefresh} className="h-7 flex-shrink-0">
          <ArrowClockwise size={12} />
        </Button>
      </div>
    </div>
  )
}

export function EarningsSummaryCard({
  authStatus,
  errorMessage,
  summary,
  lastSucceededPayout,
  reconciledCount,
  totalCount,
  period,
  onPeriodChange,
  onRefresh,
}: EarningsSummaryCardProps) {
  if (authStatus === 'auth_required') {
    return <AuthBanner onRefresh={onRefresh} />
  }
  if (authStatus === 'error') {
    return <ErrorBanner message={errorMessage} onRefresh={onRefresh} />
  }

  const loading = authStatus === 'loading'

  return (
    <div className="material-thin mx-3 mt-2 rounded-xl border border-s2/60 p-3">
      {/* Header: period toggle + refresh */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {PERIODS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
                period === p
                  ? 'bg-t1 text-white'
                  : 'text-t3 hover:text-t1',
              )}
            >
              {p}d
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh eBay finances"
          className="text-t3 transition-opacity active:opacity-40 disabled:opacity-30"
        >
          <ArrowClockwise size={14} className={loading ? 'animate-spin' : undefined} />
        </button>
      </div>

      {/* Top row: Net earnings */}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wide text-t3">
            Net · last {period}d
          </div>
          <div className="text-lg font-black leading-tight text-t1">
            {loading || !summary ? '—' : formatMoney(summary.net)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold uppercase tracking-wide text-t3">
            Last payout
          </div>
          <div className="text-[11px] font-black text-t1">
            {lastSucceededPayout
              ? `${formatMoney(parseFloat(lastSucceededPayout.amount.value))} · ${formatPayoutDate(lastSucceededPayout.payoutDate)}`
              : loading
                ? '—'
                : 'None yet'}
          </div>
        </div>
      </div>

      {/* Bottom row: gross · fees · refunds · reconciled */}
      <div className="mt-2 grid grid-cols-4 gap-1 border-t border-s1/60 pt-2">
        <Metric label="Gross" value={summary ? formatMoney(summary.grossSales) : '—'} tone="neutral" />
        <Metric label="Fees" value={summary ? `−${formatMoney(summary.fees)}` : '—'} tone="negative" />
        <Metric label="Refunds" value={summary ? `−${formatMoney(summary.refunds)}` : '—'} tone="negative" />
        <Metric
          label="Reconciled"
          value={totalCount > 0 ? `${reconciledCount}/${totalCount}` : '—'}
          tone={reconciledCount === totalCount && totalCount > 0 ? 'positive' : 'neutral'}
        />
      </div>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'positive' | 'negative' }) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] font-bold uppercase tracking-wide text-t3">{label}</div>
      <div
        className={cn(
          'text-[11px] font-black leading-tight',
          tone === 'positive' && 'text-green',
          tone === 'negative' && 'text-red',
          tone === 'neutral' && 'text-t1',
        )}
      >
        {value}
      </div>
    </div>
  )
}
