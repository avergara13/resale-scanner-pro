import { useEffect, useRef, useState, useCallback } from 'react'

// Pull-to-refresh hook with iOS-native rubber-band resistance.
//
// The resistance curve is asymptotic — the pull gets progressively heavier
// and approaches `maxPullDistance` without ever quite reaching it:
//
//   adjusted = maxPullDistance * (1 - 1 / (1 + raw / maxPullDistance))
//
// This is the canonical iOS feel. A linear `raw / resistance` cap jumps
// abruptly at the max; the asymptote gives the elastic "can always pull
// a little more, but it resists" sensation.

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  /** Distance in px past which release triggers a refresh. Default 80. */
  threshold?: number
  /** Soft ceiling — the pull asymptotes here, never quite reaching it. Default 150. */
  maxPullDistance?: number
  enabled?: boolean
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPullDistance = 150,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef<number>(0)
  const scrollY = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing) return

    const container = containerRef.current
    if (!container) return

    const scrollTop = container.scrollTop || window.scrollY || document.documentElement.scrollTop
    scrollY.current = scrollTop

    if (scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY
    }
  }, [enabled, isRefreshing])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing || touchStartY.current === 0) return

    const container = containerRef.current
    if (!container) return

    const scrollTop = container.scrollTop || window.scrollY || document.documentElement.scrollTop

    if (scrollTop > 0) {
      touchStartY.current = 0
      setIsPulling(false)
      setPullDistance(0)
      return
    }

    const touchY = e.touches[0].clientY
    const rawDistance = touchY - touchStartY.current

    if (rawDistance > 0) {
      e.preventDefault()
      setIsPulling(true)
      // Rubber-band asymptote: near-linear near zero, asymptotes at maxPullDistance.
      // At raw=max, adjusted ≈ 0.5*max. At raw=3*max, adjusted ≈ 0.75*max. Never quite reaches.
      const adjustedDistance = maxPullDistance * (1 - 1 / (1 + rawDistance / maxPullDistance))
      setPullDistance(adjustedDistance)
    }
  }, [enabled, isRefreshing, maxPullDistance])

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing) return

    if (pullDistance >= threshold) {
      setIsRefreshing(true)
      setIsPulling(false)
      setPullDistance(0)

      try {
        await onRefresh()
      } catch (error) {
        console.error('Refresh failed:', error)
      } finally {
        // Hold the spinner briefly so the refresh state is visible even on
        // instantaneous-resolve cases (local KV refreshes, etc.).
        setTimeout(() => {
          setIsRefreshing(false)
        }, 400)
      }
    } else {
      setIsPulling(false)
      setPullDistance(0)
    }

    touchStartY.current = 0
  }, [enabled, isRefreshing, pullDistance, threshold, onRefresh])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd])

  const progress = Math.min(pullDistance / threshold, 1)
  const shouldTrigger = pullDistance >= threshold

  return {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    progress,
    shouldTrigger,
  }
}
