import { ChevronLeft, Settings, TrendingUp } from 'lucide-react'
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
    <header className="material-chrome sticky top-0 z-30 flex-shrink-0 border-b border-separator safe-area-x">
      <div className="flex h-11 items-center justify-between px-4">
        <div className="flex items-center gap-2 min-w-0">
          {!isRootScreen && onBack && (
            <button
              onClick={onBack}
              className="ml-[-0.5rem] inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-system-blue transition-colors hover:bg-system-fill active:opacity-60"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <ChevronLeft size={22} strokeWidth={2.25} />
              {backLabel && (
                <span className="max-w-20 truncate text-footnote font-medium">{backLabel}</span>
              )}
            </button>
          )}
          <span className="truncate font-sans text-headline text-label">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onNavigateToTrends && (
            <button
              onClick={onNavigateToTrends}
              className="inline-flex size-11 items-center justify-center rounded-full text-tertiary-label transition-colors hover:bg-system-fill hover:text-label"
              aria-label="Trends"
            >
              <TrendingUp
                size={22}
                strokeWidth={2}
                className={showTrends ? 'text-system-blue' : undefined}
              />
            </button>
          )}
          <ThemeToggle />
          <button
            onClick={onNavigateToSettings}
            className="inline-flex size-11 items-center justify-center rounded-full text-tertiary-label transition-colors hover:bg-system-fill hover:text-label"
            aria-label="Settings"
          >
            <Settings size={22} strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  )
}
