import { Trash, ArrowRight } from '@phosphor-icons/react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ScannedItem } from '@/types'

interface QueueScreenProps {
  queueItems: ScannedItem[]
  onRemove: (id: string) => void
  onCreateListing: (id: string) => void
}

export function QueueScreen({ queueItems, onRemove, onCreateListing }: QueueScreenProps) {
  const sortedItems = [...queueItems].sort((a, b) => (b.profitMargin || 0) - (a.profitMargin || 0))

  return (
    <div id="scr-queue" className="flex flex-col h-full">
      <div className="px-4 py-6 border-b border-s2">
        <h1 className="text-2xl font-semibold text-fg mb-2">Queue</h1>
        <p className="text-sm text-s4">{queueItems.length} items ready to list</p>
      </div>

      {queueItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-s1 flex items-center justify-center mb-4">
            <p className="text-3xl">📦</p>
          </div>
          <h2 className="text-lg font-semibold text-fg mb-2">Queue is empty</h2>
          <p className="text-sm text-s4 max-w-xs">Scan items and add GO decisions to your queue</p>
        </div>
      ) : (
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-3">
            {sortedItems.map((item) => (
              <Card key={item.id} className="p-4 border border-s2">
                <div className="flex gap-3">
                  {item.imageData && (
                    <img
                      src={item.imageData}
                      alt={item.productName || 'Item'}
                      className="w-20 h-20 object-cover rounded-md border border-s2 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-fg text-sm line-clamp-2">
                        {item.productName || 'Unknown Item'}
                      </h3>
                      {item.profitMargin !== undefined && (
                        <Badge
                          variant="secondary"
                          className={`flex-shrink-0 font-mono font-medium ${
                            item.profitMargin > 50
                              ? 'bg-green/20 text-green'
                              : item.profitMargin > 20
                              ? 'bg-amber/20 text-amber'
                              : 'bg-red/20 text-red'
                          }`}
                        >
                          +{item.profitMargin.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-s4 mb-3">
                      <span>Cost: ${item.purchasePrice.toFixed(2)}</span>
                      {item.estimatedSellPrice && (
                        <span>Sell: ${item.estimatedSellPrice.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => onCreateListing(item.id)}
                        className="flex-1 bg-b1 hover:bg-b2 text-bg h-8 text-xs font-medium"
                      >
                        <ArrowRight size={14} weight="bold" className="mr-1" />
                        Create Listing
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemove(item.id)}
                        className="h-8 w-8 p-0 text-s4 hover:text-red hover:bg-red/10"
                      >
                        <Trash size={16} weight="bold" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
