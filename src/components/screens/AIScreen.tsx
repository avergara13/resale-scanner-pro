import { useState } from 'react'
import { Robot, PencilSimple, Plus, Microphone, MagnifyingGlass } from '@phosphor-icons/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
      <div id="ai-topbar" className="h-14 border-b border-s2 bg-bg flex items-center justify-between px-4">
        <h1 className="text-lg font-semibold text-fg">Resale Scanner</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeepSearch}
          className="text-s4 hover:text-fg"
        >
          <MagnifyingGlass size={18} weight="bold" />
          <span className="ml-1.5 text-xs font-medium uppercase tracking-wide">Deep Search</span>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'agent' | 'manual')} className="flex-1 flex flex-col">
        <TabsList className="bg-s1 border-b border-s2 rounded-none w-full justify-start px-4 h-auto py-2">
          <TabsTrigger
            value="agent"
            className="data-[state=active]:bg-t2 data-[state=active]:text-fg text-s3 px-4 py-2 rounded-md"
          >
            <Robot size={16} weight="bold" className="mr-1.5" />
            Agent
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="data-[state=active]:bg-t2 data-[state=active]:text-fg text-s3 px-4 py-2 rounded-md"
          >
            <PencilSimple size={16} weight="bold" className="mr-1.5" />
            Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="flex-1 flex flex-col m-0">
          <ScrollArea id="ai-panel" className="flex-1 px-4 py-4">
            <div className="space-y-4">
              {hasDecision && decision && (
                <DecisionSignal decision={decision} item={currentItem} />
              )}
              
              <PipelinePanel steps={pipeline} />
              
              {currentItem?.marketData && (
                <MarketDataPanel marketData={currentItem.marketData} />
              )}
              
              {currentItem && (
                <div className="space-y-3 pt-2">
                  {currentItem.imageUrl && (
                    <img
                      src={currentItem.imageUrl}
                      alt="Scanned item"
                      className="w-full rounded-md border border-s2"
                    />
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="manual" className="flex-1 m-0">
          <ScrollArea className="h-full px-4 py-4">
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
          </ScrollArea>
        </TabsContent>

        <div id="ai-input-bar" className="border-t border-s2 bg-bg p-4 space-y-3">
          {tab === 'agent' && hasDecision && (
            <Button
              onClick={onAddToQueue}
              className="w-full bg-b1 hover:bg-b2 text-bg h-12 font-medium"
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
      </Tabs>
    </div>
  )
}
