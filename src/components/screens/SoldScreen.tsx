import { useEffect, useMemo, useState } from 'react'
import { ArrowClockwise, ArrowSquareOut, CheckCircle, Package, SpinnerGap, Truck, Plus, Sparkle, X } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { logActivity } from '@/lib/activity-log'
import { cn } from '@/lib/utils'
import { createPirateShipUrl } from '@/lib/shipping-rate-service'
import { recommendShipping, analyzeSoldBatch } from '@/lib/shipping-intelligence'
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

const STATUS_BADGE_STYLES: Record<SoldShippingStatus, string> = {
  '🔴 Need Label': 'bg-red/10 text-red border-red/20',
  '🟡 Label Ready': 'bg-amber/10 text-amber border-amber/20',
  '📦 Packed': 'bg-blue-bg text-b1 border-b1/30',
  '✅ Shipped': 'bg-green/10 text-green border-green/20',
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

export function SoldScreen({ soldItems, loading, error, warnings, lastSyncedAt, onRefresh, onUpdateShipping }: SoldScreenProps) {
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

  const lastSyncedLabel = useMemo(() => {
    if (!lastSyncedAt) return null
    return new Date(lastSyncedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }, [lastSyncedAt])

  // Loading state only applies if we have no items at all (live + manual)
  if (loading && mergedItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
        <SpinnerGap size={28} className="animate-spin text-b1" />
        <div>
          <h2 className="text-lg font-bold text-t1">Loading Live Sold Feed</h2>
          <p className="text-sm text-t3">Reading the current Sales and Inventory data lane.</p>
        </div>
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
      {/* ── Sticky Header — glass, tabs, stats ─────────────────────────── */}
      <div
        className="px-3 pt-2 pb-2 sticky top-0 z-10"
        style={{
          background: 'color-mix(in oklch, var(--fg) 85%, transparent)',
          backdropFilter: 'saturate(180%) blur(24px)',
          WebkitBackdropFilter: 'saturate(180%) blur(24px)',
          borderBottom: '0.5px solid color-mix(in oklch, var(--s2) 50%, transparent)',
        }}
      >
        <div className="tab-bar">
          {([
            ['all', 'All'],
            ['need-label', 'Sold'],
            ['label-ready', 'Ready'],
            ['shipped', 'Shipped'],
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

      {/* ── Slim stats strip — matches Agent inline style ─────────────── */}
      <div
        className="px-3 border-b border-s1/60 flex-shrink-0"
        style={{ background: 'color-mix(in oklch, var(--fg) 85%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', height: '38px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}
      >
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
        className="flex-1 overflow-y-auto px-3 pt-2 space-y-2"
        style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 0px) + 80px)' }}
      >
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8 py-16">
            <Package size={48} className="text-t3 opacity-40 mb-4" weight="duotone" />
            <h3 className="text-base font-bold text-t1">No matching sales</h3>
            <p className="text-xs text-t3 max-w-sm mt-1">
              The Sales database is connected, but nothing matches this filter.
            </p>
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

            const netIncome = item.netIncome ?? ((item.salePrice || 0) - (item.platformFee || 0))

            return (
              <Card
                key={item.salePageId}
                className="border-s2/60 p-3 overflow-hidden"
                style={{
                  background: 'color-mix(in oklch, var(--fg) 88%, transparent)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
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
                          <Badge className={cn('border text-[9px] font-bold h-5 px-1.5', STATUS_BADGE_STYLES[draft.shippingStatus])}>
                            {draft.shippingStatus}
                          </Badge>
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
                    className="mt-3 rounded-xl border border-b1/25 px-3 py-2 flex items-start gap-2"
                    style={{ background: 'color-mix(in oklch, var(--blue-bg) 80%, transparent)' }}
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

                {/* ── Row 3: Shipped CTA (Ready items only) or status cycle ── */}
                {(draft.shippingStatus === '🟡 Label Ready' || draft.shippingStatus === '📦 Packed') ? (
                  <button
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
                    className="w-full mt-2 flex items-center justify-center gap-1.5 h-9 rounded-xl font-bold text-xs text-white transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, var(--green) 0%, color-mix(in oklch, var(--green) 80%, var(--b1)) 100%)' }}
                  >
                    {savingItemId === item.salePageId
                      ? <SpinnerGap size={13} className="animate-spin" />
                      : <CheckCircle size={13} weight="bold" />}
                    Shipped — Done
                  </button>
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

                {/* ── Row 4: Expand/Collapse details ───────────────── */}
                <button
                  onClick={() => setExpandedItemId(isExpanded ? null : item.salePageId)}
                  className="w-full mt-2 text-[10px] font-bold text-t3 hover:text-t1 py-1 transition-colors"
                >
                  {isExpanded ? '▴ Hide details' : '▾ Show details & save'}
                </button>

                {/* ── Row 5: Expanded editor ────────────────────────── */}
                {isExpanded && (
                  <div className="mt-2 space-y-3 rounded-xl border border-s2/40 p-3" style={{ background: 'color-mix(in oklch, var(--s1) 50%, transparent)' }}>
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
            )
          })
        )}
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
