import { useState, useMemo } from 'react'
import { TrendUp, Package, ShoppingBag, ArrowsClockwise } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useCostTracking } from '@/hooks/use-cost-tracking'
import { API_COST_CONFIGS } from '@/lib/cost-tracking-service'
import { cn } from '@/lib/utils'
import type { ScannedItem } from '@/types'

interface CostTrackingScreenProps {
  onBack: () => void
  queueItems?: ScannedItem[]
  scanHistory?: ScannedItem[]
  sessionId?: string
}

type Period = 'today' | 'week' | 'month' | 'all'
const PERIOD_LABELS: Record<Period, string> = { today: 'Today', week: 'Week', month: 'Month', all: 'All Time' }
const PERIOD_MS: Record<Period, number> = { today: 86_400_000, week: 604_800_000, month: 2_592_000_000, all: Infinity }

export function CostTrackingScreen({ onBack, queueItems, scanHistory, sessionId }: CostTrackingScreenProps) {
  const [period, setPeriod] = useState<Period>('today')
  const [showApiCosts, setShowApiCosts] = useState(false)
  const { costData, isLoading, refreshData } = useCostTracking(period)

  const cutoff = useMemo(() => {
    return period === 'all' ? 0 : Date.now() - PERIOD_MS[period]
  }, [period])

  const { buyItems, allPeriodItems } = useMemo(() => {
    const all = [...(queueItems || []), ...(scanHistory || [])]
    const seen = new Set<string>()
    const unique = all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true })
    const periodItems = unique.filter(i => {
      if (sessionId && i.sessionId !== sessionId) return false
      return i.timestamp >= cutoff
    })
    return {
      allPeriodItems: periodItems,
      buyItems: periodItems
        .filter(i => i.decision === 'BUY')
        .sort((a, b) => (b.profitMargin || 0) - (a.profitMargin || 0)),
    }
  }, [queueItems, scanHistory, cutoff, sessionId])

  const totalInvested = buyItems.reduce((s, i) => s + i.purchasePrice, 0)
  const totalRevenue = buyItems.reduce((s, i) => s + (i.estimatedSellPrice || 0), 0)
  const totalProfit = totalRevenue - totalInvested
  const avgROI = totalInvested > 0 ? Math.round((totalProfit / totalInvested) * 100) : 0
  const buyRate = allPeriodItems.length > 0 ? Math.round((buyItems.length / allPeriodItems.length) * 100) : 0

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 pt-4 space-y-4">

          {/* Period selector */}
          <div className="flex gap-1 bg-s1 p-1 rounded-xl">
            {(['today', 'week', 'month', 'all'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all',
                  period === p ? 'bg-fg text-t1 shadow-sm' : 'text-t3 hover:text-t2'
                )}
              >
                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-2">
            <div
              className="stat-card p-3"
              style={{ background: 'color-mix(in oklch, var(--fg) 88%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            >
              <p className="text-[9px] text-t3 uppercase tracking-wider mb-1">Est. Profit</p>
              <p className={cn('text-xl font-bold mono leading-tight', totalProfit >= 0 ? 'text-green' : 'text-red')}>
                {totalProfit >= 0 ? '+' : ''}${Math.abs(totalProfit).toFixed(2)}
              </p>
              <p className="text-[10px] text-t3 mt-0.5">{buyItems.length} items</p>
            </div>
            <div
              className="stat-card p-3"
              style={{ background: 'color-mix(in oklch, var(--fg) 88%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            >
              <p className="text-[9px] text-t3 uppercase tracking-wider mb-1">Avg ROI</p>
              <p className={cn('text-xl font-bold mono leading-tight', avgROI >= 0 ? 'text-green' : 'text-red')}>
                {avgROI >= 0 ? '+' : ''}{avgROI}%
              </p>
              <p className="text-[10px] text-t3 mt-0.5">BUY rate {buyRate}%</p>
            </div>
            <div
              className="stat-card p-3"
              style={{ background: 'color-mix(in oklch, var(--fg) 88%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            >
              <p className="text-[9px] text-t3 uppercase tracking-wider mb-1">Invested</p>
              <p className="text-xl font-bold mono text-t1 leading-tight">${totalInvested.toFixed(2)}</p>
              <p className="text-[10px] text-t3 mt-0.5">purchase cost</p>
            </div>
            <div
              className="stat-card p-3"
              style={{ background: 'color-mix(in oklch, var(--fg) 88%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            >
              <p className="text-[9px] text-t3 uppercase tracking-wider mb-1">Est. Revenue</p>
              <p className="text-xl font-bold mono text-b1 leading-tight">${totalRevenue.toFixed(2)}</p>
              <p className="text-[10px] text-t3 mt-0.5">if all sell</p>
            </div>
          </div>

          {/* BUY items list */}
          {buyItems.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-t3 uppercase tracking-wider flex items-center gap-1.5">
                <TrendUp size={12} />
                Inventory — {PERIOD_LABELS[period]} ({buyItems.length})
              </h3>
              {buyItems.map(item => {
                const profit = (item.estimatedSellPrice || 0) - item.purchasePrice
                const margin = item.profitMargin || 0
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-s2/60"
                    style={{ background: 'color-mix(in oklch, var(--fg) 88%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                  >
                    {item.imageThumbnail || item.imageData ? (
                      <img
                        src={item.imageThumbnail || item.imageData}
                        alt={item.productName || 'Item'}
                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-s2/60"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-s1 flex items-center justify-center flex-shrink-0 border border-s2/60">
                        <Package size={16} className="text-t3" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-t1 truncate">{item.productName || 'Unknown Item'}</p>
                      <p className="text-[10px] text-t3 font-mono">
                        ${item.purchasePrice.toFixed(2)} → ${(item.estimatedSellPrice || 0).toFixed(2)}
                        {profit !== 0 && (
                          <span className={cn('ml-1.5', profit > 0 ? 'text-green' : 'text-red')}>
                            ({profit > 0 ? '+' : ''}${profit.toFixed(2)})
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[9px] font-bold flex-shrink-0',
                        margin > 0
                          ? 'bg-green/10 text-green border border-green/20'
                          : 'bg-red/10 text-red border border-red/20'
                      )}
                    >
                      {margin >= 0 ? '+' : ''}{margin.toFixed(0)}%
                    </Badge>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-b1/20 to-b2/10 border border-b1/20 flex items-center justify-center mb-5">
                <ShoppingBag size={32} weight="duotone" className="text-b1" />
              </div>
              <h3 className="text-lg font-bold text-t1 mb-2">No BUY items yet</h3>
              <p className="text-sm text-t2 max-w-[220px] leading-relaxed">
                Items you decide to buy will appear here with profit projections
              </p>
            </div>
          )}

          {/* API Costs — secondary collapsible */}
          <Collapsible open={showApiCosts} onOpenChange={setShowApiCosts}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-s1 text-[11px] font-bold text-t3 hover:text-t2 transition-colors">
              <span>API Usage Costs</span>
              <div className="flex items-center gap-2">
                {!isLoading && costData && (
                  <span className="font-mono text-t1">${costData.totalCost.toFixed(4)}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); refreshData() }}
                  className="p-1 rounded hover:bg-s2 transition-colors"
                  aria-label="Refresh API costs"
                >
                  <ArrowsClockwise size={12} className={cn(isLoading && 'animate-spin')} />
                </button>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1.5">
              {costData && costData.services.length > 0 ? (
                costData.services.map(service => {
                  const config = API_COST_CONFIGS[service.service]
                  return (
                    <div
                      key={service.service}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-s2/60"
                      style={{ background: 'color-mix(in oklch, var(--s1) 70%, transparent)' }}
                    >
                      <span className="text-[11px] text-t2">{config.name}</span>
                      <div className="text-right">
                        <span className="text-[11px] font-mono text-t1">${service.totalCost.toFixed(4)}</span>
                        <span className="text-[10px] text-t3 ml-2">{service.totalRequests}x</span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-[11px] text-t3 text-center py-3">No API usage in this period</p>
              )}
            </CollapsibleContent>
          </Collapsible>

        </div>
      </div>
    </div>
  )
}
