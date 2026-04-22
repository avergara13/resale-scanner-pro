import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ScannedItem, Decision } from '@/types'

interface DecisionSignalProps {
  decision: Decision
  item?: ScannedItem
}

export function DecisionSignal({ decision, item }: DecisionSignalProps) {
  // WS-21 Phase 3: honor prefers-reduced-motion — swap spring for an instant
  // fade-in so the card still enters cleanly but without the scale bounce.
  // Call the hook before any early return to satisfy rules-of-hooks.
  const shouldReduceMotion = useReducedMotion()

  // PENDING is a pre-pipeline internal state — never render a final-decision card for it
  if (decision === 'PENDING') return null

  const isBuy = decision === 'BUY'
  const isPass = decision === 'PASS'
  const isMaybe = decision === 'MAYBE'

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
      transition={shouldReduceMotion ? { duration: 0.15 } : { type: 'spring', bounce: 0.4 }}
      id="decision-signal"
      className={cn(
        'mt-4 py-5 rounded-2xl flex flex-col items-center justify-center font-black border-4 shadow-xl',
        isBuy && 'bg-gradient-to-br from-green/20 to-green/10 text-green border-green',
        isPass && 'bg-gradient-to-br from-red/20 to-red/10 text-red border-red',
        isMaybe && 'bg-gradient-to-br from-amber/20 to-amber/10 text-amber border-amber'
      )}
    >
      <div className="text-4xl tracking-tight mb-1">{decision}</div>
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
    </motion.div>
  )
}
