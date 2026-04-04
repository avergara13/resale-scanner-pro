import { useCallback, useRef, useState } from 'react'
import { retryFetch, retryOperation, RetryOptions } from '@/lib/retry-service'
import { APIEndpoint, getRetryConfig, getRetryOptions, adjustRetryConfigByPriority } from '@/lib/retry-config'
import { useRetryTracker } from './use-retry-tracker'

export interface UseAPIRetryOptions {
  endpoint: APIEndpoint
  enableTracking?: boolean
  systemLoad?: 'low' | 'medium' | 'high'
  onRetryAttempt?: (attempt: number, delay: number, error: Error) => void
  onSuccess?: () => void
  onFailure?: (error: Error) => void
}

export interface APIRetryState {
  isLoading: boolean
  isRetrying: boolean
  currentAttempt: number
  maxAttempts: number
  lastError?: Error
  retryCount: number
}

export function useAPIRetry(options: UseAPIRetryOptions) {
  const { endpoint, enableTracking = true, systemLoad = 'medium', onRetryAttempt, onSuccess, onFailure } = options
  const { startRetry, updateRetry, completeRetry } = useRetryTracker()
  
  const [state, setState] = useState<APIRetryState>({
    isLoading: false,
    isRetrying: false,
    currentAttempt: 0,
    maxAttempts: 0,
    retryCount: 0,
  })
  
  const retryIdRef = useRef<string | null>(null)
  const config = getRetryConfig(endpoint)
  const retryOptions = adjustRetryConfigByPriority(endpoint, systemLoad)

  const fetchWithRetry = useCallback(
    async <T = any>(url: string, init?: RequestInit, customOptions?: Partial<RetryOptions>): Promise<T> => {
      const finalOptions: RetryOptions = {
        ...retryOptions,
        ...customOptions,
        onRetry: (error: Error, attempt: number, delay: number) => {
          setState((prev) => ({
            ...prev,
            isRetrying: true,
            currentAttempt: attempt,
            maxAttempts: finalOptions.maxRetries || 3,
            lastError: error,
            retryCount: prev.retryCount + 1,
          }))

          if (enableTracking && retryIdRef.current) {
            updateRetry(retryIdRef.current, attempt, delay, error.message)
          }

          if (onRetryAttempt) {
            onRetryAttempt(attempt, delay, error)
          }

          if (customOptions?.onRetry) {
            customOptions.onRetry(error, attempt, delay)
          }
        },
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        isRetrying: false,
        currentAttempt: 0,
        maxAttempts: finalOptions.maxRetries || 3,
        lastError: undefined,
      }))

      if (enableTracking) {
        retryIdRef.current = startRetry(
          `${endpoint}: ${url}`,
          finalOptions.maxRetries || 3
        )
      }

      try {
        const result = await retryFetch<T>(url, init, finalOptions)
        
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRetrying: false,
          currentAttempt: 0,
          lastError: undefined,
        }))

        if (enableTracking && retryIdRef.current) {
          completeRetry(retryIdRef.current, true)
          retryIdRef.current = null
        }

        if (onSuccess) {
          onSuccess()
        }

        return result
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRetrying: false,
          lastError: err,
        }))

        if (enableTracking && retryIdRef.current) {
          completeRetry(retryIdRef.current, false)
          retryIdRef.current = null
        }

        if (onFailure) {
          onFailure(err)
        }

        throw err
      }
    },
    [endpoint, retryOptions, enableTracking, startRetry, updateRetry, completeRetry, onRetryAttempt, onSuccess, onFailure]
  )

  const executeWithRetry = useCallback(
    async <T = any>(operation: () => Promise<T>, customOptions?: Partial<RetryOptions>): Promise<T> => {
      const finalOptions: RetryOptions = {
        ...retryOptions,
        ...customOptions,
        onRetry: (error: Error, attempt: number, delay: number) => {
          setState((prev) => ({
            ...prev,
            isRetrying: true,
            currentAttempt: attempt,
            maxAttempts: finalOptions.maxRetries || 3,
            lastError: error,
            retryCount: prev.retryCount + 1,
          }))

          if (enableTracking && retryIdRef.current) {
            updateRetry(retryIdRef.current, attempt, delay, error.message)
          }

          if (onRetryAttempt) {
            onRetryAttempt(attempt, delay, error)
          }

          if (customOptions?.onRetry) {
            customOptions.onRetry(error, attempt, delay)
          }
        },
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        isRetrying: false,
        currentAttempt: 0,
        maxAttempts: finalOptions.maxRetries || 3,
        lastError: undefined,
      }))

      if (enableTracking) {
        retryIdRef.current = startRetry(
          `${endpoint}: operation`,
          finalOptions.maxRetries || 3
        )
      }

      try {
        const result = await retryOperation<T>(operation, finalOptions)
        
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRetrying: false,
          currentAttempt: 0,
          lastError: undefined,
        }))

        if (enableTracking && retryIdRef.current) {
          completeRetry(retryIdRef.current, true)
          retryIdRef.current = null
        }

        if (onSuccess) {
          onSuccess()
        }

        return result
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRetrying: false,
          lastError: err,
        }))

        if (enableTracking && retryIdRef.current) {
          completeRetry(retryIdRef.current, false)
          retryIdRef.current = null
        }

        if (onFailure) {
          onFailure(err)
        }

        throw err
      }
    },
    [endpoint, retryOptions, enableTracking, startRetry, updateRetry, completeRetry, onRetryAttempt, onSuccess, onFailure]
  )

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isRetrying: false,
      currentAttempt: 0,
      maxAttempts: 0,
      retryCount: 0,
    })
    
    if (retryIdRef.current) {
      completeRetry(retryIdRef.current, false)
      retryIdRef.current = null
    }
  }, [completeRetry])

  return {
    fetchWithRetry,
    executeWithRetry,
    reset,
    state,
    config,
    isLoading: state.isLoading,
    isRetrying: state.isRetrying,
    currentAttempt: state.currentAttempt,
    maxAttempts: state.maxAttempts,
    lastError: state.lastError,
    retryCount: state.retryCount,
    endpointDescription: config.description,
    priority: config.priority,
  }
}
