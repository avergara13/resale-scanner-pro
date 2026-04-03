import { useMemo } from 'react'
import { TrendUp, TrendDown, Tag, CurrencyDollar, ChartBar, Package, CheckCircle, XCircle } from '@phosphor-icons/react'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import type { ScannedItem, ItemTag } from '@/types'

interface TagAnalytics {
  tagId: string
  tagName: string
  tagColor: string
  totalItems: number
  goItems: number
  passItems: number
  pendingItems: number
  goRate: number
  avgProfit: number
  totalProfit: number
  avgMargin: number
  avgPurchasePrice: number
  avgSellPrice: number
  bestItem?: ScannedItem
  worstItem?: ScannedItem
  trend: 'up' | 'down' | 'stable'
  trendPercentage: number
}

interface TagAnalyticsProps {
  items: ScannedItem[]
  tags: ItemTag[]
}

export function TagAnalytics({ items, tags }: TagAnalyticsProps) {
  const analytics = useMemo(() => {
    const tagMap = new Map<string, TagAnalytics>()

    tags.forEach(tag => {
      const taggedItems = items.filter(item => item.tags?.includes(tag.id))
      
      if (taggedItems.length === 0) {
        tagMap.set(tag.id, {
          tagId: tag.id,
          tagName: tag.name,
          tagColor: tag.color,
          totalItems: 0,
          goItems: 0,
          passItems: 0,
          pendingItems: 0,
          goRate: 0,
          avgProfit: 0,
          totalProfit: 0,
          avgMargin: 0,
          avgPurchasePrice: 0,
          avgSellPrice: 0,
          trend: 'stable',
          trendPercentage: 0,
        })
        return
      }

      const goItems = taggedItems.filter(item => item.decision === 'GO')
      const passItems = taggedItems.filter(item => item.decision === 'PASS')
      const pendingItems = taggedItems.filter(item => item.decision === 'PENDING')

      const profits = goItems.map(item => 
        (item.estimatedSellPrice || 0) - item.purchasePrice
      )
      const margins = goItems.map(item => item.profitMargin || 0).filter(m => m > 0)
      
      const totalProfit = profits.reduce((sum, p) => sum + p, 0)
      const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0
      const avgMargin = margins.length > 0 ? margins.reduce((sum, m) => sum + m, 0) / margins.length : 0
      
      const avgPurchasePrice = taggedItems.reduce((sum, item) => sum + item.purchasePrice, 0) / taggedItems.length
      const avgSellPrice = goItems.reduce((sum, item) => sum + (item.estimatedSellPrice || 0), 0) / (goItems.length || 1)

      const sortedByProfit = [...goItems].sort((a, b) => {
        const profitA = (a.estimatedSellPrice || 0) - a.purchasePrice
        const profitB = (b.estimatedSellPrice || 0) - b.purchasePrice
        return profitB - profitA
      })

      const now = Date.now()
      const last7Days = taggedItems.filter(item => item.timestamp > now - 7 * 24 * 60 * 60 * 1000)
      const prev7Days = taggedItems.filter(item => 
        item.timestamp > now - 14 * 24 * 60 * 60 * 1000 && 
        item.timestamp <= now - 7 * 24 * 60 * 60 * 1000
      )
      
      let trend: 'up' | 'down' | 'stable' = 'stable'
      let trendPercentage = 0
      
      if (prev7Days.length > 0) {
        const lastGoRate = last7Days.filter(i => i.decision === 'GO').length / last7Days.length
        const prevGoRate = prev7Days.filter(i => i.decision === 'GO').length / prev7Days.length
        
        if (lastGoRate > prevGoRate * 1.05) {
          trend = 'up'
          trendPercentage = ((lastGoRate - prevGoRate) / prevGoRate) * 100
        } else if (lastGoRate < prevGoRate * 0.95) {
          trend = 'down'
          trendPercentage = ((prevGoRate - lastGoRate) / prevGoRate) * 100
        }
      }

      tagMap.set(tag.id, {
        tagId: tag.id,
        tagName: tag.name,
        tagColor: tag.color,
        totalItems: taggedItems.length,
        goItems: goItems.length,
        passItems: passItems.length,
        pendingItems: pendingItems.length,
        goRate: taggedItems.length > 0 ? (goItems.length / taggedItems.length) * 100 : 0,
        avgProfit,
        totalProfit,
        avgMargin,
        avgPurchasePrice,
        avgSellPrice,
        bestItem: sortedByProfit[0],
        worstItem: sortedByProfit[sortedByProfit.length - 1],
        trend,
        trendPercentage,
      })
    })

    return Array.from(tagMap.values()).sort((a, b) => b.totalProfit - a.totalProfit)
  }, [items, tags])

  const topPerformers = analytics.slice(0, 3).filter(a => a.totalItems > 0)
  const needsAttention = analytics.filter(a => a.totalItems > 0 && a.goRate < 50).slice(0, 3)

  if (tags.length === 0) {
    return (
      <div className="p-8 text-center">
        <Tag size={48} className="mx-auto mb-4 text-[var(--t4)]" />
        <h3 className="text-sm font-bold text-[var(--t2)] mb-2">No Tags Yet</h3>
        <p className="text-xs text-[var(--t3)]">Create tags to start tracking analytics</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {topPerformers.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <ChartBar size={14} weight="bold" />
            Top Performing Tags
          </h3>
          <div className="space-y-3">
            {topPerformers.map((tag, index) => (
              <Card key={tag.tagId} className="p-4 border-[var(--s2)] bg-[var(--fg)]">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: tag.tagColor }}
                    >
                      #{index + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--t1)]">{tag.tagName}</h4>
                      <p className="text-[10px] text-[var(--t3)] font-medium">
                        {tag.totalItems} items scanned
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[var(--green)] mono">
                      ${tag.totalProfit.toFixed(2)}
                    </div>
                    <p className="text-[9px] text-[var(--t4)] font-medium uppercase tracking-wider">
                      Total Profit
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="text-center p-2 bg-[var(--s1)] rounded-lg">
                    <div className="text-xs font-bold text-[var(--t1)]">{tag.goRate.toFixed(0)}%</div>
                    <div className="text-[8px] text-[var(--t4)] font-medium uppercase">GO Rate</div>
                  </div>
                  <div className="text-center p-2 bg-[var(--s1)] rounded-lg">
                    <div className="text-xs font-bold text-[var(--green)] mono">
                      ${tag.avgProfit.toFixed(2)}
                    </div>
                    <div className="text-[8px] text-[var(--t4)] font-medium uppercase">Avg Profit</div>
                  </div>
                  <div className="text-center p-2 bg-[var(--s1)] rounded-lg">
                    <div className="text-xs font-bold text-[var(--t1)]">{tag.avgMargin.toFixed(1)}%</div>
                    <div className="text-[8px] text-[var(--t4)] font-medium uppercase">Margin</div>
                  </div>
                  <div className="text-center p-2 bg-[var(--s1)] rounded-lg">
                    <div className="text-xs font-bold text-[var(--t1)]">{tag.goItems}</div>
                    <div className="text-[8px] text-[var(--t4)] font-medium uppercase">GO Items</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1">
                    <Progress 
                      value={tag.goRate} 
                      className="h-2"
                      style={{
                        '--progress-color': tag.tagColor,
                      } as React.CSSProperties}
                    />
                  </div>
                  {tag.trend !== 'stable' && (
                    <Badge 
                      variant="outline" 
                      className={`text-[9px] font-bold border-0 ${
                        tag.trend === 'up' 
                          ? 'bg-[var(--green-bg)] text-[var(--green)]' 
                          : 'bg-[var(--red-bg)] text-[var(--red)]'
                      }`}
                    >
                      {tag.trend === 'up' ? (
                        <TrendUp size={10} weight="bold" className="mr-0.5" />
                      ) : (
                        <TrendDown size={10} weight="bold" className="mr-0.5" />
                      )}
                      {tag.trendPercentage.toFixed(0)}%
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="flex items-center gap-1 text-[var(--green)]">
                    <CheckCircle size={12} weight="fill" />
                    <span className="font-bold">{tag.goItems}</span>
                    <span className="text-[var(--t4)]">GO</span>
                  </div>
                  <div className="flex items-center gap-1 text-[var(--red)]">
                    <XCircle size={12} weight="fill" />
                    <span className="font-bold">{tag.passItems}</span>
                    <span className="text-[var(--t4)]">PASS</span>
                  </div>
                  <div className="flex items-center gap-1 text-[var(--amber)]">
                    <Package size={12} weight="fill" />
                    <span className="font-bold">{tag.pendingItems}</span>
                    <span className="text-[var(--t4)]">PENDING</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {needsAttention.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendDown size={14} weight="bold" className="text-[var(--amber)]" />
            Needs Attention
          </h3>
          <div className="space-y-2">
            {needsAttention.map(tag => (
              <Card key={tag.tagId} className="p-3 border-[var(--amber)]/20 bg-[var(--fg)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      style={{ 
                        backgroundColor: tag.tagColor,
                        color: 'white'
                      }}
                      className="text-[9px] font-bold"
                    >
                      {tag.tagName}
                    </Badge>
                    <span className="text-xs text-[var(--t3)]">
                      {tag.totalItems} items · {tag.goRate.toFixed(0)}% GO rate
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[var(--red)]">
                    Low conversion
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wider mb-3">
          All Tags Performance
        </h3>
        <div className="space-y-2">
          {analytics.map(tag => {
            if (tag.totalItems === 0) {
              return (
                <Card key={tag.tagId} className="p-3 border-[var(--s2)] bg-[var(--s1)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        style={{ 
                          backgroundColor: tag.tagColor,
                          color: 'white'
                        }}
                        className="text-[9px] font-bold"
                      >
                        {tag.tagName}
                      </Badge>
                      <span className="text-xs text-[var(--t3)] italic">No items yet</span>
                    </div>
                  </div>
                </Card>
              )
            }

            return (
              <Card key={tag.tagId} className="p-3 border-[var(--s2)] bg-[var(--fg)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Badge 
                      style={{ 
                        backgroundColor: tag.tagColor,
                        color: 'white'
                      }}
                      className="text-[9px] font-bold"
                    >
                      {tag.tagName}
                    </Badge>
                    <span className="text-[10px] text-[var(--t3)]">
                      {tag.totalItems} items
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-[var(--green)] mono">
                        ${tag.totalProfit.toFixed(2)}
                      </div>
                      <div className="text-[8px] text-[var(--t4)]">Total</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-[var(--t1)]">
                        {tag.goRate.toFixed(0)}%
                      </div>
                      <div className="text-[8px] text-[var(--t4)]">GO Rate</div>
                    </div>
                  </div>
                </div>
                <Progress 
                  value={tag.goRate} 
                  className="h-1.5"
                  style={{
                    '--progress-color': tag.tagColor,
                  } as React.CSSProperties}
                />
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
