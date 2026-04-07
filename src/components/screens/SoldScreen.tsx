import { useState, useMemo } from 'react'
import { Package, Truck, CheckCircle, Tag, TrendUp, CurrencyDollar } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ScannedItem } from '@/types'

type FulfillmentFilter = 'all' | 'needs-shipping' | 'shipped' | 'completed'
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

interface SoldScreenProps {
  soldItems: ScannedItem[]
  onMarkShipped: (itemId: string, trackingNumber: string, shippingCarrier: string) => void
  onMarkCompleted: (itemId: string) => void
  personalSessionIds?: Set<string>
}

export function SoldScreen({ soldItems, onMarkShipped, onMarkCompleted, personalSessionIds }: SoldScreenProps) {
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>('all')
  const [marketplaceFilter, setMarketplaceFilter] = useState<MarketplaceFilter>('all')
  const [shippingItemId, setShippingItemId] = useState<string | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCarrier, setShippingCarrier] = useState('')

  const filteredItems = useMemo(() => {
    return soldItems
      .filter(item => {
        if (fulfillmentFilter === 'needs-shipping') return item.listingStatus === 'sold'
        if (fulfillmentFilter === 'shipped') return item.listingStatus === 'shipped'
        if (fulfillmentFilter === 'completed') return item.listingStatus === 'completed'
        return true
      })
      .filter(item => {
        if (marketplaceFilter === 'all') return true
        return item.soldOn === marketplaceFilter
      })
      .sort((a, b) => (b.soldDate || 0) - (a.soldDate || 0))
  }, [soldItems, fulfillmentFilter, marketplaceFilter])

  const stats = useMemo(() => {
    const businessItems = soldItems.filter(i =>
      !i.sessionId || !personalSessionIds?.has(i.sessionId)
    )
    const personalItems = soldItems.filter(i =>
      i.sessionId != null && personalSessionIds?.has(i.sessionId)
    )
    const totalSold = soldItems.length
    const totalRevenue = businessItems.reduce((s, i) => s + (i.soldPrice || 0), 0)
    const totalCost = businessItems.reduce((s, i) => s + i.purchasePrice, 0)
    const totalProfit = totalRevenue - totalCost
    const needsShipping = soldItems.filter(i => i.listingStatus === 'sold').length
    const personalCount = personalItems.length
    return { totalSold, totalRevenue, totalProfit, needsShipping, personalCount }
  }, [soldItems, personalSessionIds])

  const handleConfirmShipped = (itemId: string) => {
    if (!trackingNumber.trim() && !shippingCarrier.trim()) {
      onMarkShipped(itemId, '', '')
    } else {
      onMarkShipped(itemId, trackingNumber.trim(), shippingCarrier.trim())
    }
    setShippingItemId(null)
    setTrackingNumber('')
    setShippingCarrier('')
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

  const getStatusBadge = (item: ScannedItem) => {
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
      <div className="h-full flex flex-col items-center justify-center px-8 pb-28 text-center">
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
      {/* Stats row */}
      <div className="px-4 pt-4 pb-3 flex gap-2">
        <div className="stat-card flex-1 p-3 text-center">
          <div className="text-lg font-black text-t1">{stats.totalSold}</div>
          <div className="text-[9px] text-t3 uppercase tracking-wider font-bold mt-0.5">Sold</div>
        </div>
        <div className="stat-card flex-1 p-3 text-center">
          <div className="text-lg font-black text-green">${stats.totalProfit.toFixed(0)}</div>
          <div className="text-[9px] text-t3 uppercase tracking-wider font-bold mt-0.5">
            {stats.personalCount > 0 ? 'Biz Profit' : 'Profit'}
          </div>
        </div>
        <div className="stat-card flex-1 p-3 text-center">
          <div className={cn('text-lg font-black', stats.needsShipping > 0 ? 'text-amber' : 'text-t3')}>
            {stats.needsShipping}
          </div>
          <div className="text-[9px] text-t3 uppercase tracking-wider font-bold mt-0.5">Ship</div>
        </div>
      </div>

      {/* Fulfillment filter tabs */}
      <div className="px-4 pb-2 flex gap-1.5">
        {(['all', 'needs-shipping', 'shipped', 'completed'] as FulfillmentFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFulfillmentFilter(f)}
            className={cn(
              'flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all',
              fulfillmentFilter === f ? 'bg-b1 text-white' : 'bg-s1 text-t3'
            )}
          >
            {f === 'all' ? 'All' : f === 'needs-shipping' ? 'Ship' : f === 'shipped' ? 'Shipped' : 'Done'}
          </button>
        ))}
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
            const profit = (item.soldPrice || 0) - item.purchasePrice
            const isShippingExpanded = shippingItemId === item.id

            return (
              <Card key={item.id} className="p-4 border-s2">
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
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {getStatusBadge(item)}
                      {item.soldOn && (
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-md', MARKETPLACE_COLORS[item.soldOn] || MARKETPLACE_COLORS.other)}>
                          {MARKETPLACE_LABELS[item.soldOn] || item.soldOn}
                        </span>
                      )}
                      <span className="text-[9px] text-t3">{formatDate(item.soldDate)}</span>
                      {item.sessionId && personalSessionIds?.has(item.sessionId) && (
                        <span className="text-[8px] font-bold bg-purple-500/15 text-purple-500 px-1.5 py-0.5 rounded-md uppercase">Personal</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-black text-t1">${(item.soldPrice || 0).toFixed(2)}</div>
                    <div className={cn('text-[10px] font-bold flex items-center gap-0.5 justify-end mt-0.5', profit >= 0 ? 'text-green' : 'text-red')}>
                      {profit >= 0 ? <TrendUp size={10} /> : <CurrencyDollar size={10} />}
                      {profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)}
                    </div>
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
                      className="flex-1 h-8 text-[10px] border-b1/30 text-b1"
                    >
                      <Truck size={12} weight="bold" className="mr-1" />
                      Mark Shipped
                    </Button>
                  )}
                  {item.listingStatus === 'shipped' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMarkCompleted(item.id)}
                      className="flex-1 h-8 text-[10px] border-green/30 text-green"
                    >
                      <CheckCircle size={12} className="mr-1" />
                      Mark Completed
                    </Button>
                  )}
                  {item.listingStatus === 'completed' && (
                    <div className="flex-1 flex items-center justify-center gap-1 text-[10px] text-green font-bold">
                      <CheckCircle size={14} weight="fill" />
                      Transaction Complete
                    </div>
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
