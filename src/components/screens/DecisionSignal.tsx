import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
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
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      id="decision-signal"
      className={cn(
        'mt-4 py-3 rounded-xl flex items-center justify-center font-black text-2xl tracking-tighter border-4',
        isGo && 'bg-green/10 text-green border-green',
        isPass && 'bg-red/10 text-red border-red'
      )}
    >
      {decision}
    </motion.div>
  )
}
