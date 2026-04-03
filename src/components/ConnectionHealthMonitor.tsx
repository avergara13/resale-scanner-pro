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

  const prevStatusRef = useRef<ConnectionStatus>(health.overall)
  const hasNotifiedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !notifyOnChange) return

    const prevStatus = prevStatusRef.current
    const currentStatus = health.overall

    if (prevStatus === currentStatus) return

    if (currentStatus === 'checking') {
      return
    }

    if (!hasNotifiedRef.current && currentStatus === 'offline') {
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
