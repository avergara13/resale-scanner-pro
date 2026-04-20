import { GearSix, ChartLine, ArrowLeft } from '@phosphor-icons/react'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '@/lib/utils'
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

/** Root screens get a large title that collapses on scroll. Detail screens always use compact inline title. */
const ROOT_SCREENS = new Set<Screen>(['session', 'agent', 'queue', 'sold'])

interface AppHeaderProps {
  screen: Screen
  onNavigateToSettings: () => void
  onNavigateToTrends?: () => void
  onBack?: () => void
  backLabel?: string
  showTrends?: boolean
  /** True when the screen content has scrolled past the large title threshold */
  scrolled?: boolean
  /** Overrides the static SCREEN_TITLES entry — used for dynamic detail screen names (e.g. session label) */
  titleOverride?: string
}

export function AppHeader({
  screen,
  onNavigateToSettings,
  onNavigateToTrends,
  onBack,
  backLabel,
  showTrends,
  scrolled = false,
  titleOverride,
}: AppHeaderProps) {
  const title = titleOverride ?? SCREEN_TITLES[screen] ?? ''
  const isRootScreen = ROOT_SCREENS.has(screen)
  const showCompactTitle = !isRootScreen || scrolled

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex-shrink-0 transition-colors duration-medium ease-out-quart',
        scrolled || !isRootScreen
          ? 'bg-system-background/88 backdrop-blur-xl border-b border-separator'
          : 'bg-transparent border-b border-transparent',
      )}
    >
      {/* Compact nav bar — always 44px */}
      <div className="flex items-center justify-between px-4 h-11">
        <div className="flex items-center gap-2">
          {!isRootScreen && onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 h-10 px-1 rounded-lg text-system-blue hover:bg-system-fill transition-colors active:opacity-60 -ml-2"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <ArrowLeft size={18} weight="bold" />
              {backLabel && (
                <span className="text-[13px] font-medium">{backLabel}</span>
              )}
            </button>
          )}
          <span
            className={cn(
              'text-[14px] font-semibold tracking-tight text-label transition-opacity duration-medium ease-out-quart',
              showCompactTitle ? 'opacity-100' : 'opacity-0',
            )}
          >
            {title}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
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

      {/* Large title — root screens only, collapses to 0 height when scrolled */}
      {isRootScreen && (
        <div
          className="overflow-hidden transition-all duration-medium ease-out-quart"
          style={{ maxHeight: scrolled ? 0 : '64px' }}
        >
          <div className="px-4 pb-3 pt-0">
            <h1 className="text-[28px] font-bold tracking-tight text-label leading-[1.1]">
              {title}
            </h1>
          </div>
        </div>
      )}
    </header>
  )
}
