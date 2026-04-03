import { useState, useEffect, useMemo, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { IncidentPlaybookViewer } from './IncidentPlaybookViewer'
import { 
  createIncidentPlaybookService, 
  type ActiveIncident,
  type IncidentType 
} from '@/lib/incident-playbook-service'
import type { AppSettings } from '@/types'
import { Bell, CheckCircle, List, FileText } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface IncidentResponsePanelProps {
  settings?: AppSettings
}

export function IncidentResponsePanel({ settings }: IncidentResponsePanelProps) {
  const [activeIncidents, setActiveIncidents] = useKV<ActiveIncident[]>('active-incidents', [])
  const [incidentHistory, setIncidentHistory] = useKV<ActiveIncident[]>('incident-history', [])
  const [executingIncidents, setExecutingIncidents] = useState<Set<string>>(new Set())

  const playbookService = useMemo(() => {
    return createIncidentPlaybookService(settings)
  }, [settings])

  useEffect(() => {
    playbookService.updateSettings(settings)
  }, [settings, playbookService])

  const handleTriggerIncident = useCallback((incidentType: IncidentType, service: string) => {
    const incident = playbookService.createIncident(service, incidentType, {
      triggeredManually: true,
      timestamp: Date.now()
    })

    setActiveIncidents((prev) => [...(prev || []), incident])
    toast.info(`Incident Created: ${incident.playbook.title}`)
  }, [playbookService, setActiveIncidents])

  const handleExecutePlaybook = useCallback(async (incidentId: string) => {
    const incident = activeIncidents?.find(i => i.id === incidentId)
    if (!incident) return

    setExecutingIncidents((prev) => new Set([...prev, incidentId]))

    try {
      await playbookService.executePlaybook(incidentId, (updatedIncident) => {
        setActiveIncidents((prev) => 
          (prev || []).map(i => i.id === incidentId ? updatedIncident : i)
        )
      })

      const finalIncident = playbookService.getIncident(incidentId)
      if (finalIncident) {
        setActiveIncidents((prev) => (prev || []).filter(i => i.id !== incidentId))
        setIncidentHistory((prev) => [finalIncident, ...(prev || [])])

        if (finalIncident.status === 'resolved') {
          toast.success(`Incident Resolved: ${finalIncident.playbook.title}`)
        } else {
          toast.error(`Incident Failed: ${finalIncident.playbook.title}`)
        }
      }
    } catch (error: any) {
      toast.error(`Playbook execution failed: ${error.message}`)
    } finally {
      setExecutingIncidents((prev) => {
        const newSet = new Set(prev)
        newSet.delete(incidentId)
        return newSet
      })
    }
  }, [activeIncidents, playbookService, setActiveIncidents, setIncidentHistory])

  const handleDismiss = useCallback((incidentId: string) => {
    setActiveIncidents((prev) => (prev || []).filter(i => i.id !== incidentId))
  }, [setActiveIncidents])

  const handleDismissHistory = useCallback((incidentId: string) => {
    setIncidentHistory((prev) => (prev || []).filter(i => i.id !== incidentId))
  }, [setIncidentHistory])

  const handleClearHistory = useCallback(() => {
    setIncidentHistory([])
    toast.success('Incident history cleared')
  }, [setIncidentHistory])

  const activeCount = activeIncidents?.length || 0
  const resolvedCount = incidentHistory?.filter(i => i.status === 'resolved').length || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-fg flex items-center gap-2">
            <Bell weight="fill" className="text-b1" />
            Incident Response
          </h2>
          <p className="text-sm text-s4 mt-1">
            Automatic remediation playbooks for API failures
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-amber border-amber">
            {activeCount} Active
          </Badge>
          <Badge variant="outline" className="text-green border-green">
            {resolvedCount} Resolved
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Bell weight="bold" size={16} />
            Active ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <CheckCircle weight="bold" size={16} />
            History ({incidentHistory?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="playbooks" className="flex items-center gap-2">
            <FileText weight="bold" size={16} />
            Playbooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-4">
          {!activeIncidents || activeIncidents.length === 0 ? (
            <Card className="p-8 text-center bg-s1 border-border">
              <CheckCircle weight="fill" className="text-green mx-auto mb-3" size={48} />
              <h3 className="text-lg font-medium text-fg">No Active Incidents</h3>
              <p className="text-sm text-s4 mt-1">
                All systems operating normally
              </p>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {activeIncidents.map((incident) => (
                  <IncidentPlaybookViewer
                    key={incident.id}
                    incident={incident}
                    onExecute={() => handleExecutePlaybook(incident.id)}
                    onResolve={() => handleDismiss(incident.id)}
                    autoExecute={incident.playbook.autoRemediate}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-s4">
              {incidentHistory?.length || 0} total incidents logged
            </p>
            {incidentHistory && incidentHistory.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearHistory}
              >
                Clear History
              </Button>
            )}
          </div>

          {!incidentHistory || incidentHistory.length === 0 ? (
            <Card className="p-8 text-center bg-s1 border-border">
              <List weight="regular" className="text-s3 mx-auto mb-3" size={48} />
              <h3 className="text-lg font-medium text-fg">No History</h3>
              <p className="text-sm text-s4 mt-1">
                Past incidents will appear here
              </p>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {incidentHistory.map((incident) => (
                  <IncidentPlaybookViewer
                    key={incident.id}
                    incident={incident}
                    onResolve={() => handleDismissHistory(incident.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="playbooks" className="space-y-4 mt-4">
          <Card className="p-6 bg-s1 border-border">
            <h3 className="font-semibold text-fg mb-4">Available Playbooks</h3>
            
            <div className="space-y-4">
              <PlaybookCard
                title="API Timeout Recovery"
                description="Retry with exponential backoff and fallback to cached data"
                severity="medium"
                automated
                onTest={() => handleTriggerIncident('api_timeout', 'gemini')}
              />
              
              <PlaybookCard
                title="Rate Limit Management"
                description="Queue requests and switch to backup API providers"
                severity="high"
                automated
                onTest={() => handleTriggerIncident('api_rate_limit', 'gemini')}
              />
              
              <PlaybookCard
                title="Authentication Failure"
                description="Validate credentials and guide user reconfiguration"
                severity="critical"
                automated
                onTest={() => handleTriggerIncident('api_unauthorized', 'ebay')}
              />
              
              <PlaybookCard
                title="Gemini Quota Exceeded"
                description="Automatically switch to Anthropic Claude backup"
                severity="high"
                automated
                onTest={() => handleTriggerIncident('gemini_quota_exceeded', 'gemini')}
              />
              
              <PlaybookCard
                title="Network Offline"
                description="Enable offline mode and queue operations"
                severity="critical"
                automated
                onTest={() => handleTriggerIncident('network_offline', 'overall')}
              />
              
              <PlaybookCard
                title="Connection Degraded"
                description="Optimize performance for slow connections"
                severity="low"
                automated
                onTest={() => handleTriggerIncident('connection_degraded', 'overall')}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface PlaybookCardProps {
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  automated: boolean
  onTest: () => void
}

function PlaybookCard({ title, description, severity, automated, onTest }: PlaybookCardProps) {
  const severityColors = {
    critical: 'bg-red text-white',
    high: 'bg-amber text-fg',
    medium: 'bg-s3 text-white',
    low: 'bg-s2 text-fg',
  }

  return (
    <Card className="p-4 bg-background border-border hover:border-b1 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-fg">{title}</h4>
            <Badge className={severityColors[severity]} variant="secondary">
              {severity.toUpperCase()}
            </Badge>
            {automated && (
              <Badge variant="outline" className="text-xs">Auto</Badge>
            )}
          </div>
          <p className="text-sm text-s4">{description}</p>
        </div>
        
        <Button 
          size="sm" 
          variant="outline"
          onClick={onTest}
        >
          Test
        </Button>
      </div>
    </Card>
  )
}
