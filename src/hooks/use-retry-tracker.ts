import { useState, useCallback } from 'react'

export interface RetryState {
  id: string
  operation: string
  attempt: number
  maxAttempts: number
  nextRetryIn?: number
  error?: string
  timestamp: number
}

export interface RetryTrackerState {
  activeRetries: RetryState[]
  completedRetries: RetryState[]
  failedRetries: RetryState[]
}

let globalRetryId = 0

export function useRetryTracker() {
  const [state, setState] = useState<RetryTrackerState>({
    activeRetries: [],
    completedRetries: [],
    failedRetries: [],
  })

  const startRetry = useCallback((operation: string, maxAttempts: number = 3): string => {
    const id = `retry-${++globalRetryId}`
    const retryState: RetryState = {
      id,
      operation,
      attempt: 1,
      maxAttempts,
      timestamp: Date.now(),
    }

    setState((prev) => ({
      ...prev,
      activeRetries: [...prev.activeRetries, retryState],
    }))

    return id
  }, [])

  const updateRetry = useCallback((id: string, attempt: number, nextRetryIn?: number, error?: string) => {
    setState((prev) => ({
      ...prev,
      activeRetries: prev.activeRetries.map((retry) =>
        retry.id === id
          ? { ...retry, attempt, nextRetryIn, error, timestamp: Date.now() }
          : retry
      ),
    }))
  }, [])

  const completeRetry = useCallback((id: string, success: boolean = true) => {
    setState((prev) => {
      const retry = prev.activeRetries.find((r) => r.id === id)
      if (!retry) return prev

      const updatedRetry = { ...retry, timestamp: Date.now() }

      return {
        ...prev,
        activeRetries: prev.activeRetries.filter((r) => r.id !== id),
        completedRetries: success
          ? [...prev.completedRetries, updatedRetry].slice(-10)
          : prev.completedRetries,
        failedRetries: !success
          ? [...prev.failedRetries, updatedRetry].slice(-10)
          : prev.failedRetries,
      }
    })
  }, [])

  const clearCompleted = useCallback(() => {
    setState((prev) => ({
      ...prev,
      completedRetries: [],
      failedRetries: [],
    }))
  }, [])

  return {
    state,
    startRetry,
    updateRetry,
    completeRetry,
    clearCompleted,
    hasActiveRetries: state.activeRetries.length > 0,
    retryCount: state.activeRetries.length,
  }
}
