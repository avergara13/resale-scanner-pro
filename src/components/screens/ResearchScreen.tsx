import { useState, useCallback, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { MagnifyingGlass, Lightbulb, ChartLine, Robot, Sparkle, TrendUp, MapPin, Globe, CaretDown, CaretUp } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ThemeToggle } from '../ThemeToggle'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types'

interface ResearchTask {
  id: string
  title: string
  type: 'market-research' | 'competitor-analysis' | 'trend-forecast' | 'price-optimization'
  status: 'pending' | 'running' | 'complete'
  timestamp: number
  result?: string
}

function CollapsibleMessage({ message, maxLines = 4 }: { message: string; maxLines?: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [needsCollapse, setNeedsCollapse] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (contentRef.current) {
      const lineHeight = parseInt(window.getComputedStyle(contentRef.current).lineHeight)
      const height = contentRef.current.scrollHeight
      const lines = Math.round(height / lineHeight)
      setNeedsCollapse(lines > maxLines)
    }
  }, [message, maxLines])

  return (
    <div>
      <div
        ref={contentRef}
        className={cn(
          "text-sm whitespace-pre-wrap overflow-hidden transition-all duration-300",
          !isExpanded && needsCollapse && "line-clamp-4"
        )}
      >
        {message}
      </div>
      {needsCollapse && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs font-semibold text-b1 hover:text-b2 flex items-center gap-1 transition-colors"
        >
          {isExpanded ? (
            <>
              <CaretUp size={14} weight="bold" />
              Show Less
            </>
          ) : (
            <>
              <CaretDown size={14} weight="bold" />
              Read More
            </>
          )}
        </button>
      )}
    </div>
  )
}

export function ResearchScreen() {
  const [chatMessages, setChatMessages] = useKV<ChatMessage[]>('research-chat', [])
  const [researchTasks, setResearchTasks] = useKV<ResearchTask[]>('research-tasks', [])
  const [input, setInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isProcessing) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    setChatMessages((prev) => [...(prev || []), userMessage])
    const messageText = input.trim()
    setInput('')
    setIsProcessing(true)

    try {
      const promptText = `You are an expert e-commerce resale advisor. The user asked: "${messageText}". Provide helpful, actionable insights for their resale business. Be concise and practical.`
      
      const response = await window.spark.llm(promptText, 'gpt-4o-mini')
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      }

      setChatMessages((prev) => [...(prev || []), assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      toast.error('Failed to get response')
    } finally {
      setIsProcessing(false)
    }
  }, [input, isProcessing, setChatMessages])

  const handleMarketResearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error('Enter a product or category to research')
      return
    }

    const task: ResearchTask = {
      id: Date.now().toString(),
      title: searchQuery.trim(),
      type: 'market-research',
      status: 'running',
      timestamp: Date.now(),
    }

    setResearchTasks((prev) => [task, ...(prev || [])])
    const query = searchQuery.trim()
    
    try {
      const promptText = `Analyze the resale market for: "${query}". Provide insights on: 1) Average resale prices, 2) Demand trends, 3) Best platforms to sell, 4) Profit potential. Be specific and data-focused.`
      
      const response = await window.spark.llm(promptText, 'gpt-4o')
      
      setResearchTasks((prev) =>
        (prev || []).map((t) =>
          t.id === task.id ? { ...t, status: 'complete', result: response } : t
        )
      )
      
      toast.success('Research complete')
    } catch (error) {
      console.error('Research error:', error)
      setResearchTasks((prev) =>
        (prev || []).map((t) =>
          t.id === task.id ? { ...t, status: 'pending' } : t
        )
      )
      toast.error('Research failed')
    }
  }, [searchQuery, setResearchTasks])

  const handleTrendAnalysis = useCallback(async () => {
    const task: ResearchTask = {
      id: Date.now().toString(),
      title: 'Current Resale Trends',
      type: 'trend-forecast',
      status: 'running',
      timestamp: Date.now(),
    }

    setResearchTasks((prev) => [task, ...(prev || [])])
    
    try {
      const promptText = `What are the top 5 trending product categories for resale in ${new Date().getFullYear()}? Include seasonality factors and profit potential for each category.`
      
      const response = await window.spark.llm(promptText, 'gpt-4o')
      
      setResearchTasks((prev) =>
        (prev || []).map((t) =>
          t.id === task.id ? { ...t, status: 'complete', result: response } : t
        )
      )
      
      toast.success('Trend analysis complete')
    } catch (error) {
      console.error('Trend analysis error:', error)
      setResearchTasks((prev) =>
        (prev || []).map((t) =>
          t.id === task.id ? { ...t, status: 'pending' } : t
        )
      )
      toast.error('Analysis failed')
    }
  }, [setResearchTasks])

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="bg-fg border-b border-s2 px-4 py-3 flex items-center justify-between gap-2 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-b1 to-b2 text-white rounded-lg flex items-center justify-center">
            <Robot size={20} weight="fill" />
          </div>
          <h1 className="text-base font-bold text-t1">AI Research Center</h1>
        </div>
        <ThemeToggle />
      </div>

      <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-3 mb-0 grid grid-cols-3 bg-s1 border border-s2">
          <TabsTrigger value="chat" className="flex items-center gap-1.5 text-xs font-semibold data-[state=active]:bg-fg data-[state=active]:text-b1">
            <Sparkle size={16} weight="fill" />
            <span>Chat</span>
          </TabsTrigger>
          <TabsTrigger value="research" className="flex items-center gap-1.5 text-xs font-semibold data-[state=active]:bg-fg data-[state=active]:text-b1">
            <MagnifyingGlass size={16} weight="bold" />
            <span>Research</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1.5 text-xs font-semibold data-[state=active]:bg-fg data-[state=active]:text-b1">
            <Lightbulb size={16} weight="fill" />
            <span>Insights</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col mt-0 min-h-0 data-[state=active]:flex">
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-3 py-4">
              {chatMessages && chatMessages.length === 0 && (
                <div className="text-center py-16 px-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-bg mb-4">
                    <Robot size={32} weight="duotone" className="text-b1" />
                  </div>
                  <h3 className="font-bold text-t1 mb-2">AI Assistant Ready</h3>
                  <p className="text-sm text-t2 max-w-xs mx-auto">Ask me anything about resale strategy, market trends, or pricing insights.</p>
                </div>
              )}
              
              {chatMessages && chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-b1 to-b2 text-white rounded-br-md'
                        : 'bg-fg text-t1 border border-s2 rounded-bl-md'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <CollapsibleMessage message={msg.content} maxLines={6} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-fg border border-s2 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-b1 rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-b1 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                      <div className="w-2 h-2 bg-b1 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex-shrink-0 p-4 bg-fg border-t border-s2 shadow-lg">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Ask AI about market trends, pricing..."
                className="flex-1 h-11 bg-bg border-s2 text-t1 placeholder:text-t3"
                disabled={isProcessing}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isProcessing}
                size="icon"
                className="h-11 w-11 bg-b1 hover:bg-b2 text-white disabled:opacity-50"
              >
                <Sparkle size={20} weight="fill" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="research" className="flex-1 mt-0 data-[state=active]:block">
          <ScrollArea className="h-full px-4 pb-20">
            <div className="py-4 space-y-4">
              <Card className="p-4 bg-fg border-s2 shadow-sm">
                <h3 className="font-bold text-t1 mb-3 flex items-center gap-2 text-sm">
                  <MagnifyingGlass size={18} weight="bold" className="text-b1" />
                  Market Research
                </h3>
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g., vintage Nike sneakers"
                    className="flex-1 bg-bg border-s2 text-t1"
                    onKeyDown={(e) => e.key === 'Enter' && handleMarketResearch()}
                  />
                  <Button onClick={handleMarketResearch} className="bg-b1 hover:bg-b2 text-white font-semibold">
                    Research
                  </Button>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleTrendAnalysis}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 bg-fg border-s2 hover:bg-blue-bg hover:border-b1 transition-all"
                >
                  <TrendUp size={28} weight="duotone" className="text-b1" />
                  <span className="text-xs font-bold text-t1">Trend Analysis</span>
                </Button>
                
                <Button
                  onClick={() => toast.info('Coming soon')}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 bg-fg border-s2 hover:bg-blue-bg hover:border-b1 transition-all"
                >
                  <ChartLine size={28} weight="duotone" className="text-b1" />
                  <span className="text-xs font-bold text-t1">Price Optimizer</span>
                </Button>

                <Button
                  onClick={() => toast.info('Coming soon')}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 bg-fg border-s2 hover:bg-blue-bg hover:border-b1 transition-all"
                >
                  <MapPin size={28} weight="duotone" className="text-b1" />
                  <span className="text-xs font-bold text-t1">Local Markets</span>
                </Button>

                <Button
                  onClick={() => toast.info('Coming soon')}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 bg-fg border-s2 hover:bg-blue-bg hover:border-b1 transition-all"
                >
                  <Globe size={28} weight="duotone" className="text-b1" />
                  <span className="text-xs font-bold text-t1">Competitor Scan</span>
                </Button>
              </div>

              {researchTasks && researchTasks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-t2">Research History</h3>
                  {researchTasks.map((task) => (
                    <Card key={task.id} className="p-4 bg-fg border-s2 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-t1 truncate">{task.title}</h4>
                          <p className="text-xs text-t3 mt-1">
                            {new Date(task.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide flex-shrink-0",
                            task.status === 'complete' && 'bg-green-bg text-green border border-green/30',
                            task.status === 'running' && 'bg-amber/20 text-amber border border-amber/30',
                            task.status === 'pending' && 'bg-s1 text-t3 border border-s2'
                          )}
                        >
                          {task.status}
                        </div>
                      </div>
                      {task.result && (
                        <div className="mt-3 p-3 bg-bg rounded-lg border border-s2">
                          <CollapsibleMessage message={task.result} maxLines={5} />
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="insights" className="flex-1 mt-0 data-[state=active]:block">
          <ScrollArea className="h-full px-4 pb-20">
            <div className="py-4 space-y-4">
              <Card className="p-4 bg-gradient-to-br from-blue-bg to-transparent border-b1/30 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-b1 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <Lightbulb size={22} weight="fill" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-t1 mb-2 text-sm">Quick Tips</h3>
                    <ul className="text-sm text-t1 space-y-2 list-disc list-inside">
                      <li>Best resale ROI: Electronics, designer brands, collectibles</li>
                      <li>Peak selling seasons: Q4 holidays, back-to-school</li>
                      <li>Price 20-30% below retail for quick turnover</li>
                      <li>Bundle slow-moving items to increase margins</li>
                    </ul>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-fg border-s2 shadow-sm">
                <h3 className="font-bold text-t1 mb-3 text-sm">Market Intelligence</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-bg rounded-lg border border-s2">
                    <span className="text-sm font-medium text-t1">Today's Hot Categories</span>
                    <span className="text-xs font-mono font-bold text-b1 bg-blue-bg px-2 py-1 rounded">Sneakers, Vintage</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-bg rounded-lg border border-s2">
                    <span className="text-sm font-medium text-t1">Avg. Sell-Through Rate</span>
                    <span className="text-xs font-mono font-bold text-green bg-green-bg px-2 py-1 rounded">67%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-bg rounded-lg border border-s2">
                    <span className="text-sm font-medium text-t1">Competitive Listings</span>
                    <span className="text-xs font-mono font-bold text-amber bg-amber/20 px-2 py-1 rounded">High</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-fg border-s2 shadow-sm">
                <h3 className="font-bold text-t1 mb-2 text-sm">AI Recommendations</h3>
                <p className="text-xs text-t2 mb-3">
                  Based on your recent scans and market trends
                </p>
                <div className="space-y-2">
                  <div className="p-3 bg-bg rounded-lg border border-s2">
                    <p className="text-sm text-t1 leading-relaxed">Focus on electronics this week - demand is up 23%</p>
                  </div>
                  <div className="p-3 bg-bg rounded-lg border border-s2">
                    <p className="text-sm text-t1 leading-relaxed">Consider bundling smaller items to improve margins</p>
                  </div>
                  <div className="p-3 bg-bg rounded-lg border border-s2">
                    <p className="text-sm text-t1 leading-relaxed">Price vintage clothing 15% higher - market is strong</p>
                  </div>
                </div>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
