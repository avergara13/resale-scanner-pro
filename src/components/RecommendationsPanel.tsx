import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkle, 
  Clock, 
  TrendUp, 
  Target,
  Lightbulb,
  ChartBar,
  Calendar,
  CurrencyDollar,
  X
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { createPatternRecommendationService, type Recommendation, type PatternAnalysis } from '@/lib/pattern-recommendation-service'
import type { Session, ScannedItem } from '@/types'
import { cn } from '@/lib/utils'

interface RecommendationsPanelProps {
  sessions: Session[]
  items: ScannedItem[]
  onClose?: () => void
  compact?: boolean
}

export function RecommendationsPanel({ sessions, items, onClose, compact = false }: RecommendationsPanelProps) {
  const [analysis, setAnalysis] = useState<PatternAnalysis | null>(null)
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null)
  const [showNowRecommendations, setShowNowRecommendations] = useState(false)

  useEffect(() => {
    const service = createPatternRecommendationService()
    const result = service.analyzeSessions(sessions, items)
    setAnalysis(result)

    const nowRecs = service.getRecommendationsForNow(result)
    setShowNowRecommendations(nowRecs.length > 0)
  }, [sessions, items])

  if (!analysis) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="loading-spinner" />
      </div>
    )
  }

  const getPriorityIcon = (priority: Recommendation['priority']) => {
    switch (priority) {
      case 'high':
        return <Sparkle size={16} weight="fill" className="text-amber" />
      case 'medium':
        return <Lightbulb size={16} weight="fill" className="text-b1" />
      case 'low':
        return <Target size={16} className="text-t3" />
    }
  }

  const getPriorityColor = (priority: Recommendation['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-amber/10 text-amber border-amber/20'
      case 'medium':
        return 'bg-blue-bg text-b1 border-b1/20'
      case 'low':
        return 'bg-s1 text-t3 border-s2'
    }
  }

  const getTypeIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'time':
        return <Clock size={20} weight="bold" />
      case 'category':
        return <ChartBar size={20} weight="bold" />
      case 'priceRange':
        return <CurrencyDollar size={20} weight="bold" />
      case 'strategy':
        return <TrendUp size={20} weight="bold" />
      case 'goal':
        return <Target size={20} weight="bold" />
    }
  }

  if (compact) {
    return (
      <Card className="p-4 bg-gradient-to-br from-blue-bg to-transparent border-b1/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-b1 to-amber flex items-center justify-center flex-shrink-0">
            <Sparkle size={20} weight="fill" className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-t1 mb-1">Smart Recommendations</h3>
            <p className="text-xs text-t3 mb-2">
              {analysis.recommendations.length} insights based on your patterns
            </p>
            {analysis.recommendations.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                {getPriorityIcon(analysis.recommendations[0].priority)}
                <span className="font-medium text-t2">{analysis.recommendations[0].title}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-s1 bg-fg flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-b1 to-amber flex items-center justify-center">
            <Sparkle size={20} weight="fill" className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-t1">Pattern Insights</h2>
            <p className="text-[10px] text-t3 font-medium uppercase tracking-wider">
              {analysis.insights.totalPatterns} Patterns Analyzed
            </p>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X size={18} />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Key Insights Summary */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="p-3 bg-fg border-s1">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-green" />
                <span className="text-[10px] font-bold text-t3 uppercase tracking-wider">Best Day</span>
              </div>
              <div className="text-sm font-bold text-t1">{analysis.insights.mostProfitableDay}</div>
            </Card>

            <Card className="p-3 bg-fg border-s1">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-b1" />
                <span className="text-[10px] font-bold text-t3 uppercase tracking-wider">Best Time</span>
              </div>
              <div className="text-sm font-bold text-t1">{analysis.insights.mostProfitableHour}</div>
            </Card>

            <Card className="p-3 bg-fg border-s1">
              <div className="flex items-center gap-2 mb-1">
                <ChartBar size={14} className="text-amber" />
                <span className="text-[10px] font-bold text-t3 uppercase tracking-wider">Top Category</span>
              </div>
              <div className="text-sm font-bold text-t1 truncate">{analysis.insights.bestCategory}</div>
            </Card>

            <Card className="p-3 bg-fg border-s1">
              <div className="flex items-center gap-2 mb-1">
                <CurrencyDollar size={14} className="text-green" />
                <span className="text-[10px] font-bold text-t3 uppercase tracking-wider">Price Range</span>
              </div>
              <div className="text-sm font-bold text-t1">{analysis.insights.optimalPriceRange}</div>
            </Card>
          </div>

          <Separator />

          {/* Recommendations List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-t2 uppercase tracking-wider">
                Recommendations ({analysis.recommendations.length})
              </h3>
              <Badge variant="secondary" className="text-[10px] font-bold">
                {analysis.insights.avgSuccessRate}% Success Rate
              </Badge>
            </div>

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {analysis.recommendations.map((rec, index) => (
                  <motion.div
                    key={rec.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={cn(
                        "p-4 cursor-pointer transition-all border",
                        selectedRecommendation?.id === rec.id
                          ? "bg-blue-bg border-b1 shadow-md"
                          : "bg-fg border-s1 hover:border-b1/30 hover:bg-blue-bg/50"
                      )}
                      onClick={() => setSelectedRecommendation(
                        selectedRecommendation?.id === rec.id ? null : rec
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                          rec.priority === 'high' ? "bg-amber/10 text-amber" :
                          rec.priority === 'medium' ? "bg-blue-bg text-b1" :
                          "bg-s1 text-t3"
                        )}>
                          {getTypeIcon(rec.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="text-[13px] font-bold text-t1 leading-tight">
                              {rec.title}
                            </h4>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[9px] font-bold uppercase tracking-wider flex-shrink-0",
                                getPriorityColor(rec.priority)
                              )}
                            >
                              {rec.priority}
                            </Badge>
                          </div>

                          <p className="text-xs text-t2 mb-2 leading-relaxed">
                            {rec.description}
                          </p>

                          <div className="flex items-center gap-3 text-[10px]">
                            <div className="flex items-center gap-1 text-green">
                              <TrendUp size={12} weight="bold" />
                              <span className="font-medium">{rec.potentialImpact}</span>
                            </div>
                            <div className="flex items-center gap-1 text-t4">
                              <Target size={12} />
                              <span>{rec.confidence}% confidence</span>
                            </div>
                          </div>

                          <AnimatePresence>
                            {selectedRecommendation?.id === rec.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-3 pt-3 border-t border-s2"
                              >
                                <div className="space-y-3">
                                  <div>
                                    <h5 className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">
                                      Reasoning
                                    </h5>
                                    <p className="text-xs text-t2 leading-relaxed">
                                      {rec.reasoning}
                                    </p>
                                  </div>

                                  <div>
                                    <h5 className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">
                                      Action Items
                                    </h5>
                                    <ul className="space-y-1.5">
                                      {rec.actionItems.map((action, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-t2">
                                          <span className="w-1 h-1 rounded-full bg-b1 mt-1.5 flex-shrink-0" />
                                          <span className="leading-relaxed">{action}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Pattern Details */}
          {analysis.bestTimes.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">
                  Best Times to Scan
                </h3>
                <div className="space-y-2">
                  {analysis.bestTimes.slice(0, 3).map((pattern, index) => {
                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                    const formatHour = (hour: number) => {
                      if (hour === 0) return '12 AM'
                      if (hour < 12) return `${hour} AM`
                      if (hour === 12) return '12 PM'
                      return `${hour - 12} PM`
                    }

                    return (
                      <Card key={index} className="p-3 bg-fg border-s1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-b1" />
                            <span className="text-sm font-bold text-t1">
                              {days[pattern.dayOfWeek]} @ {formatHour(pattern.hourOfDay)}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-green">
                              ${pattern.avgProfit.toFixed(2)} avg
                            </div>
                            <div className="text-[10px] text-t4">
                              {pattern.successRate.toFixed(0)}% success
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Category Patterns */}
          {analysis.bestCategories.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">
                  Top Performing Categories
                </h3>
                <div className="space-y-2">
                  {analysis.bestCategories.slice(0, 3).map((pattern, index) => (
                    <Card key={index} className="p-3 bg-fg border-s1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ChartBar size={16} className="text-amber flex-shrink-0" />
                          <span className="text-sm font-bold text-t1 truncate">
                            {pattern.category}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-green">
                            ${pattern.avgProfit.toFixed(2)} avg
                          </div>
                          <div className="text-[10px] text-t4">
                            {pattern.avgMargin.toFixed(0)}% margin
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
