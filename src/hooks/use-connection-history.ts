import { useEffect, useCallback, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import type { ConnectionHealth } from './use-connection-health'
import type { ConnectionEvent, DowntimeIncident } from '@/types'

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
  const cleanedRef = useRef(false)

  useEffect(() => {
    setEventsRef.current = setEvents
    setIncidentsRef.current = setIncidents
  }, [setEvents, setIncidents])

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

    // Open a new incident only when there is no active incident already open for
    // this service. The health checker temporarily sets status to 'checking' before
    // every 30 s poll, so a persistent outage produces repeated checking→offline
    // transitions. Checking the ref (rather than previousStatus) correctly opens one
    // incident on the first offline transition and suppresses duplicates thereafter,
    // while still opening a new incident if the service recovers and goes down again.
    if (newStatus === 'offline' && !activeIncidentsRef.current.has(service)) {
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
  }, [enabled, health, recordEvent])

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
