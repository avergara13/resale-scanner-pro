import { useState, useMemo, useEffect } from 'react'
import { Package, Truck, CheckCircle, Tag, TrendUp, CurrencyDollar, ArrowCounterClockwise, Clock, Warning } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { getNetProfit, getShippingUrgency } from '@/lib/profit-utils'
import type { ScannedItem, AppSettings } from '@/types'

type FulfillmentFilter = 'all' | 'needs-shipping' | 'shipped' | 'completed' | 'returned'
type MarketplaceFilter = 'all' | 'ebay' | 'mercari' | 'poshmark' | 'facebook' | 'whatnot' | 'other'

const MARKETPLACE_LABELS: Record<string, string> = {
  ebay: 'eBay',
  mercari: 'Mercari',
  poshmark: 'Poshmark',
  facebook: 'Facebook',
  whatnot: 'Whatnot',
  other: 'Other',
}

const MARKETPLACE_COLORS: Record<string, string> = {
  ebay: 'bg-blue-500/10 text-blue-600',
  mercari: 'bg-red-500/10 text-red-600',
  poshmark: 'bg-pink-500/10 text-pink-600',
  facebook: 'bg-blue-700/10 text-blue-800',
  whatnot: 'bg-purple-500/10 text-purple-700',
  other: 'bg-s2 text-t3',
}

const URGENCY_COLORS: Record<string, string> = {
  ok: 'bg-green/10 text-green',
  warning: 'bg-amber/10 text-amber',
  urgent: 'bg-red/10 text-red animate-pulse',
  overdue: 'bg-red/20 text-red font-black animate-pulse',
}

// Sort priority for the "All" tab: needs-shipping first (oldest), then shipped, completed, returned
const STATUS_SORT_ORDER: Record<string, number> = {
  sold: 0,
  shipped: 1,
  completed: 2,
  returned: 3,
}

interface SoldScreenProps {
  soldItems: ScannedItem[]
  onMarkShipped: (itemId: string, trackingNumber: string, shippingCarrier: string) => void
  onMarkCompleted: (itemId: string) => void
  onMarkReturned: (itemId: string, reason?: string) => void
  onRelistItem: (itemId: string) => void
  personalSessionIds?: Set<string>
  settings: AppSettings
}

export function SoldScreen({ soldItems, onMarkShipped, onMarkCompleted, onMarkReturned, onRelistItem, personalSessionIds, settings }: SoldScreenProps) {
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>('all')
  const [marketplaceFilter, setMarketplaceFilter] = useState<MarketplaceFilter>('all')
  const [shippingItemId, setShippingItemId] = useState<string | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCarrier, setShippingCarrier] = useState('')
  const [returnItemId, setReturnItemId] = useState<string | null>(null)
  const [returnReason, setReturnReason] = useState('')
  // Tick forces re-render every 60s so urgency badges stay live
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const filteredItems = useMemo(() => {
    return soldItems
      .filter(item => {
        if (fulfillmentFilter === 'needs-shipping') return item.listingStatus === 'sold'
        if (fulfillmentFilter === 'shipped') return item.listingStatus === 'shipped'
        if (fulfillmentFilter === 'completed') return item.listingStatus === 'completed'
        if (fulfillmentFilter === 'returned') return item.listingStatus === 'returned'
        return true
      })
      .filter(item => {
        if (marketplaceFilter === 'all') return true
        return item.soldOn === marketplaceFilter
      })
      .sort((a, b) => {
        const orderA = STATUS_SORT_ORDER[a.listingStatus || ''] ?? 9
        const orderB = STATUS_SORT_ORDER[b.listingStatus || ''] ?? 9
        if (orderA !== orderB) return orderA - orderB
        // Within "sold" (needs shipping): oldest first (most urgent)
        if (a.listingStatus === 'sold' && b.listingStatus === 'sold') {
          return (a.soldDate || 0) - (b.soldDate || 0)
        }
        // Everything else: newest first
        return (b.soldDate || 0) - (a.soldDate || 0)
      })
  }, [soldItems, fulfillmentFilter, marketplaceFilter])

  const activeItems = useMemo(() =>
    soldItems.filter(i => i.listingStatus !== 'returned'),
  [soldItems])

  const stats = useMemo(() => {
    const businessActive = activeItems.filter(i =>
      !i.sessionId || !personalSessionIds?.has(i.sessionId)
    )
    const totalSold = activeItems.length
    const netProfit = businessActive.reduce((s, i) => s + getNetProfit(i, settings).netProfit, 0)
    const needsShipping = soldItems.filter(i => i.listingStatus === 'sold').length
    const returnedCount = soldItems.filter(i => i.listingStatus === 'returned').length

    // Avg days to sell (for items with soldDate)
    const itemsWithSoldDate = activeItems.filter(i => i.soldDate)
    const avgDaysToSell = itemsWithSoldDate.length > 0
      ? itemsWithSoldDate.reduce((s, i) => {
          const listedDate = i.publishedDate ?? i.timestamp
          return s + ((i.soldDate! - listedDate) / 86400000)
        }, 0) / itemsWithSoldDate.length
      : 0

    return { totalSold, netProfit, needsShipping, avgDaysToSell, returnedCount }
  }, [activeItems, soldItems, personalSessionIds, settings])

  const handleConfirmShipped = (itemId: string) => {
    onMarkShipped(itemId, trackingNumber.trim(), shippingCarrier.trim())
    setShippingItemId(null)
    setTrackingNumber('')
    setShippingCarrier('')
  }

  const handleConfirmReturn = (itemId: string) => {
    onMarkReturned(itemId, returnReason.trim() || undefined)
    setReturnItemId(null)
    setReturnReason('')
  }

  const formatDate = (ts?: number) => {
    if (!ts) return '—'
    const d = new Date(ts)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getDaysToSell = (item: ScannedItem) => {
    if (!item.soldDate) return null
    const listedDate = item.publishedDate ?? item.timestamp
    return Math.max(0, Math.round((item.soldDate - listedDate) / 86400000))
  }

  const getStatusBadge = (item: ScannedItem) => {
    if (item.listingStatus === 'returned') {
      return <Badge className="text-[9px] bg-purple-500/10 text-purple-500 border-0">Returned</Badge>
    }
    if (item.listingStatus === 'completed') {
      return <Badge className="text-[9px] bg-green/10 text-green border-0">Completed</Badge>
    }
    if (item.listingStatus === 'shipped') {
      return <Badge className="text-[9px] bg-blue/10 text-blue border-0">Shipped</Badge>
    }
    return <Badge className="text-[9px] bg-amber/10 text-amber border-0">Needs Shipping</Badge>
  }

  if (soldItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 text-center">
        <Tag size={56} weight="duotone" className="text-t3 mb-4 opacity-40" />
        <h2 className="text-lg font-bold text-t1 mb-2">No Sold Items Yet</h2>
        <p className="text-sm text-t3 max-w-xs">
          Mark items as sold from the Listings tab once they sell on your marketplace.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Stats row — 4 cards */}
      <div className="px-4 pt-4 pb-3 grid grid-cols-4 gap-1.5">
        <div className="stat-card p-2.5 text-center">
          <div className="text-base font-black text-t1">{stats.totalSold}</div>
          <div className="text-[8px] text-t3 uppercase tracking-wider font-bold mt-0.5">Sold</div>
        </div>
        <div className="stat-card p-2.5 text-center">
          <div className={cn('text-base font-black', stats.netProfit >= 0 ? 'text-green' : 'text-red')}>
            ${Math.abs(stats.netProfit).toFixed(0)}
          </div>
          <div className="text-[8px] text-t3 uppercase tracking-wider font-bold mt-0.5">Net Profit</div>
        </div>
        <div className="stat-card p-2.5 text-center">
          <div className={cn('text-base font-black', stats.needsShipping > 0 ? 'text-amber' : 'text-t3')}>
            {stats.needsShipping}
          </div>
          <div className="text-[8px] text-t3 uppercase tracking-wider font-bold mt-0.5">Ship</div>
        </div>
        <div className="stat-card p-2.5 text-center">
          <div className="text-base font-black text-t1">{stats.avgDaysToSell > 0 ? `${stats.avgDaysToSell.toFixed(1)}` : '—'}</div>
          <div className="text-[8px] text-t3 uppercase tracking-wider font-bold mt-0.5">Avg Days</div>
        </div>
      </div>

      {/* Fulfillment filter tabs */}
      <div className="px-4 pb-2 flex gap-1.5">
        {(['all', 'needs-shipping', 'shipped', 'completed', 'returned'] as FulfillmentFilter[]).map(f => {
          const isShipTab = f === 'needs-shipping'
          const label = f === 'all' ? 'All'
            : f === 'needs-shipping' ? (stats.needsShipping > 0 ? `Ship (${stats.needsShipping})` : 'Ship')
            : f === 'shipped' ? 'Shipped'
            : f === 'completed' ? 'Done'
            : stats.returnedCount > 0 ? `Returns (${stats.returnedCount})` : 'Returns'
          return (
            <button
              key={f}
              onClick={() => setFulfillmentFilter(f)}
              className={cn(
                'flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all',
                fulfillmentFilter === f
                  ? (isShipTab && stats.needsShipping > 0 ? 'bg-amber text-white' : 'bg-b1 text-white')
                  : (isShipTab && stats.needsShipping > 0 ? 'bg-amber/15 text-amber' : 'bg-s1 text-t3')
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Marketplace filter */}
      <div className="px-4 pb-3 flex gap-1 overflow-x-auto scrollbar-hide">
        {(['all', 'ebay', 'mercari', 'poshmark', 'facebook', 'whatnot', 'other'] as MarketplaceFilter[]).map(m => (
          <button
            key={m}
            onClick={() => setMarketplaceFilter(m)}
            className={cn(
              'flex-shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all',
              marketplaceFilter === m ? 'bg-b1 text-white' : 'bg-s1 text-t3'
            )}
          >
            {m === 'all' ? 'All' : MARKETPLACE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-t3">No items match this filter</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const { netProfit } = getNetProfit(item, settings)
            const urgency = item.listingStatus === 'sold' ? getShippingUrgency(item.soldDate) : null
            const daysToSell = getDaysToSell(item)
            const isShippingExpanded = shippingItemId === item.id
            const isReturnExpanded = returnItemId === item.id

            return (
              <Card key={item.id} className={cn('p-4 border-s2', urgency?.level === 'overdue' && 'border-red/40 bg-red/5')}>
                {/* Item header row */}
                <div className="flex items-start gap-3 mb-3">
                  {(item.imageThumbnail || item.imageData) ? (
                    <img
                      src={item.imageThumbnail || item.imageData}
                      alt={item.productName || 'Item'}
                      className="w-14 h-14 rounded-lg object-cover bg-s1 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-s1 flex items-center justify-center flex-shrink-0">
                      <Package size={20} className="text-t3" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-t1 truncate">{item.productName || 'Unknown Item'}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {getStatusBadge(item)}
                      {urgency && urgency.label && (
                        <Badge className={cn('text-[8px] border-0 font-bold', URGENCY_COLORS[urgency.level])}>
                          {urgency.level === 'urgent' || urgency.level === 'overdue'
                            ? <Warning size={9} weight="fill" className="mr-0.5 inline" />
                            : <Clock size={9} className="mr-0.5 inline" />
                          }
                          {urgency.label}
                        </Badge>
                      )}
                      {item.soldOn && (
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-md', MARKETPLACE_COLORS[item.soldOn] || MARKETPLACE_COLORS.other)}>
                          {MARKETPLACE_LABELS[item.soldOn] || item.soldOn}
                        </span>
                      )}
                      <span className="text-[9px] text-t3">{formatDate(item.soldDate)}</span>
                      {daysToSell !== null && item.listingStatus !== 'sold' && item.listingStatus !== 'returned' && (
                        <span className="text-[8px] text-t3 font-mono">Sold in {daysToSell}d</span>
                      )}
                      {item.sessionId && personalSessionIds?.has(item.sessionId) && (
                        <span className="text-[8px] font-bold bg-purple-500/15 text-purple-500 px-1.5 py-0.5 rounded-md uppercase">Personal</span>
                      )}
                    </div>
                    {item.listingStatus === 'returned' && item.returnReason && (
                      <p className="text-[10px] text-t3 mt-1 italic">Reason: {item.returnReason}</p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-black text-t1">${(item.soldPrice || 0).toFixed(2)}</div>
                    <div className={cn('text-[10px] font-bold flex items-center gap-0.5 justify-end mt-0.5', netProfit >= 0 ? 'text-green' : 'text-red')}>
                      {netProfit >= 0 ? <TrendUp size={10} /> : <CurrencyDollar size={10} />}
                      {netProfit >= 0 ? '+' : '-'}${Math.abs(netProfit).toFixed(2)}
                    </div>
                    <div className="text-[8px] text-t3 mt-0.5">net</div>
                  </div>
                </div>

                {/* Shipping info if shipped */}
                {item.trackingNumber && (
                  <div className="mb-3 px-3 py-2 bg-s1 rounded-lg text-[10px] text-t2">
                    <span className="font-bold text-t3 uppercase tracking-wide">Tracking: </span>
                    {item.shippingCarrier && <span className="font-bold">{item.shippingCarrier} — </span>}
                    <span className="font-mono">{item.trackingNumber}</span>
                  </div>
                )}

                {/* Shipping expand form */}
                {isShippingExpanded && (
                  <div className="mb-3 p-3 bg-s1 rounded-lg space-y-2">
                    <Label className="text-[10px] uppercase tracking-wide text-t3">Shipping Info (optional)</Label>
                    <Input
                      value={shippingCarrier}
                      onChange={e => setShippingCarrier(e.target.value)}
                      placeholder="Carrier (USPS, UPS, FedEx…)"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={trackingNumber}
                      onChange={e => setTrackingNumber(e.target.value)}
                      placeholder="Tracking number"
                      className="h-8 text-sm font-mono"
                    />
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => handleConfirmShipped(item.id)} className="bg-b1 text-white text-xs h-8 flex-1">
                        Mark Shipped
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShippingItemId(null)} className="text-xs h-8">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Return expand form */}
                {isReturnExpanded && (
                  <div className="mb-3 p-3 bg-s1 rounded-lg space-y-2">
                    <Label className="text-[10px] uppercase tracking-wide text-t3">Return Reason (optional)</Label>
                    <Input
                      value={returnReason}
                      onChange={e => setReturnReason(e.target.value)}
                      placeholder="e.g. Defective, buyer remorse…"
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => handleConfirmReturn(item.id)} className="bg-red/80 text-white text-xs h-8 flex-1">
                        Confirm Return
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setReturnItemId(null); setReturnReason('') }} className="text-xs h-8">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {item.listingStatus === 'sold' && !isShippingExpanded && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShippingItemId(item.id)
                        setTrackingNumber('')
                        setShippingCarrier('')
                      }}
                      className={cn(
                        'flex-1 h-8 text-[10px]',
                        urgency?.level === 'overdue' || urgency?.level === 'urgent'
                          ? 'border-red/40 text-red bg-red/5'
                          : 'border-b1/30 text-b1'
                      )}
                    >
                      <Truck size={12} weight="bold" className="mr-1" />
                      {urgency?.level === 'overdue' ? 'SHIP NOW' : 'Mark Shipped'}
                    </Button>
                  )}
                  {item.listingStatus === 'shipped' && !isReturnExpanded && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onMarkCompleted(item.id)}
                        className="flex-1 h-8 text-[10px] border-green/30 text-green"
                      >
                        <CheckCircle size={12} className="mr-1" />
                        Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setReturnItemId(item.id); setReturnReason('') }}
                        className="h-8 text-[10px] text-t3"
                      >
                        Return
                      </Button>
                    </>
                  )}
                  {item.listingStatus === 'completed' && !isReturnExpanded && (
                    <div className="flex-1 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] text-green font-bold">
                        <CheckCircle size={14} weight="fill" />
                        Transaction Complete
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setReturnItemId(item.id); setReturnReason('') }}
                        className="h-7 text-[9px] text-t3 px-2"
                      >
                        Return
                      </Button>
                    </div>
                  )}
                  {item.listingStatus === 'returned' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRelistItem(item.id)}
                      className="flex-1 h-8 text-[10px] border-b1/30 text-b1"
                    >
                      <ArrowCounterClockwise size={12} className="mr-1" />
                      Re-list
                    </Button>
                  )}
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
