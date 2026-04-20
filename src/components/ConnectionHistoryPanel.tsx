import { useMemo } from 'react'
import { format } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle,
  XCircle,
  WarningCircle,
  Clock,
  Trash,
  TrendUp,
  TrendDown,
} from '@phosphor-icons/react'
import { useConnectionHealth } from '@/hooks/use-connection-health'
import { useConnectionHistory } from '@/hooks/use-connection-history'
import type { AppSettings } from '@/types'
import type { ConnectionStatus } from '@/hooks/use-connection-health'

interface ConnectionHistoryPanelProps {
  settings?: AppSettings
}

function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-green'
    case 'degraded':
      return 'text-amber'
    case 'offline':
      return 'text-red'
    default:
      return 'text-s3'
  }
}

function getStatusIcon(status: ConnectionStatus, size = 16) {
  const props = { size, weight: 'fill' as const }
  switch (status) {
    case 'healthy':
      return <CheckCircle {...props} className="text-green" />
    case 'degraded':
      return <WarningCircle {...props} className="text-amber" />
    case 'offline':
      return <XCircle {...props} className="text-red" />
    default:
      return <Clock {...props} className="text-s3" />
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function getServiceDisplayName(service: string): string {
  const names: Record<string, string> = {
    gemini: 'Gemini AI',
    googleLens: 'Google Vision',
    ebay: 'eBay API',
    overall: 'Overall',
  }
  return names[service] || service
}

export function ConnectionHistoryPanel({ settings }: ConnectionHistoryPanelProps) {
  const { health } = useConnectionHealth({ settings, enabled: true })
  const { events, incidents, stats, clearHistory } = useConnectionHistory(health)
  const currentTimestamp = health.lastUpdate

  const recentEvents = useMemo(() => {
    return events.slice(-20).reverse()
  }, [events])

  const activeIncidents = useMemo(() => {
    return incidents.filter(i => !i.resolved)
  }, [incidents])

  const resolvedIncidents = useMemo(() => {
    return incidents.filter(i => i.resolved).slice(-10).reverse()
  }, [incidents])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-s1 border border-s2 rounded-lg">
          <div className="text-xs font-medium text-s4 uppercase tracking-wide mb-1">
            Avg Uptime (24h)
          </div>
          <div className="text-2xl font-semibold text-t1 mb-2">
            {stats.averageUptime.toFixed(1)}%
          </div>
          <Progress value={stats.averageUptime} className="h-1.5" />
        </div>

        <div className="p-4 bg-s1 border border-s2 rounded-lg">
          <div className="text-xs font-medium text-s4 uppercase tracking-wide mb-1">
            Incidents (24h)
          </div>
          <div className="text-2xl font-semibold text-t1 flex items-center gap-2">
            {stats.incidentCount}
            {stats.incidentCount > 0 && (
              <TrendUp size={20} className="text-red" weight="bold" />
            )}
            {stats.incidentCount === 0 && (
              <TrendDown size={20} className="text-green" weight="bold" />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['gemini', 'googleLens', 'ebay'] as const).map((service) => (
          <div key={service} className="p-3 bg-s1 border border-s2 rounded-md">
            <div className="text-xs text-s4 mb-1">
              {getServiceDisplayName(service)}
            </div>
            <div className="text-lg font-semibold text-t1">
              {(stats.uptimePercentage[service] || 0).toFixed(1)}%
            </div>
            <div className="mt-1.5">
              <Progress value={stats.uptimePercentage[service] || 0} className="h-1" />
            </div>
          </div>
        ))}
      </div>

      {activeIncidents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-t1 uppercase tracking-wide">
              Active Incidents
            </h3>
            <Badge variant="destructive" className="text-xs">
              {activeIncidents.length}
            </Badge>
          </div>

          <div className="space-y-2">
            {activeIncidents.map((incident) => (
              <div
                key={incident.id}
                className="p-3 bg-red/10 border border-red/30 rounded-md"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <XCircle size={16} weight="fill" className="text-red" />
                    <span className="text-sm font-medium text-t1">
                      {getServiceDisplayName(incident.service)}
                    </span>
                  </div>
                  <span className="text-xs text-s4">
                    {formatDuration(currentTimestamp - incident.startTime)} ago
                  </span>
                </div>
                {incident.error && (
                  <div className="text-xs text-s4 font-mono mt-1 pl-6">
                    {incident.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {resolvedIncidents.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-t1 uppercase tracking-wide">
            Recent Incidents
          </h3>

          <ScrollArea className="h-[200px]">
            <div className="space-y-2 pr-4">
              {resolvedIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="p-3 bg-s1 border border-s2 rounded-md"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} weight="fill" className="text-green" />
                      <span className="text-xs font-medium text-t1">
                        {getServiceDisplayName(incident.service)}
                      </span>
                    </div>
                    <span className="text-xs text-s4">
                      {incident.endTime && format(incident.endTime, 'MMM d, HH:mm')}
                    </span>
                  </div>
                  <div className="text-xs text-s4 pl-5">
                    Downtime: {incident.duration ? formatDuration(incident.duration) : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-t1 uppercase tracking-wide">
            Event Log
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="text-xs text-s4 h-7 px-2"
          >
            <Trash size={14} className="mr-1" />
            Clear
          </Button>
        </div>

        <ScrollArea className="h-[250px]">
          <div className="space-y-1.5 pr-4">
            {recentEvents.length === 0 && (
              <div className="text-center text-sm text-s4 py-8">
                No connection events recorded yet
              </div>
            )}
            
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="p-2.5 bg-s1 border border-s2 rounded-md text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(event.newStatus, 12)}
                    <span className="font-medium text-t1">
                      {getServiceDisplayName(event.service)}
                    </span>
                    <span className="text-s4">→</span>
                    <span className={getStatusColor(event.newStatus)}>
                      {event.newStatus}
                    </span>
                  </div>
                  <span className="text-s4">
                    {format(event.timestamp, 'HH:mm:ss')}
                  </span>
                </div>
                {event.latency && (
                  <div className="text-s4 pl-5">
                    Latency: {event.latency}ms
                  </div>
                )}
                {event.error && (
                  <div className="text-s4 font-mono pl-5 mt-0.5">
                    {event.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
