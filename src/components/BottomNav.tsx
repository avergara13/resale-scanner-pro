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
      className="fixed bottom-0 left-0 right-0 bg-fg border-t border-s1 safe-bottom z-40"
      style={{ maxWidth: '480px', margin: '0 auto' }}
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
                  'flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-lg transition-all relative',
                  isActive ? 'text-b1' : 'text-t4'
                )}
                style={{ minWidth: '64px', minHeight: '44px' }}
              >
                <Icon size={20} weight={isActive ? 'fill' : 'regular'} className="relative z-10" />
                <span className="text-[10px] font-medium relative z-10">{item.label}</span>
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
                  'flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-lg transition-all relative',
                  isActive ? 'text-b1' : 'text-t4'
                )}
                style={{ minWidth: '64px', minHeight: '44px' }}
              >
                <Icon size={20} weight={isActive ? 'fill' : 'regular'} className="relative z-10" />
                <span className="text-[10px] font-medium relative z-10">{item.label}</span>
              </button>
            )
          })}
        </div>
        
        <button
          id="camera-fab"
          onClick={onCameraOpen}
          className="absolute left-1/2 -translate-x-1/2 -top-4 w-14 h-14 bg-gradient-to-br from-b1 to-amber text-white rounded-full shadow-[0_4px_20px_rgba(193,124,95,0.35)] border-4 border-fg flex items-center justify-center transition-all active:scale-95 hover:scale-105 z-50"
          style={{ minWidth: '56px', minHeight: '56px' }}
        >
          <Eye size={24} weight="bold" />
        </button>
      </div>
    </nav>
  )
}
