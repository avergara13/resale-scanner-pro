import { useState } from 'react'

const DEVICE_ID_KEY = 'rsp-device-id'

/**
 * Returns a stable, device-local UUID that persists across sessions.
 * Stored in localStorage (never cloud-synced) so each physical device
 * gets its own identity — used to namespace KV keys that must not
 * collide between devices (currentSession, settings).
 */
export function useDeviceId(): string {
  const [deviceId] = useState(() => {
    if (typeof window === 'undefined') {
      return DEVICE_ID_KEY
    }

    const storedDeviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (storedDeviceId) {
      return storedDeviceId
    }

    const nextDeviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, nextDeviceId)
    return nextDeviceId
  })

  return deviceId
}
