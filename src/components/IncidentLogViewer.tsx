import { useMemo } from 'react'
import { format } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle,
  XCircle,
  WarningCircle,
  Clock,
  ListBullets,
  Download,
} from '@phosphor-icons/react'
import { useConnectionHealth } from '@/hooks/use-connection-health'
import { useConnectionHistory } from '@/hooks/use-connection-history'
import { useSortFilterPreference } from '@/hooks/use-sort-filter-preference'
import type { AppSettings, DowntimeIncident } from '@/types'
import type { ConnectionStatus } from '@/hooks/use-connection-health'

interface IncidentLogViewerProps {
  settings?: AppSettings
}

type FilterService = 'all' | 'gemini' | 'googleLens' | 'ebay'
type FilterStatus = 'all' | 'active' | 'resolved'
type ViewMode = 'incidents' | 'events'

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
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function getServiceDisplayName(service: string): string {
  const names: Record<string, string> = {
    gemini: 'Gemini AI',
    googleLens: 'Google Vision',
    ebay: 'eBay API',
    overall: 'Overall System',
  }
  return names[service] || service
}

function getSeverityLevel(incident: DowntimeIncident): 'critical' | 'high' | 'medium' | 'low' {
  if (!incident.duration) {
    const currentDuration = Date.now() - incident.startTime
    if (currentDuration > 3600000) return 'critical'
    if (currentDuration > 1800000) return 'high'
    if (currentDuration > 600000) return 'medium'
    return 'low'
  }
  
  if (incident.duration > 3600000) return 'critical'
  if (incident.duration > 1800000) return 'high'
  if (incident.duration > 600000) return 'medium'
  return 'low'
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red text-white'
    case 'high': return 'bg-amber text-white'
    case 'medium': return 'bg-s2 text-t1'
    case 'low': return 'bg-s1 text-t2'
    default: return 'bg-s1 text-t2'
  }
}

export function IncidentLogViewer({ settings }: IncidentLogViewerProps) {
  const { health } = useConnectionHealth({ settings, enabled: true })
  const { events, incidents, stats } = useConnectionHistory(health)
  const currentTimestamp = health.lastUpdate
  
  const { sortBy: viewMode, filter: filterService, setSortBy: setViewMode, setFilter: setFilterService } = useSortFilterPreference<ViewMode, FilterService>(
    'incident-log-viewer',
    'incidents',
    'all'
  )
  const { filter: filterStatus, setFilter: setFilterStatus } = useSortFilterPreference<never, FilterStatus>(
    'incident-status-filter',
    '' as never,
    'all'
  )

  const filteredIncidents = useMemo(() => {
    let filtered = incidents

    if (filterService !== 'all') {
      filtered = filtered.filter(i => i.service === filterService)
    }

    if (filterStatus === 'active') {
      filtered = filtered.filter(i => !i.resolved)
    } else if (filterStatus === 'resolved') {
      filtered = filtered.filter(i => i.resolved)
    }

    return filtered.sort((a, b) => b.startTime - a.startTime)
  }, [incidents, filterService, filterStatus])

  const filteredEvents = useMemo(() => {
    let filtered = events

    if (filterService !== 'all') {
      filtered = filtered.filter(e => e.service === filterService)
    }

    return filtered.slice(-100).reverse()
  }, [events, filterService])

  const incidentsByService = useMemo(() => {
    const services = ['gemini', 'googleLens', 'ebay'] as const
    return services.map(service => ({
      service,
      total: incidents.filter(i => i.service === service).length,
      active: incidents.filter(i => i.service === service && !i.resolved).length,
      resolved: incidents.filter(i => i.service === service && i.resolved).length,
    }))
  }, [incidents])

  const exportLogs = () => {
    const data = {
      exportDate: new Date().toISOString(),
      stats,
      incidents: filteredIncidents,
      events: filteredEvents,
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `incident-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'incidents' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('incidents')}
            className="h-8 text-xs gap-1.5"
          >
            <WarningCircle size={14} weight={viewMode === 'incidents' ? 'fill' : 'regular'} />
            Incidents
          </Button>
          <Button
            variant={viewMode === 'events' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('events')}
            className="h-8 text-xs gap-1.5"
          >
            <ListBullets size={14} weight={viewMode === 'events' ? 'fill' : 'regular'} />
            Events
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={exportLogs}
          className="h-8 text-xs gap-1.5"
        >
          <Download size={14} />
          Export
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-s4 uppercase tracking-wide mb-1.5 block">
            Service
          </label>
          <Select value={filterService} onValueChange={(v) => setFilterService(v as FilterService)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              <SelectItem value="gemini">Gemini AI</SelectItem>
              <SelectItem value="googleLens">Google Vision</SelectItem>
              <SelectItem value="ebay">eBay API</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {viewMode === 'incidents' && (
          <div>
            <label className="text-xs text-s4 uppercase tracking-wide mb-1.5 block">
              Status
            </label>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Card className="p-4 bg-s1 border-s2">
        <div className="grid grid-cols-3 gap-4">
          {incidentsByService.map(({ service, total, active, resolved }) => (
            <div key={service} className="space-y-1">
              <div className="text-xs text-s4 uppercase tracking-wide">
                {getServiceDisplayName(service)}
              </div>
              <div className="text-lg font-bold text-t1">{total}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-red">{active} active</span>
                <span className="text-s3">•</span>
                <span className="text-green">{resolved} resolved</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Separator />

      {viewMode === 'incidents' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-t1 uppercase tracking-wide">
              Incident Log ({filteredIncidents.length})
            </h3>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-2 pr-4">
              {filteredIncidents.length === 0 && (
                <div className="text-center text-sm text-s4 py-12">
                  <CheckCircle size={32} weight="fill" className="text-green mx-auto mb-2" />
                  <p>No incidents found</p>
                  <p className="text-xs mt-1">All systems are running smoothly</p>
                </div>
              )}

              {filteredIncidents.map((incident) => {
                const severity = getSeverityLevel(incident)
                const duration = incident.duration || (currentTimestamp - incident.startTime)
                
                return (
                  <Card key={incident.id} className="p-3 bg-s1 border-s2">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {incident.resolved ? (
                          <CheckCircle size={16} weight="fill" className="text-green" />
                        ) : (
                          <XCircle size={16} weight="fill" className="text-red animate-pulse" />
                        )}
                        <span className="text-sm font-semibold text-t1">
                          {getServiceDisplayName(incident.service)}
                        </span>
                      </div>
                      <Badge className={`text-xs ${getSeverityColor(severity)}`}>
                        {severity}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-s4">Started</span>
                        <span className="text-t1 font-mono">
                          {format(incident.startTime, 'MMM d, yyyy HH:mm:ss')}
                        </span>
                      </div>

                      {incident.endTime && (
                        <div className="flex items-center justify-between">
                          <span className="text-s4">Resolved</span>
                          <span className="text-t1 font-mono">
                            {format(incident.endTime, 'MMM d, yyyy HH:mm:ss')}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-s4">Duration</span>
                        <span className={`font-mono font-semibold ${
                          severity === 'critical' ? 'text-red' : 
                          severity === 'high' ? 'text-amber' : 
                          'text-t1'
                        }`}>
                          {formatDuration(duration)}
                        </span>
                      </div>

                      {incident.error && (
                        <div className="mt-2 p-2 bg-red/10 border border-red/30 rounded">
                          <div className="text-xs text-s4 uppercase tracking-wide mb-0.5">Error</div>
                          <div className="text-xs font-mono text-t1">{incident.error}</div>
                        </div>
                      )}

                      {!incident.resolved && (
                        <div className="mt-2 p-2 bg-amber/10 border border-amber/30 rounded">
                          <div className="flex items-center gap-1.5 text-amber">
                            <Clock size={12} weight="fill" />
                            <span className="text-xs font-medium">Incident ongoing</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-t1 uppercase tracking-wide">
              Event Log ({filteredEvents.length})
            </h3>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-1.5 pr-4">
              {filteredEvents.length === 0 && (
                <div className="text-center text-sm text-s4 py-12">
                  <ListBullets size={32} className="text-s3 mx-auto mb-2" />
                  <p>No events recorded yet</p>
                </div>
              )}

              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-2.5 bg-s1 border border-s2 rounded-md text-xs hover:bg-t4 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(event.newStatus, 12)}
                      <span className="font-medium text-t1">
                        {getServiceDisplayName(event.service)}
                      </span>
                      <span className="text-s4">→</span>
                      <span className={`font-semibold ${getStatusColor(event.newStatus)}`}>
                        {event.newStatus}
                      </span>
                    </div>
                    <span className="text-s4 font-mono">
                      {format(event.timestamp, 'HH:mm:ss')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 pl-5 text-s4">
                    {event.latency && (
                      <span>Latency: {event.latency}ms</span>
                    )}
                    {event.error && (
                      <span className="font-mono text-red">{event.error}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
