import { CheckCircle, XCircle, Warning, ArrowsClockwise, Pulse, ArrowClockwise } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useConnectionHealth, type ConnectionStatus } from '@/hooks/use-connection-health'
import type { AppSettings } from '@/types'
import type { RetryState } from '@/hooks/use-retry-tracker'

interface ApiStatusIndicatorProps {
  settings?: AppSettings
  compact?: boolean
  liveUpdates?: boolean
  checkInterval?: number
  onStatusChange?: (status: ConnectionStatus) => void
  activeRetries?: RetryState[]
}

function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-green'
    case 'degraded':
      return 'bg-amber'
    case 'checking':
      return 'bg-s3'
    case 'offline':
      return 'bg-red'
    default:
      return 'bg-s3'
  }
}

function getStatusText(status: ConnectionStatus): string {
  switch (status) {
    case 'healthy':
      return 'ONLINE'
    case 'degraded':
      return 'SLOW'
    case 'checking':
      return 'CHECK'
    case 'offline':
      return 'OFF'
    default:
      return 'UNKNOWN'
  }
}

function getStatusIcon(status: ConnectionStatus, size: number = 14) {
  switch (status) {
    case 'healthy':
      return <CheckCircle size={size} weight="fill" className="text-green" />
    case 'degraded':
      return <Warning size={size} weight="fill" className="text-amber" />
    case 'checking':
      return <ArrowsClockwise size={size} weight="bold" className="text-s3 animate-spin" />
    case 'offline':
      return <XCircle size={size} weight="fill" className="text-red" />
    default:
      return <Warning size={size} weight="fill" className="text-s3" />
  }
}

export function ApiStatusIndicator({
  settings,
  compact = false,
  liveUpdates = true,
  checkInterval = 30000,
  onStatusChange: _onStatusChange,
  activeRetries = [],
}: ApiStatusIndicatorProps) {
  const { health, checkHealth, isChecking } = useConnectionHealth({
    settings,
    checkInterval,
    enabled: liveUpdates,
  })

  const hasRetries = activeRetries.length > 0

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => !isChecking && checkHealth()}
          disabled={isChecking}
          className="material-thin flex min-h-9 items-center gap-2 rounded-full border border-separator/70 px-2.5 py-1.5 group cursor-pointer disabled:cursor-wait"
          title={`Overall Status: ${getStatusText(health.overall)} - Click to refresh`}
        >
          <div className="flex items-center gap-1">
            <div
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                getStatusColor(health.gemini.status),
                health.gemini.status === 'checking' && 'animate-pulse',
                health.gemini.status === 'offline' && health.gemini.critical && 'animate-pulse'
              )}
              title={`Gemini: ${getStatusText(health.gemini.status)}${
                health.gemini.latency ? ` (${health.gemini.latency}ms)` : ''
              }`}
            />
            <div
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                getStatusColor(health.googleLens.status),
                health.googleLens.status === 'checking' && 'animate-pulse'
              )}
              title={`Google Vision: ${getStatusText(health.googleLens.status)}${
                health.googleLens.latency ? ` (${health.googleLens.latency}ms)` : ''
              }`}
            />
            <div
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                getStatusColor(health.ebay.status),
                health.ebay.status === 'checking' && 'animate-pulse'
              )}
              title={`eBay: ${getStatusText(health.ebay.status)}${
                health.ebay.latency ? ` (${health.ebay.latency}ms)` : ''
              }`}
            />
            <div
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                getStatusColor(health.anthropic.status),
                health.anthropic.status === 'checking' && 'animate-pulse'
              )}
              title={`Anthropic: ${getStatusText(health.anthropic.status)}${
                health.anthropic.latency ? ` (${health.anthropic.latency}ms)` : ''
              }`}
            />
          </div>
          {liveUpdates && (
            <Pulse size={10} weight="fill" className="text-system-green animate-pulse opacity-60" />
          )}
        </button>
        {hasRetries && (
          <div className="inline-flex min-h-7 items-center gap-1 rounded-full border border-system-orange/15 bg-system-orange/10 px-2 py-1" title={`${activeRetries.length} active retries`}>
            <ArrowClockwise size={11} weight="bold" className="text-chip-label-orange animate-spin" />
            <span className="text-caption-1 font-semibold text-chip-label-orange">{activeRetries.length}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="material-thin space-y-3 rounded-2xl border border-separator/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-footnote font-semibold uppercase tracking-[0.12em] text-secondary-label">Connection Health</h3>
          {liveUpdates && (
            <div className="flex items-center gap-1">
              <Pulse size={8} weight="fill" className="text-system-green animate-pulse" />
              <span className="text-caption-1 uppercase tracking-[0.14em] text-secondary-label">Live</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon(health.overall, 16)}
          <button
            onClick={() => !isChecking && checkHealth()}
            disabled={isChecking}
            className={cn(
              'text-s3 hover:text-s4 transition-colors disabled:opacity-50',
              isChecking && 'cursor-wait'
            )}
            title="Refresh health check"
          >
            <ArrowsClockwise size={14} weight="bold" className={cn(isChecking && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        <ServiceStatusRow
          name={health.gemini.name}
          status={health.gemini.status}
          latency={health.gemini.latency}
          configured={health.gemini.configured}
          critical={health.gemini.critical}
          error={health.gemini.error}
        />
        <ServiceStatusRow
          name={health.googleLens.name}
          status={health.googleLens.status}
          latency={health.googleLens.latency}
          configured={health.googleLens.configured}
          critical={health.googleLens.critical}
          error={health.googleLens.error}
        />
        <ServiceStatusRow
          name={health.ebay.name}
          status={health.ebay.status}
          latency={health.ebay.latency}
          configured={health.ebay.configured}
          critical={health.ebay.critical}
          error={health.ebay.error}
        />
        <ServiceStatusRow
          name={health.anthropic.name}
          status={health.anthropic.status}
          latency={health.anthropic.latency}
          configured={health.anthropic.configured}
          critical={health.anthropic.critical}
          error={health.anthropic.error}
        />
      </div>

      {health.lastUpdate && (
        <div className="flex items-center justify-between border-t border-separator/70 pt-3">
          <p className="text-caption-1 uppercase tracking-[0.12em] text-secondary-label">
            Last checked: {new Date(health.lastUpdate).toLocaleTimeString()}
          </p>
          {checkInterval && (
            <p className="text-caption-1 font-mono text-secondary-label">
              Every {Math.round(checkInterval / 1000)}s
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface ServiceStatusRowProps {
  name: string
  status: ConnectionStatus
  latency?: number
  configured: boolean
  critical: boolean
  error?: string
}

function ServiceStatusRow({
  name,
  status,
  latency,
  configured: _configured,
  critical,
  error,
}: ServiceStatusRowProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-separator/55 bg-system-fill/35 px-3 py-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {getStatusIcon(status, 14)}
        <div className="flex flex-col gap-0.5 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-subheadline font-medium text-label">{name}</span>
            {critical && (
              <span className="rounded-full border border-system-red/15 bg-system-red/10 px-2 py-0.5 text-caption-2 font-bold uppercase tracking-[0.14em] text-chip-label-red">
                Critical
              </span>
            )}
          </div>
          {error && status === 'offline' && (
            <span className="truncate font-mono text-caption-1 text-chip-label-red">{error}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {latency !== undefined && status !== 'offline' && (
          <span
            className={cn(
              'rounded-full px-2 py-1 text-caption-1 font-mono',
              latency < 1000 ? 'bg-green/10 text-chip-label-green' : 'bg-amber/10 text-chip-label-orange'
            )}
          >
            {latency}ms
          </span>
        )}
        <span
          className={cn(
            'min-w-[48px] text-right font-mono text-caption-1 uppercase tracking-[0.12em]',
            status === 'healthy' && 'text-chip-label-green',
            status === 'degraded' && 'text-chip-label-orange',
            status === 'checking' && 'text-s3',
            status === 'offline' && 'text-chip-label-red'
          )}
        >
          {getStatusText(status)}
        </span>
      </div>
    </div>
  )
}
