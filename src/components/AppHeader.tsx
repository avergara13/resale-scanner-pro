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
  'session-detail': 'Sessions',
  'scan-history': 'Scan History',
  'tag-analytics': 'Tag Analytics',
  'location-insights': 'Locations',
  'cost-tracking': 'Cost Tracking',
}

/** Screens that have no back button (top-level tabs) */
const ROOT_SCREENS = new Set<Screen>(['session', 'agent', 'queue', 'sold'])

interface AppHeaderProps {
  screen: Screen
  onNavigateToSettings: () => void
  onNavigateToTrends?: () => void
  onBack?: () => void
  backLabel?: string
  showTrends?: boolean
  scrolled?: boolean
}

export function AppHeader({
  screen,
  onNavigateToSettings,
  onNavigateToTrends,
  onBack,
  backLabel,
  showTrends,
}: AppHeaderProps) {
  const title = SCREEN_TITLES[screen] ?? ''
  const isRootScreen = ROOT_SCREENS.has(screen)

  return (
    <header className="sticky top-0 z-30 flex-shrink-0 bg-system-background/88 backdrop-blur-xl border-b border-separator">
      {/* Single row — title left, action buttons right */}
      <div className="flex items-center justify-between px-4 h-11">
        {/* Left zone: back button (detail screens) + title */}
        <div className="flex items-center gap-2 min-w-0">
          {!isRootScreen && onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 h-10 px-1 rounded-lg text-system-blue hover:bg-system-fill transition-colors active:opacity-60 -ml-2 flex-shrink-0"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <ArrowLeft size={18} weight="bold" />
              {backLabel && (
                <span className="text-[13px] font-medium">{backLabel}</span>
              )}
            </button>
          )}
          <span className="text-[17px] font-semibold tracking-tight text-label truncate">
            {title}
          </span>
        </div>

        {/* Right zone: action buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onNavigateToTrends && (
            <button
              onClick={onNavigateToTrends}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-tertiary-label hover:text-label hover:bg-system-fill transition-colors"
              aria-label="Trends"
            >
              <ChartLine size={18} weight={showTrends ? 'fill' : 'bold'} className={showTrends ? 'text-system-blue' : ''} />
            </button>
          )}
          <ThemeToggle />
          <button
            onClick={onNavigateToSettings}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-tertiary-label hover:text-label hover:bg-system-fill transition-colors"
            aria-label="Settings"
          >
            <GearSix size={18} weight="bold" />
          </button>
        </div>
      </div>
    </header>
  )
}
