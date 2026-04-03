import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ScannedItem, Decision } from '@/types'

interface DecisionSignalProps {
  decision: Decision
  item?: ScannedItem
}

export function DecisionSignal({ decision, item }: DecisionSignalProps) {
  const isGo = decision === 'GO'
  const isPass = decision === 'PASS'

  if (!isGo && !isPass) return null

  return (
    <Card
      id="decision-signal"
      className={`p-6 border-2 ${
        isGo ? 'border-green bg-green/10' : 'border-red bg-red/10'
      }`}
    >
      <div className="flex items-center justify-center gap-3 mb-4">
        {isGo ? (
          <CheckCircle size={48} weight="fill" className="text-green" />
        ) : (
          <XCircle size={48} weight="fill" className="text-red" />
        )}
        <div className={`text-4xl font-bold uppercase tracking-tight ${isGo ? 'text-green' : 'text-red'}`}>
          {decision}
        </div>
      </div>

      {item && (
        <div className="space-y-2 text-center">
          {item.productName && (
            <p className="font-semibold text-fg text-base">{item.productName}</p>
          )}
          <div className="flex items-center justify-center gap-4 text-sm">
            {item.purchasePrice && (
              <div>
                <span className="text-s4 uppercase text-xs tracking-wide">Cost</span>
                <p className="font-mono font-medium text-fg">${item.purchasePrice.toFixed(2)}</p>
              </div>
            )}
            {item.estimatedSellPrice && (
              <div>
                <span className="text-s4 uppercase text-xs tracking-wide">Est. Sell</span>
                <p className="font-mono font-medium text-fg">${item.estimatedSellPrice.toFixed(2)}</p>
              </div>
            )}
            {item.profitMargin !== undefined && (
              <div>
                <span className="text-s4 uppercase text-xs tracking-wide">Margin</span>
                <Badge
                  variant="secondary"
                  className={`font-mono font-medium ${
                    item.profitMargin > 50 ? 'bg-green/20 text-green' : item.profitMargin > 20 ? 'bg-amber/20 text-amber' : 'bg-red/20 text-red'
                  }`}
                >
                  {item.profitMargin.toFixed(0)}%
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
