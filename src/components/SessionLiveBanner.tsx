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
    <div
      className="flex items-center leading-none gap-1.5 px-3 py-1.5 overflow-hidden"
      style={{
        background: 'color-mix(in oklch, var(--green) 7%, var(--fg))',
        borderLeft: '2px solid var(--green)',
        borderBottom: '1px solid color-mix(in oklch, var(--green) 20%, transparent)',
      }}
    >
      {/* Sonar ping dot */}
      <span className="relative flex-shrink-0" style={{ width: 8, height: 8 }}>
        <span className="absolute inset-0 rounded-full bg-green animate-ping opacity-50" />
        <span className="relative block w-2 h-2 rounded-full bg-green" />
      </span>

      {/* LIVE label */}
      <span className="text-[9px] font-black text-green tracking-[0.15em] uppercase flex-shrink-0">LIVE</span>

      {/* Divider */}
      <span className="w-px h-3 bg-green/30 flex-shrink-0" />

      {/* Session name */}
      <span className="text-[11px] font-bold text-green font-mono flex-shrink-0 max-w-[90px] truncate">
        {sessionLabel}
      </span>

      {/* Operator name */}
      {currentSession.operatorName && (
        <span className="text-[10px] text-t3 truncate flex-1 min-w-0">{currentSession.operatorName}</span>
      )}

      {/* Stats */}
      <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
        <span className="text-[10px] font-bold text-green">{currentSession.buyCount}</span>
        <span className="text-[10px] text-t3">buy</span>
        <span className="text-[10px] text-s3 mx-0.5">·</span>
        <span className="text-[10px] font-bold text-red">{currentSession.passCount}</span>
        <span className="text-[10px] text-t3">pass</span>
        <span className="text-[10px] text-s3 mx-0.5">·</span>
        <span className="text-[10px] font-bold text-amber">{maybeCount}</span>
        <span className="text-[10px] text-t3">maybe</span>
      </div>
    </div>
  )
}
