import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ScannedItem, Decision } from '@/types'

interface DecisionSignalProps {
  decision: Decision
  item?: ScannedItem
  /**
   * When provided AND `decision === 'BUY'`, the banner becomes a clickable
   * commit surface that mirrors the bottom "Add to Queue" button. Both
   * surfaces flow through the SAME handler reference, so behavior cannot
   * diverge — a tap on the BUY banner is functionally identical to a tap
   * on the bottom green Add-to-Queue pill.
   *
   * For PASS / MAYBE decisions the banner stays display-only regardless,
   * because making a "no" recommendation tappable would create a confusing
   * "tap PASS to add anyway?" UX. Users can still override via the bottom
   * Add to Queue button (which re-runs makeDecision with their edits).
   */
  onCommit?: () => void
  /** Disables the BUY-banner button while a commit is inflight (matches the
   *  bottom Add-to-Queue pill's lock window). */
  committing?: boolean
}

export function DecisionSignal({ decision, item, onCommit, committing = false }: DecisionSignalProps) {
  // WS-21 Phase 3: honor prefers-reduced-motion — swap spring for an instant
  // fade-in so the card still enters cleanly but without the scale bounce.
  // Call the hook before any early return to satisfy rules-of-hooks.
  const shouldReduceMotion = useReducedMotion()

  // PENDING is a pre-pipeline internal state — never render a final-decision card for it
  if (decision === 'PENDING') return null

  const isBuy = decision === 'BUY'
  const isPass = decision === 'PASS'
  const isMaybe = decision === 'MAYBE'
  const isClickable = isBuy && !!onCommit

  const sharedClassName = cn(
    'w-full mt-4 py-5 rounded-2xl flex flex-col items-center justify-center font-black border-4 shadow-xl',
    isBuy && 'bg-gradient-to-br from-green/20 to-green/10 text-green border-green',
    isPass && 'bg-gradient-to-br from-red/20 to-red/10 text-red border-red',
    isMaybe && 'bg-gradient-to-br from-amber/20 to-amber/10 text-amber border-amber',
    isClickable && 'cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-70',
  )

  // `as const` on the spring transition pins `type: 'spring'` to its literal
  // type so framer-motion's `Transition` union narrows to spring options.
  // Without it, the spread infers `type: string` and the union widens to fail.
  const sharedMotionProps = {
    initial: shouldReduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 },
    animate: shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 },
    transition: shouldReduceMotion
      ? ({ duration: 0.15 } as const)
      : ({ type: 'spring', bounce: 0.4 } as const),
  }

  const inner = (
    <>
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
    </>
  )

  if (isClickable) {
    return (
      <motion.button
        {...sharedMotionProps}
        type="button"
        id="decision-signal"
        onClick={onCommit}
        disabled={committing}
        aria-label="Add to Queue"
        className={sharedClassName}
      >
        {inner}
      </motion.button>
    )
  }

  return (
    <motion.div {...sharedMotionProps} id="decision-signal" className={sharedClassName}>
      {inner}
    </motion.div>
  )
}
