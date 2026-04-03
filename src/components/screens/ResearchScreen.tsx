import { useState, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { MagnifyingGlass, Lightbulb, ChartLine, Robot, Sparkle, TrendUp, MapPin, Globe } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import type { ChatMessage } from '@/types'

interface ResearchTask {
  id: string
  title: string
  type: 'market-research' | 'competitor-analysis' | 'trend-forecast' | 'price-optimization'
  status: 'pending' | 'running' | 'complete'
  timestamp: number
  result?: string
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
      <div className="bg-t4 border-b border-s2 px-4 py-3 flex items-center gap-2">
        <Robot size={24} weight="duotone" className="text-b1" />
        <h1 className="text-lg font-semibold text-fg">AI Research Center</h1>
      </div>

      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 grid grid-cols-3 bg-s1">
          <TabsTrigger value="chat" className="flex items-center gap-1.5">
            <Sparkle size={16} />
            <span>Chat</span>
          </TabsTrigger>
          <TabsTrigger value="research" className="flex items-center gap-1.5">
            <MagnifyingGlass size={16} />
            <span>Research</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1.5">
            <Lightbulb size={16} />
            <span>Insights</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col mt-0 px-4 pb-4">
          <div className="flex-1 overflow-y-auto space-y-3 py-4 min-h-0">
            {chatMessages && chatMessages.length === 0 && (
              <div className="text-center py-12 text-s3">
                <Robot size={48} weight="duotone" className="mx-auto mb-3 text-b1" />
                <p className="text-sm">Ask me anything about resale strategy,</p>
                <p className="text-sm">market trends, or pricing insights.</p>
              </div>
            )}
            
            {chatMessages && chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-b1 text-bg'
                      : 'bg-s1 text-fg border border-s2'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-s1 border border-s2 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2 text-s3">
                    <div className="w-2 h-2 bg-b1 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-b1 rounded-full animate-pulse delay-150" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-b1 rounded-full animate-pulse delay-300" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-3 border-t border-s2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask AI about market trends, pricing..."
              className="flex-1"
              disabled={isProcessing}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isProcessing}
              size="icon"
              className="bg-b1 hover:bg-b2"
            >
              <Sparkle size={18} weight="fill" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="research" className="flex-1 flex flex-col mt-0 px-4 pb-4 overflow-y-auto">
          <div className="py-4 space-y-4">
            <Card className="p-4 bg-s1 border-s2">
              <h3 className="font-semibold text-fg mb-3 flex items-center gap-2">
                <MagnifyingGlass size={18} weight="bold" />
                Market Research
              </h3>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., vintage Nike sneakers"
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleMarketResearch()}
                />
                <Button onClick={handleMarketResearch} className="bg-b1 hover:bg-b2">
                  Research
                </Button>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleTrendAnalysis}
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 bg-s1 border-s2 hover:bg-t4"
              >
                <TrendUp size={24} className="text-b1" />
                <span className="text-xs font-medium">Trend Analysis</span>
              </Button>
              
              <Button
                onClick={() => toast.info('Coming soon')}
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 bg-s1 border-s2 hover:bg-t4"
              >
                <ChartLine size={24} className="text-b1" />
                <span className="text-xs font-medium">Price Optimizer</span>
              </Button>

              <Button
                onClick={() => toast.info('Coming soon')}
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 bg-s1 border-s2 hover:bg-t4"
              >
                <MapPin size={24} className="text-b1" />
                <span className="text-xs font-medium">Local Markets</span>
              </Button>

              <Button
                onClick={() => toast.info('Coming soon')}
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 bg-s1 border-s2 hover:bg-t4"
              >
                <Globe size={24} className="text-b1" />
                <span className="text-xs font-medium">Competitor Scan</span>
              </Button>
            </div>

            {researchTasks && researchTasks.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-sm font-semibold text-fg">Research History</h3>
                {researchTasks.map((task) => (
                  <Card key={task.id} className="p-4 bg-bg border-s2">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-fg">{task.title}</h4>
                        <p className="text-xs text-s3 mt-0.5">
                          {new Date(task.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          task.status === 'complete'
                            ? 'bg-green/20 text-green'
                            : task.status === 'running'
                            ? 'bg-amber/20 text-amber'
                            : 'bg-s2 text-s3'
                        }`}
                      >
                        {task.status}
                      </div>
                    </div>
                    {task.result && (
                      <div className="mt-3 p-3 bg-s1 rounded-lg border border-s2">
                        <p className="text-xs text-fg whitespace-pre-wrap">{task.result}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="flex-1 mt-0 px-4 pb-4 overflow-y-auto">
          <div className="py-4 space-y-4">
            <Card className="p-4 bg-gradient-to-br from-b1/10 to-t4 border-b1/20">
              <div className="flex items-start gap-3">
                <Lightbulb size={24} weight="fill" className="text-b1 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-fg mb-1">Quick Tips</h3>
                  <ul className="text-sm text-fg space-y-1.5 list-disc list-inside">
                    <li>Best resale ROI: Electronics, designer brands, collectibles</li>
                    <li>Peak selling seasons: Q4 holidays, back-to-school</li>
                    <li>Price 20-30% below retail for quick turnover</li>
                    <li>Bundle slow-moving items to increase margins</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-s1 border-s2">
              <h3 className="font-semibold text-fg mb-3">Market Intelligence</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-bg rounded border border-s2">
                  <span className="text-sm text-fg">Today's Hot Categories</span>
                  <span className="text-xs font-mono text-b1">Sneakers, Vintage</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-bg rounded border border-s2">
                  <span className="text-sm text-fg">Avg. Sell-Through Rate</span>
                  <span className="text-xs font-mono text-green">67%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-bg rounded border border-s2">
                  <span className="text-sm text-fg">Competitive Listings</span>
                  <span className="text-xs font-mono text-amber">High</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-s1 border-s2">
              <h3 className="font-semibold text-fg mb-2">AI Recommendations</h3>
              <p className="text-sm text-s4 mb-3">
                Based on your recent scans and market trends
              </p>
              <div className="space-y-2">
                <div className="p-3 bg-bg rounded border border-s2">
                  <p className="text-sm text-fg">Focus on electronics this week - demand is up 23%</p>
                </div>
                <div className="p-3 bg-bg rounded border border-s2">
                  <p className="text-sm text-fg">Consider bundling smaller items to improve margins</p>
                </div>
                <div className="p-3 bg-bg rounded border border-s2">
                  <p className="text-sm text-fg">Price vintage clothing 15% higher - market is strong</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
