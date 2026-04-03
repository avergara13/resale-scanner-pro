import { ChartBar, Robot, Stack, Gear, Eye } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { Screen } from '@/types'

interface BottomNavProps {
  currentScreen: Screen
  onNavigate: (screen: Screen) => void
  onCameraOpen: () => void
}

export function BottomNav({ currentScreen, onNavigate, onCameraOpen }: BottomNavProps) {
  const items: Array<{ id: Screen; icon: any; label: string }> = [
    { id: 'session', icon: ChartBar, label: 'Session' },
    { id: 'research', icon: Robot, label: 'AI Center' },
    { id: 'queue', icon: Stack, label: 'Queue' },
    { id: 'settings', icon: Gear, label: 'Settings' },
  ]

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 bg-fg border-t border-s1 safe-bottom z-40 backdrop-blur-sm"
      style={{ 
        maxWidth: '480px', 
        margin: '0 auto',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.04)'
      }}
    >
      <div className="relative h-16 flex items-center px-4">
        <div className="flex-1 flex items-center justify-around">
          {items.slice(0, 2).map((item) => {
            const Icon = item.icon
            const isActive = currentScreen === item.id

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all relative',
                  isActive 
                    ? 'text-b1 bg-blue-bg' 
                    : 'text-t4 hover:text-t2 hover:bg-s1/50 active:scale-95'
                )}
                style={{ minWidth: '68px', minHeight: '48px' }}
              >
                <Icon 
                  size={22} 
                  weight={isActive ? 'fill' : 'regular'} 
                  className={cn(
                    "relative z-10 transition-transform",
                    isActive && "scale-110"
                  )} 
                />
                <span className={cn(
                  "text-[10px] font-bold relative z-10 uppercase tracking-wider",
                  isActive && "font-extrabold"
                )}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
        
        <div className="w-16 flex-shrink-0" />
        
        <div className="flex-1 flex items-center justify-around">
          {items.slice(2).map((item) => {
            const Icon = item.icon
            const isActive = currentScreen === item.id

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all relative',
                  isActive 
                    ? 'text-b1 bg-blue-bg' 
                    : 'text-t4 hover:text-t2 hover:bg-s1/50 active:scale-95'
                )}
                style={{ minWidth: '68px', minHeight: '48px' }}
              >
                <Icon 
                  size={22} 
                  weight={isActive ? 'fill' : 'regular'} 
                  className={cn(
                    "relative z-10 transition-transform",
                    isActive && "scale-110"
                  )} 
                />
                <span className={cn(
                  "text-[10px] font-bold relative z-10 uppercase tracking-wider",
                  isActive && "font-extrabold"
                )}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
        
        <button
          id="camera-fab"
          onClick={onCameraOpen}
          className="absolute left-1/2 -translate-x-1/2 -top-5 w-16 h-16 bg-gradient-to-br from-b1 via-b1 to-amber text-white rounded-full shadow-[0_8px_24px_rgba(85,92,226,0.4),0_4px_8px_rgba(0,0,0,0.15)] border-[5px] border-fg flex items-center justify-center transition-all active:scale-95 hover:scale-110 hover:shadow-[0_12px_32px_rgba(85,92,226,0.5),0_6px_12px_rgba(0,0,0,0.2)] z-50 relative overflow-hidden"
          style={{ minWidth: '64px', minHeight: '64px' }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent opacity-50 animate-pulse" />
          <Eye size={28} weight="bold" className="relative z-10 drop-shadow-md" />
        </button>
      </div>
    </nav>
  )
}
