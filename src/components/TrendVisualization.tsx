import { useState, useMemo } from 'react'
import { TrendUp, TrendDown, Minus, Calendar, CurrencyDollar, Package, CheckCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SessionArchive } from '@/types'

interface TrendVisualizationProps {
  /**
   * Frozen per-session aggregates + an optional live archive for the
   * currently-active session. Trends bucket by `startTime` into daily
   * rows — one archive per session, already aggregated, so deleting
   * a session's raw items never affects the history.
   */
  archives: SessionArchive[]
}

type TimeRange = '7d' | '30d' | '90d' | 'all'

interface DailyMetrics {
  date: string
  timestamp: number
  itemsScanned: number
  buyCount: number
  passCount: number
  totalProfit: number
  avgProfit: number
  buyRate: number
}

interface TrendMetrics {
  current: number
  previous: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'flat'
}

export function TrendVisualization({ archives }: TrendVisualizationProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  const getDaysInRange = (range: TimeRange): number => {
    switch (range) {
      case '7d': return 7
      case '30d': return 30
      case '90d': return 90
      case 'all': return 365
      default: return 30
    }
  }

  const dailyMetrics = useMemo(() => {
    const days = getDaysInRange(timeRange)
    const now = Date.now()
    const startTime = now - (days * 24 * 60 * 60 * 1000)

    const metricsByDay = new Map<string, DailyMetrics>()

    for (let i = 0; i < days; i++) {
      const dayTimestamp = now - (i * 24 * 60 * 60 * 1000)
      const dateStr = new Date(dayTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      metricsByDay.set(dateStr, {
        date: dateStr,
        timestamp: dayTimestamp,
        itemsScanned: 0,
        buyCount: 0,
        passCount: 0,
        totalProfit: 0,
        avgProfit: 0,
        buyRate: 0,
      })
    }

    for (const archive of archives) {
      if (archive.startTime < startTime) continue
      const dateStr = new Date(archive.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const existing = metricsByDay.get(dateStr)
      if (!existing) continue
      existing.itemsScanned += archive.itemsScanned
      existing.buyCount += archive.buyCount
      existing.passCount += archive.passCount
      // Personal sessions excluded from profit totals — matches pre-archive behavior
      if (archive.sessionType !== 'personal') {
        existing.totalProfit += archive.estimatedProfit
      }
    }

    metricsByDay.forEach(metrics => {
      if (metrics.itemsScanned > 0) {
        metrics.avgProfit = metrics.buyCount > 0 ? metrics.totalProfit / metrics.buyCount : 0
        metrics.buyRate = (metrics.buyCount / metrics.itemsScanned) * 100
      }
    })

    return Array.from(metricsByDay.values()).reverse()
  }, [archives, timeRange])

  const calculateTrend = (values: number[]): TrendMetrics => {
    if (values.length < 2) {
      return { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'flat' }
    }

    const midpoint = Math.floor(values.length / 2)
    const currentPeriod = values.slice(midpoint)
    const previousPeriod = values.slice(0, midpoint)

    const current = currentPeriod.reduce((a, b) => a + b, 0) / currentPeriod.length
    const previous = previousPeriod.reduce((a, b) => a + b, 0) / previousPeriod.length

    const change = current - previous
    const changePercent = previous > 0 ? (change / previous) * 100 : 0

    return {
      current,
      previous,
      change,
      changePercent,
      trend: Math.abs(changePercent) < 5 ? 'flat' : changePercent > 0 ? 'up' : 'down',
    }
  }

  const profitTrend = useMemo(() =>
    calculateTrend(dailyMetrics.map(m => m.totalProfit)), [dailyMetrics]
  )

  const buyRateTrend = useMemo(() =>
    calculateTrend(dailyMetrics.map(m => m.buyRate)), [dailyMetrics]
  )

  const volumeTrend = useMemo(() =>
    calculateTrend(dailyMetrics.map(m => m.itemsScanned)), [dailyMetrics]
  )

  const avgProfitTrend = useMemo(() =>
    calculateTrend(dailyMetrics.map(m => m.avgProfit)), [dailyMetrics]
  )

  const maxProfit = useMemo(() =>
    Math.max(...dailyMetrics.map(m => m.totalProfit), 1), [dailyMetrics]
  )

  const maxVolume = useMemo(() =>
    Math.max(...dailyMetrics.map(m => m.itemsScanned), 1), [dailyMetrics]
  )

  const TrendIndicator = ({ trend }: { trend: TrendMetrics }) => {
    const Icon = trend.trend === 'up' ? TrendUp : trend.trend === 'down' ? TrendDown : Minus
    const colorClass = trend.trend === 'up' ? 'text-green' : trend.trend === 'down' ? 'text-red' : 'text-t3'

    return (
      <div className={cn('flex items-center gap-1 text-xs font-bold', colorClass)}>
        <Icon size={14} weight="bold" />
        <span>{Math.abs(trend.changePercent).toFixed(1)}%</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-t1">Performance Trends</h2>
        <div className="flex gap-1 bg-s1 rounded-lg p-1">
          {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all',
                timeRange === range
                  ? 'bg-fg text-b1 shadow-sm'
                  : 'text-t3 hover:text-t1'
              )}
            >
              {range === 'all' ? 'All' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-green/10 flex items-center justify-center">
              <CurrencyDollar size={16} weight="bold" className="text-green" />
            </div>
            <TrendIndicator trend={profitTrend} />
          </div>
          <p className="text-xs uppercase tracking-wide text-t3 mb-1">Total Profit</p>
          <p className="text-xl font-bold mono text-t1">
            ${dailyMetrics.reduce((sum, m) => sum + m.totalProfit, 0).toFixed(2)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-b1/10 flex items-center justify-center">
              <CheckCircle size={16} weight="bold" className="text-b1" />
            </div>
            <TrendIndicator trend={buyRateTrend} />
          </div>
          <p className="text-xs uppercase tracking-wide text-t3 mb-1">BUY Rate</p>
          <p className="text-xl font-bold mono text-t1">
            {dailyMetrics.reduce((sum, m) => sum + m.buyRate, 0) / dailyMetrics.filter(m => m.itemsScanned > 0).length || 0 ?
              (dailyMetrics.reduce((sum, m) => sum + m.buyRate, 0) / dailyMetrics.filter(m => m.itemsScanned > 0).length).toFixed(1) :
              '0'}%
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
              <Package size={16} weight="bold" className="text-amber" />
            </div>
            <TrendIndicator trend={volumeTrend} />
          </div>
          <p className="text-xs uppercase tracking-wide text-t3 mb-1">Volume</p>
          <p className="text-xl font-bold mono text-t1">
            {dailyMetrics.reduce((sum, m) => sum + m.itemsScanned, 0)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-green/10 flex items-center justify-center">
              <CurrencyDollar size={16} weight="bold" className="text-green" />
            </div>
            <TrendIndicator trend={avgProfitTrend} />
          </div>
          <p className="text-xs uppercase tracking-wide text-t3 mb-1">Avg Profit</p>
          <p className="text-xl font-bold mono text-t1">
            ${avgProfitTrend.current.toFixed(2)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-t1 uppercase tracking-wide">Daily Profit</h3>
          <Badge variant="secondary" className="text-xs">
            {timeRange === 'all' ? 'All Time' : `Last ${getDaysInRange(timeRange)} Days`}
          </Badge>
        </div>
        <div className="h-32 flex items-end justify-between gap-0.5">
          {dailyMetrics.map((day, idx) => {
            const heightPercent = maxProfit > 0 ? (day.totalProfit / maxProfit) * 100 : 0

            return (
              <div
                key={idx}
                className="flex-1 relative group cursor-pointer"
              >
                <div
                  className={cn(
                    "w-full rounded-t-sm transition-all duration-300",
                    day.totalProfit > 0 ? "bg-gradient-to-t from-green to-green/80" : "bg-s2",
                    "group-hover:opacity-80"
                  )}
                  style={{ height: `${Math.max(heightPercent, 2)}%` }}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-fg text-t1 px-2 py-1.5 rounded-lg shadow-lg text-xs whitespace-nowrap">
                    <p className="font-bold mb-0.5">{day.date}</p>
                    <p className="text-green font-mono">${day.totalProfit.toFixed(2)}</p>
                    <p className="text-t4">{day.itemsScanned} scans</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-t3 font-medium">
          <span>{dailyMetrics[0]?.date}</span>
          <span>{dailyMetrics[dailyMetrics.length - 1]?.date}</span>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-t1 uppercase tracking-wide">Scan Volume</h3>
          <Badge variant="secondary" className="text-xs">Daily Activity</Badge>
        </div>
        <div className="h-24 flex items-end justify-between gap-0.5">
          {dailyMetrics.map((day, idx) => {
            const heightPercent = maxVolume > 0 ? (day.itemsScanned / maxVolume) * 100 : 0

            return (
              <div
                key={idx}
                className="flex-1 relative group cursor-pointer"
              >
                <div
                  className={cn(
                    "w-full rounded-t-sm transition-all duration-300",
                    day.itemsScanned > 0 ? "bg-gradient-to-t from-b1 to-b1/80" : "bg-s2",
                    "group-hover:opacity-80"
                  )}
                  style={{ height: `${Math.max(heightPercent, 2)}%` }}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-fg text-t1 px-2 py-1.5 rounded-lg shadow-lg text-xs whitespace-nowrap">
                    <p className="font-bold mb-0.5">{day.date}</p>
                    <p className="text-b1 font-mono">{day.itemsScanned} scans</p>
                    <p className="text-green">{day.buyCount} BUY</p>
                    <p className="text-red">{day.passCount} PASS</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-t3 font-medium">
          <span>{dailyMetrics[0]?.date}</span>
          <span>{dailyMetrics[dailyMetrics.length - 1]?.date}</span>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-bold text-t1 uppercase tracking-wide mb-3">BUY Rate Trend</h3>
        <div className="h-20 relative">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${dailyMetrics.length} 100`}>
            <defs>
              <linearGradient id="buyRateGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="oklch(0.52 0.20 145)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="oklch(0.52 0.20 145)" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            <path
              d={dailyMetrics.map((day, idx) => {
                const x = idx
                const y = 100 - (day.buyRate || 0)
                return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
              }).join(' ')}
              fill="none"
              stroke="oklch(0.52 0.20 145)"
              strokeWidth="2"
              className="transition-all duration-300"
            />

            <path
              d={[
                ...dailyMetrics.map((day, idx) => {
                  const x = idx
                  const y = 100 - (day.buyRate || 0)
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                }),
                `L ${dailyMetrics.length - 1} 100`,
                'L 0 100',
                'Z'
              ].join(' ')}
              fill="url(#buyRateGradient)"
              className="transition-all duration-300"
            />
          </svg>
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-t3 font-medium">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </Card>

      <Card className="p-4 bg-gradient-to-br from-s1 to-bg border-s2">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={18} weight="bold" className="text-b1" />
          <h3 className="text-sm font-bold text-t1 uppercase tracking-wide">Period Comparison</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-t3">Current Period</span>
            <span className="text-sm font-bold mono text-t1">${profitTrend.current.toFixed(2)}/day</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-t3">Previous Period</span>
            <span className="text-sm font-bold mono text-t3">${profitTrend.previous.toFixed(2)}/day</span>
          </div>
          <div className="h-px bg-s2" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-t1">Change</span>
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-sm font-bold mono',
                profitTrend.trend === 'up' ? 'text-green' : profitTrend.trend === 'down' ? 'text-red' : 'text-t3'
              )}>
                {profitTrend.change >= 0 ? '+' : ''}${profitTrend.change.toFixed(2)}
              </span>
              <TrendIndicator trend={profitTrend} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-b1/10 flex items-center justify-center">
            <TrendUp size={16} weight="bold" className="text-b1" />
          </div>
          <h3 className="text-sm font-bold text-t1 uppercase tracking-wide">Growth Metrics</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-s1 rounded-lg">
            <p className="text-[10px] uppercase tracking-wide text-t3 mb-1">Profit Growth</p>
            <p className={cn('text-lg font-bold mono', profitTrend.trend === 'up' ? 'text-green' : profitTrend.trend === 'down' ? 'text-red' : 'text-t3')}>
              {profitTrend.changePercent >= 0 ? '+' : ''}{profitTrend.changePercent.toFixed(1)}%
            </p>
            <p className="text-[9px] text-t4 mt-0.5">vs previous period</p>
          </div>
          <div className="p-3 bg-s1 rounded-lg">
            <p className="text-[10px] uppercase tracking-wide text-t3 mb-1">Volume Growth</p>
            <p className={cn('text-lg font-bold mono', volumeTrend.trend === 'up' ? 'text-green' : volumeTrend.trend === 'down' ? 'text-red' : 'text-t3')}>
              {volumeTrend.changePercent >= 0 ? '+' : ''}{volumeTrend.changePercent.toFixed(1)}%
            </p>
            <p className="text-[9px] text-t4 mt-0.5">scans per day</p>
          </div>
          <div className="p-3 bg-s1 rounded-lg">
            <p className="text-[10px] uppercase tracking-wide text-t3 mb-1">BUY Rate Change</p>
            <p className={cn('text-lg font-bold mono', buyRateTrend.trend === 'up' ? 'text-green' : buyRateTrend.trend === 'down' ? 'text-red' : 'text-t3')}>
              {buyRateTrend.changePercent >= 0 ? '+' : ''}{buyRateTrend.changePercent.toFixed(1)}%
            </p>
            <p className="text-[9px] text-t4 mt-0.5">success rate change</p>
          </div>
          <div className="p-3 bg-s1 rounded-lg">
            <p className="text-[10px] uppercase tracking-wide text-t3 mb-1">Avg Profit/Item</p>
            <p className={cn('text-lg font-bold mono', avgProfitTrend.trend === 'up' ? 'text-green' : avgProfitTrend.trend === 'down' ? 'text-red' : 'text-t3')}>
              {avgProfitTrend.changePercent >= 0 ? '+' : ''}{avgProfitTrend.changePercent.toFixed(1)}%
            </p>
            <p className="text-[9px] text-t4 mt-0.5">per item growth</p>
          </div>
        </div>
      </Card>

      {/* Recent Sessions — sourced from archives (survives item deletion). */}
      {archives.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
              <Calendar size={16} weight="bold" className="text-amber" />
            </div>
            <h3 className="text-sm font-bold text-t1 uppercase tracking-wide">Recent Sessions</h3>
          </div>
          <div className="space-y-2">
            {[...archives].sort((a, b) => b.startTime - a.startTime).slice(0, 5).map(archive => {
              const duration = archive.endTime
                ? archive.endTime - archive.startTime
                : Date.now() - archive.startTime
              const profitPerHour = (archive.estimatedProfit / Math.max(duration / 3600000, 0.01)).toFixed(2)

              return (
                <div key={archive.sessionId} className="p-3 bg-s1 rounded-lg hover:bg-s2 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn(
                        'text-[9px] uppercase px-2 py-0.5',
                        !archive.endTime ? 'bg-green text-white' : ''
                      )}>
                        {!archive.endTime ? 'Active' : 'Ended'}
                      </Badge>
                      <span className="text-[10px] text-t3">
                        {new Date(archive.startTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span className="text-sm font-bold mono text-green">
                      ${archive.estimatedProfit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-3 text-t3">
                      <span>{archive.itemsScanned} scans</span>
                      <span className="text-green">{archive.buyCount} BUY</span>
                      <span className="text-red">{archive.passCount} PASS</span>
                    </div>
                    <span className="text-t4 mono">${profitPerHour}/hr</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
