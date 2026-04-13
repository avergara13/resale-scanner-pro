import { ChartBar, Stack, Tag, Robot, Camera } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { Screen } from '@/types'
import type { CaptureState } from '@/hooks/use-capture-state'

interface BottomNavProps {
  currentScreen: Screen
  onNavigate: (screen: Screen) => void
  onCameraOpen: () => void
  captureState?: CaptureState
  /** When true (session list screen), only Session tab + Camera are interactive */
  sessionMode?: boolean
}

export function BottomNav({ currentScreen, onNavigate, onCameraOpen, captureState = 'idle', sessionMode = false }: BottomNavProps) {
  const leftItems: Array<{ id: Screen; icon: any; label: string }> = [
    { id: 'session', icon: ChartBar, label: 'Session' },
    { id: 'agent', icon: Robot, label: 'Agent' },
  ]
  const rightItems: Array<{ id: Screen; icon: any; label: string }> = [
    { id: 'queue', icon: Stack, label: 'Listings' },
    { id: 'sold', icon: Tag, label: 'Sold' },
  ]

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        background: 'color-mix(in oklch, var(--bg) 88%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid color-mix(in oklch, var(--fg) 12%, transparent)',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.12)',
      }}
    >
      {/* 5-column grid — each slot is exactly 1/5 of the nav width, pixel-perfect on every iPhone */}
      <div
        className="h-[52px]"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          alignItems: 'center',
        }}
      >
        {leftItems.map((item) => {
          const Icon = item.icon
          // scan-result is a child of the agent tab — keep agent highlighted while on it
          const isActive = currentScreen === item.id ||
            (item.id === 'agent' && currentScreen === 'scan-result')
          // In sessionMode, only the Session tab is interactive; Agent is disabled
          const isDisabled = sessionMode && item.id !== 'session'

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onNavigate(item.id)}
              disabled={isDisabled}
              className={cn(
                'relative flex flex-col items-center justify-center gap-[3px] transition-all duration-200',
                !isDisabled && 'active:scale-90',
                isActive ? 'text-b1' : 'text-t3',
                isDisabled && 'opacity-20 cursor-default'
              )}
              style={{
                height: '52px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <Icon
                size={22}
                weight={isActive ? 'fill' : 'regular'}
                className="transition-all duration-200"
              />
              <span className={cn(
                'text-[10px] leading-none tracking-tight transition-all duration-200',
                isActive ? 'font-semibold opacity-100' : 'font-medium opacity-55'
              )}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-b1" />
              )}
            </button>
          )
        })}

        {/* Camera — center column, perfectly flush in the bar */}
        <button
          onClick={onCameraOpen}
          className={cn(
            'camera-fab-static flex items-center justify-center rounded-full',
            captureState === 'analyzing' && 'camera-analyzing',
            captureState === 'success' && 'camera-success',
            captureState === 'fail' && 'camera-fail'
          )}
          style={{
            width: '44px',
            height: '44px',
            margin: '0 auto',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <Camera size={20} weight="bold" className="text-white relative z-10" />
        </button>

        {rightItems.map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id
          // In sessionMode, Listings is disabled (session-scoped); Sold is always available (cross-session)
          const isDisabled = sessionMode && item.id !== 'sold'

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onNavigate(item.id)}
              disabled={isDisabled}
              className={cn(
                'relative flex flex-col items-center justify-center gap-[3px] transition-all duration-200',
                !isDisabled && 'active:scale-90',
                isActive ? 'text-b1' : 'text-t3',
                isDisabled && 'opacity-20 cursor-default'
              )}
              style={{
                height: '52px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <Icon
                size={22}
                weight={isActive ? 'fill' : 'regular'}
                className="transition-all duration-200"
              />
              <span className={cn(
                'text-[10px] leading-none tracking-tight transition-all duration-200',
                isActive ? 'font-semibold opacity-100' : 'font-medium opacity-55'
              )}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-b1" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
