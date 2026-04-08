import { useEffect, useMemo, useState } from 'react'
import { ArrowClockwise, ArrowSquareOut, Package, SpinnerGap, Truck } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { createPirateShipUrl, estimateShippingRates } from '@/lib/shipping-rate-service'
import type { SoldItem, SoldShippingStatus, SoldShippingUpdateInput } from '@/types'

type FulfillmentFilter = 'all' | 'need-label' | 'label-ready' | 'packed' | 'shipped'

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
  shipFromZip: string
  packageDims: string
  itemWeightLbs: string
  shipNotes: string
}

const SHIPPING_STATUS_OPTIONS: SoldShippingStatus[] = ['🔴 Need Label', '🟡 Label Ready', '📦 Packed', '✅ Shipped']

const LABEL_PROVIDER_OPTIONS = [
  '🏴‍☠️ Pirate Ship',
  '🛒 eBay Label',
  '📮 USPS Direct',
  '📦 UPS Direct',
  '🟠 FedEx Direct',
]

const STATUS_BADGE_STYLES: Record<SoldShippingStatus, string> = {
  '🔴 Need Label': 'bg-red/10 text-red border-red/20',
  '🟡 Label Ready': 'bg-amber/10 text-amber border-amber/20',
  '📦 Packed': 'bg-blue/10 text-blue border-blue/20',
  '✅ Shipped': 'bg-green/10 text-green border-green/20',
}

function formatSaleDate(value?: string | null): string {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMoney(value?: number | null): string {
  if (typeof value !== 'number') return '—'
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
    shipFromZip: item.shipFromZip || '32806',
    packageDims: item.packageDims || '',
    itemWeightLbs: item.itemWeightLbs || '',
    shipNotes: '',
  }
}

export function SoldScreen({ soldItems, loading, error, warnings, lastSyncedAt, onRefresh, onUpdateShipping }: SoldScreenProps) {
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>('all')
  const [drafts, setDrafts] = useState<Record<string, SoldItemDraft>>({})
  const [savingItemId, setSavingItemId] = useState<string | null>(null)

  useEffect(() => {
    setDrafts(() => {
      const next: Record<string, SoldItemDraft> = {}
      for (const item of soldItems) {
        next[item.salePageId] = buildDraft(item)
      }
      return next
    })
  }, [soldItems])

  const filteredItems = useMemo(() => {
    return soldItems.filter((item) => {
      if (fulfillmentFilter === 'all') return true
      if (fulfillmentFilter === 'need-label') return item.shippingStatus === '🔴 Need Label'
      if (fulfillmentFilter === 'label-ready') return item.shippingStatus === '🟡 Label Ready'
      if (fulfillmentFilter === 'packed') return item.shippingStatus === '📦 Packed'
      return item.shippingStatus === '✅ Shipped'
    })
  }, [fulfillmentFilter, soldItems])

  const stats = useMemo(() => {
    const totalSales = soldItems.length
    const totalRevenue = soldItems.reduce((sum, item) => sum + (item.salePrice || 0), 0)
    return {
      totalSales,
      totalRevenue,
      needLabel: soldItems.filter((item) => item.shippingStatus === '🔴 Need Label').length,
      shipped: soldItems.filter((item) => item.shippingStatus === '✅ Shipped').length,
    }
  }, [soldItems])

  const lastSyncedLabel = useMemo(() => {
    if (!lastSyncedAt) return 'Not synced yet'
    return `Synced ${new Date(lastSyncedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }, [lastSyncedAt])

  const handleDraftChange = (pageId: string, key: keyof SoldItemDraft, value: string) => {
    setDrafts((previous) => ({
      ...previous,
      [pageId]: {
        ...(previous[pageId] || {
          shippingStatus: '🔴 Need Label',
          trackingNumber: '',
          labelProvider: '🏴‍☠️ Pirate Ship',
          shipFromZip: '32806',
          packageDims: '',
          itemWeightLbs: '',
          shipNotes: '',
        }),
        [key]: value,
      },
    }))
  }

  const handleSave = async (item: SoldItem) => {
    const draft = drafts[item.salePageId] || buildDraft(item)
    setSavingItemId(item.salePageId)
    try {
      await onUpdateShipping(item.salePageId, draft)
    } finally {
      setSavingItemId(null)
    }
  }

  if (loading && soldItems.length === 0) {
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

  if (error && soldItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8">
        <Truck size={48} className="text-red" weight="duotone" />
        <div>
          <h2 className="text-lg font-bold text-t1">Sold Feed Unavailable</h2>
          <p className="text-sm text-t3 max-w-sm">{error}</p>
        </div>
        <Button onClick={onRefresh} className="bg-b1 text-white">
          <ArrowClockwise size={14} className="mr-1.5" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="px-4 pt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-t1">Live Sold Command Center</h2>
            <p className="text-xs text-t3">{lastSyncedLabel}</p>
          </div>
          <Button onClick={onRefresh} variant="outline" className="h-9 border-b1/30 text-b1">
            <ArrowClockwise size={14} className={cn('mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {warnings.length > 0 && (
          <Card className="border-amber/20 bg-amber/5 p-3 text-xs text-amber space-y-1">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </Card>
        )}

        <div className="grid grid-cols-4 gap-2">
          <Card className="p-3 text-center border-s2">
            <div className="text-lg font-black text-t1">{stats.totalSales}</div>
            <div className="text-[10px] uppercase tracking-wide text-t3">Sold</div>
          </Card>
          <Card className="p-3 text-center border-s2">
            <div className="text-lg font-black text-t1">{formatMoney(stats.totalRevenue)}</div>
            <div className="text-[10px] uppercase tracking-wide text-t3">Revenue</div>
          </Card>
          <Card className="p-3 text-center border-s2">
            <div className="text-lg font-black text-red">{stats.needLabel}</div>
            <div className="text-[10px] uppercase tracking-wide text-t3">Need Label</div>
          </Card>
          <Card className="p-3 text-center border-s2">
            <div className="text-lg font-black text-green">{stats.shipped}</div>
            <div className="text-[10px] uppercase tracking-wide text-t3">Shipped</div>
          </Card>
        </div>

        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
          {([
            ['all', 'All'],
            ['need-label', 'Need Label'],
            ['label-ready', 'Label Ready'],
            ['packed', 'Packed'],
            ['shipped', 'Shipped'],
          ] as Array<[FulfillmentFilter, string]>).map(([filter, label]) => (
            <button
              key={filter}
              onClick={() => setFulfillmentFilter(filter)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase transition-colors',
                fulfillmentFilter === filter ? 'bg-b1 text-white' : 'bg-s1 text-t3',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-3 space-y-4">
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <Package size={48} className="text-t3 opacity-40 mb-4" weight="duotone" />
            <h3 className="text-lg font-bold text-t1">No Live Sales Yet</h3>
            <p className="text-sm text-t3 max-w-sm">
              The Sales database is connected, but there are no sold records matching this filter yet.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const draft = drafts[item.salePageId] || buildDraft(item)
            const quotes = estimateShippingRates({
              itemWeightLbs: draft.itemWeightLbs,
              packageDims: draft.packageDims,
              originZip: draft.shipFromZip,
              destinationZip: item.buyerZip,
              platform: item.platform,
            })
            const pirateShipUrl = createPirateShipUrl({
              title: item.title,
              itemWeightLbs: draft.itemWeightLbs,
              packageDims: draft.packageDims,
              originZip: draft.shipFromZip,
              destinationZip: item.buyerZip,
              platform: item.platform,
            })

            return (
              <Card key={item.salePageId} className="border-s2 p-4 space-y-4">
                <div className="flex gap-3">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="h-16 w-16 rounded-xl object-cover bg-s1" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-s1 flex items-center justify-center">
                      <Package size={20} className="text-t3" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-t1 leading-tight">{item.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge className={cn('border text-[10px]', STATUS_BADGE_STYLES[draft.shippingStatus])}>
                            {draft.shippingStatus}
                          </Badge>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-t3">{item.platform}</span>
                          <span className="text-[10px] text-t3">Sold {formatSaleDate(item.saleDate)}</span>
                          <span className="text-[10px] text-t3">Source: {item.metadataSource}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-black text-t1">{formatMoney(item.salePrice)}</div>
                        {item.orderNumber && <div className="text-[10px] text-t3">Order {item.orderNumber}</div>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-t2">
                      <div>
                        <span className="text-t3">Buyer ZIP:</span> {item.buyerZip || 'Pending sync'}
                      </div>
                      <div>
                        <span className="text-t3">Buyer:</span> {item.buyerInfo || 'Pending sync'}
                      </div>
                      <div>
                        <span className="text-t3">Tracking:</span> {item.trackingNumber || 'Not set'}
                      </div>
                      <div>
                        <span className="text-t3">Label:</span> {item.labelProvider || 'Not set'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-3 rounded-xl bg-s1 p-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wide text-t3">Shipping Status</Label>
                      <select
                        aria-label={`Shipping status for ${item.title}`}
                        value={draft.shippingStatus}
                        onChange={(event) => handleDraftChange(item.salePageId, 'shippingStatus', event.target.value)}
                        className="h-9 w-full rounded-lg border border-s2 bg-bg px-3 text-sm text-t1"
                      >
                        {SHIPPING_STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wide text-t3">Ship From ZIP</Label>
                        <Input value={draft.shipFromZip} onChange={(event) => handleDraftChange(item.salePageId, 'shipFromZip', event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wide text-t3">Buyer ZIP</Label>
                        <Input value={item.buyerZip || ''} readOnly className="text-t3" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wide text-t3">Weight lbs</Label>
                        <Input value={draft.itemWeightLbs} onChange={(event) => handleDraftChange(item.salePageId, 'itemWeightLbs', event.target.value)} placeholder="1.25" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wide text-t3">Package Dims</Label>
                        <Input value={draft.packageDims} onChange={(event) => handleDraftChange(item.salePageId, 'packageDims', event.target.value)} placeholder="10 x 6 x 4" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wide text-t3">Tracking Number</Label>
                        <Input value={draft.trackingNumber} onChange={(event) => handleDraftChange(item.salePageId, 'trackingNumber', event.target.value)} placeholder="9400..." />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wide text-t3">Label Provider</Label>
                        <select
                          aria-label={`Label provider for ${item.title}`}
                          value={draft.labelProvider}
                          onChange={(event) => handleDraftChange(item.salePageId, 'labelProvider', event.target.value)}
                          className="h-9 w-full rounded-lg border border-s2 bg-bg px-3 text-sm text-t1"
                        >
                          {LABEL_PROVIDER_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wide text-t3">Ship Notes</Label>
                      <Input value={draft.shipNotes} onChange={(event) => handleDraftChange(item.salePageId, 'shipNotes', event.target.value)} placeholder="Pickup, box type, or handoff notes" />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        onClick={() => handleSave(item)}
                        className="bg-b1 text-white"
                        disabled={savingItemId === item.salePageId}
                      >
                        {savingItemId === item.salePageId && <SpinnerGap size={14} className="mr-1.5 animate-spin" />}
                        Save Shipping
                      </Button>
                      <Button asChild variant="outline" className="border-b1/30 text-b1">
                        <a href={pirateShipUrl} target="_blank" rel="noreferrer">
                          <ArrowSquareOut size={14} className="mr-1.5" />
                          Pirate Ship
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl bg-s1 p-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-t3">Shipping Rate Card</p>
                      <h4 className="text-sm font-black text-t1 mt-1">Top 3 cheapest guide-based options</h4>
                    </div>

                    <div className="space-y-2">
                      {quotes.map((quote) => (
                        <div
                          key={quote.id}
                          className={cn(
                            'rounded-xl border p-3',
                            quote.isBestValue ? 'border-green/30 bg-green/5' : 'border-s2 bg-bg',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-t1">{quote.carrier} {quote.service}</p>
                                {quote.isBestValue && <Badge className="border-0 bg-green text-white text-[10px]">Best</Badge>}
                              </div>
                              <p className="text-[11px] text-t3 mt-1">{quote.eta} • {quote.note}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black text-t1">{formatMoney(quote.amount)}</p>
                              <p className="text-[10px] text-t3">Guide estimate</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-s2 bg-bg p-3 text-[11px] text-t2 space-y-1">
                      <p><span className="text-t3">Fallback:</span> live guide-based estimate from the 32806 shipping matrix.</p>
                      <p><span className="text-t3">Rule:</span> Flat Rate usually wins when the item is heavy and actually fits the box.</p>
                      <p><span className="text-t3">Platform adjustment:</span> eBay rates get the built-in commercial-label discount.</p>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}