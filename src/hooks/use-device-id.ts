import { useRef } from 'react'

const DEVICE_ID_KEY = 'rsp-device-id'

/**
 * Returns a stable, device-local UUID that persists across sessions.
 * Stored in localStorage (never cloud-synced) so each physical device
 * gets its own identity — used to namespace KV keys that must not
 * collide between devices (currentSession, settings).
 */
export function useDeviceId(): string {
  const ref = useRef<string | null>(null)
  if (!ref.current) {
    ref.current = localStorage.getItem(DEVICE_ID_KEY)
    if (!ref.current) {
      ref.current = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, ref.current)
    }
  }
  return ref.current
}
