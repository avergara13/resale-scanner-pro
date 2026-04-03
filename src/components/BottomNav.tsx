import { ChartBar, Sparkle, Stack, Gear, Camera, Robot } from '@phosphor-icons/react'
import type { Screen } from '@/types'

interface BottomNavProps {
  currentScreen: Screen
  onNavigate: (screen: Screen) => void
  onCameraOpen: () => void
}

export function BottomNav({ currentScreen, onNavigate, onCameraOpen }: BottomNavProps) {
  const navItems = [
    { id: 'session' as Screen, icon: ChartBar, label: 'Session' },
    { id: 'research' as Screen, icon: Robot, label: 'Research' },
    { id: 'queue' as Screen, icon: Stack, label: 'Queue' },
    { id: 'settings' as Screen, icon: Gear, label: 'Settings' },
  ]

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 bg-bg border-t border-s2 safe-bottom"
      style={{ maxWidth: '480px', margin: '0 auto' }}
    >
      <div className="relative h-16 flex items-center justify-around px-2">
        {navItems.map((item, idx) => {
          const Icon = item.icon
          const isActive = currentScreen === item.id
          const isCameraSlot = idx === 2
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all ${
                isActive ? 'text-b1' : 'text-s3'
              } ${isCameraSlot ? 'opacity-0 pointer-events-none' : ''}`}
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              {isActive && (
                <div className="absolute w-8 h-8 bg-t4 rounded-full" style={{ top: '50%', transform: 'translateY(-50%)' }} />
              )}
              <Icon size={20} weight={isActive ? 'fill' : 'regular'} className="relative z-10" />
              <span className="text-xs font-medium relative z-10">{item.label}</span>
            </button>
          )
        })}
        
        <button
          id="camera-fab"
          onClick={onCameraOpen}
          className="absolute left-1/2 -translate-x-1/2 -top-4 w-14 h-14 bg-b1 hover:bg-b2 text-bg rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 hover:scale-105"
          style={{ minWidth: '56px', minHeight: '56px' }}
        >
          <Camera size={24} weight="bold" />
        </button>
      </div>
    </nav>
  )
}
