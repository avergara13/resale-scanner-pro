import type { Session, ScannedItem } from '@/types'

export interface TimePattern {
  dayOfWeek: number
  hourOfDay: number
  successRate: number
  avgProfit: number
  itemCount: number
}

export interface CategoryPattern {
  category: string
  successRate: number
  avgProfit: number
  avgMargin: number
  itemCount: number
  bestDays: number[]
  bestHours: number[]
}

export interface PriceRangePattern {
  minPrice: number
  maxPrice: number
  successRate: number
  avgProfit: number
  avgROI: number
  itemCount: number
}

export interface Recommendation {
  id: string
  type: 'time' | 'category' | 'priceRange' | 'strategy' | 'goal'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  reasoning: string
  confidence: number
  potentialImpact: string
  actionItems: string[]
  relatedData?: any
  createdAt: number
}

export interface PatternAnalysis {
  bestTimes: TimePattern[]
  bestCategories: CategoryPattern[]
  optimalPriceRanges: PriceRangePattern[]
  recommendations: Recommendation[]
  insights: {
    mostProfitableDay: string
    mostProfitableHour: string
    bestCategory: string
    optimalPriceRange: string
    avgSuccessRate: number
    totalPatterns: number
  }
}

export const createPatternRecommendationService = () => {
  const analyzeSessions = (
    sessions: Session[],
    items: ScannedItem[]
  ): PatternAnalysis => {
    const completedSessions = sessions.filter(s => !s.active && s.endTime)
    
    if (completedSessions.length < 3) {
      return {
        bestTimes: [],
        bestCategories: [],
        optimalPriceRanges: [],
        recommendations: [{
          id: 'need-more-data',
          type: 'strategy',
          priority: 'medium',
          title: 'Build Your Pattern History',
          description: 'Complete more scanning sessions to unlock personalized recommendations',
          reasoning: 'Pattern analysis requires at least 3 completed sessions with meaningful data',
          confidence: 100,
          potentialImpact: 'Unlock AI-powered insights',
          actionItems: [
            'Complete at least 3 scanning sessions',
            'Scan at different times of day',
            'Try different product categories',
            'Track outcomes consistently'
          ],
          createdAt: Date.now()
        }],
        insights: {
          mostProfitableDay: 'Unknown',
          mostProfitableHour: 'Unknown',
          bestCategory: 'Unknown',
          optimalPriceRange: 'Unknown',
          avgSuccessRate: 0,
          totalPatterns: 0
        }
      }
    }

    const timePatterns = analyzeTimePatterns(completedSessions, items)
    const categoryPatterns = analyzeCategoryPatterns(items)
    const priceRangePatterns = analyzePriceRanges(items)
    const recommendations = generateRecommendations(
      timePatterns,
      categoryPatterns,
      priceRangePatterns,
      completedSessions,
      items
    )

    const bestTime = timePatterns.sort((a, b) => b.avgProfit - a.avgProfit)[0]
    const bestCategory = categoryPatterns.sort((a, b) => b.avgProfit - a.avgProfit)[0]
    const bestPriceRange = priceRangePatterns.sort((a, b) => b.avgROI - a.avgROI)[0]

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const goItems = items.filter(i => i.decision === 'GO')
    const avgSuccessRate = items.length > 0 ? (goItems.length / items.length) * 100 : 0

    return {
      bestTimes: timePatterns.sort((a, b) => b.avgProfit - a.avgProfit).slice(0, 5),
      bestCategories: categoryPatterns.sort((a, b) => b.avgProfit - a.avgProfit).slice(0, 5),
      optimalPriceRanges: priceRangePatterns.sort((a, b) => b.avgROI - a.avgROI).slice(0, 3),
      recommendations: recommendations.slice(0, 10),
      insights: {
        mostProfitableDay: bestTime ? days[bestTime.dayOfWeek] : 'Unknown',
        mostProfitableHour: bestTime ? formatHour(bestTime.hourOfDay) : 'Unknown',
        bestCategory: bestCategory?.category || 'Unknown',
        optimalPriceRange: bestPriceRange 
          ? `$${bestPriceRange.minPrice}-$${bestPriceRange.maxPrice}` 
          : 'Unknown',
        avgSuccessRate: Math.round(avgSuccessRate),
        totalPatterns: timePatterns.length + categoryPatterns.length + priceRangePatterns.length
      }
    }
  }

  const analyzeTimePatterns = (sessions: Session[], items: ScannedItem[]): TimePattern[] => {
    const patterns = new Map<string, {
      items: ScannedItem[]
      goCount: number
      totalProfit: number
    }>()

    items.forEach(item => {
      const date = new Date(item.timestamp)
      const dayOfWeek = date.getDay()
      const hourOfDay = date.getHours()
      const key = `${dayOfWeek}-${hourOfDay}`

      if (!patterns.has(key)) {
        patterns.set(key, { items: [], goCount: 0, totalProfit: 0 })
      }

      const pattern = patterns.get(key)!
      pattern.items.push(item)
      if (item.decision === 'GO') {
        pattern.goCount++
        pattern.totalProfit += (item.estimatedSellPrice || 0) - item.purchasePrice
      }
    })

    return Array.from(patterns.entries())
      .filter(([_, data]) => data.items.length >= 3)
      .map(([key, data]) => {
        const [dayOfWeek, hourOfDay] = key.split('-').map(Number)
        return {
          dayOfWeek,
          hourOfDay,
          successRate: (data.goCount / data.items.length) * 100,
          avgProfit: data.totalProfit / data.items.length,
          itemCount: data.items.length
        }
      })
  }

  const analyzeCategoryPatterns = (items: ScannedItem[]): CategoryPattern[] => {
    const categoryMap = new Map<string, ScannedItem[]>()

    items.forEach(item => {
      const category = item.category || 'Uncategorized'
      if (!categoryMap.has(category)) {
        categoryMap.set(category, [])
      }
      categoryMap.get(category)!.push(item)
    })

    return Array.from(categoryMap.entries())
      .filter(([_, items]) => items.length >= 2)
      .map(([category, categoryItems]) => {
        const goItems = categoryItems.filter(i => i.decision === 'GO')
        const totalProfit = goItems.reduce((sum, i) => 
          sum + ((i.estimatedSellPrice || 0) - i.purchasePrice), 0
        )
        const totalMargin = goItems.reduce((sum, i) => sum + (i.profitMargin || 0), 0)

        const dayMap = new Map<number, number>()
        const hourMap = new Map<number, number>()

        categoryItems.forEach(item => {
          const date = new Date(item.timestamp)
          const day = date.getDay()
          const hour = date.getHours()
          dayMap.set(day, (dayMap.get(day) || 0) + 1)
          hourMap.set(hour, (hourMap.get(hour) || 0) + 1)
        })

        const bestDays = Array.from(dayMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([day]) => day)

        const bestHours = Array.from(hourMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([hour]) => hour)

        return {
          category,
          successRate: (goItems.length / categoryItems.length) * 100,
          avgProfit: totalProfit / categoryItems.length,
          avgMargin: goItems.length > 0 ? totalMargin / goItems.length : 0,
          itemCount: categoryItems.length,
          bestDays,
          bestHours
        }
      })
  }

  const analyzePriceRanges = (items: ScannedItem[]): PriceRangePattern[] => {
    const ranges = [
      { min: 0, max: 5 },
      { min: 5, max: 10 },
      { min: 10, max: 20 },
      { min: 20, max: 50 },
      { min: 50, max: 100 },
      { min: 100, max: Infinity }
    ]

    return ranges
      .map(range => {
        const rangeItems = items.filter(
          i => i.purchasePrice >= range.min && i.purchasePrice < range.max
        )

        if (rangeItems.length < 2) return null

        const goItems = rangeItems.filter(i => i.decision === 'GO')
        const totalProfit = goItems.reduce((sum, i) => 
          sum + ((i.estimatedSellPrice || 0) - i.purchasePrice), 0
        )
        const totalROI = goItems.reduce((sum, i) => {
          const profit = (i.estimatedSellPrice || 0) - i.purchasePrice
          return sum + ((profit / i.purchasePrice) * 100)
        }, 0)

        return {
          minPrice: range.min,
          maxPrice: range.max === Infinity ? 999 : range.max,
          successRate: (goItems.length / rangeItems.length) * 100,
          avgProfit: totalProfit / rangeItems.length,
          avgROI: goItems.length > 0 ? totalROI / goItems.length : 0,
          itemCount: rangeItems.length
        }
      })
      .filter((r): r is PriceRangePattern => r !== null)
  }

  const generateRecommendations = (
    timePatterns: TimePattern[],
    categoryPatterns: CategoryPattern[],
    priceRangePatterns: PriceRangePattern[],
    sessions: Session[],
    items: ScannedItem[]
  ): Recommendation[] => {
    const recommendations: Recommendation[] = []

    if (timePatterns.length > 0) {
      const bestTime = timePatterns[0]
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      
      recommendations.push({
        id: `time-${Date.now()}`,
        type: 'time',
        priority: bestTime.successRate > 70 ? 'high' : 'medium',
        title: `Scan on ${days[bestTime.dayOfWeek]}s around ${formatHour(bestTime.hourOfDay)}`,
        description: `Your highest success rate (${bestTime.successRate.toFixed(1)}%) occurs at this time`,
        reasoning: `Based on ${bestTime.itemCount} items scanned during this period, you've achieved an average profit of $${bestTime.avgProfit.toFixed(2)} per item`,
        confidence: Math.min(95, 50 + (bestTime.itemCount * 5)),
        potentialImpact: `+$${(bestTime.avgProfit * 10).toFixed(2)} per 10 items`,
        actionItems: [
          `Schedule scanning sessions for ${days[bestTime.dayOfWeek]}s`,
          `Focus on ${formatHour(bestTime.hourOfDay)} time slot`,
          'Track results to refine this pattern'
        ],
        relatedData: bestTime,
        createdAt: Date.now()
      })
    }

    if (categoryPatterns.length > 0) {
      const bestCategory = categoryPatterns[0]
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      
      recommendations.push({
        id: `category-${Date.now()}`,
        type: 'category',
        priority: bestCategory.successRate > 75 ? 'high' : 'medium',
        title: `Focus on ${bestCategory.category} items`,
        description: `This category has your best performance: ${bestCategory.successRate.toFixed(1)}% success rate`,
        reasoning: `Average profit of $${bestCategory.avgProfit.toFixed(2)} with ${bestCategory.avgMargin.toFixed(1)}% margin across ${bestCategory.itemCount} items`,
        confidence: Math.min(90, 40 + (bestCategory.itemCount * 8)),
        potentialImpact: `Consistent $${bestCategory.avgProfit.toFixed(2)} avg profit`,
        actionItems: [
          `Prioritize ${bestCategory.category} when shopping`,
          bestCategory.bestDays.length > 0 
            ? `Best on ${bestCategory.bestDays.map(d => days[d]).join(', ')}` 
            : 'Scan consistently',
          'Build expertise in this category'
        ],
        relatedData: bestCategory,
        createdAt: Date.now()
      })
    }

    if (priceRangePatterns.length > 0) {
      const bestRange = priceRangePatterns[0]
      
      recommendations.push({
        id: `price-${Date.now()}`,
        type: 'priceRange',
        priority: bestRange.avgROI > 200 ? 'high' : 'medium',
        title: `Target items priced $${bestRange.minPrice}-$${bestRange.maxPrice}`,
        description: `This price range delivers ${bestRange.avgROI.toFixed(0)}% average ROI`,
        reasoning: `${bestRange.successRate.toFixed(1)}% success rate with $${bestRange.avgProfit.toFixed(2)} average profit per item`,
        confidence: Math.min(85, 35 + (bestRange.itemCount * 7)),
        potentialImpact: `${bestRange.avgROI.toFixed(0)}% ROI potential`,
        actionItems: [
          `Look for items in the $${bestRange.minPrice}-$${bestRange.maxPrice} range`,
          'Avoid items significantly outside this range',
          'Adjust strategy based on results'
        ],
        relatedData: bestRange,
        createdAt: Date.now()
      })
    }

    const recentSessions = sessions.slice(-5)
    const avgSessionProfit = recentSessions.reduce((sum, s) => sum + s.totalPotentialProfit, 0) / recentSessions.length
    const avgItemsPerSession = recentSessions.reduce((sum, s) => sum + s.itemsScanned, 0) / recentSessions.length

    if (avgSessionProfit > 50 && avgItemsPerSession > 5) {
      recommendations.push({
        id: `strategy-momentum-${Date.now()}`,
        type: 'strategy',
        priority: 'high',
        title: 'Strong Momentum - Scale Up',
        description: 'Your recent sessions show consistent profitability',
        reasoning: `Average of $${avgSessionProfit.toFixed(2)} per session with ${avgItemsPerSession.toFixed(0)} items scanned`,
        confidence: 85,
        potentialImpact: `2x profit by doubling scan volume`,
        actionItems: [
          'Increase scanning frequency',
          'Extend session duration',
          'Visit more locations per trip',
          'Set higher profit goals'
        ],
        createdAt: Date.now()
      })
    }

    const goRate = items.length > 0 ? (items.filter(i => i.decision === 'GO').length / items.length) * 100 : 0
    
    if (goRate < 30 && items.length > 10) {
      recommendations.push({
        id: `strategy-selective-${Date.now()}`,
        type: 'strategy',
        priority: 'medium',
        title: 'Be More Selective',
        description: `Your GO rate is ${goRate.toFixed(1)}% - focus on higher quality finds`,
        reasoning: 'Low success rate suggests spending time on unprofitable items',
        confidence: 75,
        potentialImpact: 'Improved profit per hour',
        actionItems: [
          'Raise your minimum profit margin threshold',
          'Focus on proven categories',
          'Skip questionable items quickly',
          'Trust your successful patterns'
        ],
        createdAt: Date.now()
      })
    }

    if (sessions.length >= 5) {
      const lastWeekProfit = sessions
        .filter(s => s.startTime > Date.now() - 7 * 24 * 60 * 60 * 1000)
        .reduce((sum, s) => sum + s.totalPotentialProfit, 0)

      if (lastWeekProfit > 100) {
        recommendations.push({
          id: `goal-weekly-${Date.now()}`,
          type: 'goal',
          priority: 'medium',
          title: 'Set a Weekly Profit Goal',
          description: `You made $${lastWeekProfit.toFixed(2)} this week - formalize it!`,
          reasoning: 'Consistent weekly performance suggests you can set reliable goals',
          confidence: 80,
          potentialImpact: 'Increased motivation and focus',
          actionItems: [
            `Set weekly goal of $${(lastWeekProfit * 1.2).toFixed(2)}`,
            'Track daily progress',
            'Adjust strategy based on goal progress',
            'Celebrate when you hit targets'
          ],
          createdAt: Date.now()
        })
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  const getRecommendationsForNow = (analysis: PatternAnalysis): Recommendation[] => {
    const now = new Date()
    const currentDay = now.getDay()
    const currentHour = now.getHours()

    const recommendations: Recommendation[] = []

    const matchingTimePattern = analysis.bestTimes.find(
      p => p.dayOfWeek === currentDay && Math.abs(p.hourOfDay - currentHour) <= 1
    )

    if (matchingTimePattern) {
      recommendations.push({
        id: `now-time-${Date.now()}`,
        type: 'time',
        priority: 'high',
        title: '🎯 Great Time to Scan!',
        description: 'Right now matches your most successful pattern',
        reasoning: `${matchingTimePattern.successRate.toFixed(1)}% success rate at this time`,
        confidence: 90,
        potentialImpact: `$${matchingTimePattern.avgProfit.toFixed(2)} avg profit`,
        actionItems: [
          'Start scanning session now',
          'Focus on proven categories',
          'Track results to confirm pattern'
        ],
        relatedData: matchingTimePattern,
        createdAt: Date.now()
      })
    }

    return recommendations
  }

  return {
    analyzeSessions,
    getRecommendationsForNow
  }
}
