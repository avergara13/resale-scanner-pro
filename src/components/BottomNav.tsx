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
      className="fixed bottom-0 left-0 right-0 bg-bg border-t border-s2 safe-bottom z-40"
      style={{ maxWidth: '480px', margin: '0 auto' }}
    >
      <div className="relative h-16 flex items-center justify-around px-2">
        {items.map((item, idx) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id

          return (
            <div key={item.id} className="flex-1 flex justify-center">
              {idx === 1 && (
                <div className="w-14 relative flex items-center justify-center">
                  <button
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      'flex flex-col items-center justify-center w-16 h-full transition-colors',
                      isActive ? 'text-b1' : 'text-s3'
                    )}
                    style={{ minWidth: '44px', minHeight: '44px' }}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                  </button>
                </div>
              )}
              {idx === 1 ? null : (
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'flex flex-col items-center justify-center w-16 h-full transition-colors',
                    isActive ? 'text-b1' : 'text-s3'
                  )}
                  style={{ minWidth: '44px', minHeight: '44px' }}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                </button>
              )}
              {idx === 1 && (
                <button
                  id="camera-fab"
                  onClick={onCameraOpen}
                  className="absolute left-1/2 -translate-x-1/2 -top-12 w-14 h-14 bg-fg text-bg rounded-full flex items-center justify-center shadow-lg border-4 border-bg active:scale-95 transition-transform"
                  style={{ minWidth: '56px', minHeight: '56px' }}
                >
                  <Eye size={28} weight="bold" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
