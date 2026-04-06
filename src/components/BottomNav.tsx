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
      className="fixed bottom-0 left-0 right-0 bg-fg/95 backdrop-blur-md border-t border-s1 z-40"
      style={{
        maxWidth: '100%',
        margin: '0 auto',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.04)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
    >
      <div className="relative h-16 sm:h-18 flex items-center justify-around px-2 sm:px-4">
        {items.slice(0, 2).map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'touch-target flex flex-col items-center justify-center gap-1 px-3 sm:px-4 py-2 rounded-xl transition-all duration-200 relative',
                isActive 
                  ? 'text-b1 bg-blue-bg scale-105' 
                  : 'text-t2 hover:text-t1 hover:bg-s1/50 active:scale-95'
              )}
              style={{ 
                minWidth: '64px', 
                minHeight: '48px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <Icon 
                size={22} 
                weight={isActive ? 'fill' : 'regular'} 
                className={cn(
                  "relative z-10 transition-all duration-200 sm:w-[24px] sm:h-[24px]",
                  isActive && "scale-110"
                )} 
              />
              <span className={cn(
                "text-[10px] sm:text-[11px] font-bold relative z-10 uppercase tracking-wider",
                isActive && "font-extrabold"
              )}>
                {item.label}
              </span>
            </button>
          )
        })}

        <button
          onClick={onCameraOpen}
          className={cn(
            'camera-fab-animated flex items-center justify-center rounded-full w-14 h-14 sm:w-16 sm:h-16 -mt-8 shadow-lg transition-all duration-300 active:scale-95 relative z-50',
            captureState === 'analyzing' && 'camera-analyzing',
            captureState === 'success' && 'camera-success',
            captureState === 'fail' && 'camera-fail'
          )}
          style={{ 
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <Camera size={28} weight="bold" className="text-white relative z-10" />
        </button>

        {items.slice(2).map((item) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'touch-target flex flex-col items-center justify-center gap-1 px-3 sm:px-4 py-2 rounded-xl transition-all duration-200 relative',
                isActive 
                  ? 'text-b1 bg-blue-bg scale-105' 
                  : 'text-t2 hover:text-t1 hover:bg-s1/50 active:scale-95'
              )}
              style={{ 
                minWidth: '64px', 
                minHeight: '48px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <Icon 
                size={22} 
                weight={isActive ? 'fill' : 'regular'} 
                className={cn(
                  "relative z-10 transition-all duration-200 sm:w-[24px] sm:h-[24px]",
                  isActive && "scale-110"
                )} 
              />
              <span className={cn(
                "text-[10px] sm:text-[11px] font-bold relative z-10 uppercase tracking-wider",
                isActive && "font-extrabold"
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
