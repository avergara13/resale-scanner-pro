import { ChartBar, Stack, Tag, Robot, Camera } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { Screen } from '@/types'
import type { CaptureState } from '@/hooks/use-capture-state'

interface BottomNavProps {
  currentScreen: Screen
  onNavigate: (screen: Screen) => void
  onCameraOpen: () => void
  captureState?: CaptureState
}

export function BottomNav({ currentScreen, onNavigate, onCameraOpen, captureState = 'idle' }: BottomNavProps) {
  const items: Array<{ id: Screen; icon: any; label: string }> = [
    { id: 'session', icon: ChartBar, label: 'Session' },
    { id: 'agent', icon: Robot, label: 'Agent' },
    { id: 'queue', icon: Stack, label: 'Scans' },
    { id: 'sold', icon: Tag, label: 'Sold' },
  ]

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 bg-fg/92 backdrop-blur-2xl border-t border-s1/40 z-40"
      style={{
        maxWidth: '100%',
        margin: '0 auto',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        /* Subtle top shadow — matches iOS tab bar feel */
        boxShadow: '0 -0.5px 0 rgba(0,0,0,0.10), 0 -8px 32px rgba(0,0,0,0.05)',
        WebkitBackdropFilter: 'blur(24px)'
      }}
    >
      <div className="relative h-16 flex items-center justify-around px-1 sm:px-4">
        {items.slice(0, 2).map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-[3px] px-4 py-2 rounded-2xl transition-all duration-200',
                isActive
                  ? 'text-b1'
                  : 'text-t3 active:opacity-60'
              )}
              style={{
                minWidth: '60px',
                minHeight: '48px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <Icon
                size={23}
                weight={isActive ? 'fill' : 'regular'}
                className="transition-all duration-150"
              />
              <span className={cn(
                "text-[10px] leading-none tracking-tight",
                isActive ? 'font-semibold' : 'font-medium'
              )}>
                {item.label}
              </span>
            </button>
          )
        })}

        {/* Camera FAB — gradient bubble, sits slightly above nav */}
        <button
          onClick={onCameraOpen}
          className={cn(
            'camera-fab-animated flex items-center justify-center rounded-full w-12 h-12 sm:w-14 sm:h-14 -mt-5 shadow-xl transition-all duration-300 active:scale-95 relative z-50',
            captureState === 'analyzing' && 'camera-analyzing',
            captureState === 'success' && 'camera-success',
            captureState === 'fail' && 'camera-fail'
          )}
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <Camera size={24} weight="bold" className="text-white relative z-10" />
        </button>

        {items.slice(2).map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-[3px] px-4 py-2 rounded-2xl transition-all duration-200',
                isActive
                  ? 'text-b1'
                  : 'text-t3 active:opacity-60'
              )}
              style={{
                minWidth: '60px',
                minHeight: '48px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <Icon
                size={23}
                weight={isActive ? 'fill' : 'regular'}
                className="transition-all duration-150"
              />
              <span className={cn(
                "text-[10px] leading-none tracking-tight",
                isActive ? 'font-semibold' : 'font-medium'
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
