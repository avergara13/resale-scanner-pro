import { GearSix, ChartLine } from '@phosphor-icons/react'
import { ThemeToggle } from './ThemeToggle'
import type { Screen } from '@/types'

const SCREEN_TITLES: Partial<Record<Screen, string>> = {
  session: 'RESALE SCANNER PRO',
  agent: 'AGENT',
  queue: 'LISTING QUEUE',
  sold: 'SOLD',
}

interface AppHeaderProps {
  screen: Screen
  onNavigateToSettings: () => void
  onNavigateToTrends?: () => void
  showTrends?: boolean
}

export function AppHeader({ screen, onNavigateToSettings, onNavigateToTrends, showTrends }: AppHeaderProps) {
  const title = SCREEN_TITLES[screen]
  if (!title) return null

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-fg border-b border-s1 flex-shrink-0">
      <span className="text-[11px] font-black tracking-widest text-t3 uppercase">{title}</span>
      <div className="flex items-center gap-1">
        {onNavigateToTrends && (
          <button
            onClick={onNavigateToTrends}
            className="p-2 rounded-lg text-t3 hover:text-t1 hover:bg-s1 transition-colors"
            style={{ minWidth: 36, minHeight: 36 }}
            aria-label="Trends"
          >
            <ChartLine size={20} weight={showTrends ? 'fill' : 'bold'} className={showTrends ? 'text-b1' : ''} />
          </button>
        )}
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
