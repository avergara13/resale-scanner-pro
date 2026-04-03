import { CheckCircle, XCircle, Warning } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { AppSettings } from '@/types'

interface ApiStatus {
  name: string
  key: string
  configured: boolean
  critical: boolean
}

interface ApiStatusIndicatorProps {
  settings?: AppSettings
  compact?: boolean
}

export function ApiStatusIndicator({ settings, compact = false }: ApiStatusIndicatorProps) {
  const apis: ApiStatus[] = [
    {
      name: 'Gemini',
      key: 'gemini',
      configured: !!settings?.geminiApiKey,
      critical: true,
    },
    {
      name: 'Google Lens',
      key: 'google',
      configured: !!(settings?.googleApiKey && settings?.googleSearchEngineId),
      critical: false,
    },
    {
      name: 'eBay',
      key: 'ebay',
      configured: !!(settings?.ebayApiKey && settings?.ebayAppId),
      critical: false,
    },
  ]

  const allConfigured = apis.every((api) => api.configured)
  const criticalMissing = apis.some((api) => api.critical && !api.configured)

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {apis.map((api) => (
          <div
            key={api.key}
            className={cn(
              'w-2 h-2 rounded-full transition-all',
              api.configured ? 'bg-green' : api.critical ? 'bg-red animate-pulse' : 'bg-amber'
            )}
            title={`${api.name}: ${api.configured ? 'Connected' : 'Not configured'}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-s1 border border-s2 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-s4">API Status</h3>
        {allConfigured ? (
          <CheckCircle size={16} weight="fill" className="text-green" />
        ) : criticalMissing ? (
          <XCircle size={16} weight="fill" className="text-red" />
        ) : (
          <Warning size={16} weight="fill" className="text-amber" />
        )}
      </div>
      <div className="space-y-2">
        {apis.map((api) => (
          <div key={api.key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {api.configured ? (
                <CheckCircle size={14} weight="fill" className="text-green" />
              ) : api.critical ? (
                <XCircle size={14} weight="fill" className="text-red" />
              ) : (
                <Warning size={14} weight="fill" className="text-amber" />
              )}
              <span className="text-xs font-medium">{api.name}</span>
            </div>
            <span
              className={cn(
                'text-[10px] font-mono uppercase tracking-wide',
                api.configured ? 'text-green' : 'text-s3'
              )}
            >
              {api.configured ? 'ON' : 'OFF'}
            </span>
          </div>
        ))}
      </div>
      {!allConfigured && (
        <p className="text-[10px] text-s3 pt-2 border-t border-s2">
          Configure missing APIs in Settings for full functionality
        </p>
      )}
    </div>
  )
}
