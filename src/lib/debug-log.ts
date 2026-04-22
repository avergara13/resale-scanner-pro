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

// Query-string params whose values must never hit the persisted log or the
// in-app DEBUG panel. Covers every provider key we currently embed in URLs
// (Gemini, Google Cloud, Claude OAuth) plus generic names other SDKs emit.
const SENSITIVE_QUERY_PARAMS = new Set([
  'key',
  'apikey',
  'api_key',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'auth',
  'client_secret',
  'password',
])

const SENSITIVE_OBJECT_KEYS = new Set([
  'authorization',
  'apikey',
  'api_key',
  'x-api-key',
  'access_token',
  'refresh_token',
  'client_secret',
  'password',
])

/**
 * Strip query-string values for any `?key=…` style secret. Non-URL strings
 * pass through untouched. URL parsing failures fall back to regex so a
 * malformed URL cannot bypass redaction.
 */
export function redactUrl(value: string): string {
  if (!value.includes('?')) return value
  try {
    const url = new URL(value)
    let changed = false
    url.searchParams.forEach((_, name) => {
      if (SENSITIVE_QUERY_PARAMS.has(name.toLowerCase())) {
        url.searchParams.set(name, '[REDACTED]')
        changed = true
      }
    })
    return changed ? url.toString() : value
  } catch {
    return value.replace(
      /([?&](?:key|apikey|api_key|token|access_token|refresh_token|authorization|auth|client_secret|password)=)[^&#\s]+/gi,
      '$1[REDACTED]',
    )
  }
}

/**
 * Deep-redact: recurse through plain objects/arrays, redact URL-shaped strings
 * and sensitive header/field keys. Non-string leaves pass through.
 * Bounds recursion depth so a pathological payload cannot hang the logger.
 */
function redactPayload(input: unknown, depth = 0): unknown {
  if (depth > 6) return input
  if (input == null) return input
  if (typeof input === 'string') return redactUrl(input)
  if (Array.isArray(input)) return input.map(v => redactPayload(v, depth + 1))
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_OBJECT_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = redactPayload(v, depth + 1)
      }
    }
    return out
  }
  return input
}

/**
 * Dispatch a debug event. App.tsx will catch and persist.
 * Currently a no-op body — wiring added in follow-up session.
 */
export function logDebug(
  message: string,
  level: DebugLevel = 'info',
  source: string = 'app',
  data?: unknown,
): void {
  const entry: DebugEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    level,
    source,
    message: redactUrl(message),
    data: data !== undefined ? JSON.stringify(redactPayload(data)).slice(0, 500) : undefined,
  }
  // Dispatch event — App.tsx listener wired in follow-up session
  window.dispatchEvent(new CustomEvent('rsp:debug', { detail: entry }))
}
