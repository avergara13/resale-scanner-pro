import { useKV } from '@github/spark/hooks'
import { useDeviceId } from '@/hooks/use-device-id'
import type { Session } from '@/types'

export function SessionLiveBanner() {
  const deviceId = useDeviceId()
  const [currentSession] = useKV<Session | undefined>(`device-current-session-${deviceId}`, undefined)

  if (!currentSession?.active) return null

  const maybeCount = Math.max(0, currentSession.itemsScanned - currentSession.buyCount - currentSession.passCount)
  const sessionLabel = currentSession.name || `Session #${String(currentSession.sessionNumber ?? 1).padStart(3, '0')}`

  return (
    <div className="material-thin flex min-h-10 items-center gap-2 overflow-hidden border-b border-system-green/20 px-4 py-2">
      <span className="relative h-2.5 w-2.5 flex-shrink-0">
        <span className="absolute inset-0 rounded-full bg-system-green animate-ping opacity-50" />
        <span className="relative block h-2.5 w-2.5 rounded-full bg-system-green" />
      </span>

      <span className="text-caption-1 font-bold uppercase tracking-[0.18em] text-chip-label-green flex-shrink-0">Live</span>

      <span className="h-4 w-px bg-system-green/20 flex-shrink-0" />

      <span className="max-w-[112px] flex-shrink-0 truncate font-mono text-footnote font-semibold text-label">
        {sessionLabel}
      </span>

      {currentSession.operatorName && (
        <span className="min-w-0 flex-1 truncate text-footnote text-secondary-label">{currentSession.operatorName}</span>
      )}

      <div className="ml-auto flex items-center gap-1.5 flex-shrink-0 text-caption-1">
        <span className="font-semibold text-chip-label-green">{currentSession.buyCount}</span>
        <span className="text-secondary-label">buy</span>
        <span className="text-tertiary-label">·</span>
        <span className="font-semibold text-chip-label-red">{currentSession.passCount}</span>
        <span className="text-secondary-label">pass</span>
        <span className="text-tertiary-label">·</span>
        <span className="font-semibold text-chip-label-orange">{maybeCount}</span>
        <span className="text-secondary-label">maybe</span>
      </div>
    </div>
  )
}
