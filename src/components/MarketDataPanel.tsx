import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TrendUp, TrendDown, Tag, ChartBar, Package, CaretDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useCollapsePreference } from '@/hooks/use-collapse-preference'
import type { MarketData } from '@/types'

interface MarketDataPanelProps {
  marketData?: MarketData
}

export function MarketDataPanel({ marketData }: MarketDataPanelProps) {
  const [isOpen, setIsOpen] = useCollapsePreference('market-data', false)

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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-3 sm:p-4 border-s2 bg-fg mt-3 sm:mt-4 overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <ChartBar size={18} weight="bold" className="text-b1 sm:w-5 sm:h-5" />
              <h3 className="text-xs sm:text-sm font-bold text-t1 uppercase tracking-wide">eBay Market Data</h3>
            </div>
            <CaretDown
              size={18}
              weight="bold"
              className={cn(
                "text-t3 transition-transform duration-200 flex-shrink-0",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 rounded-lg bg-bg border border-s2">
            <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">Avg Sold</p>
            <p className="text-base sm:text-lg font-mono font-bold text-t1">
              {formatPrice(marketData.ebayAvgSold)}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-bg border border-s2">
            <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">Median</p>
            <p className="text-base sm:text-lg font-mono font-bold text-t1">
              {formatPrice(marketData.ebayMedianSold)}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-bg border border-s2">
            <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">Sold</p>
            <p className="text-base sm:text-lg font-mono font-bold text-green">{marketData.ebaySoldCount}</p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-bg border border-s2">
            <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">Active</p>
            <p className="text-base sm:text-lg font-mono font-bold text-amber">{marketData.ebayActiveListings}</p>
          </div>
        </div>

        <CollapsibleContent className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">

      {marketData.ebayPriceRange && (
        <div className="p-2.5 sm:p-3 rounded-lg bg-bg border border-s2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">Price Range</p>
              <p className="text-xs sm:text-sm font-mono font-medium text-t1">
                {formatPrice(marketData.ebayPriceRange.min)} - {formatPrice(marketData.ebayPriceRange.max)}
              </p>
            </div>
            {marketData.ebaySellThroughRate !== undefined && (
              <div className="text-right">
                <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">Sell-Through</p>
                <p className="text-xs sm:text-sm font-mono font-bold text-b1">
                  {marketData.ebaySellThroughRate.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {marketData.recommendedPrice && (
        <div className="p-2.5 sm:p-3 rounded-lg bg-green-bg border border-green">
          <div className="flex items-center gap-2">
            <Tag size={16} weight="bold" className="text-green sm:w-[18px] sm:h-[18px]" />
            <div>
              <p className="text-[10px] sm:text-xs text-green uppercase tracking-wide">Recommended Price</p>
              <p className="text-lg sm:text-xl font-mono font-black text-green">
                {formatPrice(marketData.recommendedPrice)}
              </p>
            </div>
          </div>
        </div>
      )}

      {marketData.ebayRecentSales && marketData.ebayRecentSales.length > 0 && (
        <div>
          <Separator className="mb-3" />
          <div className="mb-2">
            <h4 className="text-[10px] sm:text-xs font-bold text-t1 uppercase tracking-wide flex items-center gap-1.5">
              <TrendUp size={14} weight="bold" className="text-green" />
              Recent Sales ({marketData.ebayRecentSales.length})
            </h4>
          </div>
          <ScrollArea className="h-32 sm:h-40">
            <div className="space-y-2 pr-3">
              {marketData.ebayRecentSales.map((sale, idx) => (
                <div key={idx} className="p-2 rounded-lg border border-s2 bg-bg">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-[11px] sm:text-xs text-t1 line-clamp-2 flex-1">{sale.title}</p>
                    <Badge variant="secondary" className="font-mono text-[10px] sm:text-xs shrink-0">
                      {formatPrice(sale.price)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] sm:text-xs text-t3">{sale.condition}</span>
                    <span className="text-[10px] sm:text-xs text-t3">•</span>
                    <span className="text-[10px] sm:text-xs text-t3">{formatDate(sale.soldDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {marketData.ebayActiveItems && marketData.ebayActiveItems.length > 0 && (
        <div>
          <Separator className="mb-3" />
          <div className="mb-2">
            <h4 className="text-[10px] sm:text-xs font-bold text-t1 uppercase tracking-wide flex items-center gap-1.5">
              <Package size={14} weight="bold" className="text-amber" />
              Active Listings ({marketData.ebayActiveItems.length})
            </h4>
          </div>
          <ScrollArea className="h-28 sm:h-32">
            <div className="space-y-2 pr-3">
              {marketData.ebayActiveItems.map((item, idx) => (
                <div key={idx} className="p-2 rounded-lg border border-s2 bg-bg">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-[11px] sm:text-xs text-t1 line-clamp-2 flex-1">{item.title}</p>
                    <Badge variant="outline" className="font-mono text-[10px] sm:text-xs shrink-0">
                      {formatPrice(item.price)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
