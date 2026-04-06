import { useState, useMemo } from 'react'
import { Trophy, TrendUp, TrendDown, Calendar, Target, CheckCircle, XCircle, ChartBar, Sparkle, CalendarBlank } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ProfitGoal, ScannedItem } from '@/types'

interface GoalAchievementTrackerProps {
  goals: ProfitGoal[]
  items: ScannedItem[]
}

interface GoalPeriodStats {
  period: string
  startDate: number
  endDate: number
  totalGoals: number
  achievedGoals: number
  achievementRate: number
  totalTarget: number
  totalAchieved: number
  averageCompletion: number
  bestGoal?: ProfitGoal & { completion: number }
}

type TimeRange = '7d' | '30d' | '90d' | 'all'

export function GoalAchievementTracker({ goals, items }: GoalAchievementTrackerProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')

  const calculateGoalCompletion = (goal: ProfitGoal): number => {
    const relevantItems = items.filter(item => 
      item.timestamp >= goal.startDate && 
      item.timestamp <= goal.endDate &&
      item.decision === 'BUY' &&
      item.profitMargin !== undefined
    )

    const actualProfit = relevantItems.reduce((sum, item) => {
      const profit = ((item.estimatedSellPrice || 0) - item.purchasePrice) || 0
      return sum + profit
    }, 0)

    return (actualProfit / goal.targetAmount) * 100
  }

  const getTimeRangeMs = (range: TimeRange): number => {
    const now = Date.now()
    switch (range) {
      case '7d': return 7 * 24 * 60 * 60 * 1000
      case '30d': return 30 * 24 * 60 * 60 * 1000
      case '90d': return 90 * 24 * 60 * 60 * 1000
      case 'all': return now
    }
  }

  const filteredGoals = useMemo(() => {
    const cutoffTime = Date.now() - getTimeRangeMs(timeRange)
    return goals.filter(goal => goal.endDate >= cutoffTime)
  }, [goals, timeRange])

  const periodStats = useMemo(() => {
    const stats: GoalPeriodStats[] = []
    const groupedGoals = new Map<string, ProfitGoal[]>()

    filteredGoals.forEach(goal => {
      const periodKey = getPeriodKey(goal.type, goal.startDate)
      const existing = groupedGoals.get(periodKey) || []
      groupedGoals.set(periodKey, [...existing, goal])
    })

    groupedGoals.forEach((periodGoals, periodKey) => {
      const completions = periodGoals.map(goal => ({
        goal,
        completion: calculateGoalCompletion(goal)
      }))

      const achievedGoals = completions.filter(c => c.completion >= 100).length
      const totalGoals = periodGoals.length
      const achievementRate = totalGoals > 0 ? (achievedGoals / totalGoals) * 100 : 0

      const totalTarget = periodGoals.reduce((sum, g) => sum + g.targetAmount, 0)
      const totalAchieved = completions.reduce((sum, c) => {
        const relevantItems = items.filter(item => 
          item.timestamp >= c.goal.startDate && 
          item.timestamp <= c.goal.endDate &&
          item.decision === 'BUY'
        )
        const profit = relevantItems.reduce((pSum, item) => 
          pSum + ((item.estimatedSellPrice || 0) - item.purchasePrice), 0
        )
        return sum + profit
      }, 0)

      const averageCompletion = completions.reduce((sum, c) => sum + c.completion, 0) / totalGoals
      const bestGoal = completions.sort((a, b) => b.completion - a.completion)[0]

      const firstGoal = periodGoals[0]
      stats.push({
        period: periodKey,
        startDate: firstGoal.startDate,
        endDate: firstGoal.endDate,
        totalGoals,
        achievedGoals,
        achievementRate,
        totalTarget,
        totalAchieved,
        averageCompletion,
        bestGoal: bestGoal ? { ...bestGoal.goal, completion: bestGoal.completion } : undefined
      })
    })

    return stats.sort((a, b) => b.startDate - a.startDate)
  }, [filteredGoals, items])

  const overallStats = useMemo(() => {
    const completions = filteredGoals.map(goal => calculateGoalCompletion(goal))
    const achieved = completions.filter(c => c >= 100).length
    const total = filteredGoals.length

    return {
      totalGoals: total,
      achievedGoals: achieved,
      failedGoals: total - achieved,
      achievementRate: total > 0 ? (achieved / total) * 100 : 0,
      averageCompletion: total > 0 ? completions.reduce((sum, c) => sum + c, 0) / total : 0,
      bestPeriod: periodStats.length > 0 
        ? periodStats.reduce((best, current) => 
            current.achievementRate > best.achievementRate ? current : best
          )
        : null,
      worstPeriod: periodStats.length > 0 
        ? periodStats.reduce((worst, current) => 
            current.achievementRate < worst.achievementRate ? current : worst
          )
        : null,
    }
  }, [filteredGoals, periodStats])

  const successfulPeriods = periodStats.filter(p => p.achievementRate >= 80)
  const strugglingPeriods = periodStats.filter(p => p.achievementRate < 50 && p.totalGoals >= 2)

  function getPeriodKey(type: string, startDate: number): string {
    const date = new Date(startDate)
    switch (type) {
      case 'daily':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      case 'weekly':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        return `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      case 'monthly':
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      default:
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  if (filteredGoals.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Target size={48} weight="light" className="mx-auto mb-3 text-s3" />
        <h4 className="font-bold text-t1 mb-1">No Goal History</h4>
        <p className="text-sm text-t3">Create and complete goals to track achievement rates over time</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChartBar size={24} weight="bold" className="text-b1" />
          <h3 className="text-lg font-bold text-t1">Goal Achievement</h3>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v: TimeRange) => setTimeRange(v)}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'summary' ? 'detailed' : 'summary')}
            className="h-9"
          >
            {viewMode === 'summary' ? 'Details' : 'Summary'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={16} weight="fill" className="text-green" />
            <p className="text-[10px] text-t3 uppercase font-bold">Success Rate</p>
          </div>
          <p className="text-2xl font-bold text-t1 mono">
            {Math.round(overallStats.achievementRate)}%
          </p>
          <p className="text-xs text-t4 mt-1">
            {overallStats.achievedGoals} of {overallStats.totalGoals} achieved
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} weight="bold" className="text-b1" />
            <p className="text-[10px] text-t3 uppercase font-bold">Avg Completion</p>
          </div>
          <p className="text-2xl font-bold text-t1 mono">
            {Math.round(overallStats.averageCompletion)}%
          </p>
          <p className="text-xs text-t4 mt-1">
            Across all goals
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkle size={16} weight="fill" className="text-amber" />
            <p className="text-[10px] text-t3 uppercase font-bold">Best Period</p>
          </div>
          <p className="text-xl font-bold text-t1">
            {overallStats.bestPeriod ? `${Math.round(overallStats.bestPeriod.achievementRate)}%` : '-'}
          </p>
          <p className="text-xs text-t4 mt-1 truncate">
            {overallStats.bestPeriod?.period || 'N/A'}
          </p>
        </Card>
      </div>

      {successfulPeriods.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendUp size={18} weight="bold" className="text-green" />
            <h4 className="text-sm font-bold text-t1">High-Performance Periods</h4>
            <Badge variant="secondary" className="bg-green/10 text-green text-xs">
              {successfulPeriods.length}
            </Badge>
          </div>
          
          <div className="space-y-2">
            {successfulPeriods.slice(0, viewMode === 'detailed' ? undefined : 3).map((period, index) => (
              <Card key={period.period} className={cn(
                "p-4 border-green/30 bg-green-bg transition-all hover:border-green/50",
                index === 0 && "border-2"
              )}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <Trophy size={20} weight="fill" className="text-green" />
                    )}
                    <div>
                      <h5 className="font-bold text-sm text-t1">{period.period}</h5>
                      <p className="text-xs text-t3">
                        {period.achievedGoals} of {period.totalGoals} goals achieved
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green text-white font-bold">
                    {Math.round(period.achievementRate)}%
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Progress value={period.achievementRate} className="h-2 [&>div]:bg-green" />
                  
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-s2">
                    <div>
                      <p className="text-[9px] text-t4 uppercase font-bold mb-0.5">Target</p>
                      <p className="text-xs font-bold mono text-t1">{formatCurrency(period.totalTarget)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-t4 uppercase font-bold mb-0.5">Achieved</p>
                      <p className="text-xs font-bold mono text-green">{formatCurrency(period.totalAchieved)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-t4 uppercase font-bold mb-0.5">Avg Complete</p>
                      <p className="text-xs font-bold mono text-t1">{Math.round(period.averageCompletion)}%</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {strugglingPeriods.length > 0 && viewMode === 'detailed' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendDown size={18} weight="bold" className="text-amber" />
            <h4 className="text-sm font-bold text-t1">Areas for Improvement</h4>
            <Badge variant="secondary" className="bg-amber/10 text-amber text-xs">
              {strugglingPeriods.length}
            </Badge>
          </div>
          
          <div className="space-y-2">
            {strugglingPeriods.slice(0, 3).map((period) => (
              <Card key={period.period} className="p-4 border-amber/30 bg-amber/5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h5 className="font-bold text-sm text-t1">{period.period}</h5>
                    <p className="text-xs text-t3">
                      {period.achievedGoals} of {period.totalGoals} goals achieved
                    </p>
                  </div>
                  <Badge variant="outline" className="border-amber text-amber font-bold">
                    {Math.round(period.achievementRate)}%
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Progress value={period.achievementRate} className="h-2 [&>div]:bg-amber" />
                  
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-s2">
                    <div>
                      <p className="text-[9px] text-t4 uppercase font-bold mb-0.5">Shortfall</p>
                      <p className="text-xs font-bold mono text-amber">
                        {formatCurrency(period.totalTarget - period.totalAchieved)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-t4 uppercase font-bold mb-0.5">Avg Complete</p>
                      <p className="text-xs font-bold mono text-t1">{Math.round(period.averageCompletion)}%</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'detailed' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CalendarBlank size={18} weight="bold" className="text-t3" />
            <h4 className="text-sm font-bold text-t1">All Periods</h4>
          </div>
          
          <div className="space-y-2">
            {periodStats.map((period) => {
              const isSuccess = period.achievementRate >= 80
              const isStruggling = period.achievementRate < 50

              return (
                <Card key={period.period} className={cn(
                  "p-3",
                  isSuccess && "border-green/20 bg-green-bg/30",
                  isStruggling && "border-amber/20 bg-amber/5"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {isSuccess ? (
                        <CheckCircle size={18} weight="fill" className="text-green" />
                      ) : isStruggling ? (
                        <XCircle size={18} weight="fill" className="text-amber" />
                      ) : (
                        <Target size={18} weight="bold" className="text-t3" />
                      )}
                      <div className="flex-1">
                        <p className="text-xs font-bold text-t1">{period.period}</p>
                        <p className="text-[10px] text-t4">
                          {period.achievedGoals}/{period.totalGoals} achieved • {formatCurrency(period.totalAchieved)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-bold mono",
                        isSuccess && "text-green",
                        isStruggling && "text-amber",
                        !isSuccess && !isStruggling && "text-t1"
                      )}>
                        {Math.round(period.achievementRate)}%
                      </p>
                      <Progress 
                        value={period.achievementRate} 
                        className={cn(
                          "h-1 w-16 mt-1",
                          isSuccess && "[&>div]:bg-green",
                          isStruggling && "[&>div]:bg-amber"
                        )} 
                      />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {overallStats.achievementRate < 50 && filteredGoals.length >= 3 && (
        <Card className="p-4 border-amber/30 bg-amber/5">
          <div className="flex items-start gap-3">
            <Sparkle size={20} weight="fill" className="text-amber mt-0.5" />
            <div className="flex-1">
              <h5 className="text-sm font-bold text-t1 mb-1">Improvement Opportunity</h5>
              <p className="text-xs text-t2 leading-relaxed">
                Your achievement rate is currently at {Math.round(overallStats.achievementRate)}%. 
                Consider setting more realistic targets or increasing your scanning frequency to improve your success rate.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
