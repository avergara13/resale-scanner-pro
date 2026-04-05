import { useState, useCallback, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { 
  MagnifyingGlass, 
  Lightbulb, 
  ChartLine, 
  Robot, 
  Sparkle, 
  TrendUp, 
  MapPin, 
  Globe, 
  CaretDown, 
  CaretUp,
  Plus,
  Trash,
  ChatsCircle,
  DotsThreeVertical,
  PencilSimple
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ThemeToggle } from '../ThemeToggle'
import { ChatSearchDialog } from '../ChatSearchDialog'
import { useTabPreference } from '@/hooks/use-tab-preference'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { callLLM } from '@/lib/llm-service'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { ChatSession, ChatMessage } from '@/types'

interface ResearchTask {
  id: string
  title: string
  type: 'market-research' | 'competitor-analysis' | 'trend-forecast' | 'price-optimization'
  status: 'pending' | 'running' | 'complete'
  timestamp: number
  result?: string
}

interface QuickExample {
  emoji: string
  label: string
  question: string
}

const QUICK_EXAMPLES: QuickExample[] = [
  {
    emoji: '👟',
    label: 'Sneaker Trends',
    question: 'What are the most profitable sneaker brands and styles to resell right now?'
  },
  {
    emoji: '📱',
    label: 'Electronics Guide',
    question: 'What electronics have the best resale value and fastest turnover?'
  },
  {
    emoji: '👕',
    label: 'Vintage Clothing',
    question: 'How do I identify valuable vintage clothing and price it correctly?'
  },
  {
    emoji: '🎮',
    label: 'Gaming Market',
    question: 'Which retro games and consoles have the highest profit margins?'
  },
  {
    emoji: '📚',
    label: 'Book Resale',
    question: 'What types of books are worth buying for resale and where to sell them?'
  },
  {
    emoji: '💎',
    label: 'Luxury Items',
    question: 'How can I authenticate and price luxury handbags and accessories?'
  },
  {
    emoji: '🏠',
    label: 'Home Decor',
    question: 'What home decor items have strong resale demand and good margins?'
  },
  {
    emoji: '⚡',
    label: 'Quick Flips',
    question: 'What items can I flip quickly for profit within 1-3 days?'
  },
]

function formatMessage(text: string): string {
  let formatted = text

  formatted = formatted.replace(/^#{1,3}\s+(.+)$/gm, '<h3 class="font-bold text-t1 mt-4 mb-2 first:mt-0">$1</h3>')
  
  formatted = formatted.replace(/^\*\*(.+?)\*\*:?\s*(.*)$/gm, '<div class="mb-2"><span class="font-bold text-t1">$1:</span> <span class="text-t2">$2</span></div>')
  
  formatted = formatted.replace(/^[-•]\s+(.+)$/gm, '<li class="ml-4 mb-1.5 text-t1 leading-relaxed">$1</li>')
  
  formatted = formatted.replace(/(<li.*<\/li>\s*)+/g, (match) => `<ul class="space-y-1 my-3">${match}</ul>`)
  
  formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 mb-1.5 text-t1 leading-relaxed">$1</li>')
  
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-s1 text-t1 rounded text-xs font-mono">$1</code>')
  
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-t1">$1</strong>')
  
  formatted = formatted.replace(/\$(\d+(?:\.\d{2})?)/g, '<span class="font-bold text-green">$$$1</span>')
  
  formatted = formatted.replace(/(\d+)%/g, '<span class="font-semibold text-b1">$1%</span>')

  return formatted
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

  const formattedHTML = formatMessage(message)

  return (
    <div>
      <div
        ref={contentRef}
        className={cn(
          "text-sm overflow-hidden transition-all duration-300 prose prose-sm max-w-none",
          !isExpanded && needsCollapse && "line-clamp-6"
        )}
        dangerouslySetInnerHTML={{ __html: formattedHTML }}
      />
      {needsCollapse && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 text-xs font-bold text-b1 hover:text-b2 flex items-center gap-1 transition-colors px-2 py-1.5 bg-blue-bg rounded-lg"
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
  const [activeTab, setActiveTab] = useTabPreference<'chat' | 'research' | 'insights'>('research-screen', 'chat')
  const [chatSessions, setChatSessions] = useKV<ChatSession[]>('chat-sessions', [])
  const [activeSessionId, setActiveSessionId] = useKV<string | null>('active-chat-session', null)
  const [researchTasks, setResearchTasks] = useKV<ResearchTask[]>('research-tasks', [])
  const [input, setInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeSession = chatSessions?.find(s => s.id === activeSessionId)
  const chatMessages = activeSession?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleCreateSession = useCallback(() => {
    const name = newSessionName.trim() || `Chat ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name,
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      messages: [],
      isActive: true,
    }

    setChatSessions((prev) => {
      const updated = (prev || []).map(s => ({ ...s, isActive: false }))
      return [newSession, ...updated]
    })
    
    setActiveSessionId(newSession.id)
    setNewSessionName('')
    setShowNewSessionDialog(false)
    toast.success('New chat session created')
  }, [newSessionName, setChatSessions, setActiveSessionId])

  const handleDeleteSession = useCallback((sessionId: string) => {
    setChatSessions((prev) => {
      const filtered = (prev || []).filter(s => s.id !== sessionId)
      return filtered
    })
    
    if (activeSessionId === sessionId) {
      const remaining = (chatSessions || []).filter(s => s.id !== sessionId)
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id)
      } else {
        setActiveSessionId(null)
      }
    }
    
    toast.success('Chat session deleted')
  }, [chatSessions, activeSessionId, setChatSessions, setActiveSessionId])

  const handleRenameSession = useCallback(() => {
    if (!renameSessionId || !renameValue.trim()) {
      toast.error('Session name cannot be empty')
      return
    }

    setChatSessions((prev) =>
      (prev || []).map((s) =>
        s.id === renameSessionId ? { ...s, name: renameValue.trim() } : s
      )
    )

    setShowRenameDialog(false)
    setRenameSessionId(null)
    setRenameValue('')
    toast.success('Session renamed')
  }, [renameSessionId, renameValue, setChatSessions])

  const handleOpenRenameDialog = useCallback((sessionId: string) => {
    const session = chatSessions?.find(s => s.id === sessionId)
    if (session) {
      setRenameSessionId(sessionId)
      setRenameValue(session.name)
      setShowRenameDialog(true)
    }
  }, [chatSessions])

  const handleSwitchSession = useCallback((sessionId: string) => {
    setChatSessions((prev) => 
      (prev || []).map(s => ({ ...s, isActive: s.id === sessionId }))
    )
    setActiveSessionId(sessionId)
  }, [setChatSessions, setActiveSessionId])

  const handleSendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim()
    if (!text || isProcessing) return

    if (!activeSessionId) {
      handleCreateSession()
      setTimeout(() => {
        setInput(text)
      }, 100)
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    setChatSessions((prev) => 
      (prev || []).map(s => 
        s.id === activeSessionId 
          ? { ...s, messages: [...s.messages, userMessage], lastMessageAt: Date.now() }
          : s
      )
    )
    
    if (!messageText) {
      setInput('')
    }
    setIsProcessing(true)

    try {
      const prompt = `You are an expert e-commerce resale advisor helping users maximize their resale profits.

User Question: ${text}

Please provide a clear, well-formatted response following these guidelines:
- Use bullet points for lists (use - or • symbols)
- Bold key terms using **bold text**
- Include specific numbers, percentages, and dollar amounts when relevant
- Break information into short, scannable sections
- Use headings with ### for major sections
- Keep explanations concise and actionable
- Prioritize the most important information first

Format your response to be easy to read and visually scannable.`
      
      const response = await callLLM(prompt, { task: 'research', geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY })
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      }

      setChatSessions((prev) => 
        (prev || []).map(s => 
          s.id === activeSessionId 
            ? { ...s, messages: [...s.messages, assistantMessage], lastMessageAt: Date.now() }
            : s
        )
      )
    } catch (error) {
      console.error('Chat error:', error)
      toast.error('Failed to get response')
    } finally {
      setIsProcessing(false)
    }
  }, [input, isProcessing, activeSessionId, setChatSessions, handleCreateSession])

  const handleExampleClick = useCallback((question: string) => {
    if (!activeSessionId) {
      handleCreateSession()
      setTimeout(() => {
        handleSendMessage(question)
      }, 100)
    } else {
      handleSendMessage(question)
    }
  }, [activeSessionId, handleCreateSession, handleSendMessage])

  const handleSelectSearchResult = useCallback((sessionId: string, messageId: string) => {
    setChatSessions((prev) => 
      (prev || []).map(s => ({ ...s, isActive: s.id === sessionId }))
    )
    setActiveSessionId(sessionId)
    setActiveTab('chat')
    
    setTimeout(() => {
      const messageElement = document.getElementById(`message-${messageId}`)
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        messageElement.classList.add('ring-2', 'ring-amber', 'rounded-2xl')
        setTimeout(() => {
          messageElement.classList.remove('ring-2', 'ring-amber', 'rounded-2xl')
        }, 2000)
      }
    }, 300)
    
    toast.success('Jumped to message')
  }, [setChatSessions, setActiveSessionId, setActiveTab])

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
      const prompt = `Analyze the resale market for: "${query}". 

Provide a comprehensive but concise market analysis with the following structure:

### Market Overview
Brief summary of market conditions

### Pricing Analysis
- **Average resale price range**: $X-$Y
- **Sweet spot pricing**: Recommended listing price
- **Price trends**: Rising, stable, or declining

### Demand & Competition
- **Current demand**: High/Medium/Low with explanation
- **Competition level**: How saturated is this market
- **Sell-through rate**: Estimated percentage

### Best Selling Platforms
- Platform recommendations with reasoning
- Fee considerations

### Profit Potential
- Expected profit margin percentage
- **Final Verdict**: GO or PASS with brief justification

Use bullet points, bold key terms, and include specific numbers when possible.`
      
      const response = await callLLM(prompt, { task: 'research', geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY })
      
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
      const prompt = `Identify the top 5 trending product categories for resale in ${new Date().getFullYear()}.

For each category, provide:

**Category Name**
- **Current Demand**: High/Medium/Low with brief explanation
- **Seasonality**: Best months to sell
- **Average Profit Margin**: Estimated percentage
- **Key Considerations**: 1-2 important tips for this category

End with:
### Quick Action Items
- Top 2 categories to focus on now
- 1 category to avoid this month

Use bullet points, bold headings, and specific percentages where possible.`
      
      const response = await callLLM(prompt, { task: 'research', geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY })
      
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
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowSearchDialog(true)}
            className="h-9 w-9 text-t2 hover:text-b1 hover:bg-blue-bg"
            title="Search messages"
          >
            <MagnifyingGlass size={20} weight="bold" />
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col min-h-0">
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
          {chatSessions && chatSessions.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-fg border-b border-s2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 justify-between bg-bg border-s2 text-t1 hover:bg-s1">
                    <span className="flex items-center gap-2 truncate">
                      <ChatsCircle size={16} weight="fill" className="text-b1 flex-shrink-0" />
                      <span className="truncate">{activeSession?.name || 'Select Session'}</span>
                    </span>
                    <CaretDown size={14} weight="bold" className="ml-2 flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[calc(100vw-2rem)] max-w-[420px]">
                  {chatSessions.map((session) => (
                    <DropdownMenuItem
                      key={session.id}
                      onClick={() => handleSwitchSession(session.id)}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{session.name}</div>
                        <div className="text-xs text-t3">
                          {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}
                          {' • '}
                          {new Date(session.lastMessageAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-b1 hover:text-b2 hover:bg-blue-bg"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenRenameDialog(session.id)
                          }}
                        >
                          <PencilSimple size={14} weight="bold" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red hover:text-red hover:bg-red-bg"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSession(session.id)
                          }}
                        >
                          <Trash size={14} weight="bold" />
                        </Button>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                size="icon"
                onClick={() => setShowNewSessionDialog(true)}
                className="h-9 w-9 bg-b1 hover:bg-b2 text-white flex-shrink-0"
              >
                <Plus size={18} weight="bold" />
              </Button>
            </div>
          )}

          <ScrollArea className="flex-1 px-4">
            <div className="space-y-3 py-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8 px-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-bg mb-4">
                    <Robot size={32} weight="duotone" className="text-b1" />
                  </div>
                  <h3 className="font-bold text-t1 mb-2 text-lg">AI Assistant Ready</h3>
                  <p className="text-sm text-t2 max-w-xs mx-auto mb-6">Ask me anything about resale strategy, market trends, or pricing insights.</p>
                  
                  <div className="space-y-2 max-w-md mx-auto">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-t3 mb-3">Quick Examples</h4>
                    {QUICK_EXAMPLES.map((example) => (
                      <button
                        key={example.question}
                        onClick={() => handleExampleClick(example.question)}
                        className="w-full text-left p-3 bg-fg border border-s2 rounded-xl hover:border-b1 hover:bg-blue-bg transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl flex-shrink-0">{example.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-t1 mb-0.5">{example.label}</div>
                            <div className="text-xs text-t3 line-clamp-1">{example.question}</div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Sparkle size={16} weight="fill" className="text-b1" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  id={`message-${msg.id}`}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} transition-all`}
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
              
              <div ref={messagesEndRef} />
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
                onClick={() => handleSendMessage()}
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
                    <span className="text-xs font-mono font-bold text-b1 bg-blue-bg px-2 py-1 rounded">Clothing</span>
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

      <Dialog open={showNewSessionDialog} onOpenChange={setShowNewSessionDialog}>
        <DialogContent className="bg-fg border-s2">
          <DialogHeader>
            <DialogTitle className="text-t1">New Chat Session</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              placeholder="Session name (optional)"
              className="bg-bg border-s2 text-t1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSessionDialog(false)} className="border-s2 text-t2">
              Cancel
            </Button>
            <Button onClick={handleCreateSession} className="bg-b1 hover:bg-b2 text-white">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="bg-fg border-s2">
          <DialogHeader>
            <DialogTitle className="text-t1 flex items-center gap-2">
              <PencilSimple size={20} weight="bold" className="text-b1" />
              Rename Chat Session
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSession()}
              placeholder="Enter new session name"
              className="bg-bg border-s2 text-t1"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRenameDialog(false)
                setRenameSessionId(null)
                setRenameValue('')
              }} 
              className="border-s2 text-t2"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRenameSession} 
              className="bg-b1 hover:bg-b2 text-white"
              disabled={!renameValue.trim()}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChatSearchDialog
        isOpen={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
        chatSessions={chatSessions || []}
        onSelectMessage={handleSelectSearchResult}
      />
    </div>
  )
}
