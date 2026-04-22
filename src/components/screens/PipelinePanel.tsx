import { Eye, MagnifyingGlass, TrendUp, Calculator, CheckCircle, Lightning, Clock } from '@phosphor-icons/react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { PipelineStep } from '@/types'

interface PipelinePanelProps {
  steps: PipelineStep[]
}

const phaseConfig = {
  vision: { 
    icon: Eye, 
    label: '1. IDENTIFYING ITEM', 
    detail: 'Visual matching & OCR...',
    duration: 3.5,
    progressSteps: [0, 0.25, 0.5, 0.75, 0.95],
    progressTiming: [0, 0.25, 0.5, 0.75, 1],
    gradient: 'from-violet-500/20 via-blue-500/20 to-cyan-500/20'
  },
  lens: { 
    icon: MagnifyingGlass, 
    label: '2. GOOGLE LENS', 
    detail: 'Finding similar items...',
    duration: 2.8,
    progressSteps: [0, 0.35, 0.65, 0.85, 0.95],
    progressTiming: [0, 0.3, 0.6, 0.85, 1],
    gradient: 'from-blue-500/20 via-cyan-500/20 to-teal-500/20'
  },
  market: { 
    icon: TrendUp, 
    label: '3. MARKET VELOCITY', 
    detail: 'Sell-through rate calculation...',
    duration: 4.2,
    progressSteps: [0, 0.20, 0.45, 0.70, 0.90],
    progressTiming: [0, 0.2, 0.5, 0.8, 1],
    gradient: 'from-cyan-500/20 via-teal-500/20 to-emerald-500/20'
  },
  profit: {
    icon: Calculator,
    label: '4. ANALYZING',
    detail: 'Fees, shipping & net profit...',
    duration: 1.8,
    progressSteps: [0, 0.40, 0.70, 0.90, 0.95],
    progressTiming: [0, 0.35, 0.65, 0.9, 1],
    gradient: 'from-teal-500/20 via-emerald-500/20 to-green-500/20'
  },
  decision: { 
    icon: CheckCircle, 
    label: '5. FINAL DECISION', 
    detail: 'Agentic recommendation...',
    duration: 2.2,
    progressSteps: [0, 0.30, 0.60, 0.85, 0.95],
    progressTiming: [0, 0.3, 0.6, 0.85, 1],
    gradient: 'from-emerald-500/20 via-green-500/20 to-lime-500/20'
  },
}

function AnimatedPercentage({ targetValue, isActive }: { targetValue: number; isActive: boolean }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, Math.round)
  const displayValue = useTransform(rounded, (latest) => `${latest}%`)

  useEffect(() => {
    if (isActive) {
      const controls = animate(count, targetValue, {
        duration: 0.5,
        ease: 'easeOut'
      })
      return controls.stop
    }
  }, [count, targetValue, isActive])

  if (!isActive) {
    return <span className="text-xs sm:text-sm font-mono font-bold text-t3">{targetValue}%</span>
  }

  return (
    <motion.span className="text-xs sm:text-sm font-mono font-black text-b1 tabular-nums">
      {displayValue}
    </motion.span>
  )
}

export function PipelinePanel({ steps }: PipelinePanelProps) {
  // Peak progress since the last scan reset. Framer-motion smoothly animates
  // the height of the progress bar, so any regression — even for a single
  // frame — is visible to the user as a rubber-band backwards jump. We clamp
  // the rendered value to max(current, peak) so the bar never regresses
  // mid-scan. Reset to 0 when the steps array empties (new scan starting).
  const peakRef = useRef(0)
  const prevLengthRef = useRef(0)

  if (steps.length === 0) {
    peakRef.current = 0
    prevLengthRef.current = 0
    return null
  }

  // Warn in dev if the caller grows the steps array mid-scan — that's what
  // used to cause the 59% → 40% regression: denominator went from 5 to 6
  // between frames. Phases should be pre-allocated once per scan.
  if (import.meta.env.DEV && prevLengthRef.current > 0 && steps.length !== prevLengthRef.current) {
    // eslint-disable-next-line no-console
    console.warn(
      `[PipelinePanel] steps.length changed mid-scan (${prevLengthRef.current} → ${steps.length}). ` +
        `Pre-allocate all phases before the scan starts to keep progress monotonic.`,
    )
  }
  prevLengthRef.current = steps.length

  // Weighted progress: partial credit for the step currently processing so
  // the bar advances smoothly between phase boundaries instead of jumping
  // 20% chunks. error counts as "done-ish" for progress purposes — the bar
  // filling while an error card shows is the correct signal.
  const weighted = steps.reduce((acc, s) => {
    if (s.status === 'complete' || s.status === 'error') return acc + 1
    if (s.status === 'processing') {
      const p = typeof s.progress === 'number' ? s.progress : 0
      return acc + Math.max(0, Math.min(100, p)) / 100
    }
    return acc
  }, 0)
  const raw = (weighted / steps.length) * 100
  const progressPercentage = Math.max(raw, peakRef.current)
  peakRef.current = progressPercentage

  return (
    <div id="ai-pipeline" className="space-y-1.5 sm:space-y-2 relative">
      <div className="absolute left-[15px] sm:left-[17px] md:left-[19px] top-4 sm:top-5 md:top-6 bottom-4 sm:bottom-5 md:bottom-6 w-[2px] bg-s2 overflow-hidden rounded-full">
        <motion.div
          className="absolute top-0 left-0 w-full bg-gradient-to-b from-violet-500 via-cyan-500 to-green rounded-full shadow-[0_0_12px_oklch(0.55_0.20_180_/_0.4)]"
          initial={{ height: '0%' }}
          animate={{ height: `${progressPercentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {steps.map((step, index) => {
        const config = phaseConfig[step.id]
        const isProcessing = step.status === 'processing'
        const isComplete = step.status === 'complete'
        const isError = step.status === 'error'
        const isPending = step.status === 'pending'

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            id={`phase-${step.id}`}
            className={cn(
              'pipeline-card relative pipeline-step-transition overflow-hidden',
              isComplete && 'done',
              isProcessing && 'running',
              isPending && 'pending',
              isError && 'error'
            )}
          >
            {isProcessing && (
              <>
                <motion.div
                  className={cn(
                    'absolute inset-0 bg-gradient-to-br opacity-30 blur-sm',
                    config.gradient
                  )}
                  animate={{
                    opacity: [0.2, 0.4, 0.2],
                    scale: [1, 1.02, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                  animate={{
                    x: ['-100%', '200%']
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: 'linear'
                  }}
                />
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-b1 rounded-full shadow-[0_0_8px_oklch(0.50_0.18_250)]"
                    initial={{
                      x: `${20 + i * 30}%`,
                      y: '100%',
                      opacity: 0
                    }}
                    animate={{
                      y: ['-10%'],
                      opacity: [0, 1, 0]
                    }}
                    transition={{
                      duration: 2 + i * 0.5,
                      repeat: Infinity,
                      delay: i * 0.4,
                      ease: 'easeOut'
                    }}
                  />
                ))}
              </>
            )}
            
            {isComplete && (
              <>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-green/10 via-emerald-500/5 to-transparent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                />
                <motion.div
                  className="absolute top-0 right-0 w-20 h-20 bg-green/20 rounded-full blur-2xl"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.6 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </>
            )}

            {isError && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-red/10 via-red/5 to-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            )}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div
                  className={cn(
                    'w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 flex-shrink-0 border-2',
                    isComplete && 'bg-green text-white border-green shadow-[0_0_16px_oklch(0.55_0.20_145_/_0.5)]',
                    isProcessing && 'bg-b1 text-white border-b1 shadow-[0_0_20px_oklch(0.50_0.18_250_/_0.6)]',
                    isPending && 'bg-s1 text-t3 border-s2',
                    isError && 'bg-red text-white border-red shadow-[0_0_16px_oklch(0.55_0.22_25_/_0.5)]'
                  )}
                >
                  {isProcessing && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-b1/20"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0, 0.5]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeOut'
                      }}
                    />
                  )}
                  {isComplete ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.5, type: 'spring', bounce: 0.5 }}
                    >
                      <CheckCircle className="w-[14px] h-[14px] sm:w-[15px] sm:h-[15px] md:w-4 md:h-4" weight="fill" />
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Lightning className="w-[14px] h-[14px] sm:w-[15px] sm:h-[15px] md:w-4 md:h-4" weight="fill" />
                    </motion.div>
                  ) : (
                    <Clock className="w-[12px] h-[12px] sm:w-[13px] sm:h-[13px] md:w-[14px] md:h-[14px]" weight="bold" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11px] sm:text-xs md:text-sm font-bold text-t1 uppercase tracking-wide">{config.label}</h4>
                  {(isProcessing || step.data) && (
                    <motion.p 
                      className="text-[10px] sm:text-[11px] md:text-xs text-t2 mt-0.5 sm:mt-1 font-medium line-clamp-2"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {step.data && typeof step.data === 'string' ? step.data : config.detail}
                    </motion.p>
                  )}
                  {step.error && (
                    <motion.p 
                      className="text-[10px] sm:text-[11px] md:text-xs text-red mt-0.5 sm:mt-1 font-semibold line-clamp-1"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {step.error}
                    </motion.p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-1 sm:ml-2">
                {isProcessing && (
                  <AnimatedPercentage 
                    targetValue={step.progress ?? 0} 
                    isActive={true}
                  />
                )}
                {isComplete && (
                  <motion.span 
                    className="text-xs sm:text-sm font-mono font-black text-green tabular-nums"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, type: 'spring' }}
                  >
                    100%
                  </motion.span>
                )}
                {isPending && (
                  <span className="text-xs sm:text-sm font-mono font-bold text-t3 tabular-nums">0%</span>
                )}
                {isError && (
                  <motion.span 
                    className="text-xs sm:text-sm font-mono font-black text-red tabular-nums"
                    animate={{ x: [-2, 2, -2, 2, 0] }}
                    transition={{ duration: 0.4 }}
                  >
                    ERR
                  </motion.span>
                )}
              </div>
            </div>

            {isProcessing && (
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-s1 via-s2 to-s1 overflow-hidden rounded-b-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  className="h-full relative"
                  style={{
                    background: 'linear-gradient(90deg, oklch(0.50 0.18 250), oklch(0.68 0.18 75), oklch(0.52 0.20 145), oklch(0.50 0.18 250))',
                    backgroundSize: '300% 100%'
                  }}
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: config.progressSteps.map(val => `${val * 100}%`),
                    backgroundPosition: ['0% 50%', '100% 50%', '200% 50%']
                  }}
                  transition={{
                    width: {
                      duration: config.duration,
                      ease: 'easeOut',
                      times: config.progressTiming
                    },
                    backgroundPosition: {
                      duration: config.duration * 1.2,
                      ease: 'linear',
                      repeat: Infinity
                    }
                  }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{
                      x: ['-100%', '200%']
                    }}
                    transition={{
                      duration: config.duration * 0.6,
                      ease: 'easeInOut',
                      repeat: Infinity
                    }}
                  />
                  <motion.div
                    className="absolute inset-0"
                    animate={{
                      boxShadow: [
                        '0 0 8px oklch(0.50 0.18 250 / 0.4)',
                        '0 0 16px oklch(0.68 0.18 75 / 0.6)',
                        '0 0 8px oklch(0.50 0.18 250 / 0.4)'
                      ]
                    }}
                    transition={{
                      duration: 1.5,
                      ease: 'easeInOut',
                      repeat: Infinity
                    }}
                  />
                </motion.div>
              </motion.div>
            )}

            {isComplete && (
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-1 bg-s1 overflow-hidden rounded-b-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-green via-emerald-400 to-green relative"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute inset-0"
                    initial={{ boxShadow: '0 0 0px oklch(0.55 0.20 145 / 0)' }}
                    animate={{ boxShadow: '0 0 12px oklch(0.55 0.20 145 / 0.6)' }}
                    transition={{ duration: 0.5 }}
                  />
                </motion.div>
              </motion.div>
            )}

            {isError && (
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-1 bg-s1 overflow-hidden rounded-b-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-red via-orange-500 to-red"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </motion.div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
