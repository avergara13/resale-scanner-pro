import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { 
  Robot, 
  Sparkle, 
  Plus,
  Trash,
  DotsThreeVertical,
  PencilSimple,
  PaperPlaneRight,
  CaretDown,
  CaretUp,
  Package,
  TrendUp,
  ChartLine,
  Lightbulb,
  MagnifyingGlass,
  Globe,
  Stack,
  CheckCircle,
  Warning
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { callLLM, researchProduct } from '@/lib/llm-service'
import { motion, AnimatePresence } from 'framer-motion'
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
import type { ChatSession, ChatMessage, ScannedItem, AppSettings, Session, ProfitGoal } from '@/types'

interface QuickAction {
  emoji: string
  label: string
  prompt: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    emoji: '🔍',
    label: 'Market Research',
    prompt: 'What are the most profitable items to resell right now?'
  },
  {
    emoji: '💰',
    label: 'Pricing Strategy',
    prompt: 'How should I price items for maximum profit?'
  },
  {
    emoji: '📦',
    label: 'Create Listings',
    prompt: 'Create optimized eBay listings for all BUY items in my queue'
  },
  {
    emoji: '📤',
    label: 'Push to Notion',
    prompt: 'Push all ready listings to Notion'
  },
  {
    emoji: '🔎',
    label: 'Research Item',
    prompt: 'Research the market value of my most recent item'
  },
  {
    emoji: '✨',
    label: 'Optimize Queue',
    prompt: 'Review my queue and suggest which items to prioritize'
  },
  {
    emoji: '🚀',
    label: 'Full Pipeline',
    prompt: 'Run full pipeline: analyze all drafts, optimize BUY listings, and push to Notion'
  },
  {
    emoji: '📊',
    label: 'Session Status',
    prompt: 'What\'s my current session status? Show me all stats, goals, and recent items.'
  },
  {
    emoji: '🏪',
    label: 'Start Session',
    prompt: 'Start a new scanning session'
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
          "text-sm overflow-hidden transition-all duration-300 max-w-none",
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

interface AgentScreenProps {
  queueItems?: ScannedItem[]
  soldItems?: ScannedItem[]
  settings?: AppSettings
  onCreateListing?: (itemId: string) => Promise<void>
  onOptimizeItem?: (itemId: string) => Promise<void>
  onPushToNotion?: (itemId: string) => Promise<void>
  onBatchAnalyze?: () => Promise<void>
  onEditItem?: (itemId: string, updates: Partial<ScannedItem>) => void
  onMarkAsSold?: (itemId: string, soldPrice: number, soldOn: 'ebay' | 'mercari' | 'poshmark' | 'facebook' | 'whatnot' | 'other') => void
  onMarkShipped?: (itemId: string, trackingNumber: string, shippingCarrier: string) => void
  onNavigateToQueue?: () => void
  onOpenCamera?: () => void
  onStartSession?: () => void
  onEndSession?: () => void
  onEditSession?: (sessionId: string, updates: Partial<Session>) => void
  allSessions?: Session[]
  scanHistory?: ScannedItem[]
  profitGoals?: ProfitGoal[]
}

export function AgentScreen({ queueItems = [], soldItems = [], settings, onCreateListing, onOptimizeItem, onPushToNotion, onBatchAnalyze, onEditItem, onMarkAsSold, onMarkShipped, onNavigateToQueue, onOpenCamera, onStartSession, onEndSession, onEditSession, allSessions = [], scanHistory = [], profitGoals = [] }: AgentScreenProps) {
  const [chatSessions, setChatSessions] = useKV<ChatSession[]>('chat-sessions', [])
  const [activeSessionId, setActiveSessionId] = useKV<string | null>('active-chat-session', null)
  const [currentSession] = useKV<Session | undefined>('currentSession', undefined)
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeSession = chatSessions?.find(s => s.id === activeSessionId)
  const chatMessages = activeSession?.messages || []

  const handleRefresh = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 600))
  }, [])

  const pullToRefresh = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: true,
  })

  const queueStats = useMemo(() => {
    const total = queueItems.length
    const buy = queueItems.filter(item => item.decision === 'BUY').length
    const pass = queueItems.filter(item => item.decision === 'PASS').length
    const pending = queueItems.filter(item => item.decision === 'PENDING').length
    const totalProfit = queueItems
      .filter(item => item.decision === 'BUY' && item.profitMargin)
      .reduce((sum, item) => {
        const profit = (item.estimatedSellPrice || 0) - item.purchasePrice
        return sum + profit
      }, 0)
    
    return { total, buy, pass, pending, totalProfit }
  }, [queueItems])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (!activeSessionId && chatSessions && chatSessions.length > 0) {
      setActiveSessionId(chatSessions[0].id)
    }
  }, [activeSessionId, chatSessions, setActiveSessionId])

  const handleCreateSession = useCallback(() => {
    const name = newSessionName.trim() || `Session ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    
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
    // silent
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
    
    // silent
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
    // silent
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

  const buildContext = useCallback(() => {
    const queueSummary = queueItems.slice(0, 10).map(item => ({
      id: item.id,
      name: item.productName || 'Unknown',
      price: item.purchasePrice,
      estimatedSell: item.estimatedSellPrice,
      decision: item.decision,
      profitMargin: item.profitMargin,
      category: item.category,
      tags: item.tags,
      listingStatus: item.listingStatus,
      inQueue: item.inQueue,
    }))

    const sessionsSummary = allSessions.slice(-5).map(s => ({
      id: s.id,
      name: s.name || new Date(s.startTime).toLocaleDateString(),
      active: s.active,
      itemsScanned: s.itemsScanned,
      buyCount: s.buyCount,
      passCount: s.passCount,
      totalProfit: s.totalPotentialProfit,
      profitGoal: s.profitGoal,
      location: s.location?.name,
    }))

    const goalsSummary = profitGoals.filter(g => g.active).map(g => ({
      id: g.id,
      type: g.type,
      target: g.targetAmount,
      startDate: new Date(g.startDate).toLocaleDateString(),
      endDate: new Date(g.endDate).toLocaleDateString(),
    }))

    const recentScans = scanHistory.slice(0, 5).map(i => ({
      name: i.productName || 'Unknown',
      decision: i.decision,
      price: i.purchasePrice,
      sellPrice: i.estimatedSellPrice,
      sessionId: i.sessionId,
    }))

    const soldSummary = soldItems.slice(0, 10).map(item => ({
      id: item.id,
      name: item.productName || 'Unknown',
      soldPrice: item.soldPrice,
      soldOn: item.soldOn,
      soldDate: item.soldDate,
      profit: (item.soldPrice || 0) - item.purchasePrice,
      status: item.listingStatus,
      trackingNumber: item.trackingNumber,
    }))

    return {
      queueStats,
      recentItems: queueSummary,
      soldItems: soldSummary,
      sessions: sessionsSummary,
      goals: goalsSummary,
      recentScans,
      settings: {
        minProfitMargin: settings?.minProfitMargin,
        defaultShipping: settings?.defaultShippingCost,
        ebayFeePercent: settings?.ebayFeePercent
      }
    }
  }, [queueItems, soldItems, queueStats, settings, allSessions, profitGoals, scanHistory])

  const handleSendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim()
    if (!text || isProcessing) return

    // Auto-create session if none exists, then continue sending in one tap
    let sessionId = activeSessionId
    if (!sessionId) {
      const name = `Session ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
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
      sessionId = newSession.id
    }

    const lowerText = text.toLowerCase()
    
    if ((lowerText.includes('scan') || lowerText.includes('capture') || lowerText.includes('camera') || lowerText.includes('photo')) && onOpenCamera) {
      const quickResponse: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '📸 Opening the AI Camera for you now! Point it at an item and I\'ll analyze it for you.',
        timestamp: Date.now(),
      }
      
      setChatSessions((prev) => 
        (prev || []).map(s => 
          s.id === sessionId
            ? { ...s, messages: [...s.messages, quickResponse], lastMessageAt: Date.now() }
            : s
        )
      )
      
      setTimeout(() => {
        onOpenCamera()
      }, 500)
      
      setInput('')
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
        s.id === sessionId 
          ? { ...s, messages: [...s.messages, userMessage], lastMessageAt: Date.now() }
          : s
      )
    )

    setInput('')
    setIsProcessing(true)

    try {
      const lowerText = text.toLowerCase()

      // Shared helper to add agent messages
      const addMsg = (content: string) => {
        const msg: ChatMessage = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          role: 'assistant',
          content,
          timestamp: Date.now(),
        }
        setChatSessions((prev) =>
          (prev || []).map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, msg], lastMessageAt: Date.now() }
              : s
          )
        )
      }

      // Full agentic pipeline: analyze → optimize → push
      if (lowerText.includes('full pipeline') || lowerText.includes('auto-list') || lowerText.includes('process queue') || lowerText.includes('run pipeline')) {
        // Step 1: Batch analyze unanalyzed items
        const drafts = queueItems.filter(i => !i.productName || i.productName === 'Quick Draft')
        if (drafts.length > 0 && onBatchAnalyze) {
          addMsg(`**Step 1/3 — Analyzing ${drafts.length} draft(s)**\nRunning AI vision, market research, and profit analysis...`)
          try {
            await onBatchAnalyze()
            addMsg(`✅ Batch analysis complete.`)
          } catch (error) {
            addMsg(`⚠️ Batch analysis encountered errors — continuing with available data.`)
          }
        } else if (drafts.length === 0) {
          addMsg(`**Step 1/3 — Analyze:** No drafts to analyze — all items already processed.`)
        }

        // Step 2: Optimize BUY items that don't have listings yet
        // Note: After batch analysis, queueItems from props may be stale.
        // onOptimizeItem reads fresh queue state from App.tsx internally,
        // so we collect candidate IDs from current props but the actual
        // optimization operates on up-to-date data in the parent.
        const goItemIds = queueItems
          .filter(i => i.decision === 'BUY' && !i.optimizedListing)
          .map(i => i.id)
        // Also include items that were drafts (just analyzed in step 1) —
        // they may now be BUY but our stale queueItems still shows them as PENDING.
        const draftIds = drafts.map(i => i.id)
        const allCandidateIds = [...new Set([...goItemIds, ...draftIds])]

        if (allCandidateIds.length > 0 && onOptimizeItem) {
          addMsg(`**Step 2/3 — Optimizing up to ${allCandidateIds.length} listing(s)**\nGenerating SEO titles, descriptions, and pricing...`)
          let optimized = 0
          for (const itemId of allCandidateIds) {
            try {
              await onOptimizeItem(itemId)
              optimized++
            } catch (error) {
              // onOptimizeItem returns early for non-BUY or already-optimized items
              console.error('Optimize skipped or failed for:', itemId, error)
            }
          }
          addMsg(`✅ Optimized ${optimized} listing(s).`)
        } else {
          addMsg(`**Step 2/3 — Optimize:** No items to optimize.`)
        }

        // Step 3: Push to Notion — include both freshly processed items
        // AND any pre-existing optimized-but-unpushed items.
        // onPushToNotion guards: skips items without optimizedListing or
        // already-pushed (notionPageId). Safe to over-include IDs.
        const preExistingReadyIds = queueItems
          .filter(i => i.optimizedListing && !i.notionPageId)
          .map(i => i.id)
        const pushCandidateIds = [...new Set([...allCandidateIds, ...preExistingReadyIds])]

        if (pushCandidateIds.length > 0 && onPushToNotion) {
          addMsg(`**Step 3/3 — Publishing listing(s) to Notion**`)
          let pushed = 0
          for (const itemId of pushCandidateIds) {
            try {
              await onPushToNotion(itemId)
              pushed++
            } catch (error) {
              // onPushToNotion returns early for items without optimizedListing
              // or already pushed — not a real failure
            }
          }
          addMsg(`✅ Published ${pushed} listing(s) to Notion.`)
        } else {
          addMsg(`**Step 3/3 — Publish:** No listings to push.`)
        }

        addMsg(`🏁 **Pipeline complete!** Check your Queue to review results. You can manually edit any listing before final publishing.`)
        toast.success('Full pipeline complete')
        setIsProcessing(false)
        return
      }

      if (lowerText.includes('create listing') || lowerText.includes('optimize listing')) {
        const buyItems = queueItems.filter(item => item.decision === 'BUY' && !item.optimizedListing)
        
        if (buyItems.length === 0) {
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'I don\'t see any BUY items in your queue that need listing optimization. Would you like me to analyze your current queue items?',
            timestamp: Date.now(),
          }
          setChatSessions((prev) =>
            (prev || []).map(s =>
              s.id === sessionId
                ? { ...s, messages: [...s.messages, aiMessage], lastMessageAt: Date.now() }
                : s
            )
          )
          setIsProcessing(false)
          return
        }

        const responseText = `I'll create optimized eBay listings for ${buyItems.length} item${buyItems.length !== 1 ? 's' : ''} in your queue. This will include:\n\n- SEO-optimized titles (80 chars max)\n- Detailed product descriptions\n- Competitive pricing analysis\n- Item-specific keywords\n- Recommended shipping costs\n\nStarting optimization now...`
        
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        }

        setChatSessions((prev) =>
          (prev || []).map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, aiMessage], lastMessageAt: Date.now() }
              : s
          )
        )

        for (const item of buyItems) {
          if (onOptimizeItem) {
            await onOptimizeItem(item.id)
          }
        }

        const completionMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `✅ Successfully optimized ${buyItems.length} listing${buyItems.length !== 1 ? 's' : ''}! They're now ready to publish to eBay or push to Notion. Check the Queue to review them.`,
          timestamp: Date.now(),
        }

        setChatSessions((prev) =>
          (prev || []).map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, completionMessage], lastMessageAt: Date.now() }
              : s
          )
        )
        
        toast.success(`Optimized ${buyItems.length} listings`)
        setIsProcessing(false)
        return
      }

      if (lowerText.includes('push to notion') || lowerText.includes('send to notion')) {
        const readyItems = queueItems.filter(item => item.optimizedListing && !item.notionPageId)
        
        if (readyItems.length === 0) {
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'No optimized listings ready to push to Notion. Would you like me to create optimized listings first?',
            timestamp: Date.now(),
          }
          setChatSessions((prev) =>
            (prev || []).map(s =>
              s.id === sessionId
                ? { ...s, messages: [...s.messages, aiMessage], lastMessageAt: Date.now() }
                : s
            )
          )
          setIsProcessing(false)
          return
        }

        const responseText = `Pushing ${readyItems.length} optimized listing${readyItems.length !== 1 ? 's' : ''} to your Notion database...`
        
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        }

        setChatSessions((prev) =>
          (prev || []).map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, aiMessage], lastMessageAt: Date.now() }
              : s
          )
        )

        let successCount = 0
        for (const item of readyItems) {
          if (onPushToNotion) {
            try {
              await onPushToNotion(item.id)
              successCount++
            } catch (error) {
              console.error('Failed to push item:', item.id, error)
            }
          }
        }

        const completionMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `✅ Successfully pushed ${successCount} of ${readyItems.length} listings to Notion!`,
          timestamp: Date.now(),
        }

        setChatSessions((prev) =>
          (prev || []).map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, completionMessage], lastMessageAt: Date.now() }
              : s
          )
        )
        
        toast.success(`Pushed ${successCount} listings to Notion`)
        setIsProcessing(false)
        return
      }

      // Research command — uses Gemini with Google Search grounding for real market data
      if ((lowerText.includes('research') || lowerText.includes('look up') || lowerText.includes('double check') || lowerText.includes('price check') || lowerText.includes('market value')) && settings?.geminiApiKey) {
        // Find the most recently discussed item or the most recent queue item
        const recentItem = queueItems.find(i =>
          lowerText.includes(i.productName?.toLowerCase() || '')
        ) || queueItems[queueItems.length - 1]

        if (recentItem?.productName) {
          addMsg(`Researching **${recentItem.productName}** across marketplaces...`)

          try {
            const research = await researchProduct(
              recentItem.productName,
              { purchasePrice: recentItem.purchasePrice, category: recentItem.category },
              settings.geminiApiKey
            )
            addMsg(research)
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Research failed'
            addMsg(`Research error: ${msg}. Try asking me a specific question about the product instead.`)
          }

          setIsProcessing(false)
          return
        }
      }

      // Edit item command — user says "change price to X", "update description", etc.
      if ((lowerText.includes('change') || lowerText.includes('update') || lowerText.includes('set')) &&
          (lowerText.includes('price') || lowerText.includes('description') || lowerText.includes('title') || lowerText.includes('category')) &&
          onEditItem) {
        const recentItem = queueItems[queueItems.length - 1]
        if (recentItem) {
          const updates: Partial<ScannedItem> = {}

          // Extract price
          const priceMatch = text.match(/\$?(\d+\.?\d*)/)?.[1]
          if (priceMatch && lowerText.includes('price')) {
            const newPrice = parseFloat(priceMatch)
            if (lowerText.includes('sell') || lowerText.includes('list')) {
              updates.estimatedSellPrice = newPrice
            } else {
              updates.purchasePrice = newPrice
            }
          }

          // Extract description
          if (lowerText.includes('description')) {
            const descMatch = text.match(/description\s+(?:to\s+)?["']?(.+?)["']?\s*$/i)
            if (descMatch) updates.description = descMatch[1]
          }

          if (Object.keys(updates).length > 0) {
            onEditItem(recentItem.id, updates)
            const updateSummary = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(', ')

            setChatSessions((prev) =>
              (prev || []).map(s =>
                s.id === sessionId
                  ? { ...s, messages: [...s.messages, { id: Date.now().toString(), role: 'assistant' as const, content: `Updated **${recentItem.productName || 'item'}**: ${updateSummary}`, timestamp: Date.now() }], lastMessageAt: Date.now() }
                  : s
              )
            )
            setIsProcessing(false)
            return
          }
        }
      }

      // Session management commands — use regex word boundaries to avoid false positives
      if (/\b(start|begin)\b.*\bsession\b/i.test(text) && onStartSession) {
        if (currentSession?.active) {
          addMsg('A session is already active. End the current session first before starting a new one.')
        } else {
          onStartSession()
          addMsg('**Session started!** I\'m now tracking your scans, profits, and decisions. Start scanning items and I\'ll keep you updated on progress.')
        }
        setIsProcessing(false)
        return
      }

      if (/\b(end|stop|finish)\b.*\bsession\b/i.test(text) && onEndSession) {
        if (!currentSession?.active) {
          addMsg('No active session to end. Start a new session first.')
        } else {
          const profit = currentSession.totalPotentialProfit ?? 0
          onEndSession()
          addMsg(`**Session ended!** Final stats: ${currentSession.itemsScanned} scans, ${currentSession.buyCount} BUY, ${currentSession.passCount} PASS, $${profit.toFixed(2)} potential profit.`)
        }
        setIsProcessing(false)
        return
      }

      // Rename/edit session command
      if (/\b(name|rename)\b.*\bsession\b/i.test(text) && onEditSession) {
        const nameMatch = text.match(/(?:name|rename)\s+(?:this\s+)?session\s+(?:to\s+)?["']?(.+?)["']?\s*$/i)
        if (nameMatch && currentSession?.active) {
          onEditSession(currentSession.id, { name: nameMatch[1].trim() })
          addMsg(`Session renamed to **${nameMatch[1].trim()}**`)
          setIsProcessing(false)
          return
        }
      }

      // Set session goal
      if (/\b(set|target)\b.*\bgoal\b/i.test(text) && onEditSession) {
        const goalMatch = text.match(/\$?(\d+(?:\.\d{2})?)/)?.[1]
        if (goalMatch && currentSession?.active) {
          const amount = parseFloat(goalMatch)
          const currentProfit = currentSession.totalPotentialProfit ?? 0
          onEditSession(currentSession.id, { profitGoal: amount })
          addMsg(`**Profit goal set to $${amount.toFixed(2)}** for this session. Current progress: $${currentProfit.toFixed(2)} (${amount > 0 ? Math.round((currentProfit / amount) * 100) : 0}%)`)
          setIsProcessing(false)
          return
        }
      }

      // Set session location
      if (/\b(set|at)\b.*\b(location|store)\b/i.test(text) && onEditSession && currentSession?.active) {
        const locMatch = text.match(/(?:location|store|at)\s+(?:to\s+|is\s+)?["']?(.+?)["']?\s*$/i)
        if (locMatch) {
          const name = locMatch[1].trim()
          const location = {
            id: currentSession.location?.id || Date.now().toString(),
            name,
            type: 'thrift-store' as const,
          }
          onEditSession(currentSession.id, { location })
          addMsg(`Session location set to **${name}**`)
          setIsProcessing(false)
          return
        }
      }

      // Mark as sold command: "mark [item name] as sold on [marketplace] for $X"
      if ((lowerText.includes('mark') || lowerText.includes('sold')) && lowerText.includes('sold') && onMarkAsSold) {
        const priceMatch = text.match(/\$?(\d+(?:\.\d{2})?)/)?.[1]
        const marketplaces = ['ebay', 'mercari', 'poshmark', 'facebook', 'whatnot', 'other'] as const
        const foundMarketplace = marketplaces.find(m => lowerText.includes(m)) || 'other'
        const soldPrice = priceMatch ? parseFloat(priceMatch) : 0

        const matchedItem = queueItems.find(i =>
          i.listingStatus === 'published' && i.productName && lowerText.includes(i.productName.toLowerCase())
        ) || queueItems.filter(i => i.listingStatus === 'published').slice(-1)[0]

        if (matchedItem) {
          onMarkAsSold(matchedItem.id, soldPrice, foundMarketplace)
          addMsg(`✅ Marked **${matchedItem.productName || 'item'}** as sold on **${foundMarketplace}** for **$${soldPrice.toFixed(2)}**. It's now in your Sold tab.`)
          setIsProcessing(false)
          return
        }
      }

      // Add tracking command: "add tracking [number] for [item]" or "mark [item] shipped"
      if ((lowerText.includes('tracking') || lowerText.includes('shipped') || lowerText.includes('mark shipped')) && onMarkShipped) {
        const trackingMatch = text.match(/tracking\s+(?:number\s+)?([A-Z0-9]{6,30})/i)?.[1]
        const carrierMatch = text.match(/\b(usps|ups|fedex|dhl)\b/i)?.[1]?.toUpperCase() || ''

        const matchedSoldItem = soldItems.find(i =>
          i.listingStatus === 'sold' && i.productName && lowerText.includes(i.productName.toLowerCase())
        ) || soldItems.filter(i => i.listingStatus === 'sold').slice(-1)[0]

        if (matchedSoldItem) {
          onMarkShipped(matchedSoldItem.id, trackingMatch || '', carrierMatch)
          addMsg(`✅ Marked **${matchedSoldItem.productName || 'item'}** as shipped${trackingMatch ? ` with tracking **${trackingMatch}**` : ''}${carrierMatch ? ` via ${carrierMatch}` : ''}.`)
          setIsProcessing(false)
          return
        }
      }

      const context = buildContext()
      const recentItems = queueItems.slice(-3).map(i =>
        `• ${i.productName || 'Unknown'} — Buy: $${i.purchasePrice.toFixed(2)}, Sell: $${(i.estimatedSellPrice || 0).toFixed(2)}, Margin: ${(i.profitMargin || 0).toFixed(1)}%, Decision: ${i.decision}, Status: ${i.listingStatus || 'not-started'}${i.category ? `, Category: ${i.category}` : ''}`
      ).join('\n')

      const pastSessionsSummary = allSessions.slice(-3).map(s => {
        const dur = ((s.endTime || Date.now()) - s.startTime) / 60000
        return `• ${s.name || new Date(s.startTime).toLocaleDateString()} — ${s.itemsScanned} scans, ${s.buyCount} BUY, $${s.totalPotentialProfit.toFixed(2)} profit, ${Math.round(dur)}min${s.location ? `, at ${s.location.name}` : ''}${s.profitGoal ? `, goal: $${s.profitGoal}` : ''}`
      }).join('\n')

      const activeGoalsSummary = profitGoals.filter(g => g.active).map(g =>
        `• ${g.type} goal: $${g.targetAmount.toFixed(2)} (${new Date(g.startDate).toLocaleDateString()} - ${new Date(g.endDate).toLocaleDateString()})`
      ).join('\n')

      const soldSummaryText = soldItems.length > 0
        ? soldItems.slice(0, 5).map(i => {
            const profit = (i.soldPrice || 0) - i.purchasePrice
            return `• ${i.productName || 'Unknown'} — Sold $${(i.soldPrice || 0).toFixed(2)} on ${i.soldOn || '?'}, Profit: $${profit.toFixed(2)}, Status: ${i.listingStatus}`
          }).join('\n')
        : 'No sold items yet'

      const soldStats = {
        total: soldItems.length,
        revenue: soldItems.reduce((s, i) => s + (i.soldPrice || 0), 0),
        profit: soldItems.reduce((s, i) => s + ((i.soldPrice || 0) - i.purchasePrice), 0),
        needsShipping: soldItems.filter(i => i.listingStatus === 'sold').length,
      }

      const systemPrompt = `You are an expert AI agent for resale business optimization. You have FULL awareness of this app's state — every session, item, goal, and setting. You help users research products, analyze profitability, create optimized eBay listings, manage sessions, track sold items, and make data-driven decisions.

## Current App State

### Listings Queue
- ${queueStats.total} items (${queueStats.buy} BUY, ${queueStats.pass} PASS, ${queueStats.pending} PENDING)
- Potential profit: $${queueStats.totalProfit.toFixed(2)}
${recentItems ? `\nRecent Items:\n${recentItems}` : ''}

### Sold Items
- ${soldStats.total} total sold | Revenue: $${soldStats.revenue.toFixed(2)} | Profit: $${soldStats.profit.toFixed(2)} | Needs Shipping: ${soldStats.needsShipping}
${soldSummaryText !== 'No sold items yet' ? `\nRecent Sold:\n${soldSummaryText}` : '\nNo sold items yet'}

### Active Session
${currentSession?.active ? `- Name: ${currentSession.name || 'Unnamed'}
- Started: ${new Date(currentSession.startTime).toLocaleString()}
- Scans: ${currentSession.itemsScanned} (${currentSession.buyCount} BUY, ${currentSession.passCount} PASS)
- Profit: $${currentSession.totalPotentialProfit.toFixed(2)}
- Goal: ${currentSession.profitGoal ? `$${currentSession.profitGoal} (${currentSession.profitGoal > 0 ? Math.round((currentSession.totalPotentialProfit / currentSession.profitGoal) * 100) : 0}% achieved)` : 'Not set'}
- Location: ${currentSession.location?.name || 'Not set'}` : 'No active session'}

### Past Sessions (most recent)
${pastSessionsSummary || 'No past sessions'}

### Profit Goals
${activeGoalsSummary || 'No active goals'}

### Settings
- Min margin: ${settings?.minProfitMargin}%, Shipping: $${settings?.defaultShippingCost}, eBay fee: ${settings?.ebayFeePercent}%

## Available Actions
You can execute these commands for the user:
- "Research [product]" — Search real marketplaces for current prices and demand
- "Change price to $X" / "Update sell price to $X" — Edit item fields
- "Create listings" — Generate optimized eBay listings for BUY items
- "Push to Notion" — Publish ready listings
- "Full pipeline" — End-to-end: analyze → optimize → publish
- "Camera" / "Scan" — Open the AI Camera
- "Start session" / "End session" — Manage scanning sessions
- "Name session [name]" — Rename the active session
- "Set goal $X" — Set a profit goal for the active session
- "Set location [name]" — Set the location for the active session
- "Mark [item] as sold on [marketplace] for $X" — Move a published item to the Sold tab
- "Add tracking [number] for [item]" / "Mark [item] shipped" — Update shipping status

## Instructions
- You are fully aware of ALL data in this app. Reference specific items, sessions, goals, and metrics by name and number.
- When the user asks about sessions, items, goals, or any app data, answer from the state above — don't say you can't access it.
- When discussing items, reference their specific prices, margins, categories, and brands.
- If asked about profitability, calculate real numbers using the data.
- If an item has a negative margin, explain WHY (fees + shipping) and suggest alternatives.
- When the user asks to edit forms or data, use the available actions to do it immediately.
- Be proactive: if a session has no goal set, suggest one. If items are unanalyzed, suggest running the pipeline.`

      const fullPrompt = `${systemPrompt}\n\nUser: ${text}`
      const response = await callLLM(fullPrompt, {
        task: 'chat',
        geminiApiKey: settings?.geminiApiKey,
        anthropicApiKey: settings?.anthropicApiKey,
      })

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      }

      setChatSessions((prev) =>
        (prev || []).map(s =>
          s.id === sessionId
            ? { ...s, messages: [...s.messages, aiMessage], lastMessageAt: Date.now() }
            : s
        )
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('Agent AI error:', msg)
      toast.error(msg.includes('API key') ? msg : `AI error: ${msg}`)
    } finally {
      setIsProcessing(false)
    }
  }, [input, isProcessing, activeSessionId, setChatSessions, setActiveSessionId, buildContext, queueStats, settings, queueItems, soldItems, onOptimizeItem, onPushToNotion, onBatchAnalyze, onEditItem, onMarkAsSold, onMarkShipped, onOpenCamera, onStartSession, onEndSession, onEditSession, currentSession, allSessions, profitGoals])

  const handleQuickAction = useCallback((prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }, [])

  const hasMessages = chatMessages.length > 0

  return (
    <div className="flex flex-col h-full bg-bg">
      <PullToRefreshIndicator
        isPulling={pullToRefresh.isPulling}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        progress={pullToRefresh.progress}
        shouldTrigger={pullToRefresh.shouldTrigger}
      />
      <div className="flex items-center justify-between px-4 py-4 bg-fg border-b border-s1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-b1 to-b2 rounded-xl">
            <Robot size={24} weight="bold" className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-t1">Agent</h1>
            <p className="text-xs text-t3">AI Research & Automation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNewSessionDialog(true)}
            className="h-9 px-3"
          >
            <Plus size={18} weight="bold" />
          </Button>
        </div>
      </div>

      {chatSessions && chatSessions.length > 0 && (
        <div className="px-4 py-3 bg-fg border-b border-s1">
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {chatSessions.map((session) => (
                <div key={session.id} className="relative group">
                  <button
                    onClick={() => handleSwitchSession(session.id)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-2",
                      session.id === activeSessionId
                        ? "bg-b1 text-white"
                        : "bg-s1 text-t2 hover:bg-s2 hover:text-t1"
                    )}
                  >
                    {session.name}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "absolute -top-1 -right-1 p-1 bg-s2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
                          session.id === activeSessionId && "bg-b2"
                        )}
                      >
                        <DotsThreeVertical size={12} weight="bold" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenRenameDialog(session.id)}>
                        <PencilSimple size={16} className="mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteSession(session.id)}
                        className="text-red"
                      >
                        <Trash size={16} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="px-4 py-2 bg-s1/30 border-b border-s1">
        <div className="grid grid-cols-4 gap-1.5">
          <Card className="p-2 flex flex-col items-center justify-center">
            <div className="text-[9px] text-t3 font-semibold uppercase tracking-wide mb-0.5">Queue</div>
            <div className="text-base font-black text-t1">{queueStats.total}</div>
          </Card>
          <Card className="p-2 flex flex-col items-center justify-center">
            <div className="text-[9px] text-green font-semibold uppercase tracking-wide mb-0.5 flex items-center gap-0.5">
              <CheckCircle size={10} weight="fill" />
              BUY
            </div>
            <div className="text-base font-black text-green">{queueStats.buy}</div>
          </Card>
          <Card className="p-2 flex flex-col items-center justify-center">
            <div className="text-[9px] text-red font-semibold uppercase tracking-wide mb-0.5 flex items-center gap-0.5">
              <Warning size={10} weight="fill" />
              PASS
            </div>
            <div className="text-base font-black text-red">{queueStats.pass}</div>
          </Card>
          <Card className="p-2 flex flex-col items-center justify-center">
            <div className="text-[9px] text-t3 font-semibold uppercase tracking-wide mb-0.5">Profit</div>
            <div className="text-xs font-black text-green">${queueStats.totalProfit.toFixed(0)}</div>
          </Card>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div ref={pullToRefresh.containerRef} className="py-4 space-y-4">
          {!hasMessages && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="text-center py-8">
                <div className="inline-flex p-4 bg-gradient-to-br from-b1 to-b2 rounded-2xl mb-4">
                  <Sparkle size={32} weight="fill" className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-t1 mb-2">Welcome to Agent</h2>
                <p className="text-sm text-t3 max-w-xs mx-auto">
                  Your AI assistant for research, insights, and automated listing creation
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-t2 px-1">
                  Quick Actions
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((action, index) => (
                    <motion.button
                      key={action.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleQuickAction(action.prompt)}
                      className="p-3 bg-fg border border-s1 rounded-xl hover:border-b1 hover:bg-blue-bg transition-all text-left group"
                    >
                      <div className="text-2xl mb-2">{action.emoji}</div>
                      <div className="text-xs font-bold text-t1 group-hover:text-b1 transition-colors">
                        {action.label}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {hasMessages && (
            <>
              {chatMessages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn(
                    "flex gap-3",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-b1 to-b2 flex items-center justify-center flex-shrink-0">
                      <Robot size={18} weight="bold" className="text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3",
                      msg.role === 'user'
                        ? "bg-gradient-to-br from-b1 to-b2 text-white"
                        : "bg-s1 border border-s2 text-t1"
                    )}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      <CollapsibleMessage message={msg.content} />
                    )}
                  </div>
                </motion.div>
              ))}
            </>
          )}

          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-b1 to-b2 flex items-center justify-center flex-shrink-0">
                <Robot size={18} weight="bold" className="text-white" />
              </div>
              <div className="bg-s1 border border-s2 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-b1 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-b1 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-b1 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 bg-fg border-t border-s1 safe-bottom">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your resale business..."
            disabled={isProcessing}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-4"
          >
            <PaperPlaneRight size={20} weight="bold" />
          </Button>
        </form>
      </div>

      <Dialog open={showNewSessionDialog} onOpenChange={setShowNewSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Chat Session</DialogTitle>
          </DialogHeader>
          <Input
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="Session name (optional)"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewSessionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSession}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Session</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="New session name"
            onKeyDown={(e) => e.key === 'Enter' && handleRenameSession()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSession}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
