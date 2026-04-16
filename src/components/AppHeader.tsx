import { GearSix, ChartLine, ArrowLeft } from '@phosphor-icons/react'
import { ThemeToggle } from './ThemeToggle'
import type { Screen } from '@/types'

const SCREEN_TITLES: Partial<Record<Screen, string>> = {
  session: 'Resale Scanner Pro',
  agent: 'Agent',
  'scan-result': 'Scan Result',
  queue: 'Listing Queue',
  sold: 'Sold',
  settings: 'Settings',
  'session-detail': 'Session',
  'scan-history': 'Scan History',
  'tag-analytics': 'Tag Analytics',
  'location-insights': 'Locations',
  'cost-tracking': 'Cost Tracking',
}

interface AppHeaderProps {
  screen: Screen
  onNavigateToSettings: () => void
  onNavigateToTrends?: () => void
  onBack?: () => void
  backLabel?: string
  showTrends?: boolean
}

export function AppHeader({ screen, onNavigateToSettings, onNavigateToTrends, onBack, backLabel, showTrends }: AppHeaderProps) {
  const title = SCREEN_TITLES[screen] || ''
  const isSubScreen = !['session', 'agent', 'queue', 'sold'].includes(screen as string)

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-11 bg-fg border-b border-s1 flex-shrink-0">
      <div className="flex items-center gap-2">
        {isSubScreen && onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 h-10 px-1 rounded-lg text-t1 hover:bg-s1 transition-colors active:opacity-60 -ml-2"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            <ArrowLeft size={18} weight="bold" />
            {backLabel && (
              <span className="text-[13px] font-medium text-t2">{backLabel}</span>
            )}
          </button>
        )}
        <span className="text-[14px] font-semibold tracking-tight text-t1">{title}</span>
      </div>
      <div className="flex items-center gap-0.5">
        {onNavigateToTrends && (
          <button
            onClick={onNavigateToTrends}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-t3 hover:text-t1 hover:bg-s1 transition-colors"
            aria-label="Trends"
          >
            <ChartLine size={18} weight={showTrends ? 'fill' : 'bold'} className={showTrends ? 'text-b1' : ''} />
          </button>
        )}
        <ThemeToggle />
        <button
          onClick={onNavigateToSettings}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-t3 hover:text-t1 hover:bg-s1 transition-colors"
          aria-label="Settings"
        >
          <GearSix size={18} weight="bold" />
        </button>
      </div>
    </header>
  )
}
