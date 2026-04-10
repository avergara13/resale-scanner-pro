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
    { id: 'queue', icon: Stack, label: 'Listings' },
    { id: 'sold', icon: Tag, label: 'Sold' },
  ]

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40" /* z-40 > floating agent input (z-[35]) — nav always on top */
      style={{
        maxWidth: '100%',
        margin: '0 auto',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        background: 'color-mix(in oklch, var(--fg) 88%, transparent)',
        backdropFilter: 'saturate(180%) blur(28px)',
        WebkitBackdropFilter: 'saturate(180%) blur(28px)',
        borderTop: '0.5px solid color-mix(in oklch, var(--s2) 60%, transparent)',
        boxShadow: '0 -0.5px 0 rgba(0,0,0,0.06)',
      }}
    >
      <div className="relative h-[54px] flex items-center justify-around px-2">
        {items.slice(0, 2).map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all duration-200 active:scale-90',
                isActive ? 'text-b1' : 'text-t3'
              )}
              style={{
                minWidth: '62px',
                minHeight: '48px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Icon
                size={23}
                weight={isActive ? 'fill' : 'regular'}
                className="transition-all duration-200"
              />
              <span className={cn(
                'text-[10px] leading-none tracking-tight transition-all duration-200',
                isActive ? 'font-bold opacity-100' : 'font-medium opacity-60'
              )}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-b1" />
              )}
            </button>
          )
        })}

        {/* Camera — sits flush within the nav bar, static until pressed */}
        <button
          onClick={onCameraOpen}
          className={cn(
            'camera-fab-static flex items-center justify-center rounded-full w-11 h-11',
            captureState === 'analyzing' && 'camera-analyzing',
            captureState === 'success' && 'camera-success',
            captureState === 'fail' && 'camera-fail'
          )}
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Camera size={22} weight="bold" className="text-white relative z-10" />
        </button>

        {items.slice(2).map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all duration-200 active:scale-90',
                isActive ? 'text-b1' : 'text-t3'
              )}
              style={{
                minWidth: '62px',
                minHeight: '48px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Icon
                size={23}
                weight={isActive ? 'fill' : 'regular'}
                className="transition-all duration-200"
              />
              <span className={cn(
                'text-[10px] leading-none tracking-tight transition-all duration-200',
                isActive ? 'font-bold opacity-100' : 'font-medium opacity-60'
              )}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-b1" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
