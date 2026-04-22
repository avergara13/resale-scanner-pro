import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { haptics } from '@/lib/haptics'

// iOS-native pull-to-refresh dial.
//
// Design intent — iOS Mail / Safari / Notes:
//   • Single circular dial that fills clockwise as the user pulls.
//   • No text label. No separate progress bar. Just the dial.
//   • 28 px footprint — Apple's actual PTR size, not a custom 40 px pill.
//   • Stroke opacity tracks progress so the dial fades in as it fills.
//   • On refresh: same dial, constant-rotation spinner — no morph, no arrow flip.
//   • A light haptic tick the moment the threshold is crossed (the "click").
//   • iOS system spring for the scale/opacity transition, not a generic easeOut.
//
// The dial sits immediately below the fixed AppHeader (h-11 + safe-area-top).
// Fade opacity lives on the outer wrapper so the dial never pops in hard.

interface PullToRefreshIndicatorProps {
  isPulling: boolean
  isRefreshing: boolean
  pullDistance: number
  progress: number
  shouldTrigger: boolean
}

const HEADER_OFFSET = 'calc(44px + env(safe-area-inset-top, 0px))'

// 28 px outer size, 2 px stroke, leaves ~12 px inner radius after half-stroke.
const DIAL_SIZE = 28
const STROKE_WIDTH = 2
const RADIUS = (DIAL_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function PullToRefreshIndicator({
  isPulling,
  isRefreshing,
  pullDistance,
  progress,
  shouldTrigger,
}: PullToRefreshIndicatorProps) {
  const isVisible = isPulling || isRefreshing
  const indicatorHeight = isRefreshing ? 60 : Math.max(pullDistance, 0)

  // Haptic tick on the rising edge of shouldTrigger — the "click" moment.
  // Routed through the shared haptics helper (AGENTS.md: lib/haptics.ts is
  // the single source of truth) so future bridge/fallback changes apply
  // uniformly across screens.
  const prevTriggered = useRef(false)
  useEffect(() => {
    if (shouldTrigger && !prevTriggered.current) {
      haptics.selection()
    }
    prevTriggered.current = shouldTrigger
  }, [shouldTrigger])

  // Progress → stroke-dashoffset. At progress=0 the circle is invisible
  // (dash offset = full circumference); at progress=1 it's a complete ring.
  const dashOffset = CIRCUMFERENCE * (1 - Math.min(Math.max(progress, 0), 1))

  // Dial fades in from 0.05 so an idle-at-zero state isn't a visible ghost.
  const dialOpacity = Math.min(progress * 1.4, 1)

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
          className="fixed left-0 right-0 z-40 flex items-center justify-center pointer-events-none overflow-hidden"
          style={{
            top: HEADER_OFFSET,
            height: indicatorHeight,
            willChange: 'opacity',
          }}
        >
          <motion.div
            animate={{
              rotate: isRefreshing ? 360 : 0,
              scale: isRefreshing ? 1 : Math.max(0.85, Math.min(progress * 1.1, 1)),
            }}
            transition={{
              rotate: isRefreshing
                ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                : { type: 'spring', stiffness: 400, damping: 40 },
              scale: { type: 'spring', stiffness: 400, damping: 40 },
            }}
            className={cn(
              'flex items-center justify-center',
              // subtle drop shadow at rest, b1-tinted when armed/refreshing
              shouldTrigger || isRefreshing ? 'text-b1' : 'text-t3',
            )}
            style={{
              width: DIAL_SIZE,
              height: DIAL_SIZE,
              opacity: isRefreshing ? 1 : dialOpacity,
            }}
          >
            <svg
              width={DIAL_SIZE}
              height={DIAL_SIZE}
              viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
              aria-hidden
            >
              {/* Track — faint ring at low opacity so the dial has a home. */}
              <circle
                cx={DIAL_SIZE / 2}
                cy={DIAL_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeOpacity={isRefreshing ? 0.15 : 0.12}
              />
              {/* Progress arc — fills clockwise as the user pulls. */}
              <circle
                cx={DIAL_SIZE / 2}
                cy={DIAL_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                // On refresh show a 25%-arc that rotates; on pull, a progress arc.
                strokeDashoffset={isRefreshing ? CIRCUMFERENCE * 0.75 : dashOffset}
                // Start the arc at 12 o'clock (default is 3 o'clock in SVG).
                transform={`rotate(-90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
                style={{
                  transition: isRefreshing
                    ? 'none'
                    : 'stroke-dashoffset 80ms linear',
                }}
              />
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
