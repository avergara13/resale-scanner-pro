import { ChartBar, ArrowLeft } from '@phosphor-icons/react'
import { Button } from '../ui/button'
import { TagAnalytics } from '../TagAnalytics'
import type { ScannedItem, ItemTag } from '@/types'

interface TagAnalyticsScreenProps {
  items: ScannedItem[]
  tags: ItemTag[]
  onBack: () => void
}

export function TagAnalyticsScreen({ items, tags, onBack }: TagAnalyticsScreenProps) {
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg)] pb-6">
      <header className="sticky top-0 z-10 bg-[var(--fg)] border-b border-[var(--s1)] p-4">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft size={18} weight="bold" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-black tracking-tight text-[var(--t1)]">TAG ANALYTICS</h1>
            <p className="text-[10px] text-[var(--t3)] font-medium uppercase tracking-wider">
              Track which tags drive best ROI
            </p>
          </div>
          <div className="w-10 h-10 bg-gradient-to-br from-[var(--b1)] to-[var(--amber)] rounded-xl flex items-center justify-center">
            <ChartBar size={20} weight="bold" className="text-white" />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <TagAnalytics items={items} tags={tags} />
      </div>
    </div>
  )
}
