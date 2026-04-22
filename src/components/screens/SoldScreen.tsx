import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowClockwise, ArrowSquareOut, CheckCircle, Package, SpinnerGap, Truck, Plus, Sparkle, X, Tag as TagIcon, Archive } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { SessionLiveBanner } from '@/components/SessionLiveBanner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { SwipeableRow } from '@/components/ui/SwipeableRow'
import { Trash, ArrowRight } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { logActivity } from '@/lib/activity-log'
import { cn } from '@/lib/utils'
import { createPirateShipUrl } from '@/lib/shipping-rate-service'
import { recommendShipping, analyzeSoldBatch } from '@/lib/shipping-intelligence'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { useEbayFinances } from '@/hooks/use-ebay-finances'
import { lookupReconciliation, type OrderReconciliation } from '@/lib/ebay-finances-service'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'
import { EarningsSummaryCard, type EarningsPeriod } from '../EarningsSummaryCard'
import type { SoldItem, SoldShippingStatus, SoldShippingUpdateInput, SoldDelistStatus, ManualSaleEntry } from '@/types'

type FulfillmentFilter = 'all' | 'need-label' | 'label-ready' | 'shipped'

interface SoldScreenProps {
  soldItems: SoldItem[]
  loading: boolean
  error: string | null
  warnings: string[]
  lastSyncedAt: number | null
  onRefresh: () => void
  onUpdateShipping: (pageId: string, update: SoldShippingUpdateInput) => Promise<void>
}

interface SoldItemDraft {
  shippingStatus: SoldShippingStatus
  trackingNumber: string
  labelProvider: string
  labelCost: string
  shipFromZip: string
  packageDims: string
  itemWeightLbs: string
  shipNotes: string
  delistStatus: string
}

const SHIPPING_STATUS_OPTIONS: SoldShippingStatus[] = ['🔴 Need Label', '🟡 Label Ready', '📦 Packed', '✅ Shipped']
const DELIST_STATUS_OPTIONS: SoldDelistStatus[] = ['⏳ Pending Delist', '✅ Delisted — All Platforms', '⚠️ Manual Delist Needed']

const LABEL_PROVIDER_OPTIONS = [
  '🏴‍☠️ Pirate Ship',
  '🛒 eBay Label',
  '🟢 Mercari Label',
  '🩷 Poshmark Label',
  '📮 USPS Direct',
  '📦 UPS Direct',
  '🟠 FedEx Direct',
]

const PLATFORM_OPTIONS = ['eBay', 'Mercari', 'Poshmark', 'Facebook Marketplace', 'Depop', 'Grailed', 'Whatnot', 'Other']

/**
 * Presentational mapping — SoldShippingStatus → StatusChip tone + icon + label.
 * Stored values (the string keys with emoji) are NEVER mutated; this map is
 * read-only and exists solely to render the chip. New stored values fall
 * through to a neutral chip with the raw string displayed.
 */
const STATUS_CHIP_MAP: Record<SoldShippingStatus, { tone: 'danger' | 'warning' | 'info' | 'success'; icon: React.ReactNode; label: string }> = {
  '🔴 Need Label': { tone: 'danger',  icon: <Package size={14} weight="bold" />,     label: 'Need Label' },
  '🟡 Label Ready': { tone: 'warning', icon: <TagIcon size={14} weight="bold" />,    label: 'Label Ready' },
  '📦 Packed':      { tone: 'info',    icon: <Archive size={14} weight="bold" />,    label: 'Packed' },
  '✅ Shipped':     { tone: 'success', icon: <CheckCircle size={14} weight="bold" />, label: 'Shipped' },
}

function formatSaleDate(value?: string | null): string {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMoney(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function buildDraft(item: SoldItem): SoldItemDraft {
  return {
    shippingStatus: item.shippingStatus,
    trackingNumber: item.trackingNumber || '',
    labelProvider: item.labelProvider || '🏴‍☠️ Pirate Ship',
    labelCost: item.labelCost || '',
    shipFromZip: item.shipFromZip || '32806',
    packageDims: item.packageDims || '',
    itemWeightLbs: item.itemWeightLbs || '',
    shipNotes: '',
    delistStatus: item.delistStatus || '',
  }
}

/** Convert a manual sale entry to a SoldItem for unified rendering */
function manualSaleToSoldItem(entry: ManualSaleEntry): SoldItem {
  return {
    id: `manual-${entry.id}`,
    salePageId: `manual-${entry.id}`,
    title: entry.title,
    platform: entry.platform,
    salePrice: entry.salePrice,
    platformFee: entry.platformFee ?? null,
    netIncome: entry.salePrice - (entry.platformFee || 0),
    saleDate: entry.saleDate || new Date(entry.createdAt).toISOString().slice(0, 10),
    shippingStatus: entry.shippingStatus,
    trackingNumber: entry.trackingNumber || null,
    labelProvider: entry.labelProvider || null,
    labelCost: entry.labelCost || null,
    buyerZip: entry.buyerZip || null,
    buyerInfo: entry.buyerInfo || null,
    shipFromZip: '32806',
    packageDims: entry.packageDims || null,
    itemWeightLbs: entry.itemWeightLbs || null,
    orderNumber: entry.orderNumber || null,
    metadataSource: 'manual',
    isManualEntry: true,
  }
}

export function SoldScreen({ soldItems, loading, error, warnings: _warnings, lastSyncedAt: _lastSyncedAt, onRefresh, onUpdateShipping }: SoldScreenProps) {
  // Manual sales live in local KV — persist offline, merge with live Notion feed on render
  const [manualSales, setManualSales] = useKV<ManualSaleEntry[]>('manual-sold-items', [])
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>('all')
  const [drafts, setDrafts] = useState<Record<string, SoldItemDraft>>({})
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // Merge live Notion items with local manual entries
  const mergedItems = useMemo(() => {
    const manuals = (manualSales || []).map(manualSaleToSoldItem)
    return [...soldItems, ...manuals]
  }, [soldItems, manualSales])

  useEffect(() => {
    setDrafts(() => {
      const next: Record<string, SoldItemDraft> = {}
      for (const item of mergedItems) {
        next[item.salePageId] = buildDraft(item)
      }
      return next
    })
  }, [mergedItems])

  const filteredItems = useMemo(() => {
    return mergedItems.filter((item) => {
      if (fulfillmentFilter === 'all') return true
      if (fulfillmentFilter === 'need-label') return item.shippingStatus === '🔴 Need Label'
      if (fulfillmentFilter === 'label-ready') return item.shippingStatus === '🟡 Label Ready' || item.shippingStatus === '📦 Packed'
      return item.shippingStatus === '✅ Shipped'
    })
  }, [fulfillmentFilter, mergedItems])

  const batchStats = useMemo(() => analyzeSoldBatch(mergedItems), [mergedItems])

  // ── eBay Finances reconciliation ──────────────────────────────────────────
  // Period persists across sessions so the user doesn't have to re-pick 90d
  // every time they open Sold. Default 30d matches eBay's own "Last 30 days"
  // view and keeps the initial window fast.
  const [earningsPeriod, setEarningsPeriod] = useKV<EarningsPeriod>('ebay-finances-period', 30)
  const finances = useEbayFinances(earningsPeriod ?? 30)
  // Multi-item orders (one buyer buys 2+ line items in one checkout) produce a
  // single OrderReconciliation bucket whose `net` is the full order total. If
  // we assign that bucket to every line, each item's card would show the whole
  // order's net next to a single item's predicted net — visually correct delta,
  // actually wrong. We tag those orders as ambiguous and suppress the per-item
  // delta for them; the header card still reflects the correct order-level
  // totals. A future per-line-item allocator would be the real fix, but eBay
  // Finances doesn't break out line-item fees, so it can't be exact today.
  const { reconciliationByItem, ambiguousOrders } = useMemo(() => {
    const byItem = new Map<string, OrderReconciliation>()
    const itemsPerOrder = new Map<string, number>()
    if (finances.authStatus !== 'ok' || finances.byOrderId.size === 0) {
      return { reconciliationByItem: byItem, ambiguousOrders: new Set<string>() }
    }
    for (const item of mergedItems) {
      const match = lookupReconciliation(finances.byOrderId, item.orderNumber)
      if (match) {
        byItem.set(item.salePageId, match)
        itemsPerOrder.set(match.orderId, (itemsPerOrder.get(match.orderId) || 0) + 1)
      }
    }
    const ambiguous = new Set<string>()
    for (const [orderId, count] of itemsPerOrder) {
      if (count > 1) ambiguous.add(orderId)
    }
    return { reconciliationByItem: byItem, ambiguousOrders: ambiguous }
  }, [finances.authStatus, finances.byOrderId, mergedItems])
  const reconciliationStats = useMemo(() => {
    // Only sold items that *claim* an orderNumber are reconcilable candidates;
    // items missing the field aren't counted against the "X of Y" ratio.
    let candidates = 0
    for (const item of mergedItems) {
      if (item.orderNumber && item.orderNumber.trim().length > 0) candidates += 1
    }
    return { reconciled: reconciliationByItem.size, candidates }
  }, [mergedItems, reconciliationByItem])

  const handleDraftChange = (pageId: string, key: keyof SoldItemDraft, value: string) => {
    setDrafts((previous) => ({
      ...previous,
      [pageId]: {
        ...(previous[pageId] || buildDraft(mergedItems.find(i => i.salePageId === pageId) || ({} as SoldItem))),
        [key]: value,
      },
    }))
  }

  const handleSave = async (item: SoldItem) => {
    const draft = drafts[item.salePageId] || buildDraft(item)

    // Manual entries update local KV instead of Notion
    if (item.isManualEntry) {
      const manualId = item.salePageId.replace(/^manual-/, '')
      setManualSales(prev => (prev || []).map(m => m.id === manualId ? {
        ...m,
        shippingStatus: draft.shippingStatus,
        trackingNumber: draft.trackingNumber || undefined,
        labelProvider: draft.labelProvider || undefined,
        labelCost: draft.labelCost || undefined,
        itemWeightLbs: draft.itemWeightLbs || undefined,
        packageDims: draft.packageDims || undefined,
      } : m))
      logActivity('Manual sale updated locally')
      return
    }

    setSavingItemId(item.salePageId)
    try {
      await onUpdateShipping(item.salePageId, {
        shippingStatus: draft.shippingStatus,
        trackingNumber: draft.trackingNumber || undefined,
        labelProvider: draft.labelProvider || undefined,
        labelCost: draft.labelCost || undefined,
        shipFromZip: draft.shipFromZip || undefined,
        packageDims: draft.packageDims || undefined,
        itemWeightLbs: draft.itemWeightLbs || undefined,
        shipNotes: draft.shipNotes || undefined,
        delistStatus: (draft.delistStatus as SoldDelistStatus) || undefined,
      })
    } finally {
      setSavingItemId(null)
    }
  }

  const handlePullRefresh = useCallback(async () => {
    onRefresh()
    await new Promise(resolve => setTimeout(resolve, 800))
  }, [onRefresh])

  const {
    containerRef: soldContainerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    progress,
    shouldTrigger,
  } = usePullToRefresh({
    onRefresh: handlePullRefresh,
    threshold: 80,
    maxPullDistance: 150,
    enabled: true,
  })

  // Loading state only applies if we have no items at all (live + manual)
  if (loading && mergedItems.length === 0) {
    return (
      <div className="h-full flex flex-col gap-2 px-3 pt-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[96px] w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  // Error state — still offer manual fallback so the page is never useless
  if (error && mergedItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
        <Truck size={48} className="text-red" weight="duotone" />
        <div>
          <h2 className="text-lg font-bold text-t1">Sold Feed Offline</h2>
          <p className="text-sm text-t3 max-w-sm mx-auto">{error}</p>
          <p className="text-xs text-t3 max-w-sm mx-auto mt-2">You can still log sales manually below — they persist locally and will sync next time you&apos;re online.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onRefresh} className="bg-b1 text-white">
            <ArrowClockwise size={14} className="mr-1.5" />
            Retry
          </Button>
          <Button onClick={() => setShowManualDialog(true)} variant="outline">
            <Plus size={14} className="mr-1.5" />
            Log Sale Manually
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* ── Sticky Header — glass, banner, tabs ─────────────────────────── */}
      <div className="material-chrome sticky top-0 z-10 border-b border-separator">
        {/* Live session banner — above tab bar, matching Agent/Listings layout */}
        <SessionLiveBanner />
        <div className="px-3 pt-2 pb-2">
          <div className="tab-bar">
            {([
              ['all', 'All'],
              ['need-label', '🔴 Sold'],
              ['label-ready', '🟡 Ready'],
              ['shipped', '✅ Shipped'],
            ] as Array<[FulfillmentFilter, string]>).map(([filter, label]) => (
              <button
                key={filter}
                onClick={() => setFulfillmentFilter(filter)}
                className={cn('tab-btn', fulfillmentFilter === filter && 'active')}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Earnings reconciliation card — real eBay payouts + fees ───── */}
      <EarningsSummaryCard
        authStatus={finances.authStatus}
        errorMessage={finances.errorMessage}
        summary={finances.summary}
        lastSucceededPayout={finances.lastSucceededPayout}
        reconciledCount={reconciliationStats.reconciled}
        totalCount={reconciliationStats.candidates}
        period={earningsPeriod ?? 30}
        onPeriodChange={setEarningsPeriod}
        onRefresh={finances.refresh}
      />

      {/* ── Slim stats strip — matches Agent inline style ─────────────── */}
      <div className="material-thin flex h-[38px] flex-shrink-0 items-center overflow-hidden border-b border-s1/60 px-3">
        <div className="flex items-center gap-2 flex-1 text-[10px]">
          <span className="text-t1 font-black">{mergedItems.length} <span className="font-normal text-t3">Sold</span></span>
          <span className="text-red font-black">{batchStats.needsLabelCount} <span className="font-normal text-t3">Need Label</span></span>
          <span className="text-amber font-black">{batchStats.overdueCount} <span className="font-normal text-t3">Overdue</span></span>
          <span className="text-green font-black">{batchStats.shippedCount} <span className="font-normal text-t3">Shipped</span></span>
        </div>
        <button
          onClick={() => setShowManualDialog(true)}
          className="text-[9px] font-bold text-t1 uppercase tracking-wide transition-opacity active:opacity-50 flex-shrink-0"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          + Log Sale
        </button>
      </div>

      {/* ── Scrollable list ───────────────────────────────────────────── */}
      <div
        ref={soldContainerRef}
        className="flex-1 overflow-y-auto scrollable-content overscroll-y-contain"
      >
        <PullToRefreshIndicator
          isPulling={isPulling}
          isRefreshing={isRefreshing}
          pullDistance={pullDistance}
          progress={progress}
          shouldTrigger={shouldTrigger}
        />
        <div
          className="px-3 pt-2 space-y-2"
          style={{
            paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 0px) + 80px)',
            transform: `translateY(${isPulling ? pullDistance : isRefreshing ? 60 : 0}px)`,
            transition: isPulling ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            willChange: isPulling || isRefreshing ? 'transform' : 'auto',
          }}
        >
        {filteredItems.length === 0 ? (
          <div className="flex items-center justify-center min-h-[58vh] px-6">
            <EmptyState
              className="w-full max-w-sm"
              icon={<Package weight="duotone" />}
              title={mergedItems.length === 0 ? 'No sales yet' : 'Nothing matches this filter'}
              description={
                mergedItems.length === 0
                  ? 'Sales appear here once items are marked as sold or synced from your store.'
                  : 'Try a different filter tab to view your sales.'
              }
              actionLabel={mergedItems.length === 0 ? 'Log sale manually' : undefined}
              onAction={mergedItems.length === 0 ? () => setShowManualDialog(true) : undefined}
            />
          </div>
        ) : (
          filteredItems.map((item) => {
            const draft = drafts[item.salePageId] || buildDraft(item)
            const isExpanded = expandedItemId === item.salePageId
            const recommendation = recommendShipping({
              itemWeightLbs: draft.itemWeightLbs,
              packageDims: draft.packageDims,
              originZip: draft.shipFromZip,
              destinationZip: item.buyerZip,
              platform: item.platform,
              shippingStatus: draft.shippingStatus,
              saleDate: item.saleDate,
            })
            const pirateShipUrl = createPirateShipUrl({
              title: item.title,
              itemWeightLbs: draft.itemWeightLbs,
              packageDims: draft.packageDims,
              originZip: draft.shipFromZip,
              destinationZip: item.buyerZip,
              platform: item.platform,
            })

            const ebayOrderUrl = item.orderNumber
              ? `https://www.ebay.com/sh/ord/details?orderid=${encodeURIComponent(item.orderNumber)}`
              : 'https://www.ebay.com/sh/ord/?status=AWAITING_SHIPMENT'

            const netIncome = item.netIncome ?? ((item.salePrice || 0) - (item.platformFee || 0))
            const reconciliation = reconciliationByItem.get(item.salePageId)
            const hasOrderNumber = !!(item.orderNumber && item.orderNumber.trim().length > 0)
            const isAmbiguousOrder = reconciliation ? ambiguousOrders.has(reconciliation.orderId) : false
            const reconciliationDelta = reconciliation ? reconciliation.net - netIncome : 0
            const deltaIsMeaningful = reconciliation && !isAmbiguousOrder ? Math.abs(reconciliationDelta) > 2 : false

            // Swipe-right cycles draft shipping status forward (🔴→🟡→📦→✅).
            // Matches the tap-button row's local-only semantics — user still taps
            // Save to persist. Past ✅ Shipped there is nowhere to advance, so
            // the action is omitted. Swipe-left deletes manual entries only;
            // eBay-imported rows have no client-side delete path, so leftAction
            // is undefined there.
            const currentStatusIdx = SHIPPING_STATUS_OPTIONS.indexOf(draft.shippingStatus)
            const nextStatus = currentStatusIdx >= 0 && currentStatusIdx < SHIPPING_STATUS_OPTIONS.length - 1
              ? SHIPPING_STATUS_OPTIONS[currentStatusIdx + 1]
              : null

            return (
              <SwipeableRow
                key={item.salePageId}
                leftAction={item.isManualEntry ? {
                  icon: <Trash size={16} weight="bold" />,
                  label: 'Delete',
                  color: 'bg-red-500',
                  onTrigger: () => {
                    const manualId = item.salePageId.replace(/^manual-/, '')
                    setManualSales(prev => (prev || []).filter(m => m.id !== manualId))
                    logActivity('Manual sale removed')
                  },
                } : undefined}
                rightAction={nextStatus ? {
                  icon: <ArrowRight size={16} weight="bold" />,
                  label: nextStatus.split(' ').slice(1).join(' '),
                  color: 'bg-b1',
                  onTrigger: () => {
                    handleDraftChange(item.salePageId, 'shippingStatus', nextStatus)
                    setDrafts(prev => ({ ...prev, [item.salePageId]: { ...draft, shippingStatus: nextStatus } }))
                  },
                } : undefined}
                className="rounded-2xl"
              >
              <Card
                className="material-thin border-s2/60 p-3 overflow-hidden"
              >
                {/* ── Row 1: thumbnail + title + price ──────────────── */}
                <div className="flex gap-3">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="h-14 w-14 rounded-xl object-cover bg-s1 flex-shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-s1 flex items-center justify-center flex-shrink-0">
                      <Package size={20} className="text-t3" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-t1 leading-tight line-clamp-2">{item.title}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {(() => {
                            const chip = STATUS_CHIP_MAP[draft.shippingStatus]
                            return chip ? (
                              <StatusChip tone={chip.tone} icon={chip.icon} className="h-5 px-2 text-[10px]">
                                {chip.label}
                              </StatusChip>
                            ) : (
                              <StatusChip tone="neutral" className="h-5 px-2 text-[10px]">
                                {draft.shippingStatus}
                              </StatusChip>
                            )
                          })()}
                          <span className="text-[9px] font-bold uppercase tracking-wide text-t3">{item.platform}</span>
                          {item.isManualEntry && (
                            <span className="text-[8px] font-bold uppercase tracking-wide text-b1 bg-blue-bg px-1 py-0.5 rounded">MANUAL</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-black text-t1 leading-none">{formatMoney(item.salePrice)}</div>
                        {typeof item.platformFee === 'number' && item.platformFee > 0 && (
                          <div className="text-[9px] text-t3 mt-0.5">Fee −{formatMoney(item.platformFee)}</div>
                        )}
                        <div className="text-[10px] text-green font-bold mt-0.5">Net {formatMoney(netIncome)}</div>
                        {reconciliation && !isAmbiguousOrder && (
                          <div
                            className={cn(
                              'text-[9px] font-black mt-0.5 flex items-center gap-1 justify-end',
                              deltaIsMeaningful
                                ? reconciliationDelta > 0
                                  ? 'text-green'
                                  : 'text-red'
                                : 'text-t3',
                            )}
                            title={`eBay actual net: $${reconciliation.net.toFixed(2)} · fees $${reconciliation.fees.toFixed(2)} · refunds $${reconciliation.refunds.toFixed(2)}`}
                          >
                            <span className="uppercase tracking-wide">eBay</span>
                            <span>{formatMoney(reconciliation.net)}</span>
                            {deltaIsMeaningful && (
                              <span>
                                {reconciliationDelta > 0 ? '+' : '−'}
                                {formatMoney(Math.abs(reconciliationDelta))}
                              </span>
                            )}
                          </div>
                        )}
                        {reconciliation && isAmbiguousOrder && (
                          <div
                            className="text-[9px] text-t3 mt-0.5 flex items-center gap-1 justify-end"
                            title="This order contains multiple line items. eBay Finances only reports order-level totals, so per-item net can't be broken out."
                          >
                            <span className="uppercase tracking-wide">Multi-item</span>
                          </div>
                        )}
                        {!reconciliation && hasOrderNumber && finances.authStatus === 'ok' && (
                          <div
                            className="text-[9px] text-t3 mt-0.5 flex items-center gap-1 justify-end"
                            title="Order not found in recent eBay Finances window — may still be pending payout."
                          >
                            <span>⏳</span>
                            <span className="uppercase tracking-wide">Pending</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta row — order #, date, buyer */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-t3">
                      <span>{formatSaleDate(item.saleDate)}</span>
                      {item.orderNumber && <span>#{item.orderNumber}</span>}
                      {item.buyerZip && <span>ZIP {item.buyerZip}</span>}
                    </div>
                  </div>
                </div>

                {/* ── Row 2: AI Shipping Recommendation banner ──────── */}
                {draft.shippingStatus !== '✅ Shipped' && recommendation.bestQuote && (
                  <div
                    className="mt-3 flex items-start gap-2 rounded-xl border border-b1/25 bg-blue-bg/80 px-3 py-2"
                  >
                    <Sparkle size={14} weight="fill" className="text-b1 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-bold text-t1">
                          {recommendation.bestQuote.carrier} {recommendation.bestQuote.service}
                        </span>
                        <span className="text-[12px] font-black text-b1 flex-shrink-0">{formatMoney(recommendation.bestQuote.amount)}</span>
                      </div>
                      <p className="text-[10px] text-t2 leading-snug mt-0.5">{recommendation.reasoning}</p>
                      {recommendation.missingData.length > 0 && (
                        <p className="text-[9px] text-amber mt-1">
                          Add {recommendation.missingData.join(' + ')} for a better estimate.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Row 3: Mark-shipped tap-action (Ready/Packed only) or status cycle ── */}
                {(draft.shippingStatus === '🟡 Label Ready' || draft.shippingStatus === '📦 Packed') ? (
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      disabled={savingItemId === item.salePageId}
                      onClick={async () => {
                        const shippedDraft = { ...draft, shippingStatus: '✅ Shipped' as SoldShippingStatus }
                        setDrafts(prev => ({ ...prev, [item.salePageId]: shippedDraft }))
                        if (item.isManualEntry) {
                          const manualId = item.salePageId.replace(/^manual-/, '')
                          setManualSales(prev => (prev || []).map(m => m.id === manualId ? { ...m, shippingStatus: '✅ Shipped' as SoldShippingStatus } : m))
                          logActivity('Shipped!')
                        } else {
                          setSavingItemId(item.salePageId)
                          try {
                            await onUpdateShipping(item.salePageId, { shippingStatus: '✅ Shipped' })
                            logActivity('Marked as shipped!')
                          } finally {
                            setSavingItemId(null)
                          }
                        }
                      }}
                      className="bg-system-green text-white hover:bg-system-green/90 gap-1.5"
                    >
                      {savingItemId === item.salePageId
                        ? <SpinnerGap size={14} className="animate-spin" />
                        : <CheckCircle size={14} weight="bold" />}
                      Ship
                    </Button>
                  </div>
                ) : draft.shippingStatus !== '✅ Shipped' ? (
                  <div className="flex gap-1.5 mt-2">
                    {SHIPPING_STATUS_OPTIONS.filter(s => s !== '✅ Shipped').map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          handleDraftChange(item.salePageId, 'shippingStatus', status)
                          const updatedDraft = { ...draft, shippingStatus: status }
                          setDrafts(prev => ({ ...prev, [item.salePageId]: updatedDraft }))
                        }}
                        className={cn(
                          'flex-1 text-[9px] font-bold px-1 py-1.5 rounded-lg border transition-all active:scale-95',
                          draft.shippingStatus === status
                            ? 'bg-b1 text-white border-b1'
                            : 'bg-bg text-t3 border-s2/60 hover:border-b1/50'
                        )}
                      >
                        {status.slice(0, 2)}
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* ── Buy Label quick-links — always visible until shipped ── */}
                {draft.shippingStatus !== '✅ Shipped' && (
                  <div className="flex gap-1.5 mt-2">
                    <a
                      href={ebayOrderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 h-8 rounded-xl border border-s2/60 text-[10px] font-bold text-t2 hover:text-t1 hover:border-b1/40 transition-colors"
                    >
                      <ArrowSquareOut size={10} />
                      eBay Label
                    </a>
                    <a
                      href={pirateShipUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 h-8 rounded-xl border border-s2/60 text-[10px] font-bold text-t2 hover:text-t1 hover:border-b1/40 transition-colors"
                    >
                      <ArrowSquareOut size={10} />
                      Pirate Ship
                    </a>
                  </div>
                )}

                {/* ── Row 4: Expand/Collapse details ───────────────── */}
                <button
                  onClick={() => setExpandedItemId(isExpanded ? null : item.salePageId)}
                  className="w-full mt-2 text-[10px] font-bold text-t3 hover:text-t1 py-1 transition-colors"
                >
                  {isExpanded ? '▴ Hide details' : '▾ Show details & save'}
                </button>

                {/* ── Row 5: Expanded editor ────────────────────────── */}
                {isExpanded && (
                  <div className="mt-2 space-y-3 rounded-xl border border-s2/40 bg-secondary-system-background/80 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wide text-t3">Ship From ZIP</Label>
                        <Input value={draft.shipFromZip} onChange={(e) => handleDraftChange(item.salePageId, 'shipFromZip', e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wide text-t3">Buyer ZIP</Label>
                        <Input value={item.buyerZip || ''} readOnly className="h-9 text-xs text-t3" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wide text-t3">Weight lbs</Label>
                        <Input value={draft.itemWeightLbs} onChange={(e) => handleDraftChange(item.salePageId, 'itemWeightLbs', e.target.value)} placeholder="1.25" className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wide text-t3">Dims (LxWxH)</Label>
                        <Input value={draft.packageDims} onChange={(e) => handleDraftChange(item.salePageId, 'packageDims', e.target.value)} placeholder="10 x 6 x 4" className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wide text-t3">Tracking #</Label>
                        <Input value={draft.trackingNumber} onChange={(e) => handleDraftChange(item.salePageId, 'trackingNumber', e.target.value)} placeholder="9400..." className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wide text-t3">Label Cost $</Label>
                        <Input value={draft.labelCost} onChange={(e) => handleDraftChange(item.salePageId, 'labelCost', e.target.value)} placeholder="4.49" className="h-9 text-xs" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase tracking-wide text-t3">Label Provider</Label>
                      <select
                        value={draft.labelProvider}
                        onChange={(e) => handleDraftChange(item.salePageId, 'labelProvider', e.target.value)}
                        className="h-9 w-full rounded-lg border border-s2 bg-bg px-2 text-xs text-t1"
                      >
                        {LABEL_PROVIDER_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <p className="text-[8px] text-t3 leading-snug">
                        eBay Label = bought via eBay Seller Hub · Pirate Ship = ship.pirateship.com
                      </p>
                    </div>

                    {!item.isManualEntry && (
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wide text-t3">Delist Status</Label>
                        <select
                          value={draft.delistStatus}
                          onChange={(e) => handleDraftChange(item.salePageId, 'delistStatus', e.target.value)}
                          className="h-9 w-full rounded-lg border border-s2 bg-bg px-2 text-xs text-t1"
                        >
                          <option value="">— not set —</option>
                          {DELIST_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSave(item)}
                        className="flex-1 bg-b1 hover:bg-b2 text-white h-9 text-xs font-bold"
                        disabled={savingItemId === item.salePageId}
                      >
                        {savingItemId === item.salePageId && <SpinnerGap size={12} className="mr-1 animate-spin" />}
                        Save
                      </Button>
                      <Button asChild variant="outline" className="h-9 text-xs border-b1/30 text-b1">
                        <a href={pirateShipUrl} target="_blank" rel="noreferrer">
                          <ArrowSquareOut size={12} className="mr-1" />
                          Pirate Ship
                        </a>
                      </Button>
                      {item.isManualEntry && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 text-xs text-red hover:bg-red/10"
                          onClick={() => {
                            const manualId = item.salePageId.replace(/^manual-/, '')
                            setManualSales(prev => (prev || []).filter(m => m.id !== manualId))
                            logActivity('Manual sale removed')
                          }}
                        >
                          <X size={12} />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
              </SwipeableRow>
            )
          })
        )}
        </div> {/* end transform wrapper */}
      </div>

      {/* ── Manual Sale Dialog ──────────────────────────────────────── */}
      <ManualSaleDialog
        open={showManualDialog}
        onClose={() => setShowManualDialog(false)}
        onSave={(entry) => {
          setManualSales(prev => [...(prev || []), entry])
          logActivity('Sale logged locally')
          setShowManualDialog(false)
        }}
      />
    </div>
  )
}

// ── Manual Sale Entry Dialog ───────────────────────────────────────
interface ManualSaleDialogProps {
  open: boolean
  onClose: () => void
  onSave: (entry: ManualSaleEntry) => void
}

function ManualSaleDialog({ open, onClose, onSave }: ManualSaleDialogProps) {
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('eBay')
  const [salePrice, setSalePrice] = useState('')
  const [platformFee, setPlatformFee] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [buyerZip, setBuyerZip] = useState('')
  const [itemWeightLbs, setItemWeightLbs] = useState('')
  const [packageDims, setPackageDims] = useState('')

  const reset = () => {
    setTitle(''); setPlatform('eBay'); setSalePrice(''); setPlatformFee('')
    setOrderNumber(''); setBuyerZip(''); setItemWeightLbs(''); setPackageDims('')
  }

  const handleSave = () => {
    const price = Number.parseFloat(salePrice)
    if (!title.trim() || !Number.isFinite(price) || price <= 0) {
      toast.error('Title and sale price are required')
      return
    }
    const fee = Number.parseFloat(platformFee)
    const entry: ManualSaleEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      title: title.trim(),
      platform,
      salePrice: price,
      platformFee: Number.isFinite(fee) ? fee : undefined,
      orderNumber: orderNumber.trim() || undefined,
      buyerZip: buyerZip.trim() || undefined,
      itemWeightLbs: itemWeightLbs.trim() || undefined,
      packageDims: packageDims.trim() || undefined,
      saleDate: new Date().toISOString().slice(0, 10),
      shippingStatus: '🔴 Need Label',
    }
    onSave(entry)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Manual Sale</DialogTitle>
          <p className="text-xs text-t3 mt-1">Saved locally. Use this when email parsing isn&apos;t running or you&apos;re offline.</p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-t3">Item Name *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nike Air Max 90 — Size 10" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-t3">Platform *</Label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="h-10 w-full rounded-lg border border-s2 bg-bg px-2 text-sm text-t1"
              >
                {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-t3">Sale Price $ *</Label>
              <Input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="45.00" inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-t3">Platform Fee $</Label>
              <Input value={platformFee} onChange={(e) => setPlatformFee(e.target.value)} placeholder="6.11" inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-t3">Order #</Label>
              <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="optional" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-t3">Buyer ZIP</Label>
              <Input value={buyerZip} onChange={(e) => setBuyerZip(e.target.value)} placeholder="90210" inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-t3">Weight lbs</Label>
              <Input value={itemWeightLbs} onChange={(e) => setItemWeightLbs(e.target.value)} placeholder="1.25" inputMode="decimal" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-t3">Dimensions (LxWxH)</Label>
            <Input value={packageDims} onChange={(e) => setPackageDims(e.target.value)} placeholder="10 x 6 x 4" />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} className="flex-1 bg-b1 text-white">Save Sale</Button>
          <Button onClick={() => { onClose(); reset() }} variant="outline">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
