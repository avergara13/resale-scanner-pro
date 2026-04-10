import { GearSix, ChartLine, ArrowLeft, ArrowClockwise } from '@phosphor-icons/react'
import { ThemeToggle } from './ThemeToggle'
import { ApiStatusIndicator } from './ApiStatusIndicator'
import type { Screen, AppSettings } from '@/types'

const SCREEN_TITLES: Partial<Record<Screen, string>> = {
  session: 'RESALE SCANNER PRO',
  agent: 'AGENT',
  queue: 'LISTINGS',
  sold: 'SHIPPING',
  settings: 'SETTINGS',
  'session-detail': 'SESSION',
  'scan-history': 'SCAN HISTORY',
  'tag-analytics': 'TAG ANALYTICS',
  'location-insights': 'LOCATIONS',
  'cost-tracking': 'COST TRACKING',
}

interface AppHeaderProps {
  screen: Screen
  onNavigateToSettings: () => void
  onNavigateToTrends?: () => void
  onBack?: () => void
  showTrends?: boolean
  settings?: AppSettings
  queueItemCount?: number
  onRefresh?: () => void
  soldLoading?: boolean
  soldSyncedAt?: number | null
}

export function AppHeader({
  screen,
  onNavigateToSettings,
  onNavigateToTrends,
  onBack,
  showTrends,
  settings,
  queueItemCount,
  onRefresh,
  soldLoading,
  soldSyncedAt,
}: AppHeaderProps) {
  const title = SCREEN_TITLES[screen] || ''
  const isSubScreen = !['session', 'agent', 'queue', 'sold'].includes(screen)

  const soldSyncedLabel = soldSyncedAt
    ? new Date(soldSyncedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <header className="sticky top-0 z-30 relative flex items-center justify-between px-4 h-12 flex-shrink-0"
      style={{
        background: 'color-mix(in oklch, var(--fg) 85%, transparent)',
        backdropFilter: 'saturate(180%) blur(28px)',
        WebkitBackdropFilter: 'saturate(180%) blur(28px)',
        borderBottom: '0.5px solid color-mix(in oklch, var(--s2) 50%, transparent)',
      }}
    >
      <div className="flex items-center gap-2">
        {isSubScreen && onBack && (
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-lg text-t1 hover:bg-s1 transition-colors active:opacity-60 -ml-1">
            <ArrowLeft size={18} weight="bold" />
          </button>
        )}
        <span className="text-[11px] font-black tracking-widest text-t1 uppercase">{title}</span>
      </div>

      {/* Status dots — Agent screen, pinned to horizontal center */}
      {screen === 'agent' && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto">
          <ApiStatusIndicator settings={settings} compact liveUpdates={true} />
        </div>
      )}

      {/* Item count — Listings screen, pinned to horizontal center */}
      {screen === 'queue' && queueItemCount !== undefined && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <span className="text-[10px] font-semibold text-t3 uppercase tracking-widest">
            {queueItemCount} {queueItemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      )}

      {/* Sync time — Sold screen, pinned to horizontal center */}
      {screen === 'sold' && soldSyncedLabel && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <span className="text-[10px] font-semibold text-t3 tracking-wide">
            {soldSyncedLabel}
          </span>
        </div>
      )}

      <div className="flex items-center gap-0.5">
        {/* Refresh — Sold screen only */}
        {screen === 'sold' && onRefresh && (
          <button
            onClick={onRefresh}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-t3 hover:text-t1 hover:bg-s1 transition-colors"
            aria-label="Refresh sold items"
          >
            <ArrowClockwise
              size={18}
              weight="bold"
              className={soldLoading ? 'animate-spin text-b1' : ''}
            />
          </button>
        )}
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
