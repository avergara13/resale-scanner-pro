import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useConnectionHealth, type ConnectionStatus } from '@/hooks/use-connection-health'
import { useConnectionHistory } from '@/hooks/use-connection-history'
import type { AppSettings } from '@/types'

interface ConnectionHealthMonitorProps {
  settings?: AppSettings
  enabled?: boolean
  notifyOnChange?: boolean
}

function getStatusMessage(status: ConnectionStatus): string {
  switch (status) {
    case 'healthy':
      return 'All APIs connected'
    case 'degraded':
      return 'Some APIs experiencing delays'
    case 'offline':
      return 'API connections offline'
    case 'checking':
      return 'Checking connections...'
    default:
      return 'Connection status unknown'
  }
}

export function ConnectionHealthMonitor({
  settings,
  enabled = true,
  notifyOnChange = true,
}: ConnectionHealthMonitorProps) {
  const { health } = useConnectionHealth({
    settings,
    enabled,
  })

  useConnectionHistory(health, { enabled })

  const prevStatusRef = useRef<ConnectionStatus | null>(null)
  const hasNotifiedRef = useRef(false)
  const isInitialCheckRef = useRef(true)

  useEffect(() => {
    if (!enabled || !notifyOnChange) return

    const currentStatus = health.overall

    if (currentStatus === 'checking') {
      return
    }

    if (isInitialCheckRef.current) {
      prevStatusRef.current = currentStatus
      isInitialCheckRef.current = false
      return
    }

    const prevStatus = prevStatusRef.current

    if (prevStatus === currentStatus || prevStatus === null) {
      return
    }

    if (!hasNotifiedRef.current && currentStatus === 'offline' && prevStatus !== 'checking') {
      toast.error('Connection Lost', {
        description: getStatusMessage(currentStatus),
        duration: 5000,
      })
      hasNotifiedRef.current = true
    } else if (prevStatus === 'offline' && currentStatus === 'healthy') {
      toast.success('Connection Restored', {
        description: getStatusMessage(currentStatus),
        duration: 3000,
      })
      hasNotifiedRef.current = false
    } else if (prevStatus === 'healthy' && currentStatus === 'degraded') {
      toast.warning('Connection Degraded', {
        description: getStatusMessage(currentStatus),
        duration: 4000,
      })
    } else if (prevStatus === 'degraded' && currentStatus === 'healthy') {
      toast.success('Connection Improved', {
        description: getStatusMessage(currentStatus),
        duration: 3000,
      })
      hasNotifiedRef.current = false
    }

    prevStatusRef.current = currentStatus
  }, [health.overall, enabled, notifyOnChange])

  return null
}
