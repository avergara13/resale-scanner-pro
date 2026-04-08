import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ScannedItem, Decision } from '@/types'

interface DecisionSignalProps {
  decision: Decision
  item?: ScannedItem
}

export function DecisionSignal({ decision, item }: DecisionSignalProps) {
  const isBuy = decision === 'BUY'
  const isPass = decision === 'PASS'
  const isPending = !isBuy && !isPass

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', bounce: 0.4 }}
      id="decision-signal"
      className={cn(
        'mt-4 py-5 rounded-2xl flex flex-col items-center justify-center font-black border-4 shadow-xl',
        isBuy && 'bg-gradient-to-br from-green/20 to-green/10 text-green border-green',
        isPass && 'bg-gradient-to-br from-red/20 to-red/10 text-red border-red',
        isPending && 'bg-gradient-to-br from-amber/10 to-amber/5 text-amber border-amber/60'
      )}
    >
      <div className="text-4xl tracking-tight mb-1">{isPending ? '⏳ NEEDS PRICE' : decision}</div>
      {isPending ? (
        <div className="text-xs font-semibold opacity-70 text-center px-4">
          Enter buy price + tap Re-analyze, or use Chat to get a market estimate
        </div>
      ) : (
        <>
          {item?.profitMargin != null && isFinite(item.profitMargin) && (
            <div className="text-base font-bold opacity-80">
              Margin: {item.profitMargin.toFixed(1)}%
            </div>
          )}
          {item?.marketData?.recommendedPlatform && (
            <div className="mt-1 text-xs font-semibold opacity-80 text-center px-4">
              💡 Sell on {item.marketData.recommendedPlatform}
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
