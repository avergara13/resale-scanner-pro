import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Warning,
  CircleNotch,
  Lightning,
  ShieldCheck
} from '@phosphor-icons/react'
import type { ActiveIncident } from '@/lib/incident-playbook-service'

interface IncidentPlaybookViewerProps {
  incident: ActiveIncident
  onExecute?: () => void
  onResolve?: () => void
  autoExecute?: boolean
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red text-white'
    case 'high':
      return 'bg-amber text-fg'
    case 'medium':
      return 'bg-s3 text-white'
    case 'low':
      return 'bg-s2 text-fg'
    default:
      return 'bg-s2 text-fg'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle weight="fill" className="text-green" />
    case 'failed':
      return <XCircle weight="fill" className="text-red" />
    case 'in_progress':
      return <CircleNotch weight="bold" className="text-b1 animate-spin" />
    case 'skipped':
      return <Clock weight="fill" className="text-s3" />
    default:
      return <Clock weight="regular" className="text-s3" />
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-amber text-fg">Active</Badge>
    case 'remediating':
      return <Badge className="bg-b1 text-white animate-pulse">Remediating</Badge>
    case 'resolved':
      return <Badge className="bg-green text-white">Resolved</Badge>
    case 'failed':
      return <Badge className="bg-red text-white">Failed</Badge>
    default:
      return <Badge className="bg-s3 text-white">Unknown</Badge>
  }
}

export function IncidentPlaybookViewer({ 
  incident, 
  onExecute, 
  onResolve,
  autoExecute = false 
}: IncidentPlaybookViewerProps) {
  const [expanded, setExpanded] = useState(true)

  const completedSteps = incident.playbook.steps.filter(s => 
    s.status === 'completed' || s.status === 'skipped'
  ).length
  const totalSteps = incident.playbook.steps.length
  const progress = (completedSteps / totalSteps) * 100

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  const duration = incident.endTime 
    ? incident.endTime - incident.startTime 
    : Date.now() - incident.startTime

  return (
    <Card className="border-2 border-border bg-card">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck weight="fill" className="text-b1" size={20} />
              <h3 className="font-semibold text-fg">{incident.playbook.title}</h3>
              {getStatusBadge(incident.status)}
            </div>
            
            <p className="text-sm text-s4">{incident.playbook.description}</p>
            
            <div className="flex items-center gap-3 text-xs text-s4">
              <Badge className={getSeverityColor(incident.playbook.severity)}>
                {incident.playbook.severity.toUpperCase()}
              </Badge>
              <span className="font-mono">{incident.service}</span>
              <span>•</span>
              <span>{formatDuration(duration)}</span>
              {incident.playbook.autoRemediate && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Lightning weight="fill" className="text-b1" size={12} />
                    Auto
                  </span>
                </>
              )}
            </div>
          </div>

          {incident.status === 'active' && onExecute && incident.playbook.autoRemediate && (
            <Button 
              onClick={onExecute}
              size="sm"
              className="bg-b1 text-white hover:bg-b2"
            >
              <Play weight="fill" size={16} />
              Execute
            </Button>
          )}

          {incident.status === 'resolved' && onResolve && (
            <Button 
              onClick={onResolve}
              size="sm"
              variant="outline"
            >
              Dismiss
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-s4">
            <span>Progress: {completedSteps} / {totalSteps} steps</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {expanded && (
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {incident.playbook.steps.map((step, index) => (
                <div 
                  key={step.id}
                  className={`p-3 rounded-lg border ${
                    index === incident.currentStepIndex && incident.status === 'remediating'
                      ? 'border-b1 bg-t4'
                      : 'border-border bg-s1'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getStatusIcon(step.status)}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-fg">{step.action}</span>
                        {!step.automated && (
                          <Badge variant="outline" className="text-xs">Manual</Badge>
                        )}
                      </div>
                      
                      <p className="text-xs text-s4">{step.description}</p>
                      
                      {step.result && (
                        <div className="mt-2 p-2 bg-background rounded border border-border">
                          <p className="text-xs font-mono text-s4">{step.result}</p>
                        </div>
                      )}
                      
                      {step.error && (
                        <div className="mt-2 p-2 bg-red/10 rounded border border-red">
                          <div className="flex items-center gap-2">
                            <Warning weight="fill" className="text-red" size={14} />
                            <p className="text-xs font-mono text-red">{step.error}</p>
                          </div>
                        </div>
                      )}
                      
                      {step.executedAt && (
                        <p className="text-xs text-s3 font-mono">
                          Executed: {new Date(step.executedAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-s4"
        >
          {expanded ? 'Hide Details' : 'Show Details'}
        </Button>
      </div>
    </Card>
  )
}
