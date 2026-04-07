import { GearSix, ChartLine, ArrowLeft } from '@phosphor-icons/react'
import { ThemeToggle } from './ThemeToggle'
import type { Screen } from '@/types'

const SCREEN_TITLES: Partial<Record<Screen, string>> = {
  session: 'RESALE SCANNER PRO',
  agent: 'AGENT',
  queue: 'LISTING QUEUE',
  sold: 'SOLD',
  settings: 'SETTINGS',
  'session-detail': 'SESSION',
  'scan-history': 'SCAN HISTORY',
  'tag-analytics': 'TAG ANALYTICS',
  'location-insights': 'LOCATIONS',
  'cost-tracking': 'COST TRACKING',
  ai: 'AI',
  incidents: 'INCIDENTS',
  listing: 'LISTING',
}

interface AppHeaderProps {
  screen: Screen
  onNavigateToSettings: () => void
  onNavigateToTrends?: () => void
  onBack?: () => void
  showTrends?: boolean
}

export function AppHeader({ screen, onNavigateToSettings, onNavigateToTrends, onBack, showTrends }: AppHeaderProps) {
  const title = SCREEN_TITLES[screen] || ''
  const isSubScreen = !['session', 'agent', 'queue', 'sold'].includes(screen)

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-11 bg-fg border-b border-s1 flex-shrink-0">
      <div className="flex items-center gap-2">
        {isSubScreen && onBack && (
          <button onClick={onBack} className="p-1 -ml-1 rounded-lg text-t1 hover:bg-s1 transition-colors active:opacity-60">
            <ArrowLeft size={18} weight="bold" />
          </button>
        )}
        <span className="text-[11px] font-black tracking-widest text-t1 uppercase">{title}</span>
      </div>
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
