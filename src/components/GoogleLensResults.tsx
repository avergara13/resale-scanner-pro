import { MagnifyingGlass, TrendUp, ShoppingBag } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { GoogleLensAnalysis } from '@/types'

interface GoogleLensResultsProps {
  lensAnalysis?: GoogleLensAnalysis
}

export function GoogleLensResults({ lensAnalysis }: GoogleLensResultsProps) {
  if (!lensAnalysis || lensAnalysis.results.length === 0) {
    return null
  }

  const { results, priceRange, dominantSources } = lensAnalysis

  return (
    <Card className="p-4 space-y-4 bg-t4 border-s2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-b1 text-bg rounded flex items-center justify-center shrink-0">
          <MagnifyingGlass size={16} weight="bold" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Google Lens Matches</h3>
          <p className="text-xs text-s4">{results.length} visual search results</p>
        </div>
      </div>

      {priceRange && (
        <div className="flex items-center justify-between p-3 bg-bg rounded-lg border border-s2">
          <div className="flex items-center gap-2">
            <TrendUp size={16} className="text-green" weight="bold" />
            <span className="text-xs font-medium uppercase tracking-wide text-s4">Price Range</span>
          </div>
          <div className="text-sm font-bold font-mono">
            ${priceRange.min.toFixed(2)} - ${priceRange.max.toFixed(2)}
          </div>
        </div>
      )}

      {dominantSources && dominantSources.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShoppingBag size={14} className="text-s4" weight="bold" />
            <span className="text-xs font-medium uppercase tracking-wide text-s4">Top Sources</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dominantSources.map((source, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {source}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-s4">Visual Matches</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {results.slice(0, 5).map((result, idx) => (
            <a
              key={idx}
              href={result.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-2.5 bg-bg rounded-lg border border-s2 hover:border-b1 transition-colors"
            >
              {result.thumbnail && (
                <img
                  src={result.thumbnail}
                  alt={result.title}
                  className="w-12 h-12 rounded object-cover shrink-0 border border-s2"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium line-clamp-2 mb-1">{result.title}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-s4 truncate">{result.source}</span>
                  {result.price && (
                    <span className="text-xs font-bold font-mono text-green">{result.price}</span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </Card>
  )
}
