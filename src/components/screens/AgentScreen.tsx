import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useKV } from '@github/spark/hooks'
import {
  Robot,
  Sparkle,
  Plus,
  Trash,
  DotsThreeVertical,
  PencilSimple,
  PaperPlaneRight,
  ArrowLeft,
  CaretDown,
  CaretUp,
  Check,
  Package,
  TrendUp,
  ChartLine,
  Lightbulb,
  MagnifyingGlass,
  Globe,
  Stack,
  CheckCircle,
  Warning,
  ListChecks,
  ChatCircle,
  Camera,
  ArrowSquareRight,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getNetProfit } from '@/lib/profit-utils'
import { callLLM, researchProduct } from '@/lib/llm-service'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { ChatSession, ChatMessage, ScannedItem, AppSettings, Session, ProfitGoal, SharedTodo, SoldItem } from '@/types'

interface QuickAction {
  emoji: string
  label: string
  prompt: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    emoji: '📸',
    label: 'Scan Item',
    prompt: 'open camera to scan a new item',
  },
  {
    emoji: '🚀',
    label: 'Full Pipeline',
    prompt: 'Run full pipeline: analyze all drafts, optimize BUY listings, and push to Notion',
  },
  {
    emoji: '📬',
    label: 'Need Shipping',
    prompt: 'Which sold items need shipping labels right now? Show me overdue items first, then the best carrier and estimated cost for each.',
  },
  {
    emoji: '📊',
    label: 'Session Stats',
    prompt: "What's my current session status? Show stats, profit goal progress, and recent items.",
  },
]

const EMPTY_TODOS: SharedTodo[] = []

function lastMessagePreview(session: ChatSession): string {
  const last = session.messages[session.messages.length - 1]
  if (!last) return 'No messages yet'
  const text = last.content.replace(/[#*_`]/g, '').trim()
  return text.length > 60 ? text.slice(0, 60) + '…' : text
}

function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Static system instructions — module-level constant, allocated once.
// Gemini API caches identical prefixes across calls, so keeping this
// stable and at the front of every prompt reduces per-request cost.
const AGENT_SYSTEM_INSTRUCTIONS = `You are a resale business AI agent with full app state access. You help research products, analyze profit, create eBay listings, manage sessions, and track sold items. All profit figures are NET (after fees + shipping). The user offers 1-day shipping — flag overdue items.

## Commands
- "Research [product]" — live marketplace search
- "Create listings" / "Full pipeline" — optimize + publish BUY items
- "Push to Notion" — publish ready listings
- "Mark [item] sold on [marketplace] for $X" — record a sale
- "Add tracking [number]" / "Mark shipped" — update shipping
- "Start/End session" — manage scanning sessions
- "Set goal $X" / "Set location [name]" — session settings

## Rules
- Answer from the app state below — never say you can't access it.
- Reference items by name, price, margin, and category.
- Be proactive: suggest goals, flag unanalyzed items, warn about overdue shipping.` as const

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
  liveSoldItems?: SoldItem[]
  settings?: AppSettings
  /** Message injected from external widget (e.g. AgentChatWidget on Session screen) */
  pendingMessage?: string | null
  onPendingMessageHandled?: () => void
  onProcessingChange?: (processing: boolean) => void
  onCreateListing?: (itemId: string) => Promise<void>
  onOptimizeItem?: (itemId: string) => Promise<void>
  onPushToNotion?: (itemId: string) => Promise<void>
  onBatchAnalyze?: () => Promise<void>
  onEditItem?: (itemId: string, updates: Partial<ScannedItem>) => void
  onMarkAsSold?: (itemId: string, soldPrice: number, soldOn: 'ebay' | 'mercari' | 'poshmark' | 'facebook' | 'whatnot' | 'other') => void
  onMarkShipped?: (itemId: string, trackingNumber: string, shippingCarrier: string) => void
  onNavigateToQueue?: () => void
  /** Open a specific queue item in the scan analysis screen (loads it as currentItem) */
  onOpenScanItem?: (item: ScannedItem) => void
  onOpenCamera?: () => void
  onStartSession?: () => void
  onEndSession?: () => void
  onEditSession?: (sessionId: string, updates: Partial<Session>) => void
  allSessions?: Session[]
  scanHistory?: ScannedItem[]
  profitGoals?: ProfitGoal[]
  /** False when the app has navigated to another tab — triggers pill exit animation */
  isCurrentScreen?: boolean
}

const EMPTY_CHAT_SESSIONS: ChatSession[] = []

export function AgentScreen({ queueItems = [], soldItems = [], liveSoldItems = [], settings, pendingMessage, onPendingMessageHandled, onProcessingChange, onCreateListing, onOptimizeItem, onPushToNotion, onBatchAnalyze, onEditItem, onMarkAsSold, onMarkShipped, onNavigateToQueue, onOpenScanItem, onOpenCamera, onStartSession, onEndSession, onEditSession, allSessions = [], scanHistory = [], profitGoals = [], isCurrentScreen = true }: AgentScreenProps) {
  const [currentSession] = useKV<Session | undefined>('currentSession', undefined)
  const sessionId = currentSession?.id
  const chatKey = useMemo(() => sessionId ? `chat-sessions-${sessionId}` : 'chat-sessions-global', [sessionId])
  const activeKey = useMemo(() => sessionId ? `active-chat-session-${sessionId}` : 'active-chat-session-global', [sessionId])
  const [chatSessions, setChatSessions] = useKV<ChatSession[]>(chatKey, EMPTY_CHAT_SESSIONS)
  const [activeSessionId, setActiveSessionId] = useKV<string | null>(activeKey, null)
  const [todos, setTodos] = useKV<SharedTodo[]>('shared-todos', EMPTY_TODOS)
  const [activeTab, setActiveTab] = useState<'chat' | 'scans' | 'tasks'>('chat')
  const [viewMode, setViewMode] = useState<'list' | 'chat'>('list')
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [taskInput, setTaskInput] = useState('')
  const [showTaskInput, setShowTaskInput] = useState(false)
  // Direct KV access for scan history mutations in the Scans tab
  const [scanHistoryKV, setScanHistoryKV] = useKV<ScannedItem[]>('scan-history', [])
  const [, setQueueKV] = useKV<ScannedItem[]>('queue', [])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Tracks whether the component is still mounted so long-running async
  // handlers (multi-step pipeline, research, optimizer) can bail out on
  // unmount instead of dispatching state updates into a dead tree.
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])
  const pendingTodos = useMemo(() => (todos || []).filter(t => !t.completed), [todos])
  const completedTodos = useMemo(() => (todos || []).filter(t => t.completed), [todos])

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

  // Session-scoped items: filter by current session when active, else show all
  const sessionItems = useMemo(() => {
    if (!currentSession?.id) return queueItems
    return queueItems.filter(item => item.sessionId === currentSession.id)
  }, [queueItems, currentSession?.id])

  const queueStats = useMemo(() => {
    const total = sessionItems.length
    const buy = sessionItems.filter(item => item.decision === 'BUY').length
    const pass = sessionItems.filter(item => item.decision === 'PASS').length
    const pending = sessionItems.filter(item => item.decision === 'PENDING').length
    const totalProfit = sessionItems
      .filter(item => item.decision === 'BUY' && item.profitMargin)
      .reduce((sum, item) => {
        const profit = (item.estimatedSellPrice || 0) - item.purchasePrice
        return sum + profit
      }, 0)

    return { total, buy, pass, pending, totalProfit }
  }, [sessionItems])

  // Session-scoped scan cards (most recent first) for the Scans tab
  const sessionScans = useMemo(() => {
    const items = scanHistoryKV || []
    const filtered = currentSession?.id
      ? items.filter(i => i.sessionId === currentSession.id)
      : items
    return [...filtered].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100)
  }, [scanHistoryKV, currentSession?.id])

  const handleDeleteScan = useCallback((itemId: string) => {
    setScanHistoryKV(prev => (prev || []).filter(i => i.id !== itemId))
  }, [setScanHistoryKV])

  const handlePromoteToQueue = useCallback((item: ScannedItem) => {
    const queueItem: ScannedItem = { ...item, inQueue: true }
    setQueueKV(prev => {
      const current = prev || []
      if (current.some(i => i.id === queueItem.id)) return current
      return [...current, queueItem]
    })
    toast.success(`${item.productName || 'Item'} added to queue`)
  }, [setQueueKV])

  const prevMessageCount = useRef(chatMessages.length)
  const agentHasMounted = useRef(false)
  useEffect(() => {
    if (!agentHasMounted.current) {
      agentHasMounted.current = true
      prevMessageCount.current = chatMessages.length
      return
    }
    if (chatMessages.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessageCount.current = chatMessages.length
  }, [chatMessages])

  const handleCreateSession = useCallback(() => {
    // One-session model: open the existing session if it exists
    const existing = chatSessions?.[0]
    if (existing) {
      setActiveSessionId(existing.id)
      setViewMode('chat')
      return
    }
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: 'Chat',
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      messages: [],
      isActive: true,
    }
    setChatSessions([newSession])
    setActiveSessionId(newSession.id)
    setViewMode('chat')
  }, [chatSessions, setChatSessions, setActiveSessionId])

  const handleDeleteSession = useCallback((sessionId: string) => {
    setChatSessions((prev) => (prev || []).filter(s => s.id !== sessionId))
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
      setViewMode('list')
    }
  }, [activeSessionId, setChatSessions, setActiveSessionId])

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
    setViewMode('chat')
  }, [setChatSessions, setActiveSessionId])

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
      setViewMode('chat')
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

    // Add task command: "add task X", "remind me to X", "todo X"
    if (/\b(add task|remind me to|todo)\b/i.test(text)) {
      const taskText = text.replace(/^.*?\b(add task|remind me to|todo)\s*/i, '').trim()
      if (taskText) {
        setTodos(prev => [...(prev || []), {
          id: Date.now().toString(),
          text: taskText,
          completed: false,
          createdBy: 'agent' as const,
          createdAt: Date.now(),
        }])
        const addMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ Added task: "${taskText}"`,
          timestamp: Date.now(),
        }
        setChatSessions((prev) =>
          (prev || []).map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, { id: (Date.now() - 1).toString(), role: 'user' as const, content: text, timestamp: Date.now() }, addMsg], lastMessageAt: Date.now() }
              : s
          )
        )
        setInput('')
        setIsProcessing(false)
        return
      }
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
        const drafts = sessionItems.filter(i => !i.productName || i.productName === 'Quick Draft')
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
        const goItemIds = sessionItems
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
        const preExistingReadyIds = sessionItems
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
        const buyItems = sessionItems.filter(item => item.decision === 'BUY' && !item.optimizedListing)
        
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
        const readyItems = sessionItems.filter(item => item.optimizedListing && !item.notionPageId)
        
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

      // Show tasks command — list pending todos inline without hitting the LLM
      if (/\b(show tasks?|view tasks?|my tasks?|task list|what.*tasks?|tasks? left)\b/i.test(lowerText)) {
        if (pendingTodos.length === 0) {
          addMsg('✅ No pending tasks — your list is clear! Tap the **Task** tab to add one, or say "add task: [description]".')
        } else {
          const taskLines = pendingTodos.slice(0, 10).map((t, i) => `${i + 1}. ${t.text}`).join('\n')
          addMsg(`You have **${pendingTodos.length} pending task${pendingTodos.length !== 1 ? 's' : ''}**:\n\n${taskLines}\n\nSwitch to the **Task** tab to check them off or add more.`)
        }
        setIsProcessing(false)
        return
      }

      // Shipping status — serve from live sold data already in context, no LLM needed
      if (/\b(shipping|ship|need labels?|need to ship|overdue|what.*ship|labels? needed)\b/i.test(lowerText)) {
        if (liveSoldItems.length === 0) {
          addMsg('📬 No sold items found in your Notion Sales DB yet. Once items sell and WF-01 parses the confirmation emails they\'ll appear here automatically. You can also tap **+ Log Sale** on the Sold tab to add them manually.')
        } else {
          const { needsLabelCount, overdueCount, readyCount, shippedCount, urgentItems, totalPotentialShippingCost } = (() => {
            // Import is at top of file — use the already-imported analyzeSoldBatch
            const a = { needsLabelCount: 0, overdueCount: 0, readyCount: 0, shippedCount: 0, urgentItems: [] as Array<{title:string;hoursOverdue:number;platform:string}>, totalPotentialShippingCost: 0 }
            for (const item of liveSoldItems) {
              if (item.shippingStatus === '✅ Shipped') a.shippedCount++
              else if (item.shippingStatus === '🔴 Need Label') a.needsLabelCount++
              else if (item.shippingStatus === '🟡 Label Ready' || item.shippingStatus === '📦 Packed') a.readyCount++
              if (item.shippingStatus !== '✅ Shipped' && item.saleDate) {
                const hours = Math.round((Date.now() - new Date(item.saleDate).getTime()) / 3_600_000)
                if (hours >= 48) { a.overdueCount++; a.urgentItems.push({ title: item.title, hoursOverdue: Math.max(0, hours - 24), platform: item.platform }) }
              }
            }
            a.urgentItems.sort((x, y) => y.hoursOverdue - x.hoursOverdue)
            return a
          })()

          const lines: string[] = [`📬 **Shipping Status — ${liveSoldItems.length} sold item${liveSoldItems.length !== 1 ? 's' : ''}**\n`]
          if (overdueCount > 0) lines.push(`🔴 **${overdueCount} overdue** (>48h since sale — ship today!)`)
          if (needsLabelCount > 0) lines.push(`🟡 **${needsLabelCount} need a label**`)
          if (readyCount > 0) lines.push(`📦 **${readyCount} packed / label ready**`)
          if (shippedCount > 0) lines.push(`✅ **${shippedCount} shipped**`)
          if (urgentItems.length > 0) {
            lines.push('\n**Overdue items:**')
            urgentItems.slice(0, 5).forEach(u => lines.push(`• ${u.title} — ${u.hoursOverdue}h overdue (${u.platform})`))
          }
          lines.push('\nGo to the **Sold** tab to print labels and update statuses.')
          addMsg(lines.join('\n'))
        }
        setIsProcessing(false)
        return
      }

      // Research command — uses Gemini with Google Search grounding for real market data
      if ((lowerText.includes('research') || lowerText.includes('look up') || lowerText.includes('double check') || lowerText.includes('price check') || lowerText.includes('market value')) && settings?.geminiApiKey) {
        // Find the most recently discussed item or the most recent queue item
        const recentItem = sessionItems.find(i =>
          lowerText.includes(i.productName?.toLowerCase() || '')
        ) || sessionItems[sessionItems.length - 1]

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
        const recentItem = sessionItems[sessionItems.length - 1]
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
      // Require "mark" + "sold" pattern to avoid false positives on generic "sold" questions
      if (/\bmark\b.*\bsold\b/i.test(text) && onMarkAsSold) {
        const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)|\bfor\s+(\d+(?:\.\d{2})?)\b/)?.[1] || text.match(/\$(\d+(?:\.\d{2})?)/)?.[1]
        const marketplaces = ['ebay', 'mercari', 'poshmark', 'facebook', 'whatnot', 'other'] as const
        const foundMarketplace = marketplaces.find(m => lowerText.includes(m)) || 'other'
        const soldPrice = priceMatch ? parseFloat(priceMatch) : 0

        const matchedItem = sessionItems.find(i =>
          i.listingStatus === 'published' && i.productName && lowerText.includes(i.productName.toLowerCase())
        ) || sessionItems.filter(i => i.listingStatus === 'published').slice(-1)[0]

        if (matchedItem) {
          onMarkAsSold(matchedItem.id, soldPrice, foundMarketplace)
          addMsg(`✅ Marked **${matchedItem.productName || 'item'}** as sold on **${foundMarketplace}** for **$${soldPrice.toFixed(2)}**. It's now in your Sold tab.`)
          setIsProcessing(false)
          return
        }
      }

      // Add tracking command: "add tracking [number] for [item]" or "mark [item] shipped"
      if ((/\b(add|update)\b.*\btracking\b/i.test(text) || /\bmark\b.*\bshipped\b/i.test(text)) && onMarkShipped) {
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

      const recentItems = sessionItems.slice(-3).map(i =>
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
            const { netProfit } = settings ? getNetProfit(i, settings) : { netProfit: (i.soldPrice || 0) - i.purchasePrice }
            return `• ${i.productName || 'Unknown'} — Sold $${(i.soldPrice || 0).toFixed(2)} on ${i.soldOn || '?'}, Net Profit: $${netProfit.toFixed(2)}, Status: ${i.listingStatus}`
          }).join('\n')
        : 'No sold items yet'

      const activeSold = soldItems.filter(i => i.listingStatus !== 'returned')
      const soldStats = {
        total: activeSold.length,
        revenue: activeSold.reduce((s, i) => s + (i.soldPrice || 0), 0),
        netProfit: settings ? activeSold.reduce((s, i) => s + getNetProfit(i, settings).netProfit, 0) : activeSold.reduce((s, i) => s + ((i.soldPrice || 0) - i.purchasePrice), 0),
        needsShipping: soldItems.filter(i => i.listingStatus === 'sold').length,
      }

      const sessionTypeLabel = currentSession?.sessionType === 'personal' ? 'PERSONAL' : 'BUSINESS'
      const sessionScope = currentSession?.active
        ? `You are operating within ${sessionTypeLabel} session "${currentSession.name || 'Active Session'}". All stats, items, and actions below apply ONLY to this session's items.${
            currentSession.sessionType === 'personal'
              ? '\n\nIMPORTANT: This is a PERSONAL session. Items here are NOT for resale — they are personal purchases. Do NOT include these items in business profit calculations, tax estimates, or resale analytics. You may still help with product identification and price lookups.'
              : ''
          }`
        : 'No scanning session is active. You are showing all-time global stats across all sessions.'

      // Dynamic context — changes per message, billed per-request
      const dynamicContext = `${sessionScope}

## Current App State

### ${currentSession?.active ? `Session: ${currentSession.name || 'Active'} — Listings` : 'All Listings (Global)'}
- ${queueStats.total} items (${queueStats.buy} BUY, ${queueStats.pass} PASS, ${queueStats.pending} PENDING)
- Potential profit: $${(queueStats.totalProfit || 0).toFixed(2)}
${recentItems ? `\nRecent Items:\n${recentItems}` : ''}

### Sold Items
- ${soldStats.total} total sold | Revenue: $${soldStats.revenue.toFixed(2)} | Net Profit: $${soldStats.netProfit.toFixed(2)} | Needs Shipping: ${soldStats.needsShipping}
${soldSummaryText !== 'No sold items yet' ? `\nRecent Sold:\n${soldSummaryText}` : '\nNo sold items yet'}

### Active Session
${currentSession?.active ? `- ${currentSession.name || 'Unnamed'}: ${currentSession.itemsScanned} scans (${currentSession.buyCount} BUY, ${currentSession.passCount} PASS), $${currentSession.totalPotentialProfit.toFixed(2)} profit${currentSession.profitGoal ? `, goal: $${currentSession.profitGoal} (${Math.round((currentSession.totalPotentialProfit / currentSession.profitGoal) * 100)}%)` : ''}${currentSession.location?.name ? `, at ${currentSession.location.name}` : ''}` : 'No active session'}

### Past Sessions
${pastSessionsSummary || 'None'}

### Goals
${activeGoalsSummary || 'None'}

### Tasks
${pendingTodos.length > 0 ? pendingTodos.slice(0, 10).map(t => `- [ ] ${t.text} (${t.createdBy})`).join('\n') : 'No pending tasks'}

### Settings
- Min margin: ${settings?.minProfitMargin ?? 30}%, Shipping: $${settings?.defaultShippingCost ?? 5}, eBay fee: ${settings?.ebayFeePercent ?? 12.9}%`

      // Include last 4 messages for conversational continuity
      const recentHistory = chatMessages.slice(-4).map(m =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 300)}`
      ).join('\n\n')
      const historyBlock = recentHistory ? `\n\n## Recent Conversation\n${recentHistory}` : ''

      // Guard: ensure at least one API key is configured before hitting callLLM
      // (callLLM throws on missing keys but the error message may not reach the user clearly)
      if (!settings?.geminiApiKey && !settings?.anthropicApiKey) {
        const noKeyMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '⚙️ No AI API key configured. Go to **Settings → AI Configuration** and add your Gemini or Claude API key to start chatting.',
          timestamp: Date.now(),
        }
        setChatSessions((prev) =>
          (prev || []).map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, noKeyMsg], lastMessageAt: Date.now() }
              : s
          )
        )
        return
      }

      // Static instructions → Gemini systemInstruction (cached across requests)
      // Dynamic context + history + user message → contents (billed per-request)
      const userPrompt = `${dynamicContext}${historyBlock}\n\nUser: ${text}`
      const response = await callLLM(userPrompt, {
        task: 'chat',
        geminiApiKey: settings?.geminiApiKey,
        anthropicApiKey: settings?.anthropicApiKey,
        systemPrompt: AGENT_SYSTEM_INSTRUCTIONS,
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
      // Bail out silently if the user navigated away mid-flight — no point
      // dispatching state updates or toasts into an unmounted tree.
      if (!isMountedRef.current) return
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('Agent AI error:', msg)
      // Only show error toast for actionable issues (API key missing, safety block)
      // Transient failures (network, timeout) are silently absorbed — user can just retry
      if (msg.includes('API key') || msg.includes('configure')) {
        toast.error(msg)
      } else if (msg.includes('safety filter') || msg.includes('blocked')) {
        toast.error('Message couldn\'t be processed. Try rephrasing.')
      } else {
        // Transient error — add a subtle inline message instead of a loud toast
        const errorMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'I had trouble processing that. Please try again.',
          timestamp: Date.now(),
        }
        setChatSessions((prev) =>
          (prev || []).map(s =>
            s.id === activeSessionId
              ? { ...s, messages: [...s.messages, errorMessage], lastMessageAt: Date.now() }
              : s
          )
        )
      }
    } finally {
      // Safe to always run — React 18 no-ops state updates on unmounted components,
      // but short-circuit here as well to avoid the dev-mode warning.
      if (isMountedRef.current) setIsProcessing(false)
    }
  }, [input, isProcessing, activeSessionId, setChatSessions, setActiveSessionId, queueStats, settings, sessionItems, soldItems, chatMessages, pendingTodos, setTodos, onOptimizeItem, onPushToNotion, onBatchAnalyze, onEditItem, onMarkAsSold, onMarkShipped, onOpenCamera, onStartSession, onEndSession, onEditSession, currentSession, allSessions, profitGoals])

  // Broadcast processing state to parent (for external widget indicators)
  useEffect(() => {
    onProcessingChange?.(isProcessing)
  }, [isProcessing, onProcessingChange])

  // Auto-enter chat on mount whenever a session exists (persists for life of session)
  useEffect(() => {
    const existing = chatSessions?.[0]
    if (existing) {
      setActiveSessionId(existing.id)
      setViewMode('chat')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle messages injected from external widgets (e.g. AgentChatWidget)
  useEffect(() => {
    if (pendingMessage && !isProcessing) {
      setViewMode('chat')
      handleSendMessage(pendingMessage)
      onPendingMessageHandled?.()
    }
  }, [pendingMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuickAction = useCallback((prompt: string) => {
    // Send immediately — don't pre-fill the floating input bar (which lives in App.tsx
    // and has its own state, so setInput here would never reach the send button)
    handleSendMessage(prompt)
  }, [handleSendMessage])

  // Clear messages and start a fresh chat within the same session
  const handleNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: 'Chat',
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      messages: [],
      isActive: true,
    }
    setChatSessions([newSession])
    setActiveSessionId(newSession.id)
    setViewMode('chat')
  }, [setChatSessions, setActiveSessionId])

  // Shared stats bar used in both views
  const statsBar = (
    <div
      className="px-3 py-1 border-b border-s1/60"
      style={{ background: 'color-mix(in oklch, var(--fg) 85%, transparent)', WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)' }}
    >
      {currentSession?.active && (
        <div className="text-[9px] font-bold text-b1 uppercase tracking-wide mb-0.5">
          {currentSession.name || 'Active Session'}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1">
        <div className="rounded-lg border border-s2/60 py-1 px-1 text-center" style={{ background: 'color-mix(in oklch, var(--bg) 60%, transparent)' }}>
          <div className="text-sm font-black text-t1 leading-tight">{queueStats.total}</div>
          <div className="text-[8px] uppercase tracking-wide text-t3 leading-none mt-0.5">Queue</div>
        </div>
        <div className="rounded-lg border border-green/30 py-1 px-1 text-center" style={{ background: 'color-mix(in oklch, var(--green-bg) 50%, transparent)' }}>
          <div className="text-sm font-black text-green leading-tight">{queueStats.buy}</div>
          <div className="text-[8px] uppercase tracking-wide text-t3 leading-none mt-0.5">Buy</div>
        </div>
        <div className="rounded-lg border border-red/30 py-1 px-1 text-center" style={{ background: 'color-mix(in oklch, var(--red-bg) 50%, transparent)' }}>
          <div className="text-sm font-black text-red leading-tight">{queueStats.pass}</div>
          <div className="text-[8px] uppercase tracking-wide text-t3 leading-none mt-0.5">Pass</div>
        </div>
        <div className="rounded-lg border border-s2/60 py-1 px-1 text-center" style={{ background: 'color-mix(in oklch, var(--bg) 60%, transparent)' }}>
          <div className="text-sm font-black text-green leading-tight">${queueStats.totalProfit.toFixed(0)}</div>
          <div className="text-[8px] uppercase tracking-wide text-t3 leading-none mt-0.5">Profit</div>
        </div>
      </div>
      {activeTab === 'chat' && viewMode === 'chat' && (
        <div className="flex justify-end pt-1">
          <button
            onClick={handleNewChat}
            className="text-[9px] font-bold text-b1 uppercase tracking-wide transition-colors active:opacity-60 flex items-center gap-0.5"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            ↺ New Chat
          </button>
        </div>
      )}
    </div>
  )

  // Shared input bar — floating glass pill, sits just above the bottom nav
  const inputBar = (
    <motion.div
      key="chat-pill"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        // Viewport-relative (portal renders outside will-change containing block)
        // 54px nav height + 8px gap + safe area
        bottom: 'calc(62px + max(env(safe-area-inset-bottom, 0px), 0px))',
        zIndex: 50,
        padding: '0 12px',
        pointerEvents: 'none',
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSendMessage()
        }}
        className="flex items-center gap-2"
        style={{
          pointerEvents: 'auto',
          background: 'var(--glass-bg)',
          backdropFilter: 'saturate(180%) blur(24px)',
          WebkitBackdropFilter: 'saturate(180%) blur(24px)',
          border: '0.5px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
          borderRadius: '22px',
          padding: '6px 6px 6px 16px',
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
          disabled={isProcessing}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '15px',
            color: 'var(--t1)',
            minWidth: 0,
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          style={{
            width: '36px',
            height: '36px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '18px',
            background: 'linear-gradient(145deg, var(--b1) 0%, var(--b2) 100%)',
            boxShadow: !input.trim() || isProcessing ? 'none' : 'var(--send-glow)',
            border: 'none',
            cursor: 'pointer',
            opacity: !input.trim() || isProcessing ? 0.4 : 1,
            transition: 'opacity 0.15s, transform 0.1s, box-shadow 0.15s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <PaperPlaneRight size={16} weight="bold" className="text-white" />
        </button>
      </form>
    </motion.div>
  )

  // Task pill — same fixed position and spring animation as inputBar
  const taskBar = (
    <motion.div
      key="task-pill"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(62px + max(env(safe-area-inset-bottom, 0px), 0px))',
        zIndex: 50,
        padding: '0 12px',
        pointerEvents: 'none',
      }}
    >
      <form
        onSubmit={e => {
          e.preventDefault()
          const text = taskInput.trim()
          if (!text) return
          setTodos(prev => [
            ...(prev || []),
            { id: Date.now().toString(), text, completed: false, createdBy: 'user' as const, createdAt: Date.now() },
          ])
          setTaskInput('')
        }}
        className="flex items-center gap-2"
        style={{
          pointerEvents: 'auto',
          background: 'var(--glass-bg)',
          backdropFilter: 'saturate(180%) blur(24px)',
          WebkitBackdropFilter: 'saturate(180%) blur(24px)',
          border: '0.5px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
          borderRadius: '22px',
          padding: '6px 6px 6px 16px',
        }}
      >
        <input
          value={taskInput}
          onChange={e => setTaskInput(e.target.value)}
          placeholder="Add a task..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '15px',
            color: 'var(--t1)',
            minWidth: 0,
          }}
        />
        <button
          type="submit"
          disabled={!taskInput.trim()}
          style={{
            width: '36px',
            height: '36px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '18px',
            background: 'linear-gradient(145deg, var(--b1) 0%, var(--b2) 100%)',
            boxShadow: taskInput.trim() ? 'var(--send-glow)' : 'none',
            border: 'none',
            cursor: 'pointer',
            opacity: taskInput.trim() ? 1 : 0.4,
            transition: 'opacity 0.15s, box-shadow 0.15s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Plus size={16} weight="bold" className="text-white" />
        </button>
      </form>
    </motion.div>
  )

  const sortedSessions = useMemo(() =>
    [...(chatSessions || [])].sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0)),
  [chatSessions])

  return (
    <div className="flex flex-col h-full bg-bg">
      <PullToRefreshIndicator
        isPulling={pullToRefresh.isPulling}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        progress={pullToRefresh.progress}
        shouldTrigger={pullToRefresh.shouldTrigger}
      />

      {/* ── Chrome: tab bar + stats bar — flex-shrink-0 keeps it out of scroll ── */}
      <div className="flex-shrink-0 z-20 bg-fg">
        <div className="border-b border-s1">
          <div className="tab-bar px-3">
            <button
              onClick={() => setActiveTab('chat')}
              className={cn('tab-btn', activeTab === 'chat' && 'active')}
            >
              <span>💬 CHAT</span>
            </button>
            <button
              onClick={() => setActiveTab('scans')}
              className={cn('tab-btn', activeTab === 'scans' && 'active')}
            >
              <span>
                📸 SCANS{sessionScans.length > 0 && ` (${sessionScans.length})`}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={cn('tab-btn', activeTab === 'tasks' && 'active')}
            >
              <span>
                ✅ TASKS{pendingTodos.length > 0 && ` (${pendingTodos.length})`}
              </span>
            </button>
          </div>
        </div>
        {statsBar}
      </div>

      {/* ── Chat tab ── */}
      {activeTab === 'chat' && (
      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="agent-list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Splash — vertically centered */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <button
                onClick={handleCreateSession}
                className="inline-flex p-5 bg-gradient-to-br from-b1 to-b2 rounded-3xl mb-5 active:scale-95 transition-transform shadow-xl"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                <Sparkle size={32} weight="fill" className="text-white" />
              </button>
              <h2 className="text-xl font-bold text-t1 mb-2">Welcome to Agent</h2>
              <p className="text-sm text-t3 max-w-[200px] leading-relaxed">Tap to start your session assistant</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="agent-chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            {/* Empty state when chat has no messages */}
            {chatMessages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-b1 to-b2 flex items-center justify-center mb-5 shadow-lg" style={{ boxShadow: 'var(--send-glow)' }}>
                  <Robot size={48} weight="duotone" className="text-white" />
                </div>
                <p className="text-base font-semibold text-t1 mb-1">Session Assistant</p>
                <p className="text-xs text-t3 max-w-[200px] leading-relaxed">Ask about your queue, pricing, listings, or what to do next.</p>
              </div>
            )}

            {/* Messages — pb clears the floating input bar */}
            {chatMessages.length > 0 && (
            <ScrollArea className="flex-1 px-4">
              <div ref={pullToRefresh.containerRef} className="py-4 space-y-4" style={{ paddingBottom: '80px' }}>
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
            )}

          </motion.div>
        )}
      </AnimatePresence>
      )} {/* end chat tab */}

      {/* ── Scans tab ── */}
      {activeTab === 'scans' && (
        <div ref={pullToRefresh.containerRef} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-3 pb-6">
            {sessionScans.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <button
                  onClick={onOpenCamera}
                  className="w-24 h-24 rounded-3xl bg-gradient-to-br from-b1 to-b2 flex items-center justify-center mb-5 shadow-lg active:scale-95 transition-transform"
                  style={{ boxShadow: 'var(--send-glow)', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                >
                  <Camera size={48} weight="duotone" className="text-white" />
                </button>
                <p className="text-base font-semibold text-t1 mb-1">No Scans Yet</p>
                <p className="text-xs text-t3 max-w-[200px] leading-relaxed">
                  {currentSession?.active
                    ? 'Tap the icon to start scanning items.'
                    : 'Start a session and tap the icon to scan items.'}
                </p>
              </div>
            ) : (
              sessionScans.map(item => {
                const alreadyQueued = queueItems.some(q => q.id === item.id)
                const profit =
                  item.estimatedSellPrice != null
                    ? item.estimatedSellPrice - item.purchasePrice
                    : null
                const decisionColor =
                  item.decision === 'BUY'
                    ? 'text-green bg-green/10 border-green/30'
                    : item.decision === 'PASS'
                      ? 'text-red bg-red/10 border-red/30'
                      : 'text-amber bg-amber/10 border-amber/30'

                return (
                  <Card
                    key={item.id}
                    className="p-3 bg-fg border-s2 flex gap-3 items-start"
                  >
                    {(item.imageThumbnail || item.imageData) && (
                      <img
                        src={item.imageThumbnail || item.imageData}
                        alt={item.productName || 'Item'}
                        className="w-14 h-14 rounded-lg object-cover border border-s2 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-bold text-t1 truncate">
                        {item.productName || 'Unknown Item'}
                      </p>
                      <div className="flex gap-2 text-[10px] font-mono text-t2 flex-wrap">
                        <span>Buy ${item.purchasePrice.toFixed(2)}</span>
                        {item.estimatedSellPrice != null && (
                          <>
                            <span>→</span>
                            <span>Sell ${item.estimatedSellPrice.toFixed(2)}</span>
                          </>
                        )}
                        {profit != null && (
                          <span className={profit >= 0 ? 'text-green' : 'text-red'}>
                            ({profit >= 0 ? '+' : ''}{profit.toFixed(2)})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border',
                            decisionColor,
                          )}
                        >
                          {item.decision}
                        </span>
                        {alreadyQueued && (
                          <span className="inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border text-b1 bg-b1/10 border-b1/30">
                            In Queue
                          </span>
                        )}
                        {item.category && (
                          <span className="text-[9px] text-t3 truncate">{item.category}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {!alreadyQueued && (
                        <button
                          onClick={() => handlePromoteToQueue(item)}
                          className="flex items-center gap-1 px-2 py-1.5 bg-b1/10 hover:bg-b1/20 text-b1 rounded-lg text-[10px] font-bold transition-colors active:scale-95"
                          title="Add to listing queue"
                        >
                          <ArrowSquareRight size={12} weight="bold" />
                          Queue
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteScan(item.id)}
                        className="flex items-center gap-1 px-2 py-1.5 bg-s1 hover:bg-red/10 text-t3 hover:text-red rounded-lg text-[10px] font-bold transition-colors active:scale-95"
                        title="Remove from scan history"
                      >
                        <Trash size={12} weight="bold" />
                        Delete
                      </button>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ── Tasks tab ── */}
      {activeTab === 'tasks' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-1">
              {(todos || []).length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-b1 to-b2 flex items-center justify-center mb-5 shadow-lg" style={{ boxShadow: 'var(--send-glow)' }}>
                    <ListChecks size={48} weight="duotone" className="text-white" />
                  </div>
                  <p className="text-base font-semibold text-t1 mb-1">No Tasks Yet</p>
                  <p className="text-xs text-t3 max-w-[200px] leading-relaxed">
                    Add tasks below, or ask the Agent in Chat to create tasks for you.
                  </p>
                </div>
              )}
              {pendingTodos.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-2.5 py-2.5 px-1 group border-b border-s1 last:border-0"
                >
                  <button
                    onClick={() =>
                      setTodos(prev =>
                        (prev || []).map(x =>
                          x.id === t.id ? { ...x, completed: true } : x,
                        ),
                      )
                    }
                    className="flex-shrink-0 w-5 h-5 rounded-md border border-s2 hover:border-b1 hover:bg-b1/10 transition-colors"
                  />
                  <span className="flex-1 text-sm text-t1 leading-snug">{t.text}</span>
                  <span
                    className={cn(
                      'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0',
                      t.createdBy === 'agent' ? 'text-b1 bg-b1/10' : 'text-t3 bg-s1',
                    )}
                  >
                    {t.createdBy}
                  </span>
                  <button
                    onClick={() =>
                      setTodos(prev => (prev || []).filter(x => x.id !== t.id))
                    }
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-t3 hover:text-red p-1"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
              {completedTodos.length > 0 && (
                <>
                  <div className="pt-3 pb-1">
                    <p className="text-[10px] text-t3 font-bold uppercase tracking-wide">
                      Completed ({completedTodos.length})
                    </p>
                  </div>
                  {completedTodos.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2.5 py-2.5 px-1 group border-b border-s1 last:border-0 opacity-50"
                    >
                      <button
                        onClick={() =>
                          setTodos(prev =>
                            (prev || []).map(x =>
                              x.id === t.id ? { ...x, completed: false } : x,
                            ),
                          )
                        }
                        className="flex-shrink-0 w-5 h-5 rounded-md bg-green/15 border border-green/40 flex items-center justify-center"
                      >
                        <Check size={12} weight="bold" className="text-green" />
                      </button>
                      <span className="flex-1 text-sm text-t2 leading-snug line-through">{t.text}</span>
                      <button
                        onClick={() =>
                          setTodos(prev => (prev || []).filter(x => x.id !== t.id))
                        }
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-t3 hover:text-red p-1"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          {/* Task pill is portalled — see taskBar below */}
        </div>
      )}

      {/* Chat pill — portalled to body to escape will-change containing block */}
      {createPortal(
        <AnimatePresence>
          {isCurrentScreen && activeTab === 'chat' && viewMode === 'chat' && inputBar}
        </AnimatePresence>,
        document.body
      )}

      {/* Task pill — same fixed position as chat pill, slides in/out with tab changes */}
      {createPortal(
        <AnimatePresence>
          {isCurrentScreen && activeTab === 'tasks' && taskBar}
        </AnimatePresence>,
        document.body
      )}

      {/* Rename dialog */}
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
            <Button variant="ghost" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button onClick={handleRenameSession}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
