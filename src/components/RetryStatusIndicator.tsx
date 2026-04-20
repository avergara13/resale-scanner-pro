import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowClockwise, Warning, CheckCircle, XCircle } from '@phosphor-icons/react'
import type { RetryState } from '@/hooks/use-retry-tracker'
import { cn } from '@/lib/utils'

interface RetryStatusIndicatorProps {
  activeRetries: RetryState[]
  showCompleted?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  compact?: boolean
}

function formatTimeRemaining(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${Math.ceil(ms / 1000)}s`
}

export function RetryStatusIndicator({
  activeRetries,
  showCompleted = false,
  position = 'top-right',
  compact = false,
}: RetryStatusIndicatorProps) {
  const [countdown, setCountdown] = useState<Record<string, number>>({})

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(() => {
        const next: Record<string, number> = {}
        activeRetries.forEach((retry) => {
          if (retry.nextRetryIn) {
            const elapsed = Date.now() - retry.timestamp
            const remaining = retry.nextRetryIn - elapsed
            next[retry.id] = Math.max(0, remaining)
          }
        })
        return next
      })
    }, 100)

    return () => clearInterval(interval)
  }, [activeRetries])

  const positionClasses = {
    'top-right': 'right-4',
    'top-left': 'left-4',
    'bottom-right': 'bottom-20 right-4',
    'bottom-left': 'bottom-20 left-4',
  }

  const topStyle = position === 'top-right' || position === 'top-left'
    ? { top: 'max(env(safe-area-inset-top, 0px), 1rem)' }
    : undefined

  if (activeRetries.length === 0 && !showCompleted) return null

  return (
    <div className={cn('fixed z-50', positionClasses[position])} style={topStyle}>
      <AnimatePresence mode="popLayout">
        {activeRetries.map((retry) => (
          <motion.div
            key={retry.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              'mb-2 rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-lg',
              compact ? 'px-3 py-2' : 'px-4 py-3'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  className="text-amber"
                >
                  <ArrowClockwise size={compact ? 18 : 20} weight="bold" />
                </motion.div>
                {retry.attempt > 1 && (
                  <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-white">
                    {retry.attempt}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className={cn('font-semibold text-t1', compact ? 'text-xs' : 'text-sm')}>
                  Retrying {retry.operation}
                </div>
                <div className={cn('text-t3', compact ? 'text-[10px]' : 'text-xs')}>
                  Attempt {retry.attempt} of {retry.maxAttempts}
                  {countdown[retry.id] !== undefined && countdown[retry.id] > 0 && (
                    <span className="ml-2 text-amber">
                      Next in {formatTimeRemaining(countdown[retry.id])}
                    </span>
                  )}
                </div>
                {retry.error && !compact && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-red">
                    <Warning size={12} weight="fill" />
                    <span className="truncate">{retry.error}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-0.5">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-s2">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber to-b1"
                    initial={{ width: 0 }}
                    animate={{ width: `${(retry.attempt / retry.maxAttempts) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="text-[9px] font-medium text-t4">
                  {Math.round((retry.attempt / retry.maxAttempts) * 100)}%
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

interface RetryToastProps {
  operation: string
  success: boolean
  attempts: number
}

export function RetryToast({ operation, success, attempts }: RetryToastProps) {
  return (
    <div className="flex items-center gap-3">
      {success ? (
        <CheckCircle size={20} weight="fill" className="text-green flex-shrink-0" />
      ) : (
        <XCircle size={20} weight="fill" className="text-red flex-shrink-0" />
      )}
      <div className="flex-1">
        <div className="font-semibold text-sm">
          {success ? 'Request Succeeded' : 'Request Failed'}
        </div>
        <div className="text-xs text-t3">
          {operation} {success ? 'completed' : 'failed'} after {attempts}{' '}
          {attempts === 1 ? 'attempt' : 'attempts'}
        </div>
      </div>
    </div>
  )
}
