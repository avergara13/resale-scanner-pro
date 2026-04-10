import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import {
  Robot,
  Sparkle,
  Plus,
  Trash,
  DotsThreeVertical,
  PencilSimple,
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
  ListChecks,
  ChatCircle,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
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
import { analyzeSoldBatch } from '@/lib/shipping-intelligence'

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
const AGENT_SYSTEM_INSTRUCTIONS = `You are a resale business AI agent with full app state access. You help research products, analyze profit, create eBay listings, manage sessions, and track sold items.

## Business Model
- Primary platform: eBay (seller ships from Orlando, FL 32806)
- Fee structure: 12.9% eBay FVF + 3% Promoted Listings ad fee + $0.30/order
- Materials cost: $0.75 per item (box, tape, poly mailer)
- Shipping: ~$5-8 average (seller pays, offers free shipping)
- Total effective cost: ~15.9% + ~$6.05 fixed per sale
- All profit figures you report must be NET (after ALL fees, shipping, and materials)
- The user offers 1-day shipping — flag any items sold >12 hours ago as urgent

## Commands
- "Research [product]" — live marketplace search across eBay, Mercari, Poshmark, Whatnot, Amazon, Walmart, Google Shopping
- "Create listings" / "Full pipeline" — optimize + publish BUY items
- "Push to Notion" — publish ready listings to Notion database
- "Mark [item] sold on [marketplace] for $X" — record a sale
- "Add tracking [number]" / "Mark shipped" — update shipping status
- "Start/End session" — manage scanning sessions
- "Set goal $X" / "Set location [name]" — session settings

## Anti-Hallucination Rules
- NEVER invent prices. If you don't have data, say "I don't have current market data for this item — let me research it."
- When reporting sell-through rates, distinguish between HIGH (>70%), MEDIUM (40-70%), LOW (<40%).
- Base ALL pricing recommendations on actual SOLD/completed listing data — never on asking prices or MSRP.
- When uncertain about a value, flag it as "estimated" and explain your reasoning.
- Prefer conservative estimates. Overestimating profit margins costs the business real money.

## Live Shipping Context (liveShipping object in state)
When \`liveShipping\` is present in state, it is the SOURCE OF TRUTH for sold items — it comes directly from the Notion Sales DB populated by email parsing (WF-01). It includes:
- \`needsLabel\`, \`readyToShip\`, \`shipped\` — counts by status
- \`overdue\` + \`urgent[]\` — items sold >48h ago still not shipped (critical!)
- \`estimatedShippingCostOutstanding\` — dollars of shipping you still need to buy
- \`totalNetIncome\` — after platform fees (the real take-home)
- \`carrierMix\` — recommended carriers for outstanding shipments

When asked about shipping, sold items, or overdue orders:
1. ALWAYS reference liveShipping if present — don't use the legacy \`sold\` object
2. If urgent[] has items, call them out by name and hours overdue
3. Recommend the best carrier from carrierMix rather than guessing
4. If liveShipping is null, explain that the Notion Sales DB isn't syncing and suggest using the manual "Log Sale" option

## Rules
- Answer from the app state below — never say you can't access it.
- Reference items by name, price, margin, and category.
- Be proactive: suggest goals, flag unanalyzed items, warn about overdue shipping.
- When calculating profit, always include: purchase price + shipping + materials ($0.75) + eBay fee (12.9%) + ad fee (3%) + $0.30 order fee.
- Offline resilience: if the user says "no internet" or "API down", remind them manual Log Sale, manual queue editing, and manual shipping status all work without any API.` as const

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
  /** Legacy: items from the local queue marked as sold (ScannedItem shape) */
  soldItems?: ScannedItem[]
  /** Live sold feed from Notion Sales DB (populated by WF-01 email parsing) */
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
  onOpenCamera?: () => void
  onStartSession?: () => void
  onEndSession?: () => void
  onEditSession?: (sessionId: string, updates: Partial<Session>) => void
  allSessions?: Session[]
  scanHistory?: ScannedItem[]
  profitGoals?: ProfitGoal[]
}

const EMPTY_CHAT_SESSIONS: ChatSession[] = []

export function AgentScreen({ queueItems = [], soldItems = [], liveSoldItems = [], settings, pendingMessage, onPendingMessageHandled, onProcessingChange, onCreateListing, onOptimizeItem, onPushToNotion, onBatchAnalyze, onEditItem, onMarkAsSold, onMarkShipped, onNavigateToQueue, onOpenCamera, onStartSession, onEndSession, onEditSession, allSessions = [], scanHistory = [], profitGoals = [] }: AgentScreenProps) {
  const [currentSession] = useKV<Session | undefined>('currentSession', undefined)
  const sessionId = currentSession?.id
  const chatKey = useMemo(() => sessionId ? `chat-sessions-${sessionId}` : 'chat-sessions-global', [sessionId])
  const activeKey = useMemo(() => sessionId ? `active-chat-session-${sessionId}` : 'active-chat-session-global', [sessionId])
  const [chatSessions, setChatSessions] = useKV<ChatSession[]>(chatKey, EMPTY_CHAT_SESSIONS)
  const [activeSessionId, setActiveSessionId] = useKV<string | null>(activeKey, null)
  const [todos, setTodos] = useKV<SharedTodo[]>('shared-todos', EMPTY_TODOS)
  const [viewMode, setViewMode] = useState<'list' | 'chat'>('list')
  const [agentTab, setAgentTab] = useState<'chat' | 'scan' | 'task'>('chat')
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [taskInput, setTaskInput] = useState('')
  const [showTaskInput, setShowTaskInput] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
    setViewMode('chat')
  }, [setChatSessions, setActiveSessionId])

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

      // Dynamic context — JSON-encoded to prevent prompt injection from user-controlled strings
      // (item names, session names, task text are all user-editable and could contain adversarial content)
      const dynamicState = {
        scope: sessionScope,
        listings: {
          total: queueStats.total,
          buy: queueStats.buy,
          pass: queueStats.pass,
          pending: queueStats.pending,
          potentialProfit: Number((queueStats.totalProfit || 0).toFixed(2)),
          recentItems: sessionItems.slice(-3).map(i => ({
            name: i.productName || 'Unknown',
            buyPrice: Number(i.purchasePrice.toFixed(2)),
            sellPrice: Number((i.estimatedSellPrice || 0).toFixed(2)),
            margin: Number((i.profitMargin || 0).toFixed(1)),
            decision: i.decision,
            status: i.listingStatus || 'not-started',
            category: i.category || null,
          })),
        },
        sold: {
          total: soldStats.total,
          revenue: Number(soldStats.revenue.toFixed(2)),
          netProfit: Number(soldStats.netProfit.toFixed(2)),
          needsShipping: soldStats.needsShipping,
          recentSold: soldItems.slice(0, 5).map(i => {
            const { netProfit: np } = settings ? getNetProfit(i, settings) : { netProfit: (i.soldPrice || 0) - i.purchasePrice }
            return {
              name: i.productName || 'Unknown',
              soldPrice: Number((i.soldPrice || 0).toFixed(2)),
              soldOn: i.soldOn || '?',
              netProfit: Number(np.toFixed(2)),
              status: i.listingStatus,
            }
          }),
        },
        // Live Notion Sales DB feed — populated by WF-01 email parsing, is the
        // source of truth for real shipping workflow (what needs labels, what's overdue)
        liveShipping: liveSoldItems.length > 0 ? (() => {
          const analysis = analyzeSoldBatch(liveSoldItems)
          return {
            totalLiveSales: liveSoldItems.length,
            needsLabel: analysis.needsLabelCount,
            readyToShip: analysis.readyCount,
            shipped: analysis.shippedCount,
            overdue: analysis.overdueCount,
            estimatedShippingCostOutstanding: analysis.totalPotentialShippingCost,
            totalRevenue: analysis.totalRevenue,
            totalPlatformFees: analysis.totalFees,
            totalNetIncome: analysis.totalNetIncome,
            carrierMix: analysis.recommendedCarrierMix,
            urgent: analysis.urgentItems,
          }
        })() : null,
        activeSession: currentSession?.active ? {
          name: currentSession.name || 'Unnamed',
          scans: currentSession.itemsScanned,
          buy: currentSession.buyCount,
          pass: currentSession.passCount,
          profit: Number(currentSession.totalPotentialProfit.toFixed(2)),
          goal: currentSession.profitGoal || null,
          goalProgress: currentSession.profitGoal ? Math.round((currentSession.totalPotentialProfit / currentSession.profitGoal) * 100) : null,
          location: currentSession.location?.name || null,
        } : null,
        pastSessions: allSessions.slice(-3).map(s => ({
          name: s.name || new Date(s.startTime).toLocaleDateString(),
          scans: s.itemsScanned,
          buy: s.buyCount,
          profit: Number(s.totalPotentialProfit.toFixed(2)),
          durationMin: Math.round(((s.endTime || Date.now()) - s.startTime) / 60000),
          location: s.location?.name || null,
          goal: s.profitGoal || null,
        })),
        goals: profitGoals.filter(g => g.active).map(g => ({
          type: g.type,
          target: Number(g.targetAmount.toFixed(2)),
          period: `${new Date(g.startDate).toLocaleDateString()} - ${new Date(g.endDate).toLocaleDateString()}`,
        })),
        tasks: pendingTodos.slice(0, 10).map(t => ({ text: t.text, createdBy: t.createdBy })),
        settings: {
          minMargin: settings?.minProfitMargin ?? 30,
          shipping: settings?.defaultShippingCost ?? 5,
          ebayFee: settings?.ebayFeePercent ?? 12.9,
          adFee: settings?.ebayAdFeePercent ?? 3.0,
          materials: settings?.shippingMaterialsCost ?? 0.75,
          shipFromZip: '32806',
        },
      }
      const dynamicContext = `## Current App State\n\`\`\`json\n${JSON.stringify(dynamicState, null, 2)}\n\`\`\``

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
      setIsProcessing(false)
    }
  }, [input, isProcessing, activeSessionId, setChatSessions, setActiveSessionId, queueStats, settings, sessionItems, soldItems, liveSoldItems, chatMessages, pendingTodos, setTodos, onOptimizeItem, onPushToNotion, onBatchAnalyze, onEditItem, onMarkAsSold, onMarkShipped, onOpenCamera, onStartSession, onEndSession, onEditSession, currentSession, allSessions, profitGoals])

  // Broadcast processing state to parent (for external widget indicators)
  useEffect(() => {
    onProcessingChange?.(isProcessing)
  }, [isProcessing, onProcessingChange])

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
            {/* Tab bar — matches Listings page tab-bar / tab-btn style */}
            <div className="px-3 pt-3 pb-2 bg-fg border-b border-s1">
              <div className="tab-bar">
                <button onClick={() => setAgentTab('chat')} className={cn('tab-btn', agentTab === 'chat' && 'active')}>
                  <span>💬 Chat</span>
                </button>
                <button onClick={() => setAgentTab('scan')} className={cn('tab-btn', agentTab === 'scan' && 'active')}>
                  <span>📷 Scan {queueItems.filter(i => i.decision === 'BUY' && (!i.listingStatus || i.listingStatus === 'not-started')).length > 0 ? `(${queueItems.filter(i => i.decision === 'BUY' && (!i.listingStatus || i.listingStatus === 'not-started')).length})` : ''}</span>
                </button>
                <button onClick={() => setAgentTab('task')} className={cn('tab-btn', agentTab === 'task' && 'active')}>
                  <span>✅ Task {pendingTodos.length > 0 ? `(${pendingTodos.length})` : ''}</span>
                </button>
              </div>
            </div>

            {/* ── CHAT TAB ── */}
            {agentTab === 'chat' && (
            <ScrollArea className="flex-1">
              <div ref={pullToRefresh.containerRef} className="py-4 px-4 space-y-5">
                {/* Quick Actions + New Chat */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">Quick Actions</div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {/* New Chat — first in the row */}
                    <button
                      onClick={handleCreateSession}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-b1 to-b2 rounded-xl text-xs font-bold text-white active:scale-95 transition-all"
                    >
                      <Plus size={12} weight="bold" />
                      <span>New Chat</span>
                    </button>
                    {QUICK_ACTIONS.map(action => (
                      <button
                        key={action.label}
                        onClick={() => handleQuickAction(action.prompt)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-fg border border-s1 rounded-xl text-xs font-bold text-t1 active:scale-95 transition-all"
                      >
                        <span>{action.emoji}</span>
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversation List */}
                {sortedSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 w-full min-h-[45vh]">
                    <button
                      className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-b1 to-b2 rounded-2xl mb-4 active:scale-95 transition-transform"
                    >
                      <Sparkle size={32} weight="fill" className="text-white" />
                    </button>
                    <h2 className="text-xl font-bold text-t1 mb-2 text-center">Welcome to Agent</h2>
                    <p className="text-sm text-t3 max-w-xs text-center">Start a conversation below</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">
                      <ChatCircle size={12} className="inline mr-1" />
                      Conversations
                    </div>
                    <div className="space-y-2">
                      {sortedSessions.map(session => (
                        <button
                          key={session.id}
                          onClick={() => handleSwitchSession(session.id)}
                          className="w-full p-3.5 bg-fg/90 border border-s2/60 rounded-2xl text-left active:scale-[0.97] transition-all shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-sm font-bold text-t1 truncate">{session.name}</span>
                            <span className="text-[9px] text-t3 flex-shrink-0">{relativeTime(session.lastMessageAt)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-t3 truncate flex-1">{lastMessagePreview(session)}</p>
                            <span className="text-[9px] text-t3 flex-shrink-0">{session.messages.length} msg{session.messages.length !== 1 ? 's' : ''}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            )}

            {/* ── SCAN TAB — BUY queue awaiting listing ── */}
            {agentTab === 'scan' && (() => {
              const buyQueue = queueItems.filter(i => i.decision === 'BUY' && (!i.listingStatus || i.listingStatus === 'not-started'))
              const readyItems = queueItems.filter(i => i.decision === 'BUY' && i.listingStatus && i.listingStatus !== 'not-started' && i.listingStatus !== 'sold')
              return (
              <ScrollArea className="flex-1">
                <div className="py-3 px-3 space-y-3">
                  {buyQueue.length === 0 && readyItems.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-3xl mb-3">📷</div>
                      <h2 className="text-base font-bold text-t1 mb-1">Queue is clear</h2>
                      <p className="text-xs text-t3">Scan items to build your listing queue</p>
                    </div>
                  ) : (
                    <>
                      {buyQueue.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">
                            📥 Needs Listing ({buyQueue.length})
                          </div>
                          <div className="space-y-2">
                            {buyQueue.slice().reverse().map(item => (
                              <div key={item.id} className="p-3.5 bg-fg/90 border border-s2/60 rounded-2xl shadow-sm">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <span className="text-sm font-semibold text-t1 truncate flex-1">
                                    {item.productName || 'Unknown item'}
                                  </span>
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-green/15 text-green flex-shrink-0">BUY</span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-t3">
                                  <span>Cost: <span className="text-t1 font-semibold">${item.purchasePrice.toFixed(2)}</span></span>
                                  {item.estimatedSellPrice ? (
                                    <span>Est sell: <span className="text-t1 font-semibold">${item.estimatedSellPrice.toFixed(0)}</span></span>
                                  ) : null}
                                  {item.profitMargin ? (
                                    <span className={item.profitMargin >= 30 ? 'text-green font-semibold' : 'text-t2'}>
                                      {item.profitMargin.toFixed(0)}% margin
                                    </span>
                                  ) : null}
                                </div>
                                {item.category && (
                                  <div className="mt-1 text-[9px] text-t3">{item.category}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {readyItems.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">
                            📋 In Listings ({readyItems.length})
                          </div>
                          <div className="space-y-2">
                            {readyItems.slice().reverse().map(item => (
                              <div key={item.id} className="p-2.5 bg-fg/50 border border-s1/50 rounded-xl opacity-70">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-medium text-t2 truncate flex-1">
                                    {item.productName || 'Unknown item'}
                                  </span>
                                  <span className="text-[9px] text-t3 capitalize flex-shrink-0">{item.listingStatus}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
              )
            })()}

            {/* ── TASK TAB ── */}
            {agentTab === 'task' && (
            <ScrollArea className="flex-1">
              <div className="py-4 px-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-t3 flex items-center gap-1.5">
                    <ListChecks size={12} /> Tasks
                    {pendingTodos.length > 0 && (
                      <span className="text-[8px] bg-b1/15 text-b1 px-1.5 py-0.5 rounded-md font-black">{pendingTodos.length}</span>
                    )}
                  </div>
                  <button onClick={() => setShowTaskInput(!showTaskInput)} className="text-[10px] text-b1 font-bold">
                    {showTaskInput ? 'Done' : '+ Add'}
                  </button>
                </div>
                {showTaskInput && (
                  <form onSubmit={(e) => { e.preventDefault(); if (taskInput.trim()) { setTodos(prev => [...(prev || []), { id: Date.now().toString(), text: taskInput.trim(), completed: false, createdBy: 'user' as const, createdAt: Date.now() }]); setTaskInput('') } }} className="flex gap-2">
                    <Input value={taskInput} onChange={e => setTaskInput(e.target.value)} placeholder="Add a task..." className="flex-1 h-8 text-xs" autoFocus />
                    <Button type="submit" size="sm" disabled={!taskInput.trim()} className="h-8 px-3 text-xs">Add</Button>
                  </form>
                )}
                {pendingTodos.length === 0 && !showTaskInput ? (
                  <div className="text-center py-12">
                    <div className="text-3xl mb-3">✅</div>
                    <h2 className="text-base font-bold text-t1 mb-1">No tasks yet</h2>
                    <p className="text-xs text-t3">Tap "+ Add" to create a task, or ask the agent to add one</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingTodos.map(t => (
                      <div key={t.id} className="flex items-center gap-2 py-2 px-3 bg-fg rounded-xl border border-s1 group">
                        <button onClick={() => setTodos(prev => (prev || []).map(x => x.id === t.id ? { ...x, completed: true } : x))} className="w-5 h-5 rounded-full border-2 border-s2 flex items-center justify-center flex-shrink-0 hover:border-b1 active:bg-b1/10 transition-colors">
                        </button>
                        <span className="text-sm text-t1 flex-1">{t.text}</span>
                        <span className="text-[8px] text-t3 uppercase flex-shrink-0">{t.createdBy}</span>
                        <button onClick={() => setTodos(prev => (prev || []).filter(x => x.id !== t.id))} className="text-t3 hover:text-red transition-colors p-1">
                          <Trash size={13} />
                        </button>
                      </div>
                    ))}
                    {completedTodos.length > 0 && (
                      <div className="pt-2 border-t border-s1">
                        <div className="text-[10px] text-t3 mb-2 font-semibold">{completedTodos.length} completed</div>
                        {completedTodos.map(t => (
                          <div key={t.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg opacity-50">
                            <div className="w-5 h-5 rounded-full bg-b1/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-[8px] text-b1">✓</span>
                            </div>
                            <span className="text-xs text-t3 line-through flex-1">{t.text}</span>
                            <button onClick={() => setTodos(prev => (prev || []).filter(x => x.id !== t.id))} className="text-t3 hover:text-red transition-colors p-1">
                              <Trash size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
            )}

            {/* Spacer so last content scrolls above the floating input bar */}
            {agentTab === 'chat' && <div className="h-16" />}
          </motion.div>
        ) : (
          <motion.div
            key="agent-chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Chat header with back button */}
            <div className="flex items-center gap-3 px-4 py-3 bg-fg/85 backdrop-blur-2xl border-b border-s1/40">
              <button onClick={() => setViewMode('list')} className="p-1.5 -ml-1 rounded-lg active:bg-s1 transition-colors">
                <ArrowLeft size={20} weight="bold" className="text-t1" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-t1 truncate">{activeSession?.name || 'Chat'}</div>
                <div className="text-[10px] text-t3">{chatMessages.length} message{chatMessages.length !== 1 ? 's' : ''}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg hover:bg-s1 transition-colors">
                    <DotsThreeVertical size={20} weight="bold" className="text-t3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => activeSessionId && handleOpenRenameDialog(activeSessionId)}>
                    <PencilSimple size={16} className="mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => activeSessionId && handleDeleteSession(activeSessionId)}
                    className="text-red"
                  >
                    <Trash size={16} className="mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div ref={pullToRefresh.containerRef} className="py-4 space-y-4">
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

            {/* Spacer so messages scroll above the floating input bar */}
            <div className="h-16 flex-shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>

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
