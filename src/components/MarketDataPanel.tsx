import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TrendUp, Tag, ChartBar, Package, CaretDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useCollapsePreference } from '@/hooks/use-collapse-preference'
import { CompDetailModal, type Comp } from '@/components/CompDetailModal'
import type { MarketData } from '@/types'

interface MarketDataPanelProps {
  marketData?: MarketData
}

export function MarketDataPanel({ marketData }: MarketDataPanelProps) {
  const [isOpen, setIsOpen] = useCollapsePreference('market-data', false)
  const [activeComp, setActiveComp] = useState<Comp | null>(null)

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

  // Per-metric suffix — sold and active can be truncated independently.
  // Fall back to the legacy combined flag when per-source flags aren't set
  // (e.g. older persisted items that predate WS-21 Phase 1).
  const soldSuffix = (marketData.ebaySoldPageLimited ?? marketData.ebayPageLimited) ? '+' : ''
  const activeSuffix = (marketData.ebayActivePageLimited ?? marketData.ebayPageLimited) ? '+' : ''
  // The mean/median gap already drove the `skewed` flag in market-stats.ts,
  // but the 'thin' state also deserves a visible signal — few samples = low
  // confidence, and the user should know before trusting the range chip.
  const showQualityWarning =
    marketData.ebaySampleQuality === 'skewed' || marketData.ebaySampleQuality === 'thin'
  const qualityLabel = marketData.ebaySampleQuality === 'thin'
    ? 'Thin sample — wide spread'
    : 'Wide spread — using median'

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

        {/* Median leads — it's the trustworthy anchor. Avg is secondary. */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 rounded-lg bg-bg border border-s2">
            <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">Median</p>
            <p className="text-base sm:text-lg font-mono font-bold text-t1">
              {formatPrice(marketData.ebayMedianSold)}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-bg border border-s2">
            <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">Avg Sold</p>
            <p className="text-base sm:text-lg font-mono font-bold text-t1">
              {formatPrice(marketData.ebayAvgSold)}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-bg border border-s2">
            <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">Sold</p>
            <p className="text-base sm:text-lg font-mono font-bold text-green">
              {marketData.ebaySoldCount}{soldSuffix}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-bg border border-s2">
            <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">Active</p>
            <p className="text-base sm:text-lg font-mono font-bold text-amber">
              {marketData.ebayActiveListings}{activeSuffix}
            </p>
          </div>
        </div>

        {showQualityWarning && (
          <div className="mt-2 px-2 py-1 rounded-md bg-amber/10 border border-amber/30">
            <p className="text-[10px] sm:text-xs text-amber font-medium">
              {qualityLabel}
            </p>
          </div>
        )}

        <CollapsibleContent className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">

      {marketData.ebayPriceRange && (
        <div className="p-2.5 sm:p-3 rounded-lg bg-bg border border-s2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs text-t3 uppercase tracking-wide mb-0.5 sm:mb-1">
                {marketData.ebayP10 !== undefined && marketData.ebayP90 !== undefined
                  ? 'Typical Range (p10–p90)'
                  : 'Price Range'}
              </p>
              <p className="text-xs sm:text-sm font-mono font-medium text-t1">
                {marketData.ebayP10 !== undefined && marketData.ebayP90 !== undefined && marketData.ebayP90 > 0
                  ? `${formatPrice(marketData.ebayP10)} - ${formatPrice(marketData.ebayP90)}`
                  : `${formatPrice(marketData.ebayPriceRange.min)} - ${formatPrice(marketData.ebayPriceRange.max)}`}
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
              {marketData.ebayRecentSales.map((sale, idx) => {
                // A row is only interactive if we have *something* to show in
                // the drill-down — itemId drives the enrichment fetch,
                // itemWebUrl drives the "View on eBay" CTA. Neither = dead row.
                const tappable = Boolean(sale.itemId || sale.itemWebUrl)
                const content = (
                  <>
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
                  </>
                )
                return tappable ? (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveComp({
                      title: sale.title,
                      price: sale.price,
                      condition: sale.condition,
                      soldDate: sale.soldDate,
                      itemId: sale.itemId,
                      itemWebUrl: sale.itemWebUrl,
                      thumbnail: sale.thumbnail,
                    })}
                    className="w-full text-left p-2 rounded-lg border border-s2 bg-bg hover:border-b1/60 hover:bg-bg/60 active:bg-s2/40 transition-colors"
                  >
                    {content}
                  </button>
                ) : (
                  <div key={idx} className="p-2 rounded-lg border border-s2 bg-bg">
                    {content}
                  </div>
                )
              })}
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
              {marketData.ebayActiveItems.map((item, idx) => {
                const tappable = Boolean(item.itemId || item.itemWebUrl)
                const content = (
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-[11px] sm:text-xs text-t1 line-clamp-2 flex-1">{item.title}</p>
                    <Badge variant="outline" className="font-mono text-[10px] sm:text-xs shrink-0">
                      {formatPrice(item.price)}
                    </Badge>
                  </div>
                )
                return tappable ? (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveComp({
                      title: item.title,
                      price: item.price,
                      itemId: item.itemId,
                      itemWebUrl: item.itemWebUrl,
                      thumbnail: item.thumbnail,
                    })}
                    className="w-full text-left p-2 rounded-lg border border-s2 bg-bg hover:border-b1/60 hover:bg-bg/60 active:bg-s2/40 transition-colors"
                  >
                    {content}
                  </button>
                ) : (
                  <div key={idx} className="p-2 rounded-lg border border-s2 bg-bg">
                    {content}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      )}
        </CollapsibleContent>
      </Card>
      <CompDetailModal comp={activeComp} onClose={() => setActiveComp(null)} />
    </Collapsible>
  )
}
