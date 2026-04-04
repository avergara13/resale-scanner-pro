import { useState, useCallback, useEffect, useRef } from 'react'

export type CaptureState = 'idle' | 'capturing' | 'analyzing' | 'success' | 'fail'

export function useCaptureState() {
  const [captureState, setCaptureState] = useState<CaptureState>('idle')
  const stateTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (stateTimeoutRef.current) {
        clearTimeout(stateTimeoutRef.current)
      }
    }
  }, [])

  const triggerCapture = useCallback(() => {
    if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current)
    setCaptureState('capturing')
    stateTimeoutRef.current = window.setTimeout(() => {
      setCaptureState('idle')
    }, 600)
  }, [])

  const startAnalyzing = useCallback(() => {
    if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current)
    setCaptureState('analyzing')
  }, [])

  const triggerSuccess = useCallback(() => {
    if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current)
    setCaptureState('success')
    stateTimeoutRef.current = window.setTimeout(() => {
      setCaptureState('idle')
    }, 800)
  }, [])

  const triggerFail = useCallback(() => {
    if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current)
    setCaptureState('fail')
    stateTimeoutRef.current = window.setTimeout(() => {
      setCaptureState('idle')
    }, 800)
  }, [])

  const reset = useCallback(() => {
    if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current)
    setCaptureState('idle')
  }, [])

  return {
    captureState,
    triggerCapture,
    startAnalyzing,
    triggerSuccess,
    triggerFail,
    reset,
  }
}
