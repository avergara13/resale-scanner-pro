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

export function PullToRefreshIndicator({
  isPulling,
  isRefreshing,
  pullDistance,
  progress,
  shouldTrigger,
}: PullToRefreshIndicatorProps) {
  const isVisible = isPulling || isRefreshing

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
          style={{
            height: Math.max(pullDistance, 60),
          }}
        >
          <div className="relative flex flex-col items-center justify-end pb-2 h-full">
            <motion.div
              animate={{
                rotate: isRefreshing ? 360 : shouldTrigger ? 180 : progress * 180,
                scale: isRefreshing ? 1 : Math.max(0.7, Math.min(progress * 1.2, 1)),
              }}
              transition={{
                rotate: isRefreshing 
                  ? { duration: 1, repeat: Infinity, ease: 'linear' }
                  : { duration: 0.3, ease: 'easeOut' },
                scale: { duration: 0.2, ease: 'easeOut' },
              }}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors duration-300",
                shouldTrigger || isRefreshing
                  ? "bg-b1 shadow-lg shadow-b1/30"
                  : "bg-s1 border border-s2"
              )}
            >
              <ArrowsClockwise
                className={cn(
                  "transition-colors duration-300",
                  shouldTrigger || isRefreshing ? "text-white" : "text-t3"
                )}
                size={24}
                weight="bold"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: shouldTrigger || isRefreshing ? 1 : 0,
                scale: shouldTrigger || isRefreshing ? 1 : 0.8,
              }}
              transition={{ duration: 0.2 }}
              className="mt-2 text-xs font-bold uppercase tracking-wider"
            >
              <span className={cn(
                "transition-colors duration-300",
                isRefreshing ? "text-b1" : shouldTrigger ? "text-b1" : "text-t3"
              )}>
                {isRefreshing ? 'Refreshing...' : 'Release to refresh'}
              </span>
            </motion.div>

            {!isRefreshing && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-s1 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-b1"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
