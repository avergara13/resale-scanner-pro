import { useMemo, useState } from 'react'
import { ArrowLeft, MapPin, TrendUp, TrendDown, Package, ChartBar, Trophy, Tag } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { ScannedItem, ThriftStoreLocation, LocationPerformance } from '@/types'
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

export function LocationInsightsScreen({ items, onBack }: LocationInsightsScreenProps) {
  const [sortBy, setSortBy] = useState<'profit' | 'goRate' | 'scans'>('profit')

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
          goCount: 0,
          passCount: 0,
          totalProfit: 0,
          averageProfit: 0,
          goRate: 0,
          bestCategories: [],
          recentFinds: [],
        }
        locationMap.set(locationId, perf)
      }

      perf.totalScans++
      if (item.decision === 'GO') perf.goCount++
      if (item.decision === 'PASS') perf.passCount++

      const profit = (item.estimatedSellPrice || 0) - item.purchasePrice
      if (item.decision === 'GO' && profit > 0) {
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
      perf.averageProfit = perf.goCount > 0 ? perf.totalProfit / perf.goCount : 0
      perf.goRate = perf.totalScans > 0 ? (perf.goCount / perf.totalScans) * 100 : 0

      const categoryMap = new Map<string, { count: number; totalProfit: number }>()
      
      items
        .filter(item => item.location?.id === perf.location.id && item.category && item.decision === 'GO')
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
    })

    return Array.from(locationMap.values())
  }, [items])

  const sortedLocations = useMemo(() => {
    return [...locationPerformance].sort((a, b) => {
      switch (sortBy) {
        case 'profit':
          return b.totalProfit - a.totalProfit
        case 'goRate':
          return b.goRate - a.goRate
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
    ? locationPerformance.reduce((sum, loc) => sum + loc.goRate, 0) / locationPerformance.length
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
          <div className="stat-card p-3">
            <div className="text-lg font-bold text-green leading-tight">
              ${totalProfitAllLocations.toFixed(0)}
            </div>
            <div className="text-[10px] text-t3 font-medium uppercase tracking-wider mt-1">
              Total Profit
            </div>
          </div>
          <div className="stat-card p-3">
            <div className="text-lg font-bold leading-tight">
              {totalScansAllLocations}
            </div>
            <div className="text-[10px] text-t3 font-medium uppercase tracking-wider mt-1">
              Total Scans
            </div>
          </div>
          <div className="stat-card p-3">
            <div className="text-lg font-bold text-b1 leading-tight">
              {avgGoRateAllLocations.toFixed(0)}%
            </div>
            <div className="text-[10px] text-t3 font-medium uppercase tracking-wider mt-1">
              Avg GO Rate
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 overflow-y-auto pb-24">
        {topLocation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative p-4 bg-gradient-to-br from-b1/10 to-amber/10 border-2 border-b1/30 rounded-2xl overflow-hidden"
          >
            <div className="absolute top-3 right-3">
              <Trophy size={24} weight="fill" className="text-amber" />
            </div>
            
            <div className="flex items-start gap-3 mb-3">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: `${LOCATION_TYPE_COLORS[topLocation.location.type || 'other']}20` }}
              >
                {LOCATION_TYPE_ICONS[topLocation.location.type || 'other']}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-t1 mb-1">{topLocation.location.name}</h3>
                <p className="text-xs text-t3 font-medium">
                  {topLocation.location.city && topLocation.location.state 
                    ? `${topLocation.location.city}, ${topLocation.location.state}`
                    : 'Top Performing Location'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-fg p-2.5 rounded-xl border border-s1">
                <div className="text-sm font-bold text-green">
                  ${topLocation.totalProfit.toFixed(0)}
                </div>
                <div className="text-[9px] text-t4 font-bold uppercase mt-0.5">Profit</div>
              </div>
              <div className="bg-fg p-2.5 rounded-xl border border-s1">
                <div className="text-sm font-bold">{topLocation.totalScans}</div>
                <div className="text-[9px] text-t4 font-bold uppercase mt-0.5">Scans</div>
              </div>
              <div className="bg-fg p-2.5 rounded-xl border border-s1">
                <div className="text-sm font-bold text-b1">{topLocation.goRate.toFixed(0)}%</div>
                <div className="text-[9px] text-t4 font-bold uppercase mt-0.5">GO Rate</div>
              </div>
            </div>

            {topLocation.bestCategories.length > 0 && (
              <div className="mt-3 pt-3 border-t border-s2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag size={12} weight="bold" className="text-t3" />
                  <span className="text-[9px] font-bold text-t3 uppercase tracking-wider">
                    Best Categories
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {topLocation.bestCategories.map((cat, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-1 bg-fg border border-s2 rounded-lg text-[10px] font-bold"
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
              onClick={() => setSortBy('goRate')}
              className={cn(
                "px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all",
                sortBy === 'goRate' 
                  ? "bg-fg text-b1 shadow-sm" 
                  : "text-t3 hover:text-t2"
              )}
            >
              GO Rate
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
            const profitTrend = loc.totalProfit > (totalProfitAllLocations / locationPerformance.length)
            
            return (
              <motion.div
                key={loc.location.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "p-3.5 rounded-xl border transition-all",
                  isTop 
                    ? "bg-fg border-b1/20" 
                    : "bg-fg border-s2 hover:border-b1/20"
                )}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: `${LOCATION_TYPE_COLORS[loc.location.type || 'other']}20` }}
                  >
                    {LOCATION_TYPE_ICONS[loc.location.type || 'other']}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-t1 mb-0.5 truncate">
                      {loc.location.name}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-t3 font-medium">
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
                  <div className="flex items-center gap-1">
                    {profitTrend ? (
                      <TrendUp size={16} weight="bold" className="text-green" />
                    ) : (
                      <TrendDown size={16} weight="bold" className="text-t4" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-bg rounded-lg border border-s1">
                    <div className="text-sm font-bold text-green">
                      ${loc.totalProfit.toFixed(0)}
                    </div>
                    <div className="text-[8px] text-t4 font-bold uppercase mt-0.5">Profit</div>
                  </div>
                  <div className="text-center p-2 bg-bg rounded-lg border border-s1">
                    <div className="text-sm font-bold">
                      ${loc.averageProfit.toFixed(0)}
                    </div>
                    <div className="text-[8px] text-t4 font-bold uppercase mt-0.5">Avg</div>
                  </div>
                  <div className="text-center p-2 bg-bg rounded-lg border border-s1">
                    <div className="text-sm font-bold">{loc.totalScans}</div>
                    <div className="text-[8px] text-t4 font-bold uppercase mt-0.5">Scans</div>
                  </div>
                  <div className="text-center p-2 bg-bg rounded-lg border border-s1">
                    <div className="text-sm font-bold text-b1">
                      {loc.goRate.toFixed(0)}%
                    </div>
                    <div className="text-[8px] text-t4 font-bold uppercase mt-0.5">GO</div>
                  </div>
                </div>

                {loc.bestCategories.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-s1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tag size={11} weight="bold" className="text-t3" />
                      <span className="text-[9px] font-bold text-t3 uppercase tracking-wider">
                        Top Categories
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {loc.bestCategories.map((cat, idx) => (
                        <div
                          key={idx}
                          className="px-2 py-1 bg-bg border border-s1 rounded text-[9px] font-medium"
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
                  <div className="mt-3 pt-3 border-t border-s1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Package size={11} weight="bold" className="text-t3" />
                      <span className="text-[9px] font-bold text-t3 uppercase tracking-wider">
                        Recent Finds
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {loc.recentFinds.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-bg rounded-lg border border-s1"
                        >
                          <div className="flex-1 min-w-0 mr-2">
                            <p className="text-[10px] font-medium text-t2 truncate">
                              {item.productName || 'Unnamed Item'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[9px] text-t4 font-medium">
                              ${item.purchasePrice.toFixed(2)}
                            </span>
                            <span 
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded",
                                item.decision === 'GO' 
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
