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
  threshold: rawThreshold = 80,
  maxPullDistance = 150,
  enabled = true,
}: UsePullToRefreshOptions) {
  // The rubber-band curve asymptotes at maxPullDistance — it never quite
  // reaches it. Guarantee the trigger stays reachable by clamping threshold
  // below what the asymptote actually produces for any raw pull. Also warn
  // in development so misconfiguration is surfaced immediately.
  const threshold = Math.min(rawThreshold, maxPullDistance * 0.9)
  if (import.meta.env.DEV && rawThreshold > maxPullDistance * 0.9) {
    // eslint-disable-next-line no-console
    console.warn(
      `[usePullToRefresh] threshold (${rawThreshold}) must stay below ` +
      `90% of maxPullDistance (${maxPullDistance}) or the rubber-band curve ` +
      `can't reach it. Clamped to ${threshold}.`,
    )
  }

  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef<number>(0)
  const scrollY = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  // Tracks the post-refresh "hold spinner" timeout so we can cancel it on
  // unmount — otherwise setIsRefreshing(false) fires on an unmounted hook,
  // logging a React warning and flaking StrictMode double-invoke tests.
  const refreshHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

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
        // instantaneous-resolve cases (local KV refreshes, etc.). Stored
        // in a ref so the unmount cleanup can clear it.
        if (refreshHoldTimer.current) clearTimeout(refreshHoldTimer.current)
        refreshHoldTimer.current = setTimeout(() => {
          if (isMountedRef.current) setIsRefreshing(false)
          refreshHoldTimer.current = null
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

  // Cancel any pending refresh-hold timeout on unmount so setIsRefreshing
  // doesn't fire on an unmounted hook.
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (refreshHoldTimer.current) {
        clearTimeout(refreshHoldTimer.current)
        refreshHoldTimer.current = null
      }
    }
  }, [])

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
