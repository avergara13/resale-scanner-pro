import type { LucideIcon } from 'lucide-react'
import { BarChart3, Camera, Layers3, Receipt, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Screen } from '@/types'
import type { CaptureState } from '@/hooks/use-capture-state'
import { haptics } from '@/lib/haptics'

interface BottomNavProps {
  currentScreen: Screen
  onNavigate: (screen: Screen) => void
  onCameraOpen: () => void
  captureState?: CaptureState
  /** When true (session list screen), only Session tab + Camera are interactive */
  sessionMode?: boolean
}

export function BottomNav({ currentScreen, onNavigate, onCameraOpen, captureState = 'idle', sessionMode = false }: BottomNavProps) {
  const leftItems: Array<{ id: Screen; icon: LucideIcon; label: string }> = [
    { id: 'session', icon: BarChart3, label: 'Session' },
    { id: 'agent', icon: Sparkles, label: 'Agent' },
  ]
  const rightItems: Array<{ id: Screen; icon: LucideIcon; label: string }> = [
    { id: 'queue', icon: Layers3, label: 'Listings' },
    { id: 'sold', icon: Receipt, label: 'Sold' },
  ]

  const handleNavigate = (screen: Screen, disabled: boolean) => {
    if (disabled) {
      return
    }

    if (screen !== currentScreen) {
      haptics.selection()
    }

    onNavigate(screen)
  }

  return (
    <nav
      id="bottom-nav"
      className="material-chrome safe-area-x fixed bottom-0 left-0 right-0 z-40 border-t border-separator"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.12)',
      }}
    >
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
              onClick={() => handleNavigate(item.id, isDisabled)}
              disabled={isDisabled}
              className={cn(
                'relative flex min-h-[49px] flex-col items-center justify-center gap-0.5 transition-all duration-fast ease-spring',
                !isDisabled && 'active:scale-[0.96]',
                isActive ? 'text-system-blue' : 'text-tertiary-label',
                isDisabled && 'opacity-20 cursor-default'
              )}
              style={{
                height: '52px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <Icon
                size={24}
                strokeWidth={2}
                className={cn(
                  'transition-transform duration-fast ease-spring',
                  isActive && 'scale-110'
                )}
              />
              <span className={cn(
                'overflow-hidden text-caption-1 leading-none transition-all duration-fast ease-spring',
                isActive ? 'max-h-4 opacity-100 font-semibold' : 'max-h-0 opacity-0'
              )}>
                {item.label}
              </span>
            </button>
          )
        })}

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
          <Camera size={20} strokeWidth={2.5} className="text-white relative z-10" />
        </button>

        {rightItems.map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id
          // In sessionMode, Listings is disabled (session-scoped); Sold is always available (cross-session)
          const isDisabled = sessionMode && item.id !== 'sold'

          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id, isDisabled)}
              disabled={isDisabled}
              className={cn(
                'relative flex min-h-[49px] flex-col items-center justify-center gap-0.5 transition-all duration-fast ease-spring',
                !isDisabled && 'active:scale-[0.96]',
                isActive ? 'text-system-blue' : 'text-tertiary-label',
                isDisabled && 'opacity-20 cursor-default'
              )}
              style={{
                height: '52px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <Icon
                size={24}
                strokeWidth={2}
                className={cn(
                  'transition-transform duration-fast ease-spring',
                  isActive && 'scale-110'
                )}
              />
              <span className={cn(
                'overflow-hidden text-caption-1 leading-none transition-all duration-fast ease-spring',
                isActive ? 'max-h-4 opacity-100 font-semibold' : 'max-h-0 opacity-0'
              )}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
