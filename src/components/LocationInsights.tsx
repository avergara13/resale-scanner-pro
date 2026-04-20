import { useState, useMemo } from 'react'
import { MapPin, TrendUp, Star, ChartBar, Sparkle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ScannedItem, LocationPerformance } from '@/types'
import { cn } from '@/lib/utils'

interface LocationInsightsProps {
  items: ScannedItem[]
}

export function LocationInsights({ items }: LocationInsightsProps) {
  const [selectedLocation, setSelectedLocation] = useState<LocationPerformance | null>(null)
  const [showAllLocations, setShowAllLocations] = useState(false)

  const locationPerformance = useMemo(() => {
    const locationMap = new Map<string, LocationPerformance>()

    items.forEach(item => {
      if (!item.location) return

      const locationId = item.location.id
      const existing = locationMap.get(locationId)

      if (existing) {
        existing.totalScans++
        if (item.decision === 'BUY') {
          existing.buyCount++
          const profit = (item.estimatedSellPrice || 0) - item.purchasePrice
          existing.totalProfit += profit
        } else if (item.decision === 'PASS') {
          existing.passCount++
        }
        
        if (item.category) {
          const categoryIndex = existing.bestCategories.findIndex(c => c.category === item.category)
          if (categoryIndex >= 0) {
            existing.bestCategories[categoryIndex].count++
            const profit = (item.estimatedSellPrice || 0) - item.purchasePrice
            const currentTotal = existing.bestCategories[categoryIndex].avgProfit * (existing.bestCategories[categoryIndex].count - 1)
            existing.bestCategories[categoryIndex].avgProfit = (currentTotal + profit) / existing.bestCategories[categoryIndex].count
          } else {
            existing.bestCategories.push({
              category: item.category,
              count: 1,
              avgProfit: (item.estimatedSellPrice || 0) - item.purchasePrice
            })
          }
        }

        if (!existing.lastVisit || item.timestamp > existing.lastVisit) {
          existing.lastVisit = item.timestamp
        }

        existing.recentFinds.push(item)
      } else {
        const profit = item.decision === 'BUY' ? (item.estimatedSellPrice || 0) - item.purchasePrice : 0
        locationMap.set(locationId, {
          location: item.location,
          totalScans: 1,
          buyCount: item.decision === 'BUY' ? 1 : 0,
          passCount: item.decision === 'PASS' ? 1 : 0,
          totalProfit: profit,
          averageProfit: profit,
          buyRate: item.decision === 'BUY' ? 100 : 0,
          lastVisit: item.timestamp,
          bestCategories: item.category ? [{
            category: item.category,
            count: 1,
            avgProfit: profit
          }] : [],
          recentFinds: [item]
        })
      }
    })

    locationMap.forEach(location => {
      location.averageProfit = location.buyCount > 0 ? location.totalProfit / location.buyCount : 0
      location.buyRate = location.totalScans > 0 ? (location.buyCount / location.totalScans) * 100 : 0
      location.bestCategories.sort((a, b) => b.avgProfit - a.avgProfit)
      location.bestCategories = location.bestCategories.slice(0, 3)
      location.recentFinds = location.recentFinds
        .filter(f => f.decision === 'BUY')
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
    })

    return Array.from(locationMap.values()).sort((a, b) => b.totalProfit - a.totalProfit)
  }, [items])

  const topLocations = locationPerformance.slice(0, 3)
  const displayLocations = showAllLocations ? locationPerformance : topLocations

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getLocationIcon = (type?: string) => {
    switch (type) {
      case 'goodwill': return '🟢'
      case 'salvation-army': return '🔴'
      case 'thrift-store': return '🏪'
      case 'estate-sale': return '🏠'
      case 'garage-sale': return '🚗'
      case 'flea-market': return '🎪'
      default: return '📍'
    }
  }

  if (locationPerformance.length === 0) {
    return (
      <Card className="p-6 bg-fg border-s1">
        <div className="text-center py-8">
          <MapPin size={48} className="mx-auto mb-3 text-t4 opacity-40" />
          <h3 className="text-sm font-bold text-t2 mb-1">No Location Data Yet</h3>
          <p className="text-xs text-t3">
            Add location info to items to see insights
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={20} weight="fill" className="text-b1" />
          <h3 className="text-sm font-bold text-t1 uppercase tracking-wide">
            Best Performing Stores
          </h3>
        </div>
        {locationPerformance.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllLocations(!showAllLocations)}
            className="text-xs h-7"
          >
            {showAllLocations ? 'Show Less' : `View All (${locationPerformance.length})`}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {displayLocations.map((location, index) => (
          <Card
            key={location.location.id}
            className={cn(
              "p-4 bg-fg border-s1 cursor-pointer transition-all hover:border-b1 hover:shadow-md",
              index === 0 && "border-2 border-green/20 bg-green-bg"
            )}
            onClick={() => setSelectedLocation(location)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="text-2xl flex-shrink-0">
                  {index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : getLocationIcon(location.location.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-t1 truncate">
                      {location.location.name}
                    </h4>
                    {index === 0 && (
                      <Badge className="bg-green text-white text-[9px] px-1.5 py-0 h-4 font-bold">
                        TOP
                      </Badge>
                    )}
                  </div>
                  {location.location.city && (
                    <p className="text-xs text-t3">
                      {location.location.city}{location.location.state ? `, ${location.location.state}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <div className="text-lg font-bold text-green mono">
                  ${location.totalProfit.toFixed(0)}
                </div>
                <div className="text-[9px] text-t3 font-medium uppercase tracking-wider">
                  Total Profit
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-bg rounded-lg p-2 border border-s2">
                <div className="text-xs font-bold text-t1">{location.buyRate.toFixed(0)}%</div>
                <div className="text-[9px] text-t4 font-medium uppercase">BUY Rate</div>
              </div>
              <div className="bg-bg rounded-lg p-2 border border-s2">
                <div className="text-xs font-bold text-t1">{location.totalScans}</div>
                <div className="text-[9px] text-t4 font-medium uppercase">Scans</div>
              </div>
              <div className="bg-bg rounded-lg p-2 border border-s2">
                <div className="text-xs font-bold text-t1 mono">
                  ${location.averageProfit.toFixed(0)}
                </div>
                <div className="text-[9px] text-t4 font-medium uppercase">Avg</div>
              </div>
            </div>

            {location.bestCategories.length > 0 && (
              <div className="mt-3 pt-3 border-t border-s2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Sparkle size={12} weight="fill" className="text-amber" />
                  <span className="text-[10px] font-bold text-t3 uppercase">Best:</span>
                  {location.bestCategories.slice(0, 2).map((cat, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-[9px] px-1.5 py-0 h-4 bg-blue-bg text-b1 font-bold"
                    >
                      {cat.category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {location.lastVisit && (
              <div className="mt-2 text-[10px] text-t4 flex items-center gap-1">
                <span>Last visit: {formatDate(location.lastVisit)}</span>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedLocation} onOpenChange={() => setSelectedLocation(null)}>
        <DialogContent className="max-w-md bg-fg border-s1">
          {selectedLocation && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-t1">
                  <span className="text-2xl">{getLocationIcon(selectedLocation.location.type)}</span>
                  <div>
                    <div className="text-base font-bold">{selectedLocation.location.name}</div>
                    {selectedLocation.location.city && (
                      <div className="text-xs text-t3 font-normal">
                        {selectedLocation.location.city}{selectedLocation.location.state ? `, ${selectedLocation.location.state}` : ''}
                      </div>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 bg-green-bg border-green/20">
                    <div className="text-2xl font-bold text-green mono">
                      ${selectedLocation.totalProfit.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-green font-bold uppercase tracking-wider mt-1">
                      Total Profit
                    </div>
                  </Card>
                  <Card className="p-3 bg-blue-bg border-b1/20">
                    <div className="text-2xl font-bold text-b1">
                      {selectedLocation.buyRate.toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-b1 font-bold uppercase tracking-wider mt-1">
                      BUY Rate
                    </div>
                  </Card>
                </div>

                <Card className="p-4 bg-bg border-s2">
                  <h4 className="text-xs font-bold text-t2 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <ChartBar size={14} weight="fill" className="text-t3" />
                    Statistics
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-lg font-bold text-t1">{selectedLocation.totalScans}</div>
                      <div className="text-[10px] text-t3 font-medium uppercase">Total Scans</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green">{selectedLocation.buyCount}</div>
                      <div className="text-[10px] text-t3 font-medium uppercase">BUY Items</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red">{selectedLocation.passCount}</div>
                      <div className="text-[10px] text-t3 font-medium uppercase">PASS Items</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-t1 mono">
                        ${selectedLocation.averageProfit.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-t3 font-medium uppercase">Avg Profit</div>
                    </div>
                  </div>
                </Card>

                {selectedLocation.bestCategories.length > 0 && (
                  <Card className="p-4 bg-bg border-s2">
                    <h4 className="text-xs font-bold text-t2 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <Star size={14} weight="fill" className="text-amber" />
                      Best Categories
                    </h4>
                    <div className="space-y-2">
                      {selectedLocation.bestCategories.map((cat, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-fg rounded-lg border border-s1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-bg flex items-center justify-center text-[10px] font-bold text-b1">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-t1">{cat.category}</div>
                              <div className="text-[10px] text-t3">{cat.count} items</div>
                            </div>
                          </div>
                          <div className="text-sm font-bold text-green mono">
                            ${cat.avgProfit.toFixed(0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {selectedLocation.recentFinds.length > 0 && (
                  <Card className="p-4 bg-bg border-s2">
                    <h4 className="text-xs font-bold text-t2 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <TrendUp size={14} weight="fill" className="text-green" />
                      Recent Finds
                    </h4>
                    <div className="space-y-2">
                      {selectedLocation.recentFinds.map(item => {
                        const profit = (item.estimatedSellPrice || 0) - item.purchasePrice
                        return (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-fg rounded-lg border border-s1">
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="text-xs font-bold text-t1 truncate">
                                {item.productName || 'Untitled'}
                              </div>
                              <div className="text-[10px] text-t3">
                                {formatDate(item.timestamp)}
                              </div>
                            </div>
                            <div className="text-sm font-bold text-green mono">
                              +${profit.toFixed(0)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
