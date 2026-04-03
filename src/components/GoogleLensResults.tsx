import { useState } from 'react'
import { MagnifyingGlass, TrendUp, ShoppingBag, CaretDown } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { GoogleLensAnalysis } from '@/types'

interface GoogleLensResultsProps {
  lensAnalysis?: GoogleLensAnalysis
}

export function GoogleLensResults({ lensAnalysis }: GoogleLensResultsProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!lensAnalysis || lensAnalysis.results.length === 0) {
    return null
  }

  const { results, priceRange, dominantSources } = lensAnalysis

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-3 sm:p-4 bg-fg border-s2 mt-3 sm:mt-4 overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-b1 text-white rounded-lg flex items-center justify-center shrink-0">
                <MagnifyingGlass size={14} weight="bold" className="sm:w-4 sm:h-4" />
              </div>
              <div className="text-left">
                <h3 className="text-xs sm:text-sm font-bold text-t1">Google Lens Matches</h3>
                <p className="text-[10px] sm:text-xs text-t3">{results.length} visual results</p>
              </div>
            </div>
            <CaretDown
              size={18}
              weight="bold"
              className={cn(
                "text-t3 transition-transform duration-200 flex-shrink-0",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
          {priceRange && (
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-bg rounded-lg border border-s2">
              <div className="flex items-center gap-2">
                <TrendUp size={14} className="text-green sm:w-4 sm:h-4" weight="bold" />
                <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-t3">Price Range</span>
              </div>
              <div className="text-xs sm:text-sm font-bold font-mono text-t1">
                ${priceRange.min.toFixed(2)} - ${priceRange.max.toFixed(2)}
              </div>
            </div>
          )}

          {dominantSources && dominantSources.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShoppingBag size={14} className="text-t3" weight="bold" />
                <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-t3">Top Sources</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {dominantSources.map((source, idx) => (
                  <Badge key={idx} variant="secondary" className="text-[10px] sm:text-xs">
                    {source}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-t3">Visual Matches</h4>
            <div className="space-y-2 max-h-56 sm:max-h-64 overflow-y-auto pr-1">
              {results.slice(0, 5).map((result, idx) => (
                <a
                  key={idx}
                  href={result.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 sm:gap-3 p-2 sm:p-2.5 bg-bg rounded-lg border border-s2 hover:border-b1 transition-colors"
                >
                  {result.thumbnail && (
                    <img
                      src={result.thumbnail}
                      alt={result.title}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover shrink-0 border border-s2"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] sm:text-xs font-medium line-clamp-2 mb-1 text-t1">{result.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] sm:text-[10px] text-t3 truncate">{result.source}</span>
                      {result.price && (
                        <span className="text-[11px] sm:text-xs font-bold font-mono text-green">{result.price}</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
