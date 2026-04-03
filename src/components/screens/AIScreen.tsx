import { useState } from 'react'
import { Robot, PencilSimple, Plus, Microphone, Scan } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PipelinePanel } from './PipelinePanel'
import { DecisionSignal } from './DecisionSignal'
import { MarketDataPanel } from '../MarketDataPanel'
import type { ScannedItem, PipelineStep } from '@/types'

interface AIScreenProps {
  currentItem?: ScannedItem
  pipeline: PipelineStep[]
  onAddToQueue: () => void
  onDeepSearch: () => void
}

export function AIScreen({ currentItem, pipeline, onAddToQueue, onDeepSearch }: AIScreenProps) {
  const [tab, setTab] = useState<'agent' | 'manual'>('agent')
  const [description, setDescription] = useState('')

  const hasDecision = pipeline.some(p => p.id === 'decision' && p.status === 'complete')
  const decision = currentItem?.decision

  return (
    <div id="scr-ai" className="flex flex-col h-full">
      <div id="ai-topbar" className="p-4 border-b border-s2 flex items-center justify-between bg-bg sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-fg text-bg rounded flex items-center justify-center">
            <Robot size={18} weight="bold" />
          </div>
          <h2 className="font-black text-sm uppercase tracking-widest">AI CENTER</h2>
        </div>
        <div className="flex bg-s2 p-1 rounded-lg">
          <button
            onClick={() => setTab('agent')}
            className={cn(
              'px-3 py-1 text-[10px] font-bold rounded-md transition-all',
              tab === 'agent' ? 'bg-bg shadow-sm text-b1' : 'text-t3'
            )}
          >
            AGENT
          </button>
          <button
            onClick={() => setTab('manual')}
            className={cn(
              'px-3 py-1 text-[10px] font-bold rounded-md transition-all',
              tab === 'manual' ? 'bg-bg shadow-sm text-b1' : 'text-t3'
            )}
          >
            MANUAL
          </button>
        </div>
      </div>

      <ScrollArea id="ai-panel" className="flex-1 overflow-y-auto p-4 pb-32">
        {tab === 'agent' ? (
          <div className="space-y-6">
            {pipeline.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                <Scan size={64} strokeWidth={1} className="mb-4" />
                <h3 className="text-lg font-bold">Ready to Scan</h3>
                <p className="text-sm">Tap the eye below to start analysis</p>
              </div>
            ) : (
              <>
                <PipelinePanel steps={pipeline} />
                
                {hasDecision && decision && (
                  <DecisionSignal decision={decision} item={currentItem} />
                )}
                
                {currentItem?.marketData && (
                  <MarketDataPanel marketData={currentItem.marketData} />
                )}
                
                {currentItem?.imageData && (
                  <div className="space-y-3 pt-2">
                    <img
                      src={currentItem.imageData}
                      alt="Scanned item"
                      className="w-full rounded-xl border border-s2"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-s4 mb-1.5">
                Product Name
              </label>
              <Input id="manual-name" placeholder="Enter product name" className="h-10" />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-s4 mb-1.5">
                Category
              </label>
              <Input id="manual-category" placeholder="e.g., Electronics, Clothing" className="h-10" />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-s4 mb-1.5">
                Purchase Price
              </label>
              <Input id="manual-price" type="number" step="0.01" placeholder="$0.00" className="h-10 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-s4 mb-1.5">
                Notes
              </label>
              <Textarea
                id="manual-notes"
                placeholder="Condition, brand, special features..."
                className="min-h-24 resize-none"
              />
            </div>
            <Button className="w-full bg-b1 hover:bg-b2 text-bg h-10 font-medium">
              Analyze Item
            </Button>
          </div>
        )}
      </ScrollArea>

      <div id="ai-input-bar" className="absolute bottom-0 left-0 right-0 p-4 bg-bg/90 backdrop-blur-md border-t border-s2 z-20">
        {tab === 'agent' && hasDecision && (
          <Button
            onClick={onAddToQueue}
            className="w-full bg-b1 hover:bg-b2 text-bg h-12 font-medium mb-3"
          >
            <Plus size={20} weight="bold" className="mr-2" />
            Add to Queue
          </Button>
        )}
        
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              id="ai-describe"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the item or ask a question..."
              className="min-h-0 h-12 resize-none pr-12"
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-s1 hover:bg-s2 flex items-center justify-center text-s4 hover:text-fg transition-colors"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <Microphone size={18} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
