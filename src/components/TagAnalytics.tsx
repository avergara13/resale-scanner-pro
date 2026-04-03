import { useMemo, useState } from 'react'
import { TrendUp, TrendDown, Tag, CurrencyDollar, ChartBar, Package, CheckCircle, XCircle, Percent, Target, Lightning, Calendar, Sparkle, ArrowsClockwise, ArrowsLeftRight, CaretUp, CaretDown } from '@phosphor-icons/react'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Button } from './ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Switch } from './ui/switch'
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
  avgROI: number
  medianProfit: number
  profitPerItem: number
  successRate: number
  velocityScore: number
  bestItem?: ScannedItem
  worstItem?: ScannedItem
  trend: 'up' | 'down' | 'stable'
  trendPercentage: number
  last7DaysCount: number
  last30DaysCount: number
  last7DaysProfit: number
  last30DaysProfit: number
  profitByWeek: number[]
}

interface TagAnalyticsProps {
  items: ScannedItem[]
  tags: ItemTag[]
}

export function TagAnalytics({ items, tags }: TagAnalyticsProps) {
  const [sortBy, setSortBy] = useState<'profit' | 'roi' | 'velocity' | 'success'>('profit')
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'all'>('all')
  const [compareMode, setCompareMode] = useState(false)
  const [comparePeriod1, setComparePeriod1] = useState<'7days' | '30days' | '90days'>('7days')
  const [comparePeriod2, setComparePeriod2] = useState<'7days' | '30days' | '90days'>('30days')

  const getPeriodMilliseconds = (period: '7days' | '30days' | '90days') => {
    if (period === '7days') return 7 * 24 * 60 * 60 * 1000
    if (period === '30days') return 30 * 24 * 60 * 60 * 1000
    if (period === '90days') return 90 * 24 * 60 * 60 * 1000
    return 0
  }

  const getPeriodLabel = (period: '7days' | '30days' | '90days') => {
    if (period === '7days') return 'Last 7 Days'
    if (period === '30days') return 'Last 30 Days'
    if (period === '90days') return 'Last 90 Days'
    return ''
  }

  const calculatePeriodAnalytics = (period: '7days' | '30days' | '90days') => {
    const now = Date.now()
    const periodMs = getPeriodMilliseconds(period)
    const periodItems = items.filter(item => item.timestamp > now - periodMs)
    
    const tagMap = new Map<string, Omit<TagAnalytics, 'trend' | 'trendPercentage' | 'last7DaysCount' | 'last30DaysCount' | 'last7DaysProfit' | 'last30DaysProfit' | 'profitByWeek'>>()
    
    tags.forEach(tag => {
      const taggedItems = periodItems.filter(item => item.tags?.includes(tag.id))
      
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
          avgROI: 0,
          medianProfit: 0,
          profitPerItem: 0,
          successRate: 0,
          velocityScore: 0,
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
      const rois = goItems.map(item => {
        const profit = (item.estimatedSellPrice || 0) - item.purchasePrice
        return item.purchasePrice > 0 ? (profit / item.purchasePrice) * 100 : 0
      }).filter(r => r > 0)
      
      const totalProfit = profits.reduce((sum, p) => sum + p, 0)
      const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0
      const avgMargin = margins.length > 0 ? margins.reduce((sum, m) => sum + m, 0) / margins.length : 0
      const avgROI = rois.length > 0 ? rois.reduce((sum, r) => sum + r, 0) / rois.length : 0
      
      const sortedProfits = [...profits].sort((a, b) => a - b)
      const medianProfit = sortedProfits.length > 0 
        ? sortedProfits[Math.floor(sortedProfits.length / 2)] 
        : 0
      
      const avgPurchasePrice = taggedItems.reduce((sum, item) => sum + item.purchasePrice, 0) / taggedItems.length
      const avgSellPrice = goItems.reduce((sum, item) => sum + (item.estimatedSellPrice || 0), 0) / (goItems.length || 1)
      const profitPerItem = totalProfit / taggedItems.length
      const successRate = taggedItems.length > 0 ? (goItems.length / taggedItems.length) * 100 : 0

      const sortedByProfit = [...goItems].sort((a, b) => {
        const profitA = (a.estimatedSellPrice || 0) - a.purchasePrice
        const profitB = (b.estimatedSellPrice || 0) - b.purchasePrice
        return profitB - profitA
      })

      const velocityScore = taggedItems.length > 0 
        ? (goItems.length / taggedItems.length) * (totalProfit / taggedItems.length)
        : 0

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
        avgROI,
        medianProfit,
        profitPerItem,
        successRate,
        velocityScore,
        bestItem: sortedByProfit[0],
        worstItem: sortedByProfit[sortedByProfit.length - 1],
      })
    })

    return Array.from(tagMap.values())
  }

  const analytics = useMemo(() => {
    const tagMap = new Map<string, TagAnalytics>()
    const now = Date.now()

    tags.forEach(tag => {
      const allTaggedItems = items.filter(item => item.tags?.includes(tag.id))
      
      let taggedItems = allTaggedItems
      if (timeRange === '7days') {
        taggedItems = allTaggedItems.filter(item => item.timestamp > now - 7 * 24 * 60 * 60 * 1000)
      } else if (timeRange === '30days') {
        taggedItems = allTaggedItems.filter(item => item.timestamp > now - 30 * 24 * 60 * 60 * 1000)
      }
      
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
          avgROI: 0,
          medianProfit: 0,
          profitPerItem: 0,
          successRate: 0,
          velocityScore: 0,
          trend: 'stable',
          trendPercentage: 0,
          last7DaysCount: 0,
          last30DaysCount: 0,
          last7DaysProfit: 0,
          last30DaysProfit: 0,
          profitByWeek: [0, 0, 0, 0],
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
      const rois = goItems.map(item => {
        const profit = (item.estimatedSellPrice || 0) - item.purchasePrice
        return item.purchasePrice > 0 ? (profit / item.purchasePrice) * 100 : 0
      }).filter(r => r > 0)
      
      const totalProfit = profits.reduce((sum, p) => sum + p, 0)
      const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0
      const avgMargin = margins.length > 0 ? margins.reduce((sum, m) => sum + m, 0) / margins.length : 0
      const avgROI = rois.length > 0 ? rois.reduce((sum, r) => sum + r, 0) / rois.length : 0
      
      const sortedProfits = [...profits].sort((a, b) => a - b)
      const medianProfit = sortedProfits.length > 0 
        ? sortedProfits[Math.floor(sortedProfits.length / 2)] 
        : 0
      
      const avgPurchasePrice = taggedItems.reduce((sum, item) => sum + item.purchasePrice, 0) / taggedItems.length
      const avgSellPrice = goItems.reduce((sum, item) => sum + (item.estimatedSellPrice || 0), 0) / (goItems.length || 1)
      const profitPerItem = totalProfit / taggedItems.length
      const successRate = taggedItems.length > 0 ? (goItems.length / taggedItems.length) * 100 : 0

      const sortedByProfit = [...goItems].sort((a, b) => {
        const profitA = (a.estimatedSellPrice || 0) - a.purchasePrice
        const profitB = (b.estimatedSellPrice || 0) - b.purchasePrice
        return profitB - profitA
      })

      const last7Days = allTaggedItems.filter(item => item.timestamp > now - 7 * 24 * 60 * 60 * 1000)
      const last30Days = allTaggedItems.filter(item => item.timestamp > now - 30 * 24 * 60 * 60 * 1000)
      const last7DaysGo = last7Days.filter(item => item.decision === 'GO')
      const last30DaysGo = last30Days.filter(item => item.decision === 'GO')
      
      const last7DaysProfit = last7DaysGo.reduce((sum, item) => 
        sum + ((item.estimatedSellPrice || 0) - item.purchasePrice), 0
      )
      const last30DaysProfit = last30DaysGo.reduce((sum, item) => 
        sum + ((item.estimatedSellPrice || 0) - item.purchasePrice), 0
      )

      const profitByWeek = [0, 1, 2, 3].map(weekOffset => {
        const weekStart = now - ((weekOffset + 1) * 7 * 24 * 60 * 60 * 1000)
        const weekEnd = now - (weekOffset * 7 * 24 * 60 * 60 * 1000)
        const weekItems = allTaggedItems.filter(item => 
          item.timestamp >= weekStart && item.timestamp < weekEnd && item.decision === 'GO'
        )
        return weekItems.reduce((sum, item) => 
          sum + ((item.estimatedSellPrice || 0) - item.purchasePrice), 0
        )
      }).reverse()

      const prev7Days = allTaggedItems.filter(item => 
        item.timestamp > now - 14 * 24 * 60 * 60 * 1000 && 
        item.timestamp <= now - 7 * 24 * 60 * 60 * 1000
      )
      
      let trend: 'up' | 'down' | 'stable' = 'stable'
      let trendPercentage = 0
      
      if (prev7Days.length > 0 && last7Days.length > 0) {
        const lastGoRate = last7DaysGo.length / last7Days.length
        const prevGoRate = prev7Days.filter(i => i.decision === 'GO').length / prev7Days.length
        
        if (lastGoRate > prevGoRate * 1.05) {
          trend = 'up'
          trendPercentage = ((lastGoRate - prevGoRate) / prevGoRate) * 100
        } else if (lastGoRate < prevGoRate * 0.95) {
          trend = 'down'
          trendPercentage = ((prevGoRate - lastGoRate) / prevGoRate) * 100
        }
      }

      const velocityScore = last7Days.length > 0 
        ? (last7DaysGo.length / last7Days.length) * (last7DaysProfit / (last7Days.length || 1))
        : 0

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
        avgROI,
        medianProfit,
        profitPerItem,
        successRate,
        velocityScore,
        bestItem: sortedByProfit[0],
        worstItem: sortedByProfit[sortedByProfit.length - 1],
        trend,
        trendPercentage,
        last7DaysCount: last7Days.length,
        last30DaysCount: last30Days.length,
        last7DaysProfit,
        last30DaysProfit,
        profitByWeek,
      })
    })

    const analyticsArray = Array.from(tagMap.values())
    
    return analyticsArray.sort((a, b) => {
      if (sortBy === 'profit') return b.totalProfit - a.totalProfit
      if (sortBy === 'roi') return b.avgROI - a.avgROI
      if (sortBy === 'velocity') return b.velocityScore - a.velocityScore
      if (sortBy === 'success') return b.successRate - a.successRate
      return b.totalProfit - a.totalProfit
    })
  }, [items, tags, timeRange, sortBy])

  const period1Analytics = useMemo(() => calculatePeriodAnalytics(comparePeriod1), [items, tags, comparePeriod1])
  const period2Analytics = useMemo(() => calculatePeriodAnalytics(comparePeriod2), [items, tags, comparePeriod2])

  const topPerformers = analytics.slice(0, 3).filter(a => a.totalItems > 0)
  const needsAttention = analytics.filter(a => a.totalItems > 0 && a.goRate < 50).slice(0, 3)

  const overallStats = useMemo(() => {
    const activeAnalytics = analytics.filter(a => a.totalItems > 0)
    if (activeAnalytics.length === 0) return null

    const totalProfit = activeAnalytics.reduce((sum, a) => sum + a.totalProfit, 0)
    const totalItems = activeAnalytics.reduce((sum, a) => sum + a.totalItems, 0)
    const totalGoItems = activeAnalytics.reduce((sum, a) => sum + a.goItems, 0)
    const avgROI = activeAnalytics.reduce((sum, a) => sum + a.avgROI, 0) / activeAnalytics.length

    return {
      totalProfit,
      totalItems,
      totalGoItems,
      avgROI,
      overallGoRate: (totalGoItems / totalItems) * 100,
    }
  }, [analytics])

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
      {/* Controls */}
      <div className="flex items-center gap-2">
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)} className="flex-1">
          <TabsList className="grid w-full grid-cols-3 bg-[var(--s1)]">
            <TabsTrigger value="7days" className="text-[10px] font-bold">
              <Calendar size={12} className="mr-1" />
              7D
            </TabsTrigger>
            <TabsTrigger value="30days" className="text-[10px] font-bold">
              <Calendar size={12} className="mr-1" />
              30D
            </TabsTrigger>
            <TabsTrigger value="all" className="text-[10px] font-bold">
              <Calendar size={12} className="mr-1" />
              ALL
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Sort Controls */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          size="sm"
          variant={sortBy === 'profit' ? 'default' : 'outline'}
          onClick={() => setSortBy('profit')}
          className="text-[10px] font-bold whitespace-nowrap"
        >
          <CurrencyDollar size={12} className="mr-1" />
          Profit
        </Button>
        <Button
          size="sm"
          variant={sortBy === 'roi' ? 'default' : 'outline'}
          onClick={() => setSortBy('roi')}
          className="text-[10px] font-bold whitespace-nowrap"
        >
          <Percent size={12} className="mr-1" />
          ROI
        </Button>
        <Button
          size="sm"
          variant={sortBy === 'velocity' ? 'default' : 'outline'}
          onClick={() => setSortBy('velocity')}
          className="text-[10px] font-bold whitespace-nowrap"
        >
          <Lightning size={12} className="mr-1" />
          Velocity
        </Button>
        <Button
          size="sm"
          variant={sortBy === 'success' ? 'default' : 'outline'}
          onClick={() => setSortBy('success')}
          className="text-[10px] font-bold whitespace-nowrap"
        >
          <Target size={12} className="mr-1" />
          Success
        </Button>
      </div>

      {/* Comparison Mode Toggle */}
      <Card className="p-4 border-[var(--s2)] bg-[var(--fg)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowsLeftRight size={16} weight="bold" className="text-[var(--b1)]" />
            <div>
              <h3 className="text-xs font-bold text-[var(--t1)]">Period Comparison</h3>
              <p className="text-[9px] text-[var(--t3)] font-medium">
                Compare tag performance side-by-side
              </p>
            </div>
          </div>
          <Switch
            checked={compareMode}
            onCheckedChange={setCompareMode}
          />
        </div>

        {compareMode && (
          <div className="mt-4 flex gap-2">
            <div className="flex-1">
              <label className="text-[9px] font-bold text-[var(--t3)] uppercase block mb-1.5">
                Period 1
              </label>
              <Tabs value={comparePeriod1} onValueChange={(v) => setComparePeriod1(v as typeof comparePeriod1)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[var(--s1)] h-8">
                  <TabsTrigger value="7days" className="text-[9px] font-bold">7D</TabsTrigger>
                  <TabsTrigger value="30days" className="text-[9px] font-bold">30D</TabsTrigger>
                  <TabsTrigger value="90days" className="text-[9px] font-bold">90D</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-bold text-[var(--t3)] uppercase block mb-1.5">
                Period 2
              </label>
              <Tabs value={comparePeriod2} onValueChange={(v) => setComparePeriod2(v as typeof comparePeriod2)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[var(--s1)] h-8">
                  <TabsTrigger value="7days" className="text-[9px] font-bold">7D</TabsTrigger>
                  <TabsTrigger value="30days" className="text-[9px] font-bold">30D</TabsTrigger>
                  <TabsTrigger value="90days" className="text-[9px] font-bold">90D</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        )}
      </Card>

      {/* Comparison View */}
      {compareMode && (
        <div>
          <h3 className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <ArrowsLeftRight size={14} weight="bold" />
            Side-by-Side Comparison
          </h3>
          <div className="space-y-3">
            {tags.filter(tag => {
              const p1 = period1Analytics.find(a => a.tagId === tag.id)
              const p2 = period2Analytics.find(a => a.tagId === tag.id)
              return (p1 && p1.totalItems > 0) || (p2 && p2.totalItems > 0)
            }).map(tag => {
              const p1 = period1Analytics.find(a => a.tagId === tag.id)
              const p2 = period2Analytics.find(a => a.tagId === tag.id)
              
              if (!p1 || !p2) return null

              const profitChange = p2.totalProfit - p1.totalProfit
              const profitChangePercent = p1.totalProfit > 0 
                ? ((profitChange / p1.totalProfit) * 100) 
                : (p2.totalProfit > 0 ? 100 : 0)
              
              const roiChange = p2.avgROI - p1.avgROI
              const goRateChange = p2.goRate - p1.goRate
              const itemsChange = p2.totalItems - p1.totalItems

              return (
                <Card key={tag.id} className="p-4 border-[var(--s2)] bg-[var(--fg)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: tag.color }}
                    >
                      <Tag size={16} weight="bold" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-[var(--t1)]">{tag.name}</h4>
                      <p className="text-[9px] text-[var(--t3)] font-medium">
                        {getPeriodLabel(comparePeriod1)} vs {getPeriodLabel(comparePeriod2)}
                      </p>
                    </div>
                  </div>

                  {/* Comparison Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Period 1 */}
                    <div className="p-3 bg-[var(--s1)] rounded-lg border border-[var(--s2)]">
                      <div className="text-[9px] font-bold text-[var(--b1)] uppercase tracking-wider mb-2">
                        {getPeriodLabel(comparePeriod1)}
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-[var(--t4)] mb-0.5">Total Profit</div>
                          <div className="text-lg font-bold text-[var(--green)] mono">
                            ${p1.totalProfit.toFixed(2)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <div className="text-[var(--t4)]">Items</div>
                            <div className="font-bold text-[var(--t1)]">{p1.totalItems}</div>
                          </div>
                          <div>
                            <div className="text-[var(--t4)]">GO Rate</div>
                            <div className="font-bold text-[var(--t1)]">{p1.goRate.toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-[var(--t4)]">Avg ROI</div>
                            <div className="font-bold text-[var(--b1)]">{p1.avgROI.toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-[var(--t4)]">Avg Profit</div>
                            <div className="font-bold text-[var(--green)] mono">${p1.avgProfit.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Period 2 */}
                    <div className="p-3 bg-[var(--s1)] rounded-lg border border-[var(--s2)]">
                      <div className="text-[9px] font-bold text-[var(--b1)] uppercase tracking-wider mb-2">
                        {getPeriodLabel(comparePeriod2)}
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-[var(--t4)] mb-0.5">Total Profit</div>
                          <div className="text-lg font-bold text-[var(--green)] mono">
                            ${p2.totalProfit.toFixed(2)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <div className="text-[var(--t4)]">Items</div>
                            <div className="font-bold text-[var(--t1)]">{p2.totalItems}</div>
                          </div>
                          <div>
                            <div className="text-[var(--t4)]">GO Rate</div>
                            <div className="font-bold text-[var(--t1)]">{p2.goRate.toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-[var(--t4)]">Avg ROI</div>
                            <div className="font-bold text-[var(--b1)]">{p2.avgROI.toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-[var(--t4)]">Avg Profit</div>
                            <div className="font-bold text-[var(--green)] mono">${p2.avgProfit.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Change Indicators */}
                  <div className="mt-3 pt-3 border-t border-[var(--s2)]">
                    <div className="text-[9px] font-bold text-[var(--t3)] uppercase tracking-wider mb-2">
                      Changes
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center p-2 bg-[var(--bg)] rounded-lg">
                        <div className={`text-xs font-bold flex items-center justify-center gap-1 ${
                          profitChange > 0 ? 'text-[var(--green)]' : profitChange < 0 ? 'text-[var(--red)]' : 'text-[var(--t3)]'
                        }`}>
                          {profitChange > 0 && <CaretUp size={10} weight="bold" />}
                          {profitChange < 0 && <CaretDown size={10} weight="bold" />}
                          {Math.abs(profitChangePercent).toFixed(0)}%
                        </div>
                        <div className="text-[8px] text-[var(--t4)] mt-0.5">Profit</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg)] rounded-lg">
                        <div className={`text-xs font-bold flex items-center justify-center gap-1 ${
                          itemsChange > 0 ? 'text-[var(--green)]' : itemsChange < 0 ? 'text-[var(--red)]' : 'text-[var(--t3)]'
                        }`}>
                          {itemsChange > 0 && <CaretUp size={10} weight="bold" />}
                          {itemsChange < 0 && <CaretDown size={10} weight="bold" />}
                          {Math.abs(itemsChange)}
                        </div>
                        <div className="text-[8px] text-[var(--t4)] mt-0.5">Items</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg)] rounded-lg">
                        <div className={`text-xs font-bold flex items-center justify-center gap-1 ${
                          goRateChange > 0 ? 'text-[var(--green)]' : goRateChange < 0 ? 'text-[var(--red)]' : 'text-[var(--t3)]'
                        }`}>
                          {goRateChange > 0 && <CaretUp size={10} weight="bold" />}
                          {goRateChange < 0 && <CaretDown size={10} weight="bold" />}
                          {Math.abs(goRateChange).toFixed(0)}%
                        </div>
                        <div className="text-[8px] text-[var(--t4)] mt-0.5">GO Rate</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg)] rounded-lg">
                        <div className={`text-xs font-bold flex items-center justify-center gap-1 ${
                          roiChange > 0 ? 'text-[var(--green)]' : roiChange < 0 ? 'text-[var(--red)]' : 'text-[var(--t3)]'
                        }`}>
                          {roiChange > 0 && <CaretUp size={10} weight="bold" />}
                          {roiChange < 0 && <CaretDown size={10} weight="bold" />}
                          {Math.abs(roiChange).toFixed(0)}%
                        </div>
                        <div className="text-[8px] text-[var(--t4)] mt-0.5">ROI</div>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Overall Stats Summary */}
      {overallStats && (
        <Card className="p-4 border-[var(--b1)]/20 bg-gradient-to-br from-[var(--blue-bg)] to-[var(--fg)]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkle size={16} weight="fill" className="text-[var(--b1)]" />
            <h3 className="text-xs font-bold text-[var(--t1)] uppercase tracking-wider">
              Overall Performance
            </h3>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 bg-[var(--fg)] rounded-lg border border-[var(--s1)]">
              <div className="text-sm font-bold text-[var(--green)] mono">
                ${overallStats.totalProfit.toFixed(0)}
              </div>
              <div className="text-[8px] text-[var(--t4)] font-bold uppercase mt-0.5">Total</div>
            </div>
            <div className="text-center p-2 bg-[var(--fg)] rounded-lg border border-[var(--s1)]">
              <div className="text-sm font-bold text-[var(--t1)]">
                {overallStats.overallGoRate.toFixed(0)}%
              </div>
              <div className="text-[8px] text-[var(--t4)] font-bold uppercase mt-0.5">GO Rate</div>
            </div>
            <div className="text-center p-2 bg-[var(--fg)] rounded-lg border border-[var(--s1)]">
              <div className="text-sm font-bold text-[var(--b1)]">
                {overallStats.avgROI.toFixed(0)}%
              </div>
              <div className="text-[8px] text-[var(--t4)] font-bold uppercase mt-0.5">Avg ROI</div>
            </div>
            <div className="text-center p-2 bg-[var(--fg)] rounded-lg border border-[var(--s1)]">
              <div className="text-sm font-bold text-[var(--t1)]">
                {overallStats.totalItems}
              </div>
              <div className="text-[8px] text-[var(--t4)] font-bold uppercase mt-0.5">Items</div>
            </div>
          </div>
        </Card>
      )}

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

                {/* Enhanced Metrics Grid */}
                <div className="grid grid-cols-5 gap-2 mb-3">
                  <div className="text-center p-2 bg-[var(--s1)] rounded-lg">
                    <div className="text-xs font-bold text-[var(--t1)]">{tag.goRate.toFixed(0)}%</div>
                    <div className="text-[8px] text-[var(--t4)] font-medium uppercase">GO Rate</div>
                  </div>
                  <div className="text-center p-2 bg-[var(--s1)] rounded-lg">
                    <div className="text-xs font-bold text-[var(--green)] mono">
                      ${tag.avgProfit.toFixed(2)}
                    </div>
                    <div className="text-[8px] text-[var(--t4)] font-medium uppercase">Avg</div>
                  </div>
                  <div className="text-center p-2 bg-[var(--s1)] rounded-lg">
                    <div className="text-xs font-bold text-[var(--b1)]">{tag.avgROI.toFixed(0)}%</div>
                    <div className="text-[8px] text-[var(--t4)] font-medium uppercase">ROI</div>
                  </div>
                  <div className="text-center p-2 bg-[var(--s1)] rounded-lg">
                    <div className="text-xs font-bold text-[var(--t1)]">{tag.avgMargin.toFixed(0)}%</div>
                    <div className="text-[8px] text-[var(--t4)] font-medium uppercase">Margin</div>
                  </div>
                  <div className="text-center p-2 bg-[var(--s1)] rounded-lg">
                    <div className="text-xs font-bold text-[var(--t1)] mono">
                      ${tag.profitPerItem.toFixed(2)}
                    </div>
                    <div className="text-[8px] text-[var(--t4)] font-medium uppercase">/Item</div>
                  </div>
                </div>

                {/* Profit Trend Mini Chart */}
                {tag.profitByWeek.length > 0 && tag.profitByWeek.some(v => v > 0) && (
                  <div className="mb-3">
                    <div className="text-[9px] font-bold text-[var(--t3)] uppercase tracking-wider mb-1.5">
                      4-Week Profit Trend
                    </div>
                    <div className="h-12 flex items-end justify-between gap-1">
                      {tag.profitByWeek.map((profit, idx) => {
                        const maxProfit = Math.max(...tag.profitByWeek, 1)
                        const height = (profit / maxProfit) * 100
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center justify-end">
                            <div 
                              className="w-full rounded-t-sm transition-all"
                              style={{ 
                                height: `${height}%`,
                                backgroundColor: tag.tagColor,
                                minHeight: profit > 0 ? '4px' : '0px'
                              }}
                            />
                            <div className="text-[7px] text-[var(--t4)] font-bold mt-1">
                              W{idx + 1}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Time-based Stats */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2 bg-[var(--bg)] rounded-lg border border-[var(--s2)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-[var(--t3)] font-bold uppercase">Last 7D</span>
                      <span className="text-xs font-bold text-[var(--t1)]">{tag.last7DaysCount} items</span>
                    </div>
                    <div className="text-sm font-bold text-[var(--green)] mono mt-1">
                      ${tag.last7DaysProfit.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-2 bg-[var(--bg)] rounded-lg border border-[var(--s2)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-[var(--t3)] font-bold uppercase">Last 30D</span>
                      <span className="text-xs font-bold text-[var(--t1)]">{tag.last30DaysCount} items</span>
                    </div>
                    <div className="text-sm font-bold text-[var(--green)] mono mt-1">
                      ${tag.last30DaysProfit.toFixed(2)}
                    </div>
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
                    <span className="text-xs text-[var(--t3)]">
                      {tag.totalItems} items · {tag.goRate.toFixed(0)}% GO rate
                    </span>
                    {tag.trend === 'down' && (
                      <Badge 
                        variant="outline" 
                        className="text-[9px] font-bold px-1.5 py-0.5 h-5 border-0 bg-[var(--red-bg)] text-[var(--red)]"
                      >
                        <TrendDown size={10} weight="bold" className="mr-0.5" />
                        {tag.trendPercentage.toFixed(0)}%
                      </Badge>
                    )}
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
        <h3 className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <ArrowsClockwise size={14} weight="bold" />
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
                    {tag.trend !== 'stable' && (
                      <Badge 
                        variant="outline" 
                        className={`text-[9px] font-bold px-1.5 py-0.5 h-5 border-0 ${
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
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-[var(--green)] mono">
                        ${tag.totalProfit.toFixed(2)}
                      </div>
                      <div className="text-[8px] text-[var(--t4)]">Total</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-[var(--b1)]">
                        {tag.avgROI.toFixed(0)}%
                      </div>
                      <div className="text-[8px] text-[var(--t4)]">ROI</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-[var(--t1)]">
                        {tag.goRate.toFixed(0)}%
                      </div>
                      <div className="text-[8px] text-[var(--t4)]">GO</div>
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
