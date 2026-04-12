import { useState } from 'react'
import { Target, Plus, TrendUp, Calendar, CheckCircle, XCircle, Trophy } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'
import { logActivity } from '@/lib/activity-log'
import { cn } from '@/lib/utils'
import type { ProfitGoal, ProfitGoalProgress, Session, ScannedItem } from '@/types'

interface ProfitGoalManagerProps {
  sessions?: Session[]
  items?: ScannedItem[]
}

export function ProfitGoalManager({ sessions = [], items = [] }: ProfitGoalManagerProps) {
  const [goals, setGoals] = useKV<ProfitGoal[]>('profit-goals', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newGoal, setNewGoal] = useState({
    type: 'daily' as 'daily' | 'weekly' | 'monthly' | 'custom',
    targetAmount: '',
    customDays: '7',
  })

  const calculateGoalProgress = (goal: ProfitGoal): ProfitGoalProgress => {
    const now = Date.now()
    const goalStart = goal.startDate
    const goalEnd = goal.endDate
    
    const relevantItems = items.filter(item => 
      item.timestamp >= goalStart && 
      item.timestamp <= now &&
      item.decision === 'BUY' &&
      item.profitMargin !== undefined
    )

    const currentAmount = relevantItems.reduce((sum, item) => {
      const profit = ((item.estimatedSellPrice || 0) - item.purchasePrice) || 0
      return sum + profit
    }, 0)

    const percentageComplete = (currentAmount / goal.targetAmount) * 100
    const remainingAmount = Math.max(0, goal.targetAmount - currentAmount)
    const daysRemaining = Math.max(0, Math.ceil((goalEnd - now) / (1000 * 60 * 60 * 24)))
    const totalDays = Math.ceil((goalEnd - goalStart) / (1000 * 60 * 60 * 24))
    const daysPassed = totalDays - daysRemaining
    
    const dailyRate = daysPassed > 0 ? currentAmount / daysPassed : 0
    const projectedTotal = dailyRate * totalDays
    const onTrack = projectedTotal >= goal.targetAmount
    const dailyAverageNeeded = daysRemaining > 0 ? remainingAmount / daysRemaining : 0

    return {
      goal,
      currentAmount,
      percentageComplete,
      remainingAmount,
      daysRemaining,
      onTrack,
      projectedTotal,
      dailyAverageNeeded,
    }
  }

  const handleCreateGoal = () => {
    const target = parseFloat(newGoal.targetAmount)
    if (!target || target <= 0) {
      toast.error('Please enter a valid target amount')
      return
    }

    const now = Date.now()
    let endDate: number

    switch (newGoal.type) {
      case 'daily':
        endDate = now + (24 * 60 * 60 * 1000)
        break
      case 'weekly':
        endDate = now + (7 * 24 * 60 * 60 * 1000)
        break
      case 'monthly':
        endDate = now + (30 * 24 * 60 * 60 * 1000)
        break
      case 'custom':
        const days = parseInt(newGoal.customDays)
        if (!days || days <= 0) {
          toast.error('Please enter valid number of days')
          return
        }
        endDate = now + (days * 24 * 60 * 60 * 1000)
        break
      default:
        return
    }

    const goal: ProfitGoal = {
      id: Date.now().toString(),
      type: newGoal.type,
      targetAmount: target,
      startDate: now,
      endDate,
      createdAt: now,
      active: true,
    }

    setGoals((prev) => {
      const currentGoals = prev || []
      const deactivatedGoals = currentGoals.map(g => 
        g.type === goal.type ? { ...g, active: false } : g
      )
      return [...deactivatedGoals, goal]
    })

    logActivity('Profit goal created!')
    setIsDialogOpen(false)
    setNewGoal({ type: 'daily', targetAmount: '', customDays: '7' })
  }

  const handleDeleteGoal = (goalId: string) => {
    setGoals((prev) => (prev || []).filter(g => g.id !== goalId))
    logActivity('Goal removed')
  }

  const activeGoals = (goals || []).filter(g => {
    const now = Date.now()
    return g.active && g.endDate > now
  })

  const completedGoals = (goals || []).filter(g => {
    const now = Date.now()
    const progress = calculateGoalProgress(g)
    return g.endDate <= now || progress.percentageComplete >= 100
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const getGoalTypeLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily Goal'
      case 'weekly': return 'Weekly Goal'
      case 'monthly': return 'Monthly Goal'
      case 'custom': return 'Custom Goal'
      default: return 'Goal'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={24} weight="bold" className="text-b1" />
          <h3 className="text-lg font-bold text-t1">Profit Goals</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-to-br from-b1 to-amber hover:opacity-90 text-white font-bold">
              <Plus size={16} weight="bold" className="mr-1" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Profit Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="goal-type">Goal Period</Label>
                <Select
                  value={newGoal.type}
                  onValueChange={(value: any) => setNewGoal({ ...newGoal, type: value })}
                >
                  <SelectTrigger id="goal-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (24 hours)</SelectItem>
                    <SelectItem value="weekly">Weekly (7 days)</SelectItem>
                    <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                    <SelectItem value="custom">Custom Period</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newGoal.type === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="custom-days">Number of Days</Label>
                  <Input
                    id="custom-days"
                    type="number"
                    min="1"
                    value={newGoal.customDays}
                    onChange={(e) => setNewGoal({ ...newGoal, customDays: e.target.value })}
                    placeholder="Enter days"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="target-amount">Target Profit</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-t3 font-bold">$</span>
                  <Input
                    id="target-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-8"
                    value={newGoal.targetAmount}
                    onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <Button onClick={handleCreateGoal} className="w-full bg-b1 hover:bg-b2 text-white font-bold">
                Create Goal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activeGoals.length === 0 && completedGoals.length === 0 ? (
        <Card className="p-8 text-center">
          <Target size={48} weight="light" className="mx-auto mb-3 text-s3" />
          <h4 className="font-bold text-t1 mb-1">No Goals Set</h4>
          <p className="text-sm text-t3 mb-4">Create your first profit goal to track performance</p>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            variant="outline"
            size="sm"
          >
            <Plus size={16} className="mr-1" />
            Create Goal
          </Button>
        </Card>
      ) : (
        <>
          {activeGoals.map((goal) => {
            const progress = calculateGoalProgress(goal)
            const isAchieved = progress.percentageComplete >= 100

            return (
              <Card key={goal.id} className={cn(
                "p-4 space-y-3 transition-all",
                isAchieved && "border-green bg-green-bg"
              )}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {isAchieved ? (
                      <Trophy size={20} weight="fill" className="text-green" />
                    ) : (
                      <Target size={20} weight="bold" className="text-b1" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-t1">{getGoalTypeLabel(goal.type)}</h4>
                      <p className="text-xs text-t3">
                        {isAchieved ? 'Goal Achieved!' : `${progress.daysRemaining} days remaining`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="text-t4 hover:text-red transition-colors p-1"
                  >
                    <XCircle size={20} weight="bold" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-t2 font-medium">Progress</span>
                    <span className="font-bold text-t1 mono">
                      {formatCurrency(progress.currentAmount)} / {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(100, progress.percentageComplete)} 
                    className={cn(
                      "h-3",
                      isAchieved && "[&>div]:bg-green"
                    )}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-t3">
                      {Math.round(progress.percentageComplete)}% complete
                    </span>
                    {!isAchieved && progress.onTrack ? (
                      <Badge variant="secondary" className="bg-green/10 text-green text-xs">
                        <TrendUp size={12} className="mr-1" />
                        On Track
                      </Badge>
                    ) : !isAchieved ? (
                      <Badge variant="secondary" className="bg-amber/10 text-amber text-xs">
                        Behind Pace
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-green/10 text-green text-xs">
                        <CheckCircle size={12} className="mr-1" />
                        Achieved
                      </Badge>
                    )}
                  </div>
                </div>

                {!isAchieved && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-s2">
                    <div>
                      <p className="text-[10px] text-t4 uppercase font-bold mb-0.5">Remaining</p>
                      <p className="text-xs font-bold mono text-t1">{formatCurrency(progress.remainingAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-t4 uppercase font-bold mb-0.5">Daily Need</p>
                      <p className="text-xs font-bold mono text-t1">{formatCurrency(progress.dailyAverageNeeded)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-t4 uppercase font-bold mb-0.5">Projected</p>
                      <p className={cn(
                        "text-xs font-bold mono",
                        progress.onTrack ? "text-green" : "text-amber"
                      )}>
                        {formatCurrency(progress.projectedTotal)}
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}

          {completedGoals.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-t3 uppercase tracking-wider">Past Goals</h4>
              {completedGoals.slice(0, 3).map((goal) => {
                const progress = calculateGoalProgress(goal)
                const isAchieved = progress.percentageComplete >= 100

                return (
                  <Card key={goal.id} className="p-3 flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                      {isAchieved ? (
                        <CheckCircle size={18} weight="fill" className="text-green" />
                      ) : (
                        <XCircle size={18} weight="fill" className="text-red" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-t1">{getGoalTypeLabel(goal.type)}</p>
                        <p className="text-[10px] text-t4">
                          {new Date(goal.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold mono text-t1">
                        {formatCurrency(progress.currentAmount)}
                      </p>
                      <p className="text-[10px] text-t4">
                        {Math.round(progress.percentageComplete)}%
                      </p>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
