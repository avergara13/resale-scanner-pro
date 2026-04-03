import { ChartBar, Robot, Stack, Gear, Eye } from '@phosphor-icons/react'
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
    { id: 'queue', icon: Stack, label: 'Queue' },
    { id: 'settings', icon: Gear, label: 'Settings' },
  ]

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 bg-fg border-t border-s1 safe-bottom z-40 backdrop-blur-sm"
      style={{ 
        maxWidth: '100%', 
        margin: '0 auto',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.04)'
      }}
    >
      <div className="relative h-14 sm:h-16 flex items-center px-2 sm:px-4">
        <div className="flex-1 flex items-center justify-around">
          {items.slice(0, 2).map((item) => {
            const Icon = item.icon
            const isActive = currentScreen === item.id

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl transition-all relative',
                  isActive 
                    ? 'text-b1 bg-blue-bg' 
                    : 'text-t2 hover:text-t1 hover:bg-s1/50 active:scale-95'
                )}
                style={{ minWidth: '56px', minHeight: '44px' }}
              >
                <Icon 
                  size={20} 
                  weight={isActive ? 'fill' : 'regular'} 
                  className={cn(
                    "relative z-10 transition-transform sm:w-[22px] sm:h-[22px]",
                    isActive && "scale-110"
                  )} 
                />
                <span className={cn(
                  "text-[9px] sm:text-[10px] font-bold relative z-10 uppercase tracking-wider",
                  isActive && "font-extrabold"
                )}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
        
        <div className="w-12 sm:w-16 flex-shrink-0" />
        
        <div className="flex-1 flex items-center justify-around">
          {items.slice(2).map((item) => {
            const Icon = item.icon
            const isActive = currentScreen === item.id

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl transition-all relative',
                  isActive 
                    ? 'text-b1 bg-blue-bg' 
                    : 'text-t2 hover:text-t1 hover:bg-s1/50 active:scale-95'
                )}
                style={{ minWidth: '56px', minHeight: '44px' }}
              >
                <Icon 
                  size={20} 
                  weight={isActive ? 'fill' : 'regular'} 
                  className={cn(
                    "relative z-10 transition-transform sm:w-[22px] sm:h-[22px]",
                    isActive && "scale-110"
                  )} 
                />
                <span className={cn(
                  "text-[9px] sm:text-[10px] font-bold relative z-10 uppercase tracking-wider",
                  isActive && "font-extrabold"
                )}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 -top-4 sm:-top-5 z-50">
          <div className={cn(
            "absolute inset-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all pointer-events-none",
            captureState === 'analyzing' && "animate-[pulse-ring-analyzing_1.5s_ease-out_infinite] bg-amber/50",
            captureState === 'success' && "animate-[pulse-ring_1s_ease-out_3] bg-green/50",
            captureState === 'fail' && "animate-[pulse-ring_1s_ease-out_3] bg-red/50",
            captureState === 'idle' && "animate-[pulse-ring_3s_ease-out_infinite] bg-b1/30",
            captureState === 'capturing' && "animate-[pulse-ring_0.8s_ease-out_2] bg-b1/60"
          )} style={{ minWidth: '56px', minHeight: '56px' }} />
          <div className={cn(
            "absolute inset-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all pointer-events-none",
            captureState === 'analyzing' && "animate-[pulse-ring-analyzing_1.5s_ease-out_infinite_0.5s] bg-b1/40",
            captureState === 'idle' && "animate-[pulse-ring_3s_ease-out_infinite_1s] bg-amber/20"
          )} style={{ minWidth: '56px', minHeight: '56px' }} />
          <div className={cn(
            "absolute inset-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all pointer-events-none",
            captureState === 'analyzing' && "animate-[pulse-ring-analyzing_1.5s_ease-out_infinite_1s] bg-amber/30"
          )} style={{ minWidth: '56px', minHeight: '56px' }} />
          <button
            id="camera-fab"
            onClick={onCameraOpen}
            className={cn(
              "camera-fab-animated relative w-14 h-14 sm:w-16 sm:h-16 text-white rounded-full border-[4px] sm:border-[5px] border-fg flex items-center justify-center transition-all overflow-hidden",
              captureState === 'analyzing' && "camera-analyzing",
              captureState === 'success' && "camera-success",
              captureState === 'fail' && "camera-fail"
            )}
            style={{ minWidth: '56px', minHeight: '56px' }}
          >
            <Eye 
              size={24} 
              weight="bold" 
              className={cn(
                "relative z-10 drop-shadow-md transition-all duration-300 sm:w-[28px] sm:h-[28px]",
                captureState === 'analyzing' && "animate-pulse scale-110",
                captureState === 'success' && "scale-125",
                captureState === 'fail' && "scale-90"
              )} 
            />
          </button>
        </div>
      </div>
    </nav>
  )
}
