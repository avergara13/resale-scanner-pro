import { useKV } from '@github/spark/hooks'
import { CaretUp, CaretDown } from '@phosphor-icons/react'
import { useDeviceId } from '@/hooks/use-device-id'
import type { Session } from '@/types'

export function SessionLiveBanner() {
  const deviceId = useDeviceId()
  const [currentSession] = useKV<Session | undefined>(`device-current-session-${deviceId}`, undefined)
  const [collapsed, setCollapsed] = useKV<boolean>('agent-banner-collapsed', false)

  if (!currentSession?.active) return null

  const maybeCount = Math.max(0, currentSession.itemsScanned - currentSession.buyCount - currentSession.passCount)
  const sessionLabel = currentSession.name || `Session #${String(currentSession.sessionNumber ?? 1).padStart(3, '0')}`

  const barStyle = {
    background: 'color-mix(in oklch, var(--green) 7%, var(--fg))',
    borderLeft: '2px solid var(--green)',
    borderBottom: '1px solid color-mix(in oklch, var(--green) 20%, transparent)',
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={barStyle}
        className="w-full flex items-center justify-center gap-1.5 py-0.5"
        aria-label="Expand session banner"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
        <CaretDown size={9} weight="bold" className="text-green" />
      </button>
    )
  }

  return (
    <div style={barStyle} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0 sm:py-1.5">
      {/* Sonar ping dot */}
      <span className="relative flex-shrink-0" style={{ width: 7, height: 7 }}>
        <span className="absolute inset-0 rounded-full bg-green animate-ping opacity-50" />
        <span className="relative block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green" />
      </span>

      {/* LIVE label */}
      <span className="text-[7px] sm:text-[8px] font-black text-green tracking-[0.15em] uppercase flex-shrink-0">LIVE</span>

      {/* Divider */}
      <span className="w-px h-2.5 sm:h-3 bg-green/25 flex-shrink-0" />

      {/* Session name */}
      <span className="text-[9px] sm:text-[10px] font-bold text-green font-mono flex-shrink-0 max-w-[72px] sm:max-w-[90px] truncate">
        {sessionLabel}
      </span>

      {/* Operator name */}
      {currentSession.operatorName && (
        <span className="text-[8px] sm:text-[9px] text-t3 truncate flex-1 min-w-0">{currentSession.operatorName}</span>
      )}

      {/* Stats */}
      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0 ml-auto">
        <span className="text-[8px] sm:text-[9px] font-bold text-green">{currentSession.buyCount}</span>
        <span className="text-[8px] sm:text-[9px] text-t3 font-medium">buy</span>
        <span className="text-[8px] sm:text-[9px] text-s3 mx-0.5">·</span>
        <span className="text-[8px] sm:text-[9px] font-bold text-red">{currentSession.passCount}</span>
        <span className="text-[8px] sm:text-[9px] text-t3 font-medium">pass</span>
        <span className="text-[8px] sm:text-[9px] text-s3 mx-0.5">·</span>
        <span className="text-[8px] sm:text-[9px] font-bold text-amber">{maybeCount}</span>
        <span className="text-[8px] sm:text-[9px] text-t3 font-medium">maybe</span>
      </div>

      {/* Collapse */}
      <button
        onClick={() => setCollapsed(true)}
        className="flex-shrink-0 text-green/60 hover:text-green transition-colors ml-1 sm:ml-2"
        aria-label="Collapse session banner"
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      >
        <CaretUp size={9} weight="bold" />
      </button>
    </div>
  )
}
