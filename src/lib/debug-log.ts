/**
 * Debug console — structured log for AI-readable field diagnostics.
 * logDebug() is safe to call from anywhere — no React hooks needed.
 * Entries are persisted to KV under DEBUG_LOG_KEY.
 *
 * Wiring (console.error override, API intercept, network errors)
 * happens in a follow-up session. This file defines the contract.
 */

export type DebugLevel = 'error' | 'warn' | 'info' | 'debug'

export interface DebugEntry {
  id: string
  timestamp: number
  level: DebugLevel
  source: string        // e.g. 'gemini-service', 'retry-service', 'App'
  message: string
  data?: string         // JSON.stringify of any extra payload (truncated to 500 chars)
}

export const DEBUG_LOG_KEY = 'debug-log'
export const MAX_DEBUG_ENTRIES = 200

/**
 * Dispatch a debug event. App.tsx will catch and persist.
 * Currently a no-op body — wiring added in follow-up session.
 */
export function logDebug(
  message: string,
  level: DebugLevel = 'info',
  source: string = 'app',
  data?: unknown
): void {
  const entry: DebugEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    level,
    source,
    message,
    data: data !== undefined ? JSON.stringify(data).slice(0, 500) : undefined,
  }
  // Dispatch event — App.tsx listener wired in follow-up session
  window.dispatchEvent(new CustomEvent('rsp:debug', { detail: entry }))
}
