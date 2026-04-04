import { createContext, useContext, ReactNode } from 'react'
import { useRetryTracker } from '@/hooks/use-retry-tracker'
import type { RetryState } from '@/hooks/use-retry-tracker'

interface RetryContextValue {
  state: {
    activeRetries: RetryState[]
    completedRetries: RetryState[]
    failedRetries: RetryState[]
  }
  startRetry: (operation: string, maxAttempts?: number) => string
  updateRetry: (id: string, attempt: number, nextRetryIn?: number, error?: string) => void
  completeRetry: (id: string, success?: boolean) => void
  clearCompleted: () => void
  hasActiveRetries: boolean
  retryCount: number
}

const RetryContext = createContext<RetryContextValue | null>(null)

export function RetryProvider({ children }: { children: ReactNode }) {
  const retryTracker = useRetryTracker()

  return (
    <RetryContext.Provider value={retryTracker}>
      {children}
    </RetryContext.Provider>
  )
}

export function useRetryContext() {
  const context = useContext(RetryContext)
  if (!context) {
    throw new Error('useRetryContext must be used within RetryProvider')
  }
  return context
}
