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

  if (!isBuy && !isPass) return null

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', bounce: 0.4 }}
      id="decision-signal"
      className={cn(
        'mt-4 py-6 rounded-2xl flex flex-col items-center justify-center font-black border-4 shadow-xl',
        isBuy && 'bg-gradient-to-br from-green/20 to-green/10 text-green border-green',
        isPass && 'bg-gradient-to-br from-red/20 to-red/10 text-red border-red'
      )}
    >
      <div className="text-5xl tracking-tight mb-2">{decision}</div>
      {item?.profitMargin !== undefined && (
        <div className="text-base font-bold opacity-80">
          Margin: {item.profitMargin.toFixed(1)}%
        </div>
      )}
    </motion.div>
  )
}
