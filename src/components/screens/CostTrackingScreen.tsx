import { useState } from 'react'
import { ArrowLeft, CurrencyDollar, TrendUp, TrendDown, Warning, CalendarBlank, Database, Lightning, Eye, ShoppingCart, FileText, ArrowsClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useCostTracking } from '@/hooks/use-cost-tracking'
import { API_COST_CONFIGS } from '@/lib/cost-tracking-service'
import type { ApiService } from '@/types'
import { cn } from '@/lib/utils'

interface CostTrackingScreenProps {
  onBack: () => void
}

const SERVICE_ICONS: Record<ApiService, React.ReactNode> = {
  gemini: <Lightning className="w-5 h-5" />,
  googleLens: <Eye className="w-5 h-5" />,
  googleCustomSearch: <Database className="w-5 h-5" />,
  ebay: <ShoppingCart className="w-5 h-5" />,
  notion: <FileText className="w-5 h-5" />,
  openai: <Lightning className="w-5 h-5" />
}

const SERVICE_COLORS: Record<ApiService, string> = {
  gemini: 'text-blue-600 dark:text-blue-400',
  googleLens: 'text-purple-600 dark:text-purple-400',
  googleCustomSearch: 'text-green-600 dark:text-green-400',
  ebay: 'text-yellow-600 dark:text-yellow-400',
  notion: 'text-pink-600 dark:text-pink-400',
  openai: 'text-indigo-600 dark:text-indigo-400'
}

export function CostTrackingScreen({ onBack }: CostTrackingScreenProps) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month')
  const { costData, alerts, budgets, isLoading, refreshData } = useCostTracking(period)
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({})

  const toggleService = (service: string) => {
    setExpandedServices(prev => ({ ...prev, [service]: !prev[service] }))
  }

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '$0.00'
    if (amount < 0.01) return `$${amount.toFixed(4)}`
    return `$${amount.toFixed(2)}`
  }

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Today'
      case 'week': return 'Last 7 Days'
      case 'month': return 'Last 30 Days'
      case 'all': return 'All Time'
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="touch-target"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-t1">💰 API Cost Tracking</h1>
            <p className="text-xs text-t3">{getPeriodLabel()}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={refreshData}
          className="touch-target"
          disabled={isLoading}
        >
          <ArrowsClockwise className={cn("w-5 h-5", isLoading && "animate-spin")} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {alerts.length > 0 && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <Warning className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-100">Cost Alerts</h3>
                <div className="space-y-2 mt-2">
                  {alerts.map(alert => (
                    <div key={alert.id} className="text-sm text-red-800 dark:text-red-200">
                      • {alert.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="loading-spinner" />
          </div>
        ) : costData ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="stat-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CurrencyDollar className="w-5 h-5 text-b1" />
                  <span className="text-xs font-medium text-t3 uppercase tracking-wide">Total Cost</span>
                </div>
                <div className="text-2xl font-bold text-t1">
                  {formatCurrency(costData.totalCost)}
                </div>
                {costData.projectedMonthlyCost && period !== 'month' && period !== 'all' && (
                  <div className="text-xs text-t3 mt-1">
                    ~{formatCurrency(costData.projectedMonthlyCost)}/mo projected
                  </div>
                )}
              </Card>

              <Card className="stat-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-5 h-5 text-green" />
                  <span className="text-xs font-medium text-t3 uppercase tracking-wide">Requests</span>
                </div>
                <div className="text-2xl font-bold text-t1">
                  {costData.totalRequests.toLocaleString()}
                </div>
                <div className="text-xs text-t3 mt-1">
                  {costData.totalRequests > 0 
                    ? formatCurrency(costData.totalCost / costData.totalRequests) 
                    : '$0.00'} avg/request
                </div>
              </Card>
            </div>

            {costData.services.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-t2 uppercase tracking-wide flex items-center gap-2">
                  <CalendarBlank className="w-4 h-4" />
                  Services Breakdown
                </h2>

                {costData.services.map(service => {
                  const config = API_COST_CONFIGS[service.service]
                  const percentOfTotal = costData.totalCost > 0 
                    ? (service.totalCost / costData.totalCost) * 100 
                    : 0
                  const isExpanded = expandedServices[service.service]

                  return (
                    <Collapsible
                      key={service.service}
                      open={isExpanded}
                      onOpenChange={() => toggleService(service.service)}
                    >
                      <Card className="stat-card overflow-hidden">
                        <CollapsibleTrigger className="w-full p-4 text-left">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn("p-2 rounded-lg bg-s1", SERVICE_COLORS[service.service])}>
                                {SERVICE_ICONS[service.service]}
                              </div>
                              <div>
                                <h3 className="font-semibold text-t1">{config.name}</h3>
                                <p className="text-xs text-t3">{service.totalRequests} requests</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-t1">
                                {formatCurrency(service.totalCost)}
                              </div>
                              <div className="text-xs text-t3">
                                {percentOfTotal.toFixed(1)}% of total
                              </div>
                            </div>
                          </div>

                          <div className="mt-3">
                            <Progress value={percentOfTotal} className="h-2" />
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                            <div>
                              <span className="text-t3">Success:</span>{' '}
                              <span className="font-semibold text-green">{service.successfulRequests}</span>
                            </div>
                            <div>
                              <span className="text-t3">Failed:</span>{' '}
                              <span className="font-semibold text-red">{service.failedRequests}</span>
                            </div>
                            <div>
                              <span className="text-t3">Avg:</span>{' '}
                              <span className="font-semibold text-t1">
                                {formatCurrency(service.averageCostPerRequest)}
                              </span>
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-2 border-t border-border">
                            <h4 className="text-xs font-semibold text-t2 mb-2 uppercase tracking-wide">
                              Cost by Operation
                            </h4>
                            <div className="space-y-2">
                              {Object.entries(service.costByOperation)
                                .sort(([, a], [, b]) => b - a)
                                .map(([operation, cost]) => (
                                  <div key={operation} className="flex items-center justify-between text-sm">
                                    <span className="text-t2">{operation}</span>
                                    <span className="font-mono text-t1">{formatCurrency(cost)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  )
                })}
              </div>
            )}

            {costData.topCostOperations.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-t2 uppercase tracking-wide flex items-center gap-2">
                  <TrendUp className="w-4 h-4" />
                  Top Cost Operations
                </h2>

                <Card className="stat-card p-4">
                  <div className="space-y-3">
                    {costData.topCostOperations.map((op, index) => {
                      const config = API_COST_CONFIGS[op.service]
                      const percentOfTotal = costData.totalCost > 0 
                        ? (op.cost / costData.totalCost) * 100 
                        : 0

                      return (
                        <div key={`${op.service}-${op.operation}`} className="flex items-center gap-3">
                          <Badge variant="secondary" className="w-6 h-6 flex items-center justify-center p-0">
                            {index + 1}
                          </Badge>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <span className="text-sm font-medium text-t1">{op.operation}</span>
                                <span className="text-xs text-t3 ml-2">({config.name})</span>
                              </div>
                              <span className="text-sm font-bold text-t1">{formatCurrency(op.cost)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={percentOfTotal} className="h-1.5 flex-1" />
                              <span className="text-xs text-t3 w-12 text-right">{op.count}x</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>
            )}

            {costData.services.length === 0 && costData.totalRequests === 0 && (
              <Card className="stat-card p-8 text-center">
                <CurrencyDollar className="w-12 h-12 mx-auto text-s3 mb-3" />
                <h3 className="font-semibold text-t2 mb-1">No API usage yet</h3>
                <p className="text-sm text-t3">
                  Start scanning items to track API costs
                </p>
              </Card>
            )}

            {budgets.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-t2 uppercase tracking-wide flex items-center gap-2">
                  <Warning className="w-4 h-4" />
                  Active Budgets
                </h2>

                {budgets.map(budget => {
                  const percentUsed = (costData.totalCost / budget.limit) * 100
                  const isWarning = percentUsed >= budget.warningThreshold
                  const isExceeded = percentUsed >= 100

                  return (
                    <Card key={budget.id} className="stat-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-t1 capitalize">{budget.period} Budget</span>
                        <Badge variant={isExceeded ? 'destructive' : isWarning ? 'secondary' : 'default'}>
                          {percentUsed.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="mb-2">
                        <Progress 
                          value={Math.min(percentUsed, 100)} 
                          className={cn(
                            "h-2",
                            isExceeded && "bg-red-200 dark:bg-red-900",
                            isWarning && !isExceeded && "bg-yellow-200 dark:bg-yellow-900"
                          )}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-t3">
                        <span>{formatCurrency(costData.totalCost)} used</span>
                        <span>{formatCurrency(budget.limit)} limit</span>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <Card className="stat-card p-8 text-center">
            <Warning className="w-12 h-12 mx-auto text-s3 mb-3" />
            <h3 className="font-semibold text-t2 mb-1">No data available</h3>
            <p className="text-sm text-t3">
              Unable to load cost tracking data
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
