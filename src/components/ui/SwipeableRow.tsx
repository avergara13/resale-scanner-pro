import { useState, type ReactNode } from 'react'
import { motion, animate, useMotionValue, useTransform, useReducedMotion, type PanInfo } from 'framer-motion'
import { cn } from '@/lib/utils'

// SwipeableRow wraps a row (typically a Card) with horizontal-swipe actions.
//
// Prop naming convention — matches iOS Mail:
//   leftAction  = the action on the LEFT edge, revealed by swiping RIGHT
//   rightAction = the action on the RIGHT edge, revealed by swiping LEFT
//
// Callers should wire destructive actions (Delete) to rightAction so they live
// on the right edge revealed by a left-swipe, matching the iOS convention.
// Positive/safe actions (Save Draft, Optimize) go on leftAction.
//
// Architecture note — sibling-wrapper pattern for dnd-kit coexistence.
// dnd-kit writes its transform to the element it owns (the Card's setNodeRef);
// this component writes Framer Motion's transform to its own motion.div.
// Two DOM elements, two transform writers, no last-writer-wins collision.
// Pass `disabled` when dnd-kit is actively dragging — turns drag={false} on
// motion.div WITHOUT unmounting it (no state loss mid-gesture).
//
// iOS guards: dragConstraints cap at ±120 px (edge-swipe-back safety);
// `prefers-reduced-motion` gets instant snap with no spring animation;
// drag is disabled entirely when neither action is defined (no hijacking).
// Wrapper uses overflow-x-hidden (not overflow-hidden) so dnd-kit's vertical
// transforms on children are never clipped during reorder.

export interface SwipeAction {
  icon: ReactNode
  label: string
  /** Tailwind background class for the action trail (e.g. 'bg-red-500'). */
  color: string
  /** Tailwind text color for icon/label on the trail. Default: 'text-white'. */
  textColor?: string
  onTrigger: () => void
}

interface SwipeableRowProps {
  children: ReactNode
  /** Action on the LEFT edge — revealed by swiping right. Positive/safe actions. */
  leftAction?: SwipeAction
  /** Action on the RIGHT edge — revealed by swiping left. Destructive actions. */
  rightAction?: SwipeAction
  /** Swipe past this many px to commit the action. Default 80. */
  threshold?: number
  /** When true, drag is disabled (keeps motion.div mounted — no state loss). */
  disabled?: boolean
  className?: string
}

const MAX_DRAG = 120

export function SwipeableRow({
  children,
  leftAction,
  rightAction,
  threshold = 80,
  disabled = false,
  className,
}: SwipeableRowProps) {
  const x = useMotionValue(0)
  const prefersReducedMotion = useReducedMotion()
  const [committing, setCommitting] = useState(false)

  // Only enable drag when there is at least one action to reveal — prevents
  // hijacking horizontal gestures when the row has nothing to offer.
  const isSwipeEnabled = !!(leftAction || rightAction)

  // Action trails fade in proportional to drag distance — starts showing at
  // 20 px, fully opaque at threshold. Left trail appears on right-swipe;
  // right trail appears on left-swipe (iOS Mail convention).
  const leftTrailOpacity = useTransform(x, [0, 20, threshold], [0, 0.4, 1])
  const rightTrailOpacity = useTransform(x, [-threshold, -20, 0], [1, 0.4, 0])

  const snapBack = () => {
    if (prefersReducedMotion) {
      x.set(0)
    } else {
      // Use animate() so the spring config actually runs — x.set(0) bypasses
      // the transition prop and jumps immediately without animation.
      void animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 })
    }
  }

  const handleDragEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const offset = info.offset.x
    if (offset <= -threshold && rightAction) {
      // Swiped left past threshold → fire right-edge action (e.g. Delete)
      setCommitting(true)
      rightAction.onTrigger()
      snapBack()
      setCommitting(false)
    } else if (offset >= threshold && leftAction) {
      // Swiped right past threshold → fire left-edge action (e.g. Save Draft)
      setCommitting(true)
      leftAction.onTrigger()
      snapBack()
      setCommitting(false)
    } else {
      snapBack()
    }
  }

  return (
    // overflow-x-hidden clips the action trails horizontally without clipping
    // dnd-kit's vertical transforms on child rows during reorder.
    <div className={cn('relative overflow-x-hidden', className)}>
      {/* Left-edge action trail — revealed when row slides right */}
      {leftAction && (
        <motion.div
          aria-hidden
          style={{ opacity: leftTrailOpacity }}
          className={cn(
            'absolute inset-y-0 left-0 flex items-center justify-start pl-4 pointer-events-none',
            leftAction.color,
            leftAction.textColor ?? 'text-white',
          )}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {leftAction.icon}
            <span>{leftAction.label}</span>
          </div>
        </motion.div>
      )}

      {/* Right-edge action trail — revealed when row slides left */}
      {rightAction && (
        <motion.div
          aria-hidden
          style={{ opacity: rightTrailOpacity }}
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-end pr-4 pointer-events-none',
            rightAction.color,
            rightAction.textColor ?? 'text-white',
          )}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{rightAction.label}</span>
            {rightAction.icon}
          </div>
        </motion.div>
      )}

      <motion.div
        drag={disabled || committing || !isSwipeEnabled ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: -MAX_DRAG, right: MAX_DRAG }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  )
}
