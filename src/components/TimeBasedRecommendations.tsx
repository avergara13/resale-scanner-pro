import { Lightbulb, TrendUp, Clock, MapPin, Sparkle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useMemo } from 'react'
import type { Session, ScannedItem } from '@/types'

interface TimeBasedRecommendationsProps {
  sessions: Session[]
  items: ScannedItem[]
}

interface Recommendation {
  id: string
  type: 'time' | 'category' | 'location' | 'strategy'
  title: string
  description: string
  confidence: 'high' | 'medium' | 'low'
  icon: typeof Lightbulb
  color: string
}

export function TimeBasedRecommendations({ sessions, items }: TimeBasedRecommendationsProps) {
  const recommendations = useMemo(() => {
    const recs: Recommendation[] = []
    const now = new Date()
    const currentHour = now.getHours()
    const currentDay = now.getDay()
    
    const completedSessions = sessions.filter(s => !s.active && s.endTime)
    
    if (completedSessions.length === 0) {
      recs.push({
        id: 'first-session',
        type: 'strategy',
        title: 'Start Your First Session',
        description: 'Begin tracking your scans to unlock personalized insights and recommendations based on your performance patterns.',
        confidence: 'high',
        icon: Sparkle,
        color: 'text-b1'
      })
      return recs
    }

    const timeOfDayData = completedSessions.reduce((acc, session) => {
      const sessionDate = new Date(session.startTime)
      const hour = sessionDate.getHours()
      let timeSlot: 'morning' | 'afternoon' | 'evening' = 'morning'
      
      if (hour >= 5 && hour < 12) timeSlot = 'morning'
      else if (hour >= 12 && hour < 17) timeSlot = 'afternoon'
      else timeSlot = 'evening'
      
      if (!acc[timeSlot]) {
        acc[timeSlot] = { count: 0, totalProfit: 0, totalScans: 0, buyRate: 0 }
      }

      acc[timeSlot].count++
      acc[timeSlot].totalProfit += session.totalPotentialProfit
      acc[timeSlot].totalScans += session.itemsScanned
      acc[timeSlot].buyRate += session.itemsScanned > 0 ? (session.buyCount / session.itemsScanned) : 0

      return acc
    }, {} as Record<string, { count: number; totalProfit: number; totalScans: number; buyRate: number }>)

    Object.keys(timeOfDayData).forEach(slot => {
      const data = timeOfDayData[slot]
      data.buyRate = data.buyRate / data.count
    })

    const bestTimeSlot = Object.entries(timeOfDayData).reduce((best, [slot, data]) => {
      if (!best || data.totalProfit > best.data.totalProfit) {
        return { slot, data }
      }
      return best
    }, null as { slot: string; data: typeof timeOfDayData[string] } | null)

    if (bestTimeSlot) {
      let currentTimeSlot: 'morning' | 'afternoon' | 'evening' = 'morning'
      if (currentHour >= 5 && currentHour < 12) currentTimeSlot = 'morning'
      else if (currentHour >= 12 && currentHour < 17) currentTimeSlot = 'afternoon'
      else currentTimeSlot = 'evening'

      if (currentTimeSlot === bestTimeSlot.slot) {
        recs.push({
          id: 'peak-time',
          type: 'time',
          title: `Prime Time for Scanning`,
          description: `Your ${bestTimeSlot.slot} sessions average $${(bestTimeSlot.data.totalProfit / bestTimeSlot.data.count).toFixed(2)} profit with a ${(bestTimeSlot.data.buyRate * 100).toFixed(0)}% BUY rate. Great time to be scanning!`,
          confidence: 'high',
          icon: TrendUp,
          color: 'text-green'
        })
      }
    }

    const dayOfWeekData = completedSessions.reduce((acc, session) => {
      const sessionDate = new Date(session.startTime)
      const day = sessionDate.getDay()
      
      if (!acc[day]) {
        acc[day] = { count: 0, totalProfit: 0, totalScans: 0 }
      }
      
      acc[day].count++
      acc[day].totalProfit += session.totalPotentialProfit
      acc[day].totalScans += session.itemsScanned
      
      return acc
    }, {} as Record<number, { count: number; totalProfit: number; totalScans: number }>)

    const bestDay = Object.entries(dayOfWeekData).reduce((best, [day, data]) => {
      if (!best || data.totalProfit > best.data.totalProfit) {
        return { day: parseInt(day), data }
      }
      return best
    }, null as { day: number; data: typeof dayOfWeekData[number] } | null)

    if (bestDay && bestDay.day === currentDay && bestDay.data.count >= 2) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      recs.push({
        id: 'best-day',
        type: 'time',
        title: `${dayNames[bestDay.day]} Success Pattern`,
        description: `Your ${dayNames[bestDay.day]} sessions typically yield $${(bestDay.data.totalProfit / bestDay.data.count).toFixed(2)} in profit. Today could be productive!`,
        confidence: 'medium',
        icon: Clock,
        color: 'text-amber'
      })
    }

    const categoryData = items.reduce((acc, item) => {
      if (item.decision !== 'BUY' || !item.category) return acc
      
      const cat = item.category
      if (!acc[cat]) {
        acc[cat] = { count: 0, totalProfit: 0, avgMargin: 0 }
      }
      
      acc[cat].count++
      acc[cat].totalProfit += (item.estimatedSellPrice || 0) - item.purchasePrice
      acc[cat].avgMargin += item.profitMargin || 0
      
      return acc
    }, {} as Record<string, { count: number; totalProfit: number; avgMargin: number }>)

    Object.keys(categoryData).forEach(cat => {
      const data = categoryData[cat]
      data.avgMargin = data.avgMargin / data.count
    })

    const topCategory = Object.entries(categoryData).reduce((best, [cat, data]) => {
      if (!best || data.count > best.data.count) {
        return { cat, data }
      }
      return best
    }, null as { cat: string; data: typeof categoryData[string] } | null)

    if (topCategory && topCategory.data.count >= 3) {
      recs.push({
        id: 'top-category',
        type: 'category',
        title: `Focus on ${topCategory.cat}`,
        description: `You've had ${topCategory.data.count} successful ${topCategory.cat} items with ${topCategory.data.avgMargin.toFixed(0)}% avg margin. Keep an eye out for similar finds!`,
        confidence: 'high',
        icon: Lightbulb,
        color: 'text-b1'
      })
    }

    const recentSessions = completedSessions.slice(-5)
    const recentAvgProfit = recentSessions.reduce((sum, s) => sum + s.totalPotentialProfit, 0) / recentSessions.length
    const recentAvgScans = recentSessions.reduce((sum, s) => sum + s.itemsScanned, 0) / recentSessions.length
    
    if (recentSessions.length >= 3) {
      recs.push({
        id: 'recent-performance',
        type: 'strategy',
        title: 'Recent Session Benchmark',
        description: `Your last ${recentSessions.length} sessions averaged ${recentAvgScans.toFixed(0)} scans and $${recentAvgProfit.toFixed(2)} profit. Aim to match or beat this today!`,
        confidence: 'medium',
        icon: TrendUp,
        color: 'text-green'
      })
    }

    const weekendSessions = completedSessions.filter(s => {
      const day = new Date(s.startTime).getDay()
      return day === 0 || day === 6
    })
    const weekdaySessions = completedSessions.filter(s => {
      const day = new Date(s.startTime).getDay()
      return day > 0 && day < 6
    })

    if (weekendSessions.length >= 2 && weekdaySessions.length >= 2) {
      const weekendAvg = weekendSessions.reduce((sum, s) => sum + s.totalPotentialProfit, 0) / weekendSessions.length
      const weekdayAvg = weekdaySessions.reduce((sum, s) => sum + s.totalPotentialProfit, 0) / weekdaySessions.length
      
      const isWeekend = currentDay === 0 || currentDay === 6
      
      if (isWeekend && weekendAvg > weekdayAvg * 1.2) {
        recs.push({
          id: 'weekend-boost',
          type: 'time',
          title: 'Weekend Advantage',
          description: `Your weekend sessions average ${((weekendAvg / weekdayAvg - 1) * 100).toFixed(0)}% more profit than weekdays. Make the most of today!`,
          confidence: 'high',
          icon: Sparkle,
          color: 'text-amber'
        })
      }
    }

    if (recs.length === 0) {
      recs.push({
        id: 'general-tip',
        type: 'strategy',
        title: 'Optimize Your Session',
        description: 'Complete more scans to unlock personalized time-based insights and performance recommendations.',
        confidence: 'low',
        icon: Lightbulb,
        color: 'text-t3'
      })
    }

    return recs.slice(0, 3)
  }, [sessions, items])

  if (recommendations.length === 0) return null

  const confidenceColors = {
    high: 'bg-green/10 text-green border-green/20',
    medium: 'bg-amber/10 text-amber border-amber/20',
    low: 'bg-s2 text-t3 border-s2'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkle size={16} weight="fill" className="text-b1" />
        <h3 className="text-xs font-bold text-t2 uppercase tracking-wider">Smart Recommendations</h3>
      </div>
      
      {recommendations.map((rec) => {
        const Icon = rec.icon
        return (
          <Card 
            key={rec.id} 
            className="p-4 border-l-4 transition-all hover:shadow-md"
            style={{ borderLeftColor: `var(--${rec.color.replace('text-', '')})` }}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${rec.color.replace('text-', '')}/10 flex-shrink-0`}>
                <Icon size={20} weight="fill" className={rec.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-sm font-bold text-t1 leading-tight">{rec.title}</h4>
                  <Badge 
                    variant="outline" 
                    className={`text-[9px] px-2 py-0.5 uppercase font-bold ${confidenceColors[rec.confidence]}`}
                  >
                    {rec.confidence}
                  </Badge>
                </div>
                <p className="text-xs text-t2 leading-relaxed">{rec.description}</p>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
