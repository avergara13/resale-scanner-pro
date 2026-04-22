import { useState, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useTransform, useReducedMotion, type PanInfo } from 'framer-motion'
import { cn } from '@/lib/utils'

// SwipeableRow wraps a row (typically a Card) with horizontal-swipe actions.
//
// Architecture note — this is the "sibling wrapper" pattern that lets dnd-kit
// and Framer Motion coexist on the same row. dnd-kit writes its transform to
// the draggable element it owns (the Card's setNodeRef); this component writes
// Framer Motion's transform to its own inner <motion.div>. Two DOM elements,
// two transform writers, no collision. When a row is actively being reordered
// by dnd-kit, pass `disabled` so we render a plain div and never capture the
// pointer — see QueueScreen integration for the exact pattern.
//
// iOS guards: dragConstraints cap at ±120 px so the edge-swipe-back gesture is
// not hijacked; `prefers-reduced-motion` users get an instant snap with no
// spring animation.

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
  leftAction?: SwipeAction
  rightAction?: SwipeAction
  /** Swipe past this many px to commit the action. Default 80. */
  threshold?: number
  /** When true, renders children without any drag behavior. */
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

  // Action trails fade in proportional to drag distance — starts showing at
  // 20px drag, fully opaque at threshold. The leftAction is revealed when the
  // user swipes right (pulls the row right, exposing the left edge); the
  // rightAction is revealed when the user swipes left. That matches iOS Mail.
  const leftTrailOpacity = useTransform(x, [0, 20, threshold], [0, 0.4, 1])
  const rightTrailOpacity = useTransform(x, [-threshold, -20, 0], [1, 0.4, 0])

  // Note: when `disabled` is true we keep motion.div mounted but turn off its
  // drag prop. Unmounting/remounting mid-gesture (e.g. when dnd-kit flips
  // isDragging partway through an 8 px activation window) would drop drag
  // state and cause visual glitches on Queue rows. This way the node stays
  // stable and we just stop responding to new pan input.

  const snapToOrigin = () => {
    if (prefersReducedMotion) {
      x.set(0)
      return
    }

    void animate(x, 0, {
      type: 'spring',
      stiffness: 500,
      damping: 40,
    })
  }

  const handleDragEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const offset = info.offset.x
    if (offset <= -threshold && rightAction) {
      setCommitting(true)
      rightAction.onTrigger()
      // Snap back after the action fires so the row returns to rest. If the
      // action removed the row from the list it unmounts before this runs —
      // harmless either way.
      snapToOrigin()
      setCommitting(false)
    } else if (offset >= threshold && leftAction) {
      setCommitting(true)
      leftAction.onTrigger()
      snapToOrigin()
      setCommitting(false)
    } else {
      snapToOrigin()
    }
  }

  const isSwipeEnabled = Boolean(leftAction || rightAction)

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Left-edge action trail — revealed on swipe right */}
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

      {/* Right-edge action trail — revealed on swipe left */}
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
        dragConstraints={{ left: -MAX_DRAG, right: MAX_DRAG }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x }}
        // Reduced motion: disable the spring so snap-back is instant.
        transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
        className="relative touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  )
}
