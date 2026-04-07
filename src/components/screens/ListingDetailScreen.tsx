import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Sparkle,
  ShoppingBag,
  Tag,
  TrendUp,
  Info,
  Copy,
  Check,
} from '@phosphor-icons/react'
import { callLLM } from '@/lib/llm-service'
import { cn } from '@/lib/utils'
import type { ScannedItem, ResalePlatform, AppSettings } from '@/types'

// ── Platform metadata ──────────────────────────────────────────────────────

const PLATFORMS: Array<{ id: ResalePlatform; label: string; fee: number; color: string }> = [
  { id: 'ebay',      label: 'eBay',       fee: 12.9, color: 'text-amber' },
  { id: 'mercari',   label: 'Mercari',    fee: 10,   color: 'text-red' },
  { id: 'poshmark',  label: 'Poshmark',   fee: 20,   color: 'text-pink-400' },
  { id: 'whatnot',   label: 'Whatnot',    fee: 8,    color: 'text-purple-400' },
  { id: 'facebook',  label: 'Facebook',   fee: 0,    color: 'text-blue-400' },
]

// ── Inline chat types ──────────────────────────────────────────────────────

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function formatMsg(text: string): string {
  let f = text
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

// ── Platform listing tab content ───────────────────────────────────────────

interface PlatformTabProps {
  platform: ResalePlatform
  item: ScannedItem
  onGenerate: (platform: ResalePlatform) => Promise<void>
  isGenerating: boolean
}

function PlatformTab({ platform, item, onGenerate, isGenerating }: PlatformTabProps) {
  const meta = PLATFORMS.find(p => p.id === platform)!
  const listing = item.optimizedListing?.platformListings?.[platform]
  const ebayListing = item.optimizedListing

  // For eBay, read from optimizedListing directly
  const isEbay = platform === 'ebay'
  const title = isEbay ? ebayListing?.title : listing?.title
  const description = isEbay ? ebayListing?.description : listing?.description
  const price = isEbay ? ebayListing?.price : listing?.price
  const condition = isEbay ? ebayListing?.condition : listing?.condition
  const shipping = isEbay ? ebayListing?.shippingCost : listing?.shippingCost
  const notes = isEbay ? undefined : listing?.platformNotes
  const hasListing = isEbay ? !!ebayListing : !!listing
  const seoScore = isEbay ? ebayListing?.seoScore : undefined

  const netPrice = price != null && meta.fee > 0
    ? price * (1 - meta.fee / 100)
    : price

  return (
    <div className="space-y-3 py-2">
      {/* Fee badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn('text-[10px] font-mono border-s3', meta.color)}>
          {meta.fee > 0 ? `${meta.fee}% fee` : 'No fee (local)'}
        </Badge>
        {price != null && netPrice != null && (
          <span className="text-[10px] text-t3 font-mono">
            List ${price.toFixed(2)} → net ~${netPrice.toFixed(2)}
          </span>
        )}
      </div>

      {hasListing ? (
        <div className="space-y-3">
          {/* Title */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-t2">Title</Label>
              {title && <CopyButton text={title} />}
            </div>
            <div className="text-sm text-t1 font-medium leading-snug bg-s1 rounded-md px-2.5 py-2 border border-s2">
              {title || '—'}
            </div>
            {title && (
              <span className="text-[10px] text-s4 font-mono">{title.length} chars</span>
            )}
            {isEbay && seoScore != null && <SEOScoreBar score={seoScore} />}
          </div>

          {/* Price */}
          {price != null && (
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs font-medium text-t2">List Price</Label>
                <div className="text-sm font-bold font-mono text-t1 bg-s1 rounded-md px-2.5 py-1.5 border border-s2">
                  ${price.toFixed(2)}
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs font-medium text-t2">After Fees</Label>
                <div className="text-sm font-bold font-mono text-green bg-green/5 rounded-md px-2.5 py-1.5 border border-green/20">
                  ${netPrice?.toFixed(2)}
                </div>
              </div>
              {shipping != null && (
                <div className="flex-1 space-y-1">
                  <Label className="text-xs font-medium text-t2">Shipping</Label>
                  <div className="text-sm font-mono text-t2 bg-s1 rounded-md px-2.5 py-1.5 border border-s2">
                    {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Condition */}
          {condition && (
            <div className="space-y-1">
              <Label className="text-xs font-medium text-t2">Condition</Label>
              <div className="text-xs text-t2 bg-s1 rounded-md px-2.5 py-1.5 border border-s2">{condition}</div>
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-t2">Description</Label>
                <CopyButton text={description} />
              </div>
              <ScrollArea className="h-28">
                <div className="text-xs text-t2 bg-s1 rounded-md px-2.5 py-2 border border-s2 whitespace-pre-wrap leading-relaxed">
                  {description}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Item Specifics (eBay) */}
          {isEbay && ebayListing?.itemSpecifics && Object.keys(ebayListing.itemSpecifics).length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-medium text-t2">Item Specifics</Label>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(ebayListing.itemSpecifics).slice(0, 8).map(([k, v]) => (
                  <div key={k} className="flex gap-1 text-[10px] bg-s1 rounded px-2 py-1 border border-s2">
                    <span className="text-s4 font-medium shrink-0">{k}:</span>
                    <span className="text-t2 truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Platform notes */}
          {notes && (
            <div className="flex gap-1.5 items-start p-2 bg-b1/10 border border-b1/20 rounded-md">
              <Info size={12} weight="bold" className="text-b1 shrink-0 mt-0.5" />
              <span className="text-[10px] text-t2 leading-relaxed">{notes}</span>
            </div>
          )}

          {/* Regen button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onGenerate(platform)}
            disabled={isGenerating}
            className="w-full h-7 text-[11px] border-s2 text-t2 hover:text-t1 hover:bg-s1"
          >
            {isGenerating
              ? <CircleNotch size={12} className="mr-1.5 animate-spin" />
              : <Sparkle size={12} className="mr-1.5" />
            }
            Regenerate {meta.label} listing
          </Button>
        </div>
      ) : (
        <div className="py-6 flex flex-col items-center gap-3">
          <ShoppingBag size={32} className="text-s3" />
          <div className="text-center">
            <p className="text-sm text-t2 font-medium">No {meta.label} listing yet</p>
            <p className="text-xs text-t3 mt-0.5">
              {isEbay ? 'Generate your eBay listing first' : `Tap below to adapt your eBay listing for ${meta.label}`}
            </p>
          </div>
          <Button
            onClick={() => onGenerate(platform)}
            disabled={isGenerating}
            className="bg-b1 hover:bg-b2 text-bg h-8 text-xs font-medium"
          >
            {isGenerating
              ? <CircleNotch size={13} className="mr-1.5 animate-spin" />
              : <Sparkle size={13} className="mr-1.5" />
            }
            Generate {meta.label} listing
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface ListingDetailScreenProps {
  item: ScannedItem
  onClose: () => void
  onSave: (itemId: string, updates: Partial<ScannedItem>) => void
  onOptimize: (itemId: string) => Promise<void>
  onOptimizeForPlatform: (itemId: string, platform: ResalePlatform) => Promise<void>
  settings?: AppSettings
}

export function ListingDetailScreen({
  item,
  onClose,
  onOptimize,
  onOptimizeForPlatform,
  settings,
}: ListingDetailScreenProps) {
  const [activeTab, setActiveTab] = useState<ResalePlatform>('ebay')
  const [generatingPlatform, setGeneratingPlatform] = useState<ResalePlatform | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatProcessing, setIsChatProcessing] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

    const apiKey = settings?.geminiApiKey || settings?.anthropicApiKey
    if (!apiKey) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'No API key configured. Add a Gemini or Anthropic key in Settings.',
      }])
      setIsChatProcessing(false)
      return
    }

    try {
      const response = await callLLM(text, {
        task: 'chat',
        geminiApiKey: settings?.geminiApiKey,
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

  const handleGenerate = useCallback(async (platform: ResalePlatform) => {
    setGeneratingPlatform(platform)
    try {
      if (platform === 'ebay') {
        await onOptimize(item.id)
      } else {
        await onOptimizeForPlatform(item.id, platform)
      }
    } finally {
      setGeneratingPlatform(null)
    }
  }, [item.id, onOptimize, onOptimizeForPlatform])

  const profitDisplay = item.profitMargin != null && isFinite(item.profitMargin)
    ? `${item.profitMargin >= 0 ? '+' : ''}${item.profitMargin.toFixed(0)}%`
    : null

  const marginColor = item.profitMargin != null && isFinite(item.profitMargin)
    ? item.profitMargin > 50 ? 'text-green' : item.profitMargin > 20 ? 'text-amber' : 'text-red'
    : 'text-s4'

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full h-[90dvh] p-0 bg-bg border-s2 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-s2 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}
            className="h-7 w-7 p-0 text-t3 hover:text-t1 -ml-1">
            <ArrowLeft size={16} weight="bold" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-t1 truncate">
              {item.productName || 'Unnamed Item'}
            </h2>
            <p className="text-[10px] text-t3 truncate">{item.category || 'Uncategorized'}</p>
          </div>
          {item.decision && (
            <Badge
              className={cn('text-[10px] font-bold shrink-0',
                item.decision === 'BUY' ? 'bg-green/20 text-green' :
                item.decision === 'PENDING' ? 'bg-amber/20 text-amber' :
                'bg-red/20 text-red'
              )}
            >
              {item.decision}
            </Badge>
          )}
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

            {/* Platform tabs */}
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as ResalePlatform)}>
              <TabsList className="w-full h-8 bg-s1 p-0.5 gap-0.5 rounded-lg">
                {PLATFORMS.map(p => (
                  <TabsTrigger
                    key={p.id}
                    value={p.id}
                    className={cn(
                      'flex-1 text-[10px] h-7 rounded-md font-medium transition-all',
                      'data-[state=active]:bg-bg data-[state=active]:shadow-sm',
                      activeTab === p.id ? p.color : 'text-t3'
                    )}
                  >
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {PLATFORMS.map(p => (
                <TabsContent key={p.id} value={p.id} className="mt-3 focus-visible:outline-none">
                  <PlatformTab
                    platform={p.id}
                    item={item}
                    onGenerate={handleGenerate}
                    isGenerating={generatingPlatform === p.id}
                  />
                </TabsContent>
              ))}
            </Tabs>
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
                    {[
                      'What\'s the resale value range?',
                      'Which platform should I list on?',
                      'Write a better title',
                      'Fill in item specifics',
                      'Is this a good buy?',
                    ].map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => { setChatInput(prompt); }}
                        className="text-[10px] px-2 py-1 rounded-full border border-s2 text-t3 hover:border-b1 hover:text-b1 transition-colors"
                      >
                        {prompt}
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
