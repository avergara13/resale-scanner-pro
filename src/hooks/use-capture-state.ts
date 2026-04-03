import { useState, useCallback, useEffect } from 'react'

export type CaptureState = 'idle' | 'capturing' | 'analyzing' | 'success' | 'fail'

export function useCaptureState() {
  const [captureState, setCaptureState] = useState<CaptureState>('idle')
  const [stateTimeout, setStateTimeout] = useState<number | null>(null)

  useEffect(() => {
    return () => {
      if (stateTimeout) {
        clearTimeout(stateTimeout)
      }
    }
  }, [stateTimeout])

  const triggerCapture = useCallback(() => {
    setCaptureState('capturing')
    const timeout = setTimeout(() => {
      setCaptureState('idle')
    }, 600)
    setStateTimeout(timeout)
  }, [])

  const startAnalyzing = useCallback(() => {
    if (stateTimeout) clearTimeout(stateTimeout)
    setCaptureState('analyzing')
  }, [stateTimeout])

  const triggerSuccess = useCallback(() => {
    if (stateTimeout) clearTimeout(stateTimeout)
    setCaptureState('success')
    const timeout = setTimeout(() => {
      setCaptureState('idle')
    }, 800)
    setStateTimeout(timeout)
  }, [stateTimeout])

  const triggerFail = useCallback(() => {
    if (stateTimeout) clearTimeout(stateTimeout)
    setCaptureState('fail')
    const timeout = setTimeout(() => {
      setCaptureState('idle')
    }, 800)
    setStateTimeout(timeout)
  }, [stateTimeout])

  const reset = useCallback(() => {
    if (stateTimeout) clearTimeout(stateTimeout)
    setCaptureState('idle')
  }, [stateTimeout])

  return {
    captureState,
    triggerCapture,
    startAnalyzing,
    triggerSuccess,
    triggerFail,
    reset,
  }
}
