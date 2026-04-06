import { GearSix } from '@phosphor-icons/react'
import { ThemeToggle } from './ThemeToggle'
import type { Screen } from '@/types'

const SCREEN_TITLES: Partial<Record<Screen, string>> = {
  session: 'SESSION',
  agent: 'AGENT',
  queue: 'LISTING QUEUE',
  sold: 'SOLD',
}

interface AppHeaderProps {
  screen: Screen
  onNavigateToSettings: () => void
}

export function AppHeader({ screen, onNavigateToSettings }: AppHeaderProps) {
  const title = SCREEN_TITLES[screen]
  if (!title) return null

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-fg border-b border-s1 flex-shrink-0">
      <span className="text-[11px] font-black tracking-widest text-t3 uppercase">{title}</span>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <button
          onClick={onNavigateToSettings}
          className="p-2 rounded-lg text-t3 hover:text-t1 hover:bg-s1 transition-colors"
          style={{ minWidth: 36, minHeight: 36 }}
          aria-label="Settings"
        >
          <GearSix size={20} weight="bold" />
        </button>
      </div>
    </header>
  )
}
