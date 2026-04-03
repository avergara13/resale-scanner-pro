import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TrendUp, TrendDown, Tag, ChartBar, Package } from '@phosphor-icons/react'
import type { MarketData } from '@/types'

interface MarketDataPanelProps {
  marketData?: MarketData
}

export function MarketDataPanel({ marketData }: MarketDataPanelProps) {
  if (!marketData) {
    return null
  }

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A'
    return `$${price.toFixed(2)}`
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const hasEbayData = marketData.ebaySoldCount !== undefined && marketData.ebaySoldCount > 0

  if (!hasEbayData) {
    return null
  }

  return (
    <Card className="p-4 border-s2 bg-s1 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <ChartBar size={20} weight="bold" className="text-b1" />
        <h3 className="text-sm font-semibold text-fg uppercase tracking-wide">eBay Market Data</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-md bg-bg border border-s2">
          <p className="text-xs text-s3 uppercase tracking-wide mb-1">Avg Sold Price</p>
          <p className="text-lg font-mono font-semibold text-fg">
            {formatPrice(marketData.ebayAvgSold)}
          </p>
        </div>
        <div className="p-3 rounded-md bg-bg border border-s2">
          <p className="text-xs text-s3 uppercase tracking-wide mb-1">Median Price</p>
          <p className="text-lg font-mono font-semibold text-fg">
            {formatPrice(marketData.ebayMedianSold)}
          </p>
        </div>
        <div className="p-3 rounded-md bg-bg border border-s2">
          <p className="text-xs text-s3 uppercase tracking-wide mb-1">Items Sold</p>
          <p className="text-lg font-mono font-semibold text-green">{marketData.ebaySoldCount}</p>
        </div>
        <div className="p-3 rounded-md bg-bg border border-s2">
          <p className="text-xs text-s3 uppercase tracking-wide mb-1">Active Listings</p>
          <p className="text-lg font-mono font-semibold text-amber">{marketData.ebayActiveListings}</p>
        </div>
      </div>

      {marketData.ebayPriceRange && (
        <div className="p-3 rounded-md bg-t4 border border-t3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-s3 uppercase tracking-wide mb-1">Price Range</p>
              <p className="text-sm font-mono font-medium text-fg">
                {formatPrice(marketData.ebayPriceRange.min)} - {formatPrice(marketData.ebayPriceRange.max)}
              </p>
            </div>
            {marketData.ebaySellThroughRate !== undefined && (
              <div className="text-right">
                <p className="text-xs text-s3 uppercase tracking-wide mb-1">Sell-Through</p>
                <p className="text-sm font-mono font-semibold text-b1">
                  {marketData.ebaySellThroughRate.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {marketData.recommendedPrice && (
        <div className="p-3 rounded-md bg-green/10 border border-green/30 mb-4">
          <div className="flex items-center gap-2">
            <Tag size={18} weight="bold" className="text-green" />
            <div>
              <p className="text-xs text-green/80 uppercase tracking-wide">Recommended Price</p>
              <p className="text-xl font-mono font-bold text-green">
                {formatPrice(marketData.recommendedPrice)}
              </p>
            </div>
          </div>
        </div>
      )}

      {marketData.ebayRecentSales && marketData.ebayRecentSales.length > 0 && (
        <>
          <Separator className="my-4" />
          <div className="mb-2">
            <h4 className="text-xs font-semibold text-fg uppercase tracking-wide flex items-center gap-1.5">
              <TrendUp size={14} weight="bold" className="text-green" />
              Recent Sales ({marketData.ebayRecentSales.length})
            </h4>
          </div>
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {marketData.ebayRecentSales.map((sale, idx) => (
                <div key={idx} className="p-2 rounded border border-s2 bg-bg">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs text-fg line-clamp-2 flex-1">{sale.title}</p>
                    <Badge variant="secondary" className="font-mono text-xs shrink-0">
                      {formatPrice(sale.price)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-s3">{sale.condition}</span>
                    <span className="text-xs text-s4">•</span>
                    <span className="text-xs text-s3">{formatDate(sale.soldDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}

      {marketData.ebayActiveItems && marketData.ebayActiveItems.length > 0 && (
        <>
          <Separator className="my-4" />
          <div className="mb-2">
            <h4 className="text-xs font-semibold text-fg uppercase tracking-wide flex items-center gap-1.5">
              <Package size={14} weight="bold" className="text-amber" />
              Active Listings ({marketData.ebayActiveItems.length})
            </h4>
          </div>
          <ScrollArea className="h-32">
            <div className="space-y-2">
              {marketData.ebayActiveItems.map((item, idx) => (
                <div key={idx} className="p-2 rounded border border-s2 bg-bg">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs text-fg line-clamp-2 flex-1">{item.title}</p>
                    <Badge variant="outline" className="font-mono text-xs shrink-0">
                      {formatPrice(item.price)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </Card>
  )
}
