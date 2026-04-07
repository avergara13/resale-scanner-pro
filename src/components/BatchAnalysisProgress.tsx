import { Progress } from '@/components/ui/progress'
import { Lightning } from '@phosphor-icons/react'

interface BatchAnalysisProgressProps {
  current: number
  total: number
  currentItemName?: string
}

export function BatchAnalysisProgress({ current, total, currentItemName }: BatchAnalysisProgressProps) {
  const progress = total > 0 ? (current / total) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/80 backdrop-blur-sm">
      <div className="bg-bg border-2 border-b1 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-b1/20 flex items-center justify-center">
            <Lightning size={32} weight="fill" className="text-b1 animate-pulse" />
          </div>
        </div>
        
        <h3 className="text-lg font-semibold text-t1 text-center mb-2">
          Batch Analysis
        </h3>
        
        <p className="text-sm text-s4 text-center mb-4">
          Processing item {current} of {total}
        </p>
        
        {currentItemName && (
          <p className="text-xs text-s3 text-center mb-4 font-mono truncate">
            {currentItemName}
          </p>
        )}
        
        <Progress value={progress} className="h-2 mb-2" />
        
        <p className="text-xs text-s4 text-center">
          {Math.round(progress)}% complete
        </p>
      </div>
    </div>
  )
}
