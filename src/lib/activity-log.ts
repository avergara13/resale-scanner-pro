/**
 * Activity log — lightweight event bus for silent app activity.
 *
 * Components call logActivity() instead of toast.success/info.
 * App.tsx listens on the custom event and writes to KV.
 * SettingsScreen reads the KV key and displays Recent Activity.
 */

export interface ActivityEntry {
  id: string
  timestamp: number
  message: string
  type: 'success' | 'info' | 'error'
}

export const ACTIVITY_LOG_KEY = 'activity-log'
export const MAX_ACTIVITY_ENTRIES = 100

/**
 * Dispatch a silent activity event. App.tsx catches it and persists to KV.
 * Safe to call from any module — no React hooks needed.
 */
export function logActivity(message: string, type: ActivityEntry['type'] = 'success'): void {
  const entry: ActivityEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    message,
    type,
  }
  window.dispatchEvent(new CustomEvent('rsp:activity', { detail: entry }))
}
