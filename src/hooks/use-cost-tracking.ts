import { useState, useEffect, useCallback, useMemo } from 'react'
import type { CostTrackingPeriod, CostAlert, CostBudget } from '@/types'
import { createCostTrackingService } from '@/lib/cost-tracking-service'

export function useCostTracking(period: 'today' | 'week' | 'month' | 'all' = 'month') {
  const [costData, setCostData] = useState<CostTrackingPeriod | null>(null)
  const [alerts, setAlerts] = useState<CostAlert[]>([])
  const [budgets, setBudgets] = useState<CostBudget[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const costService = useMemo(() => createCostTrackingService(), [])

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const [data, allAlerts, allBudgets] = await Promise.all([
        costService.getCostTrackingPeriod(period),
        costService.getUnacknowledgedAlerts(),
        costService.getActiveBudgets()
      ])

      setCostData(data)
      setAlerts(allAlerts)
      setBudgets(allBudgets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost data')
    } finally {
      setIsLoading(false)
    }
  }, [costService, period])

  useEffect(() => {
    refreshData()
  }, [costService, refreshData])

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    await costService.acknowledgeAlert(alertId)
    await refreshData()
  }, [costService, refreshData])

  const createBudget = useCallback(async (budget: CostBudget) => {
    await costService.setBudget(budget)
    await refreshData()
  }, [costService, refreshData])

  return {
    costData,
    alerts,
    budgets,
    isLoading,
    error,
    refreshData,
    acknowledgeAlert,
    createBudget
  }
}
