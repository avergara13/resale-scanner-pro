import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  Robot,
  User,
  PaperPlaneRight,
  CircleNotch,
  Lightning,
  Tag,
  TrendUp,
  Copy,
  Check,
} from '@phosphor-icons/react'
import { callLLM } from '@/lib/llm-service'
import { cn } from '@/lib/utils'
import type { ScannedItem, AppSettings } from '@/types'

// ── Inline chat types ──────────────────────────────────────────────────────

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatMsg(text: string): string {
  // Escape HTML entities first so AI-generated markup/scripts cannot execute
  let f = escapeHtml(text)
  f = f.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-t1">$1</strong>')
  f = f.replace(/^[-•]\s+(.+)$/gm, '<li class="ml-3 mb-1 leading-relaxed">$1</li>')
  f = f.replace(/(<li.*<\/li>\s*)+/g, m => `<ul class="space-y-0.5 my-2">${m}</ul>`)
  f = f.replace(/\$(\d+(?:\.\d{2})?)/g, '<span class="font-bold text-green">$$$1</span>')
  f = f.replace(/\n{2,}/g, '<br/><br/>')
  return f
}

// ── SEO score bar ──────────────────────────────────────────────────────────

function SEOScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green' : score >= 50 ? 'bg-amber' : 'bg-red'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-t3 font-medium">SEO Score</span>
        <span className={cn('text-xs font-bold font-mono', score >= 75 ? 'text-green' : score >= 50 ? 'text-amber' : 'text-red')}>
          {score}/100
        </span>
      </div>
      <div className="h-1.5 bg-s2 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

// ── Copy button ────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <Button size="sm" variant="ghost" onClick={handleCopy}
      className={cn('h-6 w-6 p-0 text-s4 hover:text-t2', className)}>
      {copied ? <Check size={12} weight="bold" className="text-green" /> : <Copy size={12} />}
    </Button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface ListingDetailScreenProps {
  item: ScannedItem
  onClose: () => void
  onOptimize: (itemId: string) => Promise<void>
  settings?: AppSettings
  onEdit?: (itemId: string, updates: Partial<ScannedItem>) => void
  onPushToNotion?: (itemId: string) => Promise<void>
}

export function ListingDetailScreen({
  item,
  onClose,
  onOptimize,
  settings,
  onEdit,
  onPushToNotion,
}: ListingDetailScreenProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatProcessing, setIsChatProcessing] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleQuickAction = useCallback(async (actionType: 'title' | 'description' | 'specifics') => {
    const apiKey = settings?.geminiApiKey || settings?.openaiApiKey || settings?.anthropicApiKey
    if (!apiKey || isChatProcessing) return
    setIsChatProcessing(true)
    const productName = item.productName || 'Unknown product'
    const prompts = {
      title: `Write an optimized eBay title for: ${productName}. Max 80 chars, include brand, model, key specs. Return ONLY the title text.`,
      description: `Write a complete eBay description for: ${productName}, ${item.category || 'general'}. Include condition notes, key features, measurements if known.`,
      specifics: `List the key item specifics for eBay for: ${productName}. Format as "Label: Value" on separate lines.`,
    }
    try {
      const result = await callLLM(prompts[actionType], {
        task: 'chat',
        geminiApiKey: settings?.geminiApiKey,
        openaiApiKey: settings?.openaiApiKey,
        anthropicApiKey: settings?.anthropicApiKey,
        maxTokens: 600,
        temperature: 0.6,
      })
      if (actionType === 'title') {
        onEdit?.(item.id, { productName: result.trim().slice(0, 80) })
      } else if (actionType === 'description') {
        onEdit?.(item.id, { description: result.trim() })
      }
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: result,
      }])
      setChatCollapsed(false)
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'AI action failed — check your API key in Settings.',
      }])
    } finally {
      setIsChatProcessing(false)
    }
  }, [item.id, item.productName, item.category, settings?.geminiApiKey, isChatProcessing, onEdit])

  // Auto-scroll chat
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // Build item-context system prompt for the embedded agent
  const agentSystemPrompt = [
    'You are an expert resale listing agent for a professional resale business.',
    `Current item: "${item.productName || 'Unknown product'}"`,
    item.category ? `Category: ${item.category}` : '',
    `Purchase price: $${item.purchasePrice.toFixed(2)}`,
    item.estimatedSellPrice ? `Estimated sell price: $${item.estimatedSellPrice.toFixed(2)}` : 'Sell price: not set',
    item.description ? `Description: ${item.description}` : '',
    item.marketData?.researchSummary ? `Market research:\n${item.marketData.researchSummary}` : '',
    '',
    'Help the user research market comps, refine listing copy, determine best platform, set optimal price, and fill in item specifics.',
    'When citing prices, be specific. When writing titles or descriptions, stay within platform character limits.',
    'Platforms: eBay (12.9% fee, 80 char title), Mercari (10%, 80 chars), Poshmark (20%, 60 chars), Whatnot (8%, auction), Facebook Marketplace (0%, local).',
  ].filter(Boolean).join('\n')

  const handleSendChat = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || isChatProcessing) return

    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setChatInput('')
    setIsChatProcessing(true)

    const apiKey = settings?.geminiApiKey || settings?.openaiApiKey || settings?.anthropicApiKey
    if (!apiKey) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'No API key configured. Add a Gemini, OpenAI, or Anthropic key in Settings.',
      }])
      setIsChatProcessing(false)
      return
    }

    try {
      const response = await callLLM(text, {
        task: 'chat',
        geminiApiKey: settings?.geminiApiKey,
        openaiApiKey: settings?.openaiApiKey,
        anthropicApiKey: settings?.anthropicApiKey,
        systemPrompt: agentSystemPrompt,
        maxTokens: 800,
        temperature: 0.7,
      })
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'AI unavailable'}`,
      }])
    } finally {
      setIsChatProcessing(false)
    }
  }, [chatInput, isChatProcessing, agentSystemPrompt, settings])

  const profitDisplay = item.profitMargin != null && isFinite(item.profitMargin)
    ? `${item.profitMargin >= 0 ? '+' : ''}${item.profitMargin.toFixed(0)}%`
    : null

  const marginColor = item.profitMargin != null && isFinite(item.profitMargin)
    ? item.profitMargin > 50 ? 'text-green' : item.profitMargin > 20 ? 'text-amber' : 'text-red'
    : 'text-s4'

  return (
    <Dialog open onOpenChange={onClose}>
      {/* [&>button]:hidden suppresses shadcn's auto-injected DialogClose X button — ← is the sole close affordance */}
      <DialogContent className="max-w-lg w-full h-[90dvh] p-0 bg-bg border-s2 flex flex-col overflow-hidden [&>button]:hidden">
        {/* Header — 3-zone: back | title+badge | spacer */}
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-s2 shrink-0">
          {/* Back / close */}
          <Button variant="ghost" size="sm" onClick={onClose}
            className="h-8 w-8 p-0 text-t3 hover:text-t1 shrink-0 -ml-0.5 rounded-xl">
            <ArrowLeft size={17} weight="bold" />
          </Button>

          {/* Title block — grows, truncates gracefully */}
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-semibold text-t1 leading-tight truncate">
              {item.productName || 'Unnamed Item'}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[10px] text-t3 truncate">{item.category || 'Uncategorized'}</p>
              {item.decision && (
                <span className={cn(
                  'text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-full shrink-0',
                  item.decision === 'BUY'     ? 'bg-green/15 text-green' :
                  item.decision === 'MAYBE'   ? 'bg-amber/15 text-amber' :
                  item.decision === 'PENDING' ? 'bg-amber/15 text-amber' :
                                                'bg-red/15 text-red'
                )}>
                  {item.decision}
                </span>
              )}
            </div>
          </div>

          {/* Right spacer — keeps title centered visually */}
          <div className="h-8 w-8 shrink-0" />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 space-y-4">
            {/* Item summary strip */}
            <div className="flex gap-3">
              {(item.imageThumbnail || item.imageData) && (
                <img
                  src={item.imageThumbnail || item.imageData}
                  alt={item.productName || 'Item'}
                  className="w-20 h-20 object-cover object-center rounded-lg border border-s2 shrink-0"
                />
              )}
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-t3 font-mono">Cost</span>
                  <span className="text-sm font-bold font-mono text-t1">${item.purchasePrice.toFixed(2)}</span>
                  {item.estimatedSellPrice != null && item.estimatedSellPrice > 0 && (
                    <>
                      <span className="text-s4">→</span>
                      <span className="text-xs text-t3 font-mono">Sell</span>
                      <span className="text-sm font-bold font-mono text-t1">${item.estimatedSellPrice.toFixed(2)}</span>
                    </>
                  )}
                  {profitDisplay && (
                    <Badge className={cn('text-[10px] font-bold font-mono', marginColor, 'bg-transparent border-0 p-0')}>
                      ({profitDisplay})
                    </Badge>
                  )}
                </div>
                {item.marketData?.researchSummary && (
                  <div className="flex items-center gap-1 text-[10px] text-green">
                    <TrendUp size={10} weight="bold" />
                    Market research available
                  </div>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Tag size={10} className="text-s4 shrink-0" />
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] text-t3 bg-s1 border border-s2 rounded px-1.5 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* eBay listing */}
            {item.optimizedListing ? (
              <div className="space-y-3">
                {/* Title */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-t2">eBay Title</Label>
                    {item.optimizedListing.title && <CopyButton text={item.optimizedListing.title} />}
                  </div>
                  <div className="text-sm text-t1 font-medium leading-snug bg-s1 rounded-md px-2.5 py-2 border border-s2">
                    {item.optimizedListing.title || '—'}
                  </div>
                  {item.optimizedListing.title && (
                    <span className="text-[10px] text-s4 font-mono">{item.optimizedListing.title.length} chars</span>
                  )}
                  {item.optimizedListing.seoScore != null && <SEOScoreBar score={item.optimizedListing.seoScore} />}
                </div>

                {/* Price */}
                {item.optimizedListing.price != null && (
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs font-medium text-t2">List Price</Label>
                      <div className="text-sm font-bold font-mono text-t1 bg-s1 rounded-md px-2.5 py-1.5 border border-s2">
                        ${item.optimizedListing.price.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs font-medium text-t2">Net (−12.9%)</Label>
                      <div className="text-sm font-bold font-mono text-green bg-green/5 rounded-md px-2.5 py-1.5 border border-green/20">
                        ${(item.optimizedListing.price * 0.871).toFixed(2)}
                      </div>
                    </div>
                    {item.optimizedListing.shippingCost != null && (
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs font-medium text-t2">Shipping</Label>
                        <div className="text-sm font-mono text-t2 bg-s1 rounded-md px-2.5 py-1.5 border border-s2">
                          {item.optimizedListing.shippingCost === 0 ? 'Free' : `$${item.optimizedListing.shippingCost.toFixed(2)}`}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Condition */}
                {item.optimizedListing.condition && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-t2">Condition</Label>
                    <div className="text-xs text-t2 bg-s1 rounded-md px-2.5 py-1.5 border border-s2">{item.optimizedListing.condition}</div>
                  </div>
                )}

                {/* Description */}
                {item.optimizedListing.description && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-t2">Description</Label>
                      <CopyButton text={item.optimizedListing.description} />
                    </div>
                    <ScrollArea className="h-28">
                      <div className="text-xs text-t2 bg-s1 rounded-md px-2.5 py-2 border border-s2 whitespace-pre-wrap leading-relaxed">
                        {item.optimizedListing.description}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Item Specifics */}
                {item.optimizedListing.itemSpecifics && Object.keys(item.optimizedListing.itemSpecifics).length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-t2">Item Specifics</Label>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(item.optimizedListing.itemSpecifics).slice(0, 8).map(([k, v]) => (
                        <div key={k} className="flex gap-1 text-[10px] bg-s1 rounded px-2 py-1 border border-s2">
                          <span className="text-s4 font-medium shrink-0">{k}:</span>
                          <span className="text-t2 truncate">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optimize + List buttons — Apple pill style */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOptimize(item.id)}
                    className="flex-1 h-9 text-xs border-s2 text-t2 hover:text-t1 hover:bg-s1 rounded-full"
                  >
                    <Lightning size={13} className="mr-1.5" />
                    Optimize
                  </Button>
                  {onPushToNotion && item.listingStatus !== 'published' && (
                    <Button
                      size="sm"
                      onClick={() => onPushToNotion(item.id)}
                      className="flex-1 h-9 text-xs font-bold text-white rounded-full"
                      style={{ background: 'linear-gradient(135deg, var(--green) 0%, color-mix(in oklch, var(--green) 80%, var(--b1)) 100%)' }}
                    >
                      List
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center gap-3">
                <div className="text-center">
                  <p className="text-sm text-t2 font-medium">No eBay listing yet</p>
                  <p className="text-xs text-t3 mt-0.5">Generate your eBay listing to see details here</p>
                </div>
                <Button
                  onClick={() => onOptimize(item.id)}
                  className="bg-b1 hover:bg-b2 text-bg h-9 text-xs font-medium rounded-full"
                >
                  <Lightning size={13} className="mr-1.5" />
                  Optimize
                </Button>
              </div>
            )}
          </div>

          {/* Embedded agent panel */}
          <div className="border-t border-s2 mx-0">
            {/* Agent header */}
            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-s1 transition-colors"
              onClick={() => setChatCollapsed(c => !c)}
            >
              <Robot size={14} weight="fill" className="text-b1 shrink-0" />
              <span className="text-xs font-semibold text-t1 flex-1">AI Research Agent</span>
              <span className="text-[10px] text-t3">
                {chatCollapsed ? 'Expand' : 'Collapse'}
              </span>
            </button>

            {!chatCollapsed && (
              <div className="px-4 pb-4 space-y-3">
                {/* Quick prompts */}
                {messages.length === 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { label: "What's the resale value range?", action: 'chat' as const },
                      { label: 'Which platform should I list on?', action: 'chat' as const },
                      { label: 'Write a better title', action: 'title' as const },
                      { label: 'Fill in item specifics', action: 'specifics' as const },
                      { label: 'Is this a good buy?', action: 'chat' as const },
                    ]).map(({ label, action }) => (
                      <button
                        key={label}
                        disabled={isChatProcessing}
                        onClick={() => {
                          if (action === 'title') {
                            handleQuickAction('title')
                          } else if (action === 'specifics') {
                            handleQuickAction('specifics')
                          } else {
                            setChatInput(label)
                          }
                        }}
                        className="text-[10px] px-2 py-1 rounded-full border border-s2 text-t3 hover:border-b1 hover:text-b1 transition-colors disabled:opacity-40"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Messages */}
                {messages.length > 0 && (
                  <ScrollArea className="h-40">
                    <div className="space-y-2 pr-2">
                      {messages.map(msg => (
                        <div key={msg.id}
                          className={cn('flex gap-2 text-xs', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                          {msg.role === 'assistant' && (
                            <Robot size={14} weight="fill" className="text-b1 shrink-0 mt-0.5" />
                          )}
                          <div
                            className={cn(
                              'max-w-[85%] rounded-lg px-2.5 py-1.5 leading-relaxed',
                              msg.role === 'user'
                                ? 'bg-b1 text-bg'
                                : 'bg-s1 text-t1 border border-s2'
                            )}
                            dangerouslySetInnerHTML={msg.role === 'assistant'
                              ? { __html: formatMsg(msg.content) }
                              : undefined}
                          >
                            {msg.role === 'user' ? msg.content : undefined}
                          </div>
                          {msg.role === 'user' && (
                            <User size={14} className="text-s4 shrink-0 mt-0.5" />
                          )}
                        </div>
                      ))}
                      {isChatProcessing && (
                        <div className="flex gap-2 items-center text-xs text-t3">
                          <Robot size={14} weight="fill" className="text-b1 shrink-0" />
                          <CircleNotch size={12} className="animate-spin text-b1" />
                          <span>Thinking…</span>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                )}

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
                    placeholder="Ask about this item…"
                    className="flex-1 h-8 text-xs bg-bg border-s2 text-t1 placeholder:text-s3"
                    disabled={isChatProcessing}
                  />
                  <Button
                    size="sm"
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || isChatProcessing}
                    className="h-8 w-8 p-0 bg-b1 hover:bg-b2 text-bg shrink-0"
                  >
                    <PaperPlaneRight size={14} weight="bold" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
