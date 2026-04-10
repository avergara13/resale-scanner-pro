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
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.04)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
    >
      {/* 5-column grid — each slot is exactly 1/5 of the nav width, pixel-perfect on every iPhone */}
      <div
        className="h-[54px]"
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

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-[3px] transition-all duration-200 active:scale-90',
                isActive ? 'text-b1' : 'text-t3'
              )}
              style={{
                height: '54px',
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

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-[3px] transition-all duration-200 active:scale-90',
                isActive ? 'text-b1' : 'text-t3'
              )}
              style={{
                height: '54px',
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
