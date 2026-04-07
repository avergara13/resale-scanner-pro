export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  timeout?: number
  retryableStatuses?: number[]
  shouldRetry?: (error: Error, attempt: number) => boolean
  onRetry?: (error: Error, attempt: number, delay: number) => void
}

export interface RetryResult<T> {
  data?: T
  error?: Error
  attempts: number
  totalTime: number
  success: boolean
}

const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504]

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  timeout: 30000,
  retryableStatuses: DEFAULT_RETRYABLE_STATUSES,
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public isTimeout: boolean = false,
    public isNetworkFailure: boolean = false
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}

function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>>): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1)
  const jitter = Math.random() * 0.1 * exponentialDelay
  return Math.min(exponentialDelay + jitter, options.maxDelay)
}

function isRetryableError(error: Error, status: number | undefined, options: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>>): boolean {
  if (error instanceof NetworkError) {
    if (error.isTimeout) return true
    if (error.isNetworkFailure) return true
    if (error.status && options.retryableStatuses.includes(error.status)) return true
  }
  
  if (status && options.retryableStatuses.includes(status)) return true
  
  const errorMessage = error.message.toLowerCase()
  const retryableMessages = [
    'network',
    'fetch',
    'timeout',
    'aborted',
    'failed to fetch',
    'networkerror',
    'econnreset',
    'econnrefused',
    'etimedout'
  ]
  
  return retryableMessages.some(msg => errorMessage.includes(msg))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function retryFetch<T = any>(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const startTime = Date.now()
  let lastError: Error | undefined
  
  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    const isLastAttempt = attempt === opts.maxRetries + 1
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout)
      
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const error = new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response.statusText
        )
        
        if (isLastAttempt || !isRetryableError(error, response.status, opts)) {
          if (opts.shouldRetry && !opts.shouldRetry(error, attempt)) {
            throw error
          }
          if (!opts.shouldRetry && (!isRetryableError(error, response.status, opts) || isLastAttempt)) {
            throw error
          }
        }
        
        lastError = error
        const delay = calculateDelay(attempt, opts)
        
        if (opts.onRetry) {
          opts.onRetry(error, attempt, delay)
        }
        
        await sleep(delay)
        continue
      }
      
      const contentType = response.headers.get('content-type')
      let data: any
      
      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else if (contentType?.includes('text/')) {
        data = await response.text()
      } else {
        data = await response.blob()
      }
      
      return data as T
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      
      const isTimeout = err.name === 'AbortError' || err.message.includes('aborted')
      const isNetworkFailure = err.message.includes('fetch') || err.message.includes('network')
      
      const networkError = new NetworkError(
        err.message,
        undefined,
        undefined,
        isTimeout,
        isNetworkFailure
      )
      
      if (isLastAttempt) {
        throw networkError
      }
      
      if (opts.shouldRetry && !opts.shouldRetry(networkError, attempt)) {
        throw networkError
      }
      
      if (!opts.shouldRetry && !isRetryableError(networkError, undefined, opts)) {
        throw networkError
      }
      
      lastError = networkError
      const delay = calculateDelay(attempt, opts)
      
      if (opts.onRetry) {
        opts.onRetry(networkError, attempt, delay)
      }
      
      await sleep(delay)
    }
  }
  
  throw lastError || new Error('Request failed after all retries')
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const startTime = Date.now()
  let lastError: Error | undefined
  
  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    const isLastAttempt = attempt === opts.maxRetries + 1
    
    try {
      const result = await operation()
      return result
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      
      if (isLastAttempt) {
        throw err
      }
      
      if (opts.shouldRetry && !opts.shouldRetry(err, attempt)) {
        throw err
      }
      
      if (!opts.shouldRetry && err instanceof NetworkError && !isRetryableError(err, err.status, opts)) {
        throw err
      }
      
      lastError = err
      const delay = calculateDelay(attempt, opts)
      
      if (opts.onRetry) {
        opts.onRetry(err, attempt, delay)
      }
      
      await sleep(delay)
    }
  }
  
  throw lastError || new Error('Operation failed after all retries')
}

export function createRetryWrapper(defaultOptions: RetryOptions = {}) {
  return {
    fetch: <T = any>(url: string, init?: RequestInit, options?: RetryOptions) =>
      retryFetch<T>(url, init, { ...defaultOptions, ...options }),
    
    operation: <T>(operation: () => Promise<T>, options?: RetryOptions) =>
      retryOperation<T>(operation, { ...defaultOptions, ...options }),
  }
}

export const aggressiveRetry = createRetryWrapper({
  maxRetries: 5,
  initialDelay: 500,
  maxDelay: 15000,
  backoffMultiplier: 2.5,
  timeout: 45000,
})
