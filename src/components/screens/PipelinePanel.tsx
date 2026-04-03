import { Eye, MagnifyingGlass, TrendUp, Calculator, CheckCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { PipelineStep } from '@/types'

interface PipelinePanelProps {
  steps: PipelineStep[]
}

const phaseConfig = {
  vision: { icon: Eye, label: 'Vision Analysis', color: 'text-b1' },
  lens: { icon: MagnifyingGlass, label: 'Google Lens', color: 'text-b1' },
  market: { icon: TrendUp, label: 'Market Research', color: 'text-b1' },
  profit: { icon: Calculator, label: 'Profit Calculation', color: 'text-b1' },
  decision: { icon: CheckCircle, label: 'Decision', color: 'text-green' },
}

export function PipelinePanel({ steps }: PipelinePanelProps) {
  if (steps.length === 0) {
    return (
      <div className="text-center py-12 text-s3">
        <p className="text-sm">Capture an item to begin analysis</p>
      </div>
    )
  }

  return (
    <div id="ai-pipeline" className="space-y-3">
      {steps.map((step) => {
        const config = phaseConfig[step.id]
        const Icon = config.icon
        const isProcessing = step.status === 'processing'
        const isComplete = step.status === 'complete'
        const isError = step.status === 'error'

        return (
          <Card
            key={step.id}
            id={`phase-${step.id}`}
            className={`p-4 border transition-all ${
              isProcessing
                ? 'border-b1 bg-t4 animate-pulse'
                : isComplete
                ? 'border-s2 bg-bg'
                : isError
                ? 'border-red bg-red/5'
                : 'border-s2 bg-s1 opacity-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${
                  isComplete ? 'bg-green/10' : 'bg-s1'
                }`}
              >
                <Icon size={20} weight="bold" className={isComplete ? 'text-green' : config.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-fg">{config.label}</h3>
                  {isComplete && (
                    <span className="text-xs font-medium text-green uppercase tracking-wide">Complete</span>
                  )}
                  {isProcessing && (
                    <span className="text-xs font-medium text-b1 uppercase tracking-wide">Processing</span>
                  )}
                  {isError && (
                    <span className="text-xs font-medium text-red uppercase tracking-wide">Error</span>
                  )}
                </div>
                {isProcessing && <Progress value={66} className="h-1 mb-2" />}
                {step.data && (
                  <div className="text-xs text-s4 mt-2">
                    {typeof step.data === 'string' ? (
                      <p>{step.data}</p>
                    ) : (
                      <pre className="whitespace-pre-wrap font-mono text-xs">
                        {JSON.stringify(step.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
                {step.error && <p className="text-xs text-red mt-1">{step.error}</p>}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
