import type { ApiService, ApiCostConfig, ApiUsageLog, ServiceCostSummary, CostTrackingPeriod, CostBudget, CostAlert } from '@/types'

export const API_COST_CONFIGS: Record<ApiService, ApiCostConfig> = {
  gemini: {
    service: 'gemini',
    name: 'Google Gemini API',
    pricing: {
      inputTokenCost: 0.00001875,
      outputTokenCost: 0.000075,
      imageCost: 0.0001315,
      freeTier: {
        monthly: 15
      }
    }
  },
  googleLens: {
    service: 'googleLens',
    name: 'Google Custom Search API',
    pricing: {
      searchCost: 0.005,
      freeTier: {
        daily: 100
      }
    }
  },
  googleCustomSearch: {
    service: 'googleCustomSearch',
    name: 'Google Custom Search',
    pricing: {
      searchCost: 0.005,
      freeTier: {
        daily: 100
      }
    }
  },
  ebay: {
    service: 'ebay',
    name: 'eBay API',
    pricing: {
      requestCost: 0,
      freeTier: {
        daily: 5000
      }
    }
  },
  notion: {
    service: 'notion',
    name: 'Notion API',
    pricing: {
      requestCost: 0,
      freeTier: {
        monthly: 1000
      }
    }
  },
  openai: {
    service: 'openai',
    name: 'OpenAI API',
    pricing: {
      inputTokenCost: 0.00015,
      outputTokenCost: 0.0006,
      freeTier: {
        monthly: 0
      }
    }
  }
}

export class CostTrackingService {
  private storageKey = 'api-usage-logs'
  private budgetKey = 'cost-budgets'
  private alertsKey = 'cost-alerts'

  async logUsage(log: Omit<ApiUsageLog, 'id' | 'timestamp'>): Promise<void> {
    const fullLog: ApiUsageLog = {
      ...log,
      id: Date.now().toString(),
      timestamp: Date.now()
    }

    const logs = await this.getAllLogs()
    logs.push(fullLog)
    
    await window.spark?.kv.set(this.storageKey, logs)

    await this.checkBudgets(log.service, log.cost)
  }

  async getAllLogs(): Promise<ApiUsageLog[]> {
    const logs = await window.spark?.kv.get<ApiUsageLog[]>(this.storageKey)
    return logs || []
  }

  async getLogsForPeriod(startDate: number, endDate: number): Promise<ApiUsageLog[]> {
    const logs = await this.getAllLogs()
    return logs.filter(log => log.timestamp >= startDate && log.timestamp <= endDate)
  }

  async getLogsForService(service: ApiService, startDate?: number, endDate?: number): Promise<ApiUsageLog[]> {
    const logs = await this.getAllLogs()
    return logs.filter(log => {
      const matchesService = log.service === service
      const matchesDate = !startDate || !endDate || (log.timestamp >= startDate && log.timestamp <= endDate)
      return matchesService && matchesDate
    })
  }

  async calculateServiceCostSummary(service: ApiService, startDate: number, endDate: number): Promise<ServiceCostSummary> {
    const logs = await this.getLogsForService(service, startDate, endDate)
    
    const totalCost = logs.reduce((sum, log) => sum + log.cost, 0)
    const totalRequests = logs.length
    const successfulRequests = logs.filter(log => log.details.success).length
    const failedRequests = totalRequests - successfulRequests
    const averageCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0

    const costByOperation: Record<string, number> = {}
    logs.forEach(log => {
      if (!costByOperation[log.operation]) {
        costByOperation[log.operation] = 0
      }
      costByOperation[log.operation] += log.cost
    })

    const lastUsed = logs.length > 0 ? Math.max(...logs.map(log => log.timestamp)) : undefined

    return {
      service,
      totalCost,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageCostPerRequest,
      costByOperation,
      lastUsed
    }
  }

  async getCostTrackingPeriod(period: 'today' | 'week' | 'month' | 'all'): Promise<CostTrackingPeriod> {
    const now = Date.now()
    let startDate: number
    let endDate = now

    switch (period) {
      case 'today':
        startDate = new Date().setHours(0, 0, 0, 0)
        break
      case 'week':
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        startDate = weekAgo.getTime()
        break
      case 'month':
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        startDate = monthAgo.getTime()
        break
      case 'all':
        startDate = 0
        break
    }

    const logs = await this.getLogsForPeriod(startDate, endDate)
    const totalCost = logs.reduce((sum, log) => sum + log.cost, 0)
    const totalRequests = logs.length

    const services: ServiceCostSummary[] = []
    const allServices: ApiService[] = ['gemini', 'googleLens', 'ebay', 'notion', 'googleCustomSearch', 'openai']
    
    for (const service of allServices) {
      const summary = await this.calculateServiceCostSummary(service, startDate, endDate)
      if (summary.totalRequests > 0) {
        services.push(summary)
      }
    }

    const operationCosts: Record<string, { cost: number; count: number; service: ApiService }> = {}
    logs.forEach(log => {
      const key = `${log.service}:${log.operation}`
      if (!operationCosts[key]) {
        operationCosts[key] = { cost: 0, count: 0, service: log.service }
      }
      operationCosts[key].cost += log.cost
      operationCosts[key].count++
    })

    const topCostOperations = Object.entries(operationCosts)
      .map(([key, data]) => ({
        service: data.service,
        operation: key.split(':')[1],
        cost: data.cost,
        count: data.count
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5)

    let projectedMonthlyCost: number | undefined
    if (period === 'today' || period === 'week') {
      const daysInPeriod = period === 'today' ? 1 : 7
      const dailyAverage = totalCost / daysInPeriod
      projectedMonthlyCost = dailyAverage * 30
    }

    return {
      period,
      startDate,
      endDate,
      totalCost,
      totalRequests,
      services,
      topCostOperations,
      projectedMonthlyCost
    }
  }

  async setBudget(budget: CostBudget): Promise<void> {
    const budgets = await this.getAllBudgets()
    const existingIndex = budgets.findIndex(b => b.id === budget.id)
    
    if (existingIndex >= 0) {
      budgets[existingIndex] = budget
    } else {
      budgets.push(budget)
    }
    
    await window.spark?.kv.set(this.budgetKey, budgets)
  }

  async getAllBudgets(): Promise<CostBudget[]> {
    const budgets = await window.spark?.kv.get<CostBudget[]>(this.budgetKey)
    return budgets || []
  }

  async getActiveBudgets(): Promise<CostBudget[]> {
    const budgets = await this.getAllBudgets()
    return budgets.filter(b => b.active)
  }

  async checkBudgets(service: ApiService, cost: number): Promise<void> {
    const budgets = await this.getActiveBudgets()
    
    for (const budget of budgets) {
      const { startDate, endDate } = this.getBudgetPeriodDates(budget)
      const logs = await this.getLogsForPeriod(startDate, endDate)
      
      const totalCost = logs.reduce((sum, log) => sum + log.cost, 0)
      const percentUsed = (totalCost / budget.limit) * 100

      if (percentUsed >= 100) {
        await this.createAlert({
          type: 'budget-exceeded',
          service,
          message: `${budget.period} budget exceeded for ${service}`,
          cost: totalCost,
          threshold: budget.limit
        })
      } else if (percentUsed >= budget.warningThreshold) {
        await this.createAlert({
          type: 'budget-warning',
          service,
          message: `${budget.period} budget warning: ${percentUsed.toFixed(1)}% used`,
          cost: totalCost,
          threshold: budget.limit * (budget.warningThreshold / 100)
        })
      }

      if (budget.serviceSpecific) {
        for (const serviceLimit of budget.serviceSpecific) {
          if (serviceLimit.service === service) {
            const serviceLogs = logs.filter(log => log.service === service)
            const serviceCost = serviceLogs.reduce((sum, log) => sum + log.cost, 0)
            const servicePercent = (serviceCost / serviceLimit.limit) * 100

            if (servicePercent >= 100) {
              await this.createAlert({
                type: 'budget-exceeded',
                service,
                message: `${budget.period} budget exceeded for ${service}: $${serviceCost.toFixed(2)}`,
                cost: serviceCost,
                threshold: serviceLimit.limit
              })
            }
          }
        }
      }
    }
  }

  private getBudgetPeriodDates(budget: CostBudget): { startDate: number; endDate: number } {
    const now = Date.now()
    let startDate: number
    let endDate = now

    switch (budget.period) {
      case 'daily':
        startDate = new Date().setHours(0, 0, 0, 0)
        break
      case 'weekly':
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        startDate = weekAgo.getTime()
        break
      case 'monthly':
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        startDate = monthAgo.getTime()
        break
    }

    return { startDate, endDate }
  }

  async createAlert(alert: Omit<CostAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    const alerts = await this.getAllAlerts()
    
    const recentAlert = alerts.find(a =>
      a.type === alert.type &&
      a.service === alert.service &&
      !a.acknowledged &&
      Date.now() - a.timestamp < 60 * 60 * 1000
    )

    if (recentAlert) {
      return
    }

    const fullAlert: CostAlert = {
      ...alert,
      id: Date.now().toString(),
      timestamp: Date.now(),
      acknowledged: false
    }

    alerts.push(fullAlert)
    await window.spark?.kv.set(this.alertsKey, alerts)
  }

  async getAllAlerts(): Promise<CostAlert[]> {
    const alerts = await window.spark?.kv.get<CostAlert[]>(this.alertsKey)
    return alerts || []
  }

  async getUnacknowledgedAlerts(): Promise<CostAlert[]> {
    const alerts = await this.getAllAlerts()
    return alerts.filter(a => !a.acknowledged)
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const alerts = await this.getAllAlerts()
    const alert = alerts.find(a => a.id === alertId)
    
    if (alert) {
      alert.acknowledged = true
      await window.spark?.kv.set(this.alertsKey, alerts)
    }
  }

  async clearOldLogs(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
    const logs = await this.getAllLogs()
    const recentLogs = logs.filter(log => log.timestamp >= cutoffDate)
    await window.spark?.kv.set(this.storageKey, recentLogs)
  }

  calculateCost(service: ApiService, operation: string, details: {
    inputTokens?: number
    outputTokens?: number
    imageSize?: number
    searchQueries?: number
  }): number {
    const config = API_COST_CONFIGS[service]
    let cost = 0

    if (details.inputTokens && config.pricing.inputTokenCost) {
      cost += details.inputTokens * config.pricing.inputTokenCost
    }

    if (details.outputTokens && config.pricing.outputTokenCost) {
      cost += details.outputTokens * config.pricing.outputTokenCost
    }

    if (details.imageSize && config.pricing.imageCost) {
      cost += config.pricing.imageCost
    }

    if (details.searchQueries && config.pricing.searchCost) {
      cost += details.searchQueries * config.pricing.searchCost
    }

    if (config.pricing.requestCost) {
      cost += config.pricing.requestCost
    }

    return cost
  }
}

export const createCostTrackingService = () => new CostTrackingService()
