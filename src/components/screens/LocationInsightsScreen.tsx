import { useMemo, useState } from 'react'
import { ArrowLeft, MapPin, TrendUp, TrendDown, Package, Trophy, Tag, CalendarBlank, CaretDown } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ScannedItem, LocationPerformance } from '@/types'
import { cn } from '@/lib/utils'

interface LocationInsightsScreenProps {
  items: ScannedItem[]
  onBack: () => void
}

const LOCATION_TYPE_COLORS: Record<string, string> = {
  'goodwill': 'oklch(0.60 0.20 145)',
  'salvation-army': 'oklch(0.65 0.22 25)',
  'thrift-store': 'oklch(0.55 0.18 250)',
  'estate-sale': 'oklch(0.70 0.18 75)',
  'garage-sale': 'oklch(0.60 0.15 180)',
  'flea-market': 'oklch(0.65 0.20 300)',
  'other': 'oklch(0.55 0.10 240)',
}

const LOCATION_TYPE_ICONS: Record<string, string> = {
  'goodwill': '🏪',
  'salvation-army': '⛪',
  'thrift-store': '🛍️',
  'estate-sale': '🏡',
  'garage-sale': '🚗',
  'flea-market': '🎪',
  'other': '📍',
}

function getWeekStart(timestamp: number): number {
  const date = new Date(timestamp)
  const day = date.getDay()
  const diff = date.getDate() - day
  return new Date(date.getFullYear(), date.getMonth(), diff, 0, 0, 0, 0).getTime()
}

function getWeekEnd(weekStart: number): number {
  return weekStart + 7 * 24 * 60 * 60 * 1000 - 1
}

export function LocationInsightsScreen({ items, onBack }: LocationInsightsScreenProps) {
  const [sortBy, setSortBy] = useState<'profit' | 'buyRate' | 'scans'>('profit')
  const [showWeeklyTrends, setShowWeeklyTrends] = useState(false)

  const locationPerformance = useMemo(() => {
    const locationMap = new Map<string, LocationPerformance>()

    items.forEach(item => {
      if (!item.location) return

      const locationId = item.location.id
      let perf = locationMap.get(locationId)

      if (!perf) {
        perf = {
          location: item.location,
          totalScans: 0,
          buyCount: 0,
          passCount: 0,
          totalProfit: 0,
          averageProfit: 0,
          buyRate: 0,
          bestCategories: [],
          recentFinds: [],
        }
        locationMap.set(locationId, perf)
      }

      perf.totalScans++
      if (item.decision === 'BUY') perf.buyCount++
      if (item.decision === 'PASS') perf.passCount++

      const profit = (item.estimatedSellPrice || 0) - item.purchasePrice
      if (item.decision === 'BUY' && profit > 0) {
        perf.totalProfit += profit
      }

      if (perf.recentFinds.length < 5) {
        perf.recentFinds.push(item)
      }

      if (!perf.lastVisit || item.timestamp > perf.lastVisit) {
        perf.lastVisit = item.timestamp
      }
    })

    locationMap.forEach(perf => {
      perf.averageProfit = perf.buyCount > 0 ? perf.totalProfit / perf.buyCount : 0
      perf.buyRate = perf.totalScans > 0 ? (perf.buyCount / perf.totalScans) * 100 : 0

      const categoryMap = new Map<string, { count: number; totalProfit: number }>()

      items
        .filter(item => item.location?.id === perf.location.id && item.category && item.decision === 'BUY')
        .forEach(item => {
          const cat = item.category!
          const existing = categoryMap.get(cat) || { count: 0, totalProfit: 0 }
          existing.count++
          existing.totalProfit += (item.estimatedSellPrice || 0) - item.purchasePrice
          categoryMap.set(cat, existing)
        })

      perf.bestCategories = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          count: data.count,
          avgProfit: data.totalProfit / data.count,
        }))
        .sort((a, b) => b.avgProfit - a.avgProfit)
        .slice(0, 3)

      const weeklyMap = new Map<number, { scans: number; profit: number; buyCount: number; passCount: number }>()

      items
        .filter(item => item.location?.id === perf.location.id)
        .forEach(item => {
          const weekStart = getWeekStart(item.timestamp)
          const existing = weeklyMap.get(weekStart) || { scans: 0, profit: 0, buyCount: 0, passCount: 0 }

          existing.scans++
          if (item.decision === 'BUY') {
            existing.buyCount++
            existing.profit += (item.estimatedSellPrice || 0) - item.purchasePrice
          }
          if (item.decision === 'PASS') {
            existing.passCount++
          }

          weeklyMap.set(weekStart, existing)
        })

      perf.weeklyPerformance = Array.from(weeklyMap.entries())
        .map(([weekStart, data]) => ({
          weekStart,
          weekEnd: getWeekEnd(weekStart),
          scans: data.scans,
          profit: data.profit,
          buyCount: data.buyCount,
          passCount: data.passCount,
        }))
        .sort((a, b) => a.weekStart - b.weekStart)
    })

    return Array.from(locationMap.values())
  }, [items])

  const sortedLocations = useMemo(() => {
    return [...locationPerformance].sort((a, b) => {
      switch (sortBy) {
        case 'profit':
          return b.totalProfit - a.totalProfit
        case 'buyRate':
          return b.buyRate - a.buyRate
        case 'scans':
          return b.totalScans - a.totalScans
        default:
          return 0
      }
    })
  }, [locationPerformance, sortBy])

  const topLocation = sortedLocations[0]
  const totalProfitAllLocations = locationPerformance.reduce((sum, loc) => sum + loc.totalProfit, 0)
  const totalScansAllLocations = locationPerformance.reduce((sum, loc) => sum + loc.totalScans, 0)
  const avgGoRateAllLocations = locationPerformance.length > 0
    ? locationPerformance.reduce((sum, loc) => sum + loc.buyRate, 0) / locationPerformance.length
    : 0

  if (locationPerformance.length === 0) {
    return (
      <div className="flex flex-col h-full bg-bg">
        <header className="p-4 border-b border-s2 bg-fg sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-s1 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} weight="bold" className="text-t2" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-t1">Location Insights</h1>
              <p className="text-xs text-t3 font-medium">Profit Comparison</p>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <MapPin size={64} weight="light" className="text-t4 mb-4" />
          <h3 className="text-base font-bold text-t2 mb-2">No Location Data</h3>
          <p className="text-sm text-t3 max-w-xs">
            Start tagging items with locations when scanning to see performance insights.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      <header className="p-4 border-b border-s2 bg-fg sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-s1 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} weight="bold" className="text-t2" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-t1">Location Insights</h1>
            <p className="text-xs text-t3 font-medium">{locationPerformance.length} Locations Tracked</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="stat-card p-2.5">
            <div className="text-base font-bold text-green leading-tight">
              ${totalProfitAllLocations.toFixed(0)}
            </div>
            <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">
              Total Profit
            </div>
          </div>
          <div className="stat-card p-2.5">
            <div className="text-base font-bold leading-tight">
              {totalScansAllLocations}
            </div>
            <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">
              Total Scans
            </div>
          </div>
          <div className="stat-card p-2.5">
            <div className="text-base font-bold text-b1 leading-tight">
              {avgGoRateAllLocations.toFixed(0)}%
            </div>
            <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">
              Avg BUY Rate
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 overflow-y-auto pb-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-fg border border-s2 rounded-2xl overflow-hidden"
        >
          <button
            onClick={() => setShowWeeklyTrends(!showWeeklyTrends)}
            className="w-full p-4 flex items-center justify-between hover:bg-s1/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <CalendarBlank size={20} weight="bold" className="text-b1" />
              <h3 className="text-sm font-bold text-t1">📊 Weekly Profit Trends</h3>
            </div>
            <motion.div
              animate={{ rotate: showWeeklyTrends ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <CaretDown size={16} weight="bold" className="text-t3" />
            </motion.div>
          </button>
          
          <AnimatePresence>
            {showWeeklyTrends && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0 border-t border-s1">
                  <p className="text-xs text-t3 mb-4">
                    Compare store performance across weeks to identify trends and optimize your sourcing strategy.
                  </p>
                  {sortedLocations.length > 0 && sortedLocations[0].weeklyPerformance && sortedLocations[0].weeklyPerformance.length > 0 ? (
                    <div className="space-y-3">
                      {sortedLocations.slice(0, 3).map(loc => {
                        if (!loc.weeklyPerformance || loc.weeklyPerformance.length === 0) return null
                        
                        const recentWeeks = loc.weeklyPerformance.slice(-4)
                        const weeklyTrend = recentWeeks.length >= 2 
                          ? recentWeeks[recentWeeks.length - 1].profit > recentWeeks[recentWeeks.length - 2].profit
                          : null
                        
                        return (
                          <div key={loc.location.id} className="p-3 bg-bg rounded-xl border border-s1">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                                  style={{ backgroundColor: `${LOCATION_TYPE_COLORS[loc.location.type || 'other']}20` }}
                                >
                                  {LOCATION_TYPE_ICONS[loc.location.type || 'other']}
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-t1">{loc.location.name}</h4>
                                  <p className="text-[9px] text-t3 font-medium">{recentWeeks.length} weeks tracked</p>
                                </div>
                              </div>
                              {weeklyTrend !== null && (
                                <div className={cn(
                                  "px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1",
                                  weeklyTrend ? "bg-green-bg text-green" : "bg-red-bg text-red"
                                )}>
                                  {weeklyTrend ? (
                                    <>
                                      <TrendUp size={10} weight="bold" />
                                      Improving
                                    </>
                                  ) : (
                                    <>
                                      <TrendDown size={10} weight="bold" />
                                      Declining
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-4 gap-2">
                              {recentWeeks.map((week, idx) => {
                                const weekDate = new Date(week.weekStart)
                                const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                const buyRate = week.scans > 0 ? (week.buyCount / week.scans) * 100 : 0
                                
                                return (
                                  <div key={idx} className="text-center p-2 bg-fg rounded-lg border border-s1">
                                    <div className="text-[9px] text-t4 font-bold uppercase mb-1">{weekLabel}</div>
                                    <div className="text-sm font-bold text-green">${week.profit.toFixed(0)}</div>
                                    <div className="text-[8px] text-t3 mt-0.5">{week.scans} scans</div>
                                    <div className="text-[8px] text-b1 font-bold mt-0.5">{buyRate.toFixed(0)}%</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-t3">
                      <CalendarBlank size={32} weight="light" className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No weekly data yet. Start scanning with location tags!</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {topLocation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative p-3 bg-gradient-to-br from-b1/10 to-amber/10 border-2 border-b1/30 rounded-xl overflow-hidden"
          >
            <div className="absolute top-2 right-2">
              <Trophy size={20} weight="fill" className="text-amber" />
            </div>
            
            <div className="flex items-start gap-2.5 mb-2.5">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: `${LOCATION_TYPE_COLORS[topLocation.location.type || 'other']}20` }}
              >
                {LOCATION_TYPE_ICONS[topLocation.location.type || 'other']}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-t1 mb-0.5 leading-tight">{topLocation.location.name}</h3>
                <p className="text-[10px] text-t3 font-medium leading-tight">
                  {topLocation.location.city && topLocation.location.state 
                    ? `${topLocation.location.city}, ${topLocation.location.state}`
                    : 'Top Performing Location'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div className="bg-fg p-2 rounded-lg border border-s1">
                <div className="text-xs font-bold text-green leading-tight">
                  ${topLocation.totalProfit.toFixed(0)}
                </div>
                <div className="text-[8px] text-t4 font-bold uppercase mt-0.5">Profit</div>
              </div>
              <div className="bg-fg p-2 rounded-lg border border-s1">
                <div className="text-xs font-bold leading-tight">{topLocation.totalScans}</div>
                <div className="text-[8px] text-t4 font-bold uppercase mt-0.5">Scans</div>
              </div>
              <div className="bg-fg p-2 rounded-lg border border-s1">
                <div className="text-xs font-bold text-b1 leading-tight">{topLocation.buyRate.toFixed(0)}%</div>
                <div className="text-[8px] text-t4 font-bold uppercase mt-0.5">BUY Rate</div>
              </div>
            </div>

            {topLocation.bestCategories.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-s2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Tag size={11} weight="bold" className="text-t3" />
                  <span className="text-[8px] font-bold text-t3 uppercase tracking-wider">
                    Best Categories
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {topLocation.bestCategories.map((cat, idx) => (
                    <div
                      key={idx}
                      className="px-1.5 py-0.5 bg-fg border border-s2 rounded text-[9px] font-bold"
                    >
                      {cat.category} <span className="text-green">${cat.avgProfit.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-t2 uppercase tracking-wider">All Locations</h3>
          <div className="flex gap-1 p-1 bg-s1 rounded-lg border border-s2">
            <button
              onClick={() => setSortBy('profit')}
              className={cn(
                "px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all",
                sortBy === 'profit' 
                  ? "bg-fg text-b1 shadow-sm" 
                  : "text-t3 hover:text-t2"
              )}
            >
              Profit
            </button>
            <button
              onClick={() => setSortBy('buyRate')}
              className={cn(
                "px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all",
                sortBy === 'buyRate'
                  ? "bg-fg text-b1 shadow-sm" 
                  : "text-t3 hover:text-t2"
              )}
            >
              BUY Rate
            </button>
            <button
              onClick={() => setSortBy('scans')}
              className={cn(
                "px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all",
                sortBy === 'scans' 
                  ? "bg-fg text-b1 shadow-sm" 
                  : "text-t3 hover:text-t2"
              )}
            >
              Scans
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {sortedLocations.map((loc, index) => {
            const isTop = index === 0
            const avgProfit = totalProfitAllLocations / locationPerformance.length
            const profitTrend = loc.totalProfit > avgProfit
            const profitDiff = loc.totalProfit - avgProfit
            const profitDiffPercent = avgProfit > 0 ? (Math.abs(profitDiff) / avgProfit) * 100 : 0
            
            const avgBuyRate = locationPerformance.reduce((sum, l) => sum + l.buyRate, 0) / locationPerformance.length
            const buyRateTrend = loc.buyRate > avgBuyRate
            const buyRateDiff = loc.buyRate - avgBuyRate
            
            return (
              <motion.div
                key={loc.location.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  isTop 
                    ? "bg-fg border-b1/20" 
                    : "bg-fg border-s2 hover:border-b1/20"
                )}
              >
                <div className="flex items-start gap-2.5 mb-2.5">
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: `${LOCATION_TYPE_COLORS[loc.location.type || 'other']}20` }}
                  >
                    {LOCATION_TYPE_ICONS[loc.location.type || 'other']}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="text-xs font-bold text-t1 truncate">
                        {loc.location.name}
                      </h4>
                      {profitDiffPercent > 10 && (
                        <div 
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5",
                            profitTrend 
                              ? "bg-green-bg text-green" 
                              : "bg-red-bg text-red"
                          )}
                        >
                          {profitTrend ? (
                            <TrendUp size={9} weight="bold" />
                          ) : (
                            <TrendDown size={9} weight="bold" />
                          )}
                          {profitDiffPercent.toFixed(0)}%
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-t3 font-medium">
                      {loc.location.city && (
                        <span>{loc.location.city}</span>
                      )}
                      {loc.lastVisit && (
                        <>
                          <span>•</span>
                          <span>
                            Last visit {new Date(loc.lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <div className="text-center p-1.5 bg-bg rounded-lg border border-s1">
                    <div className="text-xs font-bold text-green leading-tight">
                      ${loc.totalProfit.toFixed(0)}
                    </div>
                    <div className="text-[7px] text-t4 font-bold uppercase mt-0.5">Profit</div>
                  </div>
                  <div className="text-center p-1.5 bg-bg rounded-lg border border-s1">
                    <div className="text-xs font-bold leading-tight">
                      ${loc.averageProfit.toFixed(0)}
                    </div>
                    <div className="text-[7px] text-t4 font-bold uppercase mt-0.5">Avg</div>
                  </div>
                  <div className="text-center p-1.5 bg-bg rounded-lg border border-s1">
                    <div className="text-xs font-bold leading-tight">{loc.totalScans}</div>
                    <div className="text-[7px] text-t4 font-bold uppercase mt-0.5">Scans</div>
                  </div>
                  <div className="text-center p-1.5 bg-bg rounded-lg border border-s1 relative">
                    <div className="flex items-center justify-center gap-0.5">
                      <div className="text-xs font-bold text-b1 leading-tight">
                        {loc.buyRate.toFixed(0)}%
                      </div>
                      {Math.abs(buyRateDiff) > 5 && (
                        <div className={cn(
                          "flex items-center",
                          buyRateTrend ? "text-green" : "text-red"
                        )}>
                          {buyRateTrend ? (
                            <TrendUp size={10} weight="bold" />
                          ) : (
                            <TrendDown size={10} weight="bold" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-[7px] text-t4 font-bold uppercase mt-0.5">BUY</div>
                  </div>
                </div>

                {loc.bestCategories.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-s1">
                    <div className="flex items-center gap-1 mb-1.5">
                      <Tag size={10} weight="bold" className="text-t3" />
                      <span className="text-[8px] font-bold text-t3 uppercase tracking-wider">
                        Top Categories
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {loc.bestCategories.map((cat, idx) => (
                        <div
                          key={idx}
                          className="px-1.5 py-0.5 bg-bg border border-s1 rounded text-[8px] font-medium"
                        >
                          <span className="text-t2">{cat.category}</span>
                          {' '}
                          <span className="text-green font-bold">${cat.avgProfit.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {loc.recentFinds.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-s1">
                    <div className="flex items-center gap-1 mb-1.5">
                      <Package size={10} weight="bold" className="text-t3" />
                      <span className="text-[8px] font-bold text-t3 uppercase tracking-wider">
                        Recent Finds
                      </span>
                    </div>
                    <div className="space-y-1">
                      {loc.recentFinds.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-1.5 bg-bg rounded-lg border border-s1"
                        >
                          <div className="flex-1 min-w-0 mr-1.5">
                            <p className="text-[9px] font-medium text-t2 truncate">
                              {item.productName || 'Unnamed Item'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[8px] text-t4 font-medium">
                              ${item.purchasePrice.toFixed(2)}
                            </span>
                            <span 
                              className={cn(
                                "text-[8px] font-bold px-1 py-0.5 rounded",
                                item.decision === 'BUY' 
                                  ? "bg-green-bg text-green" 
                                  : "bg-red-bg text-red"
                              )}
                            >
                              {item.decision}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
