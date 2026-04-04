import { useEffect, useRef, useState, useCallback } from 'react'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
  maxPullDistance?: number
  resistance?: number
  enabled?: boolean
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPullDistance = 150,
  resistance = 2.5,
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
    const distance = touchY - touchStartY.current

    if (distance > 0) {
      e.preventDefault()
      setIsPulling(true)
      const adjustedDistance = Math.min(distance / resistance, maxPullDistance)
      setPullDistance(adjustedDistance)
    }
  }, [enabled, isRefreshing, resistance, maxPullDistance])

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
