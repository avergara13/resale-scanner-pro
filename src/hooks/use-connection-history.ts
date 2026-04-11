import { useEffect, useCallback, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import type { ConnectionHealth } from './use-connection-health'
import type { ConnectionEvent, DowntimeIncident, ConnectionHistoryStats } from '@/types'

interface UseConnectionHistoryOptions {
  enabled?: boolean
  maxEvents?: number
}

const MAX_HISTORY_DAYS = 30

export function useConnectionHistory(
  health: ConnectionHealth | undefined,
  options: UseConnectionHistoryOptions = {}
) {
  const { enabled = true, maxEvents = 1000 } = options

  const [events, setEvents] = useKV<ConnectionEvent[]>('connection-events', [])
  const [incidents, setIncidents] = useKV<DowntimeIncident[]>('downtime-incidents', [])
  const prevHealthRef = useRef<ConnectionHealth | undefined>(undefined)
  const activeIncidentsRef = useRef(new Map<string, DowntimeIncident>())

  // Stabilize KV setters via refs to prevent infinite re-render loops.
  // useKV setters may not be referentially stable across renders (unlike useState).
  const setEventsRef = useRef(setEvents)
  const setIncidentsRef = useRef(setIncidents)
  setEventsRef.current = setEvents
  setIncidentsRef.current = setIncidents

  const cleanedRef = useRef(false)

  // Run cleanup once on mount
  useEffect(() => {
    if (cleanedRef.current) return
    cleanedRef.current = true

    const cutoffTime = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000)
    setEventsRef.current((prev) => (prev || []).filter(e => e.timestamp > cutoffTime))
    setIncidentsRef.current((prev) => (prev || []).filter(i => i.startTime > cutoffTime))
  }, [])

  const recordEvent = useCallback((
    service: ConnectionEvent['service'],
    previousStatus: ConnectionEvent['previousStatus'],
    newStatus: ConnectionEvent['newStatus'],
    latency?: number,
    error?: string
  ) => {
    const event: ConnectionEvent = {
      id: `${Date.now()}-${service}`,
      timestamp: Date.now(),
      service,
      previousStatus,
      newStatus,
      latency,
      error,
    }

    setEventsRef.current(prev => {
      const updated = [...(prev || []), event]
      return updated.slice(-maxEvents)
    })

    // Only open a new incident on a genuine offline transition from a known-good state.
    // Ignore checking→offline because the health checker sets status to 'checking' on
    // every poll cycle, so a persistent offline service would otherwise create a new
    // incident every 30 s.
    if (newStatus === 'offline' && previousStatus !== 'offline' && previousStatus !== 'checking') {
      const incident: DowntimeIncident = {
        id: `incident-${Date.now()}-${service}`,
        service,
        startTime: Date.now(),
        resolved: false,
        error,
        impactedOperations: 0,
      }

      activeIncidentsRef.current.set(service, incident)

      setIncidentsRef.current(prev => [...(prev || []), incident])
    }

    if (newStatus !== 'offline' && previousStatus === 'offline') {
      const activeIncident = activeIncidentsRef.current.get(service)
      if (activeIncident) {
        const endTime = Date.now()
        const duration = endTime - activeIncident.startTime

        setIncidentsRef.current(prev =>
          (prev || []).map(i =>
            i.id === activeIncident.id
              ? { ...i, endTime, duration, resolved: true }
              : i
          )
        )

        activeIncidentsRef.current.delete(service)
      }
    }
  }, [maxEvents])

  useEffect(() => {
    if (!enabled || !health) return

    const prevHealth = prevHealthRef.current

    if (!prevHealth) {
      prevHealthRef.current = health
      return
    }

    const services: Array<{ key: keyof Omit<ConnectionHealth, 'lastUpdate' | 'overall'>, name: ConnectionEvent['service'] }> = [
      { key: 'gemini', name: 'gemini' },
      { key: 'googleLens', name: 'googleLens' },
      { key: 'ebay', name: 'ebay' },
    ]

    services.forEach(({ key, name }) => {
      const prevStatus = prevHealth[key].status
      const newStatus = health[key].status

      if (prevStatus !== newStatus && newStatus !== 'checking') {
        recordEvent(
          name,
          prevStatus,
          newStatus,
          health[key].latency,
          health[key].error
        )
      }
    })

    if (prevHealth.overall !== health.overall && health.overall !== 'checking') {
      recordEvent(
        'overall',
        prevHealth.overall,
        health.overall
      )
    }

    prevHealthRef.current = health
  }, [health?.overall, health?.gemini?.status, health?.googleLens?.status, health?.ebay?.status, health?.anthropic?.status, enabled, recordEvent])

  const calculateStats = useCallback(() => {
    const eventsList = events || []
    const incidentsList = incidents || []

    const now = Date.now()
    const last24h = now - (24 * 60 * 60 * 1000)
    const recentEvents = eventsList.filter(e => e.timestamp > last24h)
    const recentIncidents = incidentsList.filter(i => i.startTime > last24h)

    const totalDowntime = incidentsList.reduce((sum, incident) => {
      if (incident.resolved && incident.duration) {
        return sum + incident.duration
      }
      if (!incident.resolved) {
        return sum + (now - incident.startTime)
      }
      return sum
    }, 0)

    const services = ['gemini', 'googleLens', 'ebay'] as const
    const uptimePercentage: Record<string, number> = {}

    services.forEach(service => {
      const serviceIncidents = recentIncidents.filter(i => i.service === service)
      const serviceDowntime = serviceIncidents.reduce((sum, incident) => {
        if (incident.resolved && incident.duration) {
          return sum + incident.duration
        }
        if (!incident.resolved) {
          return sum + (now - incident.startTime)
        }
        return sum
      }, 0)

      const totalTime = 24 * 60 * 60 * 1000
      uptimePercentage[service] = ((totalTime - serviceDowntime) / totalTime) * 100
    })

    const incidentsByService = services.map(service => ({
      service,
      count: recentIncidents.filter(i => i.service === service).length,
    }))

    const mostUnreliable = incidentsByService.sort((a, b) => b.count - a.count)[0]

    return {
      totalEvents: recentEvents.length,
      totalDowntime,
      averageUptime: Object.values(uptimePercentage).reduce((a, b) => a + b, 0) / services.length,
      incidentCount: recentIncidents.length,
      mostUnreliableService: mostUnreliable?.count > 0 ? mostUnreliable.service : undefined,
      lastIncident: incidentsList[incidentsList.length - 1],
      uptimePercentage,
    }
  }, [events, incidents])

  const clearHistory = useCallback(() => {
    setEventsRef.current([])
    setIncidentsRef.current([])
    activeIncidentsRef.current.clear()
  }, [])

  return {
    events: events || [],
    incidents: incidents || [],
    stats: calculateStats(),
    clearHistory,
  }
}
