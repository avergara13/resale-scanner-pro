import { useEffect, useState } from 'react'
import { ArrowSquareOut, Warning } from '@phosphor-icons/react'
import { fetchSellerStandards, type EbaySellerStandards } from '@/lib/ebay-finances-service'
import { cn } from '@/lib/utils'

// Compact account-health pill for the eBay section of Settings. Calls
// /api/ebay/seller-standards (5-min cached) and shows the user eBay's own
// assessment of their account — Top Rated / Above Standard / Below Standard —
// with the two most-relevant metrics inline. Tap → eBay Seller Hub dashboard.
//
// Only mounted when eBay is already configured; a guaranteed 401/503 for an
// un-connected user would be pure noise on the settings screen.

type LevelTone = 'positive' | 'neutral' | 'negative' | 'unknown'

function classifyLevel(level: string | undefined): { label: string; tone: LevelTone } {
  switch (level) {
    case 'TOP_RATED':
      return { label: 'Top Rated', tone: 'positive' }
    case 'ABOVE_STANDARD':
      return { label: 'Above Standard', tone: 'neutral' }
    case 'BELOW_STANDARD':
      return { label: 'Below Standard', tone: 'negative' }
    default:
      return { label: level || 'Unknown', tone: 'unknown' }
  }
}

// eBay returns metric names in PascalCase / camelCase like "defectRate" or
// "TRANSACTION_COUNT". Normalize to a short human-friendly label without
// hardcoding which metrics exist (the set differs across seller programs).
function humanizeMetricName(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, c => c.toUpperCase())
}

function formatMetricValue(value: number | string | undefined): string {
  if (value == null) return ''
  if (typeof value === 'number') {
    // Rates come back as fractions (0.012 = 1.2%). Counts come back as whole
    // numbers > 1. Heuristic: values from 0 up to 1 are rates; format as percent.
    if (value >= 0 && value < 1) return `${(value * 100).toFixed(1)}%`
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  return String(value)
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-s2/60 bg-fg/60 px-3 py-2 text-xs">
      <span className="h-2 w-2 rounded-full bg-s2" />
      <span className="text-t3">Fetching seller standards…</span>
    </div>
  )
}

export function SellerStandardsBadge() {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ok'; data: EbaySellerStandards }
    | { kind: 'auth' }
    | { kind: 'error' }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchSellerStandards().then(res => {
      if (cancelled) return
      if (res.status === 'ok') setState({ kind: 'ok', data: res.data })
      else if (res.status === 'auth_required') setState({ kind: 'auth' })
      else setState({ kind: 'error' })
    })
    return () => { cancelled = true }
  }, [])

  if (state.kind === 'loading') return <SkeletonRow />

  if (state.kind === 'auth') {
    return (
      <a
        href="/api/ebay/auth-url"
        className="flex items-center gap-2 rounded-lg border border-amber/40 bg-amber-bg/30 px-3 py-2 text-xs font-semibold text-amber hover:bg-amber-bg/50"
      >
        <Warning size={14} weight="fill" />
        Connect eBay to see seller standards
      </a>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-s2/60 bg-fg/60 px-3 py-2 text-xs text-t3">
        <span className="h-2 w-2 rounded-full bg-t3/60" />
        Seller standards unavailable
      </div>
    )
  }

  const { label, tone } = classifyLevel(state.data.standardsLevel)
  // Pick the first two metrics that have both a name and a value — eBay's
  // metric set varies by program (US Standard vs. Global) so hardcoding
  // "defectRate" or "lateShipmentRate" would blank out for anyone on a
  // program where those aren't surfaced.
  const metrics = (state.data.metrics || [])
    .filter(m => m?.name && m.value != null && m.value !== '')
    .slice(0, 2)

  return (
    <a
      href="https://www.ebay.com/sh/performance/dashboard"
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-s2/60 bg-fg/60 px-3 py-2 text-xs hover:border-s3"
    >
      <span
        className={cn(
          'h-2.5 w-2.5 flex-shrink-0 rounded-full',
          tone === 'positive' && 'bg-green',
          tone === 'neutral' && 'bg-amber',
          tone === 'negative' && 'bg-red',
          tone === 'unknown' && 'bg-t3/60',
        )}
      />
      <span className="font-semibold text-t1">{label}</span>
      {metrics.length > 0 && (
        <span className="min-w-0 flex-1 truncate text-t3">
          {metrics
            .map(m => `${humanizeMetricName(m.name)}: ${formatMetricValue(m.value)}`)
            .join(' · ')}
        </span>
      )}
      <ArrowSquareOut size={12} weight="bold" className="flex-shrink-0 text-t3" />
    </a>
  )
}
