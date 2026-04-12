import { motion, AnimatePresence } from 'framer-motion'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface PullToRefreshIndicatorProps {
  isPulling: boolean
  isRefreshing: boolean
  pullDistance: number
  progress: number
  shouldTrigger: boolean
}

// AppHeader is h-11 = 44px. The indicator sits immediately below it.
// We add env(safe-area-inset-top) for notched devices.
const HEADER_OFFSET = 'calc(44px + env(safe-area-inset-top, 0px))'

export function PullToRefreshIndicator({
  isPulling,
  isRefreshing,
  pullDistance,
  progress,
  shouldTrigger,
}: PullToRefreshIndicatorProps) {
  const isVisible = isPulling || isRefreshing
  const indicatorHeight = isRefreshing ? 60 : Math.max(pullDistance, 0)

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.1 }}
          className="fixed left-0 right-0 z-40 flex items-center justify-center pointer-events-none overflow-hidden"
          style={{
            top: HEADER_OFFSET,
            height: indicatorHeight,
            // GPU-composited: no layout impact
            willChange: 'opacity',
          }}
        >
          <div className="relative flex flex-col items-center justify-end pb-2 h-full">
            <motion.div
              animate={{
                rotate: isRefreshing ? 360 : shouldTrigger ? 180 : progress * 180,
                scale: isRefreshing ? 1 : Math.max(0.65, Math.min(progress * 1.15, 1)),
              }}
              transition={{
                rotate: isRefreshing
                  ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                  : { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] },
                scale: { duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] },
              }}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors duration-200",
                shouldTrigger || isRefreshing
                  ? "bg-b1 shadow-lg shadow-b1/25"
                  : "bg-s1/90 border border-s2"
              )}
            >
              <ArrowsClockwise
                className={cn(
                  "transition-colors duration-200",
                  shouldTrigger || isRefreshing ? "text-white" : "text-t3"
                )}
                size={20}
                weight="bold"
              />
            </motion.div>

            <motion.div
              animate={{
                opacity: shouldTrigger || isRefreshing ? 1 : 0,
                scale: shouldTrigger || isRefreshing ? 1 : 0.85,
              }}
              transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mt-1.5 text-[10px] font-bold uppercase tracking-wider"
            >
              <span className={cn(
                "transition-colors duration-200",
                isRefreshing ? "text-b1" : shouldTrigger ? "text-b1" : "text-t3"
              )}>
                {isRefreshing ? 'Refreshing…' : 'Release to refresh'}
              </span>
            </motion.div>

            {!isRefreshing && progress > 0.1 && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-s1 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-b1 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.05 }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
