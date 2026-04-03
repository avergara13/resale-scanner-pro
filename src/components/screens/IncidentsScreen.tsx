import { IncidentResponsePanel } from '../IncidentResponsePanel'
import type { AppSettings } from '@/types'

interface IncidentsScreenProps {
  settings?: AppSettings
}

export function IncidentsScreen({ settings }: IncidentsScreenProps) {
  return (
    <div id="scr-incidents" className="flex flex-col h-full">
      <div className="px-4 py-6 border-b border-s2 bg-s1">
        <h1 className="text-2xl font-semibold text-fg mb-2">Incident Response</h1>
        <p className="text-sm text-s4">Automatic remediation and playbook management</p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-6 pb-24">
        <IncidentResponsePanel settings={settings} />
      </div>
    </div>
  )
}
