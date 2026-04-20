import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Camera, Plus, Trash, CheckCircle, Warning, XCircle, CircleNotch, Tag, CurrencyDollar, Truck, Package, Lightning, Info, CaretDown } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import type { ScannedItem, OptimizedListing, AppSettings } from '@/types'

// ── Canonical Notion condition options (must match DB exactly) ──────────────
const CONDITION_OPTIONS = [
  'New – Sealed',
  'New – Open Box',
  'Used – Like New',
  'Used – Very Good',
  'Used – Good',
  'Used – Acceptable',
  'For Parts / Repair',
  'New',
] as const

const SHIPPING_STRATEGY_OPTIONS = [
  'USPS Ground Advantage',
  'USPS Priority Mail',
  'FedEx Ground',
  'UPS Ground',
  'Local Pickup Only',
]

const DEPARTMENT_OPTIONS = ['N/A', 'Men', 'Women', 'Unisex', 'Boys', 'Girls', 'Youth']

// ── Break-even helper (mirrors server.js formula) ────────────────────────────
function computeBreakEven(purchasePrice: number, weightOzNum: number): number {
  const shipping = weightOzNum <= 0 ? 7.90 : weightOzNum <= 15.99 ? 4.19 : weightOzNum <= 32 ? 7.90 : 12.40
  const combinedFeeRate = (13.25 + 3.0) / 100
  return (purchasePrice + shipping + 0.75 + 0.30) / (1 - combinedFeeRate)
}

function computeNetProfit(price: number, purchasePrice: number, weightOzNum: number): number {
  const shipping = weightOzNum <= 0 ? 7.90 : weightOzNum <= 15.99 ? 4.19 : weightOzNum <= 32 ? 7.90 : 12.40
  const ebayFee = price * 0.1325
  const adFee = price * 0.03
  return price - purchasePrice - shipping - 0.75 - 0.30 - ebayFee - adFee
}

// ── Gate types ───────────────────────────────────────────────────────────────
interface GateItem {
  id: string
  label: string
  pass: boolean
}

interface GateResult {
  required: GateItem[]
  warnings: GateItem[]
  allRequiredPass: boolean
}

// ── ListingBuilder state ──────────────────────────────────────────────────────
interface ListingBuilderState {
  title: string
  subtitle: string
  subtitleEnabled: boolean
  condition: string
  conditionDescription: string
  description: string
  brand: string
  model: string
  sku: string
  size: string
  color: string
  department: string
  material: string
  upc: string
  ebayCategoryId: string
  itemSpecifics: Array<{ key: string; value: string }>
  price: string
  bestOfferEnabled: boolean
  autoAccept: string
  autoDecline: string
  shippingStrategy: string
  weightOz: string
  packageLengthIn: string
  packageWidthIn: string
  packageHeightIn: string
  freeShipping: boolean
  photoUrls: string[]
  compLow: number | null
  compHigh: number | null
}

// ── Props ────────────────────────────────────────────────────────────────────
interface ListingBuilderProps {
  item: ScannedItem
  initialListing?: OptimizedListing
  settings: AppSettings
  onBack: () => void
  onPushed: (itemId: string, listingId: string, listingUrl: string, notionPageId: string) => void
  onEditPhotos?: (item: ScannedItem) => void
  /** Upload raw base64/data-URL photos to storage, return public URLs */
  onUploadPhotos?: (photos: string[], sku: string) => Promise<string[]>
  /** Trigger AI optimization from within ListingBuilder */
  onOptimize?: (itemId: string) => Promise<void>
  /** Open the gate drawer immediately on mount (quick-list from queue card) */
  initialGateOpen?: boolean
  /** 'browse' = view/edit, 'list' = intent to push (different back behavior) */
  mode?: 'browse' | 'list'
}

// ── Gate function ────────────────────────────────────────────────────────────
function runGate(state: ListingBuilderState, purchasePrice: number): GateResult {
  const priceNum = parseFloat(state.price) || 0
  const weightOzNum = parseFloat(state.weightOz) || 0
  const breakEven = computeBreakEven(purchasePrice, weightOzNum)

  const required: GateItem[] = [
    { id: 'title', label: 'Title present and ≤80 chars', pass: !!state.title.trim() && state.title.length <= 80 },
    { id: 'title-pipe', label: 'No pipe symbols (|) in title', pass: !state.title.includes('|') },
    { id: 'condition', label: 'Condition set', pass: !!state.condition },
    { id: 'description', label: 'Description ≥400 chars', pass: state.description.length >= 400 },
    { id: 'photo', label: 'At least 1 photo', pass: state.photoUrls.length >= 1 },
    { id: 'price', label: 'Listing Price > 0', pass: priceNum > 0 },
    { id: 'price-breakeven', label: `Price > Break Even ($${breakEven.toFixed(2)})`, pass: priceNum > breakEven },
    { id: 'category', label: 'eBay category set (not "Other")', pass: !!state.ebayCategoryId && state.ebayCategoryId !== '99' },
    { id: 'brand', label: 'Brand not blank', pass: !!state.brand.trim() },
  ]

  const warnings: GateItem[] = [
    { id: 'upc', label: 'No UPC/EAN — catalog match reduced', pass: !!state.upc.trim() },
    { id: 'subtitle', label: 'No subtitle — search visibility reduced', pass: !state.subtitleEnabled || !!state.subtitle.trim() },
    { id: 'comps', label: 'No comp data — price unverified', pass: state.compLow != null || state.compHigh != null },
    { id: 'specifics', label: 'Item Specifics empty', pass: state.itemSpecifics.some(s => s.key.trim() && s.value.trim()) },
    { id: 'photos-count', label: 'Only 1 photo (eBay recommends 8+)', pass: state.photoUrls.length >= 8 },
  ]

  return { required, warnings, allRequiredPass: required.every(r => r.pass) }
}

// ── Section header component ─────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-5 pb-2">
      <span className="text-t3">{icon}</span>
      <span className="text-[11px] font-semibold text-t3 uppercase tracking-wide">{title}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ListingBuilder({
  item,
  initialListing,
  settings: _settings,
  onBack,
  onPushed,
  onEditPhotos,
  onOptimize,
  initialGateOpen,
  mode = 'browse',
}: ListingBuilderProps) {
  // ── Initialise state from item + optimizedListing ──────────────────────────
  const [state, setState] = useState<ListingBuilderState>(() => {
    const l = initialListing
    const existingSpecifics = l?.itemSpecifics
      ? Object.entries(l.itemSpecifics)
          .filter(([k, v]) => k && v && v !== 'N/A' && v !== 'null')
          .map(([k, v]) => ({ key: k, value: v }))
      : []
    const brandFallback = l?.itemSpecifics?.['Brand']
      || item.productName?.match(/^([A-Z][a-zA-Z&]{1,19})(?:\s|$)/)?.[1]
      || ''

    const priceStr = l?.price != null ? String(l.price) : item.estimatedSellPrice != null ? String(item.estimatedSellPrice) : ''
    const priceNum = parseFloat(priceStr) || 0

    return {
      title: (l?.title || item.productName || '').slice(0, 80),
      subtitle: l?.subtitle?.slice(0, 55) || '',
      subtitleEnabled: !!l?.subtitle,
      condition: l?.condition || item.condition || 'Used – Good',
      conditionDescription: l?.conditionDescription || '',
      description: l?.description || item.description || '',
      brand: brandFallback,
      model: l?.itemSpecifics?.['Model'] || l?.itemSpecifics?.['Style'] || '',
      sku: item.tags?.find(t => t.startsWith('HRBO-')) || '',
      size: l?.size || l?.itemSpecifics?.['Size'] || '',
      color: l?.itemSpecifics?.['Color'] || '',
      department: l?.department || 'N/A',
      material: l?.itemSpecifics?.['Material'] || '',
      upc: item.upcEan || '',
      ebayCategoryId: l?.ebayCategoryId || '',
      itemSpecifics: existingSpecifics.length ? existingSpecifics : [{ key: '', value: '' }],
      price: priceStr,
      bestOfferEnabled: l?.bestOfferEnabled ?? true,
      autoAccept: l?.autoAcceptPrice != null ? String(l.autoAcceptPrice) : priceNum > 0 ? String(+(priceNum * 0.88).toFixed(2)) : '',
      autoDecline: l?.autoDeclinePrice != null ? String(l.autoDeclinePrice) : priceNum > 0 ? String(+(priceNum * 0.73).toFixed(2)) : '',
      shippingStrategy: l?.shippingService || 'USPS Ground Advantage',
      weightOz: l?.weightOz != null ? String(l.weightOz) : '',
      packageLengthIn: '',
      packageWidthIn: '',
      packageHeightIn: '',
      freeShipping: item.optimizedListing?.price != null ? (item.optimizedListing.price >= 20) : false,
      photoUrls: item.photoUrls || [],
      compLow: item.marketData?.ebayPriceRange?.min ?? null,
      compHigh: item.marketData?.ebayPriceRange?.max ?? null,
    }
  })

  // ── Gate sheet ──────────────────────────────────────────────────────────────
  const [gateOpen, setGateOpen] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [pushError, setPushError] = useState<string | null>(null)

  const gateResult = runGate(state, item.purchasePrice)

  // ── Derived display values ─────────────────────────────────────────────────
  const priceNum = parseFloat(state.price) || 0
  const weightOzNum = parseFloat(state.weightOz) || 0
  const breakEven = computeBreakEven(item.purchasePrice, weightOzNum)
  const netProfit = priceNum > 0 ? computeNetProfit(priceNum, item.purchasePrice, weightOzNum) : null

  // ── Sync auto-accept/decline when price changes ────────────────────────────
  useEffect(() => {
    if (priceNum > 0) {
      setState(s => ({
        ...s,
        autoAccept: s.bestOfferEnabled ? String(+(priceNum * 0.88).toFixed(2)) : s.autoAccept,
        autoDecline: s.bestOfferEnabled ? String(+(priceNum * 0.73).toFixed(2)) : s.autoDecline,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.price, state.bestOfferEnabled])

  // ── Update from PhotoManager done callback ─────────────────────────────────
  // item.photoUrls may update if the parent updates the item after photo edit.
  const prevPhotoUrlsRef = useRef<string[]>(item.photoUrls || [])
  useEffect(() => {
    const incoming = item.photoUrls || []
    const prev = prevPhotoUrlsRef.current
    if (incoming.length !== prev.length || incoming.some((u, i) => u !== prev[i])) {
      setState(s => ({ ...s, photoUrls: incoming }))
      prevPhotoUrlsRef.current = incoming
    }
  }, [item.photoUrls])

  // ── Auto-open gate drawer (quick-list from queue card) ────────────────────
  useEffect(() => {
    if (initialGateOpen) {
      const t = setTimeout(() => setGateOpen(true), 150)
      return () => clearTimeout(t)
    }
  }, [initialGateOpen])

  // ── Dirty tracking — tracks user-edited fields so AI refresh won't overwrite them
  const dirtyFieldsRef = useRef<Set<keyof ListingBuilderState>>(new Set())

  // ── Refresh state when AI optimization completes ──────────────────────────
  const prevOptimizedAtRef = useRef<number | undefined>(item.optimizedListing?.optimizedAt)
  useEffect(() => {
    const newAt = item.optimizedListing?.optimizedAt
    if (newAt && newAt !== prevOptimizedAtRef.current) {
      prevOptimizedAtRef.current = newAt
      const l = item.optimizedListing!
      const dirty = dirtyFieldsRef.current
      // Only update fields the user hasn't manually touched
      setState(s => ({
        ...s,
        ...(!dirty.has('title') && l.title ? { title: l.title.slice(0, 80) } : {}),
        ...(!dirty.has('subtitle') && l.subtitle ? { subtitle: l.subtitle.slice(0, 55) } : {}),
        ...(!dirty.has('condition') && l.condition ? { condition: l.condition } : {}),
        ...(!dirty.has('conditionDescription') && l.conditionDescription ? { conditionDescription: l.conditionDescription } : {}),
        ...(!dirty.has('description') && l.description ? { description: l.description } : {}),
        ...(!dirty.has('brand') && l.itemSpecifics?.['Brand'] ? { brand: l.itemSpecifics['Brand'] } : {}),
        ...(!dirty.has('model') && (l.itemSpecifics?.['Model'] || l.itemSpecifics?.['Style']) ? { model: l.itemSpecifics['Model'] || l.itemSpecifics['Style'] || '' } : {}),
        ...(!dirty.has('color') && l.itemSpecifics?.['Color'] ? { color: l.itemSpecifics['Color'] } : {}),
        ...(!dirty.has('size') && (l.size || l.itemSpecifics?.['Size']) ? { size: l.size || l.itemSpecifics?.['Size'] || '' } : {}),
        ...(!dirty.has('material') && l.itemSpecifics?.['Material'] ? { material: l.itemSpecifics['Material'] } : {}),
        ...(!dirty.has('ebayCategoryId') && l.ebayCategoryId ? { ebayCategoryId: l.ebayCategoryId } : {}),
        ...(!dirty.has('department') && l.department ? { department: l.department } : {}),
        ...(!dirty.has('price') && l.price != null ? { price: String(l.price) } : {}),
        ...(!dirty.has('bestOfferEnabled') ? { bestOfferEnabled: l.bestOfferEnabled ?? s.bestOfferEnabled } : {}),
        ...(!dirty.has('shippingStrategy') && l.shippingService ? { shippingStrategy: l.shippingService } : {}),
        ...(!dirty.has('weightOz') && l.weightOz != null ? { weightOz: String(l.weightOz) } : {}),
        ...(!dirty.has('itemSpecifics') && l.itemSpecifics
          ? { itemSpecifics: Object.entries(l.itemSpecifics)
                .filter(([k, v]) => k && v && v !== 'N/A' && v !== 'null')
                .map(([k, v]) => ({ key: k, value: v })) }
          : {}),
      }))
      toast.success('AI optimization applied')
    }
  }, [item.optimizedListing?.optimizedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Optimize handler ──────────────────────────────────────────────────────
  const handleOptimize = useCallback(async () => {
    if (!onOptimize || isOptimizing) return
    setIsOptimizing(true)
    try {
      await onOptimize(item.id)
    } catch {
      toast.error('Optimization failed')
    } finally {
      setIsOptimizing(false)
    }
  }, [onOptimize, item.id, isOptimizing])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const set = useCallback(<K extends keyof ListingBuilderState>(key: K, value: ListingBuilderState[K]) => {
    dirtyFieldsRef.current.add(key)
    setState(s => ({ ...s, [key]: value }))
  }, [])

  const addSpecific = () => setState(s => ({ ...s, itemSpecifics: [...s.itemSpecifics, { key: '', value: '' }] }))
  const removeSpecific = (idx: number) => setState(s => ({ ...s, itemSpecifics: s.itemSpecifics.filter((_, i) => i !== idx) }))
  const updateSpecific = (idx: number, field: 'key' | 'value', val: string) => {
    setState(s => {
      const next = [...s.itemSpecifics]
      next[idx] = { ...next[idx], [field]: val }
      return { ...s, itemSpecifics: next }
    })
  }

  // ── Confirm & Push ──────────────────────────────────────────────────────────
  const handleConfirmPush = useCallback(async () => {
    setIsPushing(true)
    setPushError(null)

    const finalPhotoUrls = [...state.photoUrls]

    // Queue items have already been through Photo Manager — imageData is stripped from KV-persisted items.
    // If photoUrls is empty, the item was never properly photographed; block push and prompt user to add photos.
    if (finalPhotoUrls.length === 0) {
      toast.error('No photos — tap Edit Photos first')
      setIsPushing(false)
      return
    }
    setUploadProgress(null)

    // Build item specifics object from rows
    const itemSpecificsObj: Record<string, string> = {}
    for (const { key, value } of state.itemSpecifics) {
      if (key.trim() && value.trim() && value !== 'N/A') {
        itemSpecificsObj[key.trim()] = value.trim()
      }
    }
    if (state.brand) itemSpecificsObj['Brand'] = state.brand
    if (state.model) itemSpecificsObj['Model'] = state.model
    if (state.color) itemSpecificsObj['Color'] = state.color
    if (state.size) itemSpecificsObj['Size'] = state.size
    if (state.material) itemSpecificsObj['Material'] = state.material

    const itemSpecificsRaw = Object.entries(itemSpecificsObj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ')

    const listingData = {
      title: state.title.trim().slice(0, 80),
      subtitle: state.subtitleEnabled ? state.subtitle.trim().slice(0, 55) || undefined : undefined,
      condition: state.condition,
      conditionDescription: state.conditionDescription || undefined,
      description: state.description,
      brand: state.brand.trim() || undefined,
      model: state.model.trim() || undefined,
      sku: state.sku.trim() || undefined,
      size: state.size.trim() || undefined,
      color: state.color.trim() || undefined,
      department: state.department !== 'N/A' ? state.department : undefined,
      material: state.material.trim() || undefined,
      upc: state.upc.trim() || undefined,
      ebayCategoryId: state.ebayCategoryId.trim() || undefined,
      itemSpecifics: Object.keys(itemSpecificsObj).length ? itemSpecificsObj : undefined,
      itemSpecificsRaw: itemSpecificsRaw || undefined,
      price: priceNum,
      bestOfferEnabled: state.bestOfferEnabled,
      autoAccept: state.bestOfferEnabled && state.autoAccept ? parseFloat(state.autoAccept) : undefined,
      autoDecline: state.bestOfferEnabled && state.autoDecline ? parseFloat(state.autoDecline) : undefined,
      purchasePrice: item.purchasePrice,
      shippingStrategy: state.shippingStrategy,
      weightOz: weightOzNum > 0 ? weightOzNum : undefined,
      packageDimensions: (() => {
        const l = parseFloat(state.packageLengthIn) || 0
        const w = parseFloat(state.packageWidthIn) || 0
        const h = parseFloat(state.packageHeightIn) || 0
        return l > 0 || w > 0 || h > 0 ? { lengthIn: l, widthIn: w, heightIn: h } : undefined
      })(),
      freeShipping: state.freeShipping,
      photoUrls: finalPhotoUrls,
      seoTitle: state.title.trim().slice(0, 80),
      marketNotes: item.notes || undefined,
    }

    try {
      const response = await fetch('/api/ebay/push-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingData,
          notionPageId: item.notionPageId || null,
          supabaseItemId: undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const msg = data?.error || `eBay push failed (${response.status})`
        setPushError(msg)
        setIsPushing(false)
        return
      }
      setGateOpen(false)
      onPushed(item.id, String(data.listingId), data.listingUrl, data.notionPageId || item.notionPageId || '')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setPushError(msg)
      setIsPushing(false)
    }
  }, [state, priceNum, weightOzNum, item, onPushed])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 flex flex-col bg-bg overflow-hidden">
      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="flex-none flex items-center justify-between px-4 py-3 bg-bg/95 backdrop-blur-sm border-b border-s1 z-10">
        <button
          onClick={() => {
            if (isPushing) return // cannot leave during push
            if (mode === 'list') toast('Changes not saved — tap the card to continue', { duration: 3000 })
            onBack()
          }}
          disabled={isPushing}
          className="flex items-center gap-1.5 text-t2 hover:text-b1 active:scale-95 transition-all py-1 disabled:opacity-40"
          style={{ touchAction: 'manipulation' }}
        >
          <ArrowLeft size={18} weight="bold" />
          <span className="text-[13px] font-medium">{isPushing ? '' : 'Back'}</span>
        </button>

        <div className="text-[12px] font-semibold text-t2 flex items-center gap-1.5">
          <span className="text-[10px] text-t3 mr-1">{mode === 'list' ? 'List on eBay' : 'Edit Listing'}</span>
          {gateResult.allRequiredPass
            ? <><CheckCircle size={14} weight="fill" className="text-green-500" />Ready</>
            : <><span className="text-red-500 text-[11px]">{gateResult.required.filter(r => !r.pass).length} required</span></>
          }
        </div>

        <div className="flex items-center gap-2">
          {onOptimize && (
            <button
              onClick={handleOptimize}
              disabled={isOptimizing}
              title="Re-run AI optimization"
              aria-label="Optimize listing with AI"
              className="h-9 w-9 flex items-center justify-center rounded-full bg-b1/10 text-b1 hover:bg-b1/20 active:scale-95 transition-all disabled:opacity-40"
              style={{ touchAction: 'manipulation' }}
            >
              {isOptimizing
                ? <CircleNotch size={15} className="animate-spin" />
                : <Lightning size={15} weight="bold" />
              }
            </button>
          )}
          <button
            onClick={() => setGateOpen(true)}
            className="h-9 px-4 text-[12px] font-bold text-white rounded-full active:scale-95 transition-all flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)', touchAction: 'manipulation' }}
          >
            Review &amp; Push
          </button>
        </div>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-8">

        {/* ── 1. Photos ─────────────────────────────────────────────────────── */}
        <SectionHeader icon={<Camera size={14} />} title="Photos" />
        <div className="px-4">
          {state.photoUrls.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {state.photoUrls.map((url, i) => (
                <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-s1 bg-s1 flex-none">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
              <div className="w-16 h-16 rounded-lg border border-dashed border-s2 flex items-center justify-center text-t3 flex-none">
                <span className="text-[10px] text-center leading-tight">{state.photoUrls.length} photo{state.photoUrls.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ) : (
            // Fall back to showing item thumbnail if no uploaded photos yet
            <div className="flex items-center gap-3">
              {item.imageData || item.imageThumbnail ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-s1 flex-none">
                  <img src={item.imageData || item.imageThumbnail} alt="Item" className="w-full h-full object-cover" />
                </div>
              ) : null}
              {(item.additionalImageData || []).slice(0, 4).map((d, i) => (
                <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-s1 flex-none">
                  <img src={d} alt={`Photo ${i + 2}`} className="w-full h-full object-cover" />
                </div>
              ))}
              <div className="text-[11px] text-t3 italic">Not uploaded yet — will upload on push</div>
            </div>
          )}
          {onEditPhotos && (
            <button
              onClick={() => onEditPhotos(item)}
              className="mt-2 text-[11px] text-blue-500 font-medium flex items-center gap-1 active:scale-95"
              style={{ touchAction: 'manipulation' }}
            >
              <Camera size={12} /> Edit Photos
            </button>
          )}
        </div>

        {/* ── 2. Title & Subtitle ───────────────────────────────────────────── */}
        <SectionHeader icon={<Tag size={14} />} title="Title & Subtitle" />
        <div className="px-4 space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[11px] text-t3 font-medium">Title</label>
              <span className={cn(
                'text-[11px] font-mono',
                state.title.length > 80 ? 'text-red-500' : state.title.length > 65 ? 'text-amber-500' : 'text-green-500'
              )}>{state.title.length}/80</span>
            </div>
            <input
              type="text"
              value={state.title}
              onChange={e => set('title', e.target.value)}
              maxLength={80}
              placeholder="Brand Model Key Feature Condition"
              className="w-full h-10 px-3 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
            />
            {state.title.includes('|') && (
              <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                <XCircle size={11} weight="fill" /> Remove pipe symbols from title
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-t3 font-medium">
                Subtitle <span className="text-t3/60">(+$0.15/listing)</span>
              </label>
              <button
                onClick={() => set('subtitleEnabled', !state.subtitleEnabled)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors',
                  state.subtitleEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-s1 text-t3'
                )}
              >
                {state.subtitleEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {state.subtitleEnabled && (
              <>
                <input
                  type="text"
                  value={state.subtitle}
                  onChange={e => set('subtitle', e.target.value.slice(0, 55))}
                  maxLength={55}
                  placeholder="Keyword-rich subtitle (different words from title)"
                  className="w-full h-10 px-3 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
                />
                <div className="flex justify-end mt-0.5">
                  <span className={cn('text-[11px] font-mono', state.subtitle.length > 50 ? 'text-amber-500' : 'text-t3')}>{state.subtitle.length}/55</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── 3. Condition & Description ────────────────────────────────────── */}
        <SectionHeader icon={<Info size={14} />} title="Condition & Description" />
        <div className="px-4 space-y-3">
          <div>
            <label className="text-[11px] text-t3 font-medium block mb-1">Condition</label>
            <div className="relative">
              <select
                value={state.condition}
                onChange={e => set('condition', e.target.value)}
                className="w-full h-10 px-3 pr-8 rounded-lg bg-s1 text-[13px] text-b1 border border-transparent focus:border-blue-500/50 focus:outline-none appearance-none transition-colors"
              >
                {CONDITION_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <CaretDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-t3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-t3 font-medium block mb-1">Condition Description</label>
            <textarea
              value={state.conditionDescription}
              onChange={e => set('conditionDescription', e.target.value)}
              placeholder="Specific flaws, wear, scratches, or 'No visible flaws noted'"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none resize-none transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[11px] text-t3 font-medium">Description</label>
              <span className={cn(
                'text-[11px] font-mono',
                state.description.length < 400 ? 'text-amber-500' : state.description.length > 1500 ? 'text-amber-500' : 'text-green-500'
              )}>{state.description.length} chars</span>
            </div>
            <textarea
              value={state.description}
              onChange={e => set('description', e.target.value)}
              placeholder="1. What it is and why buy it&#10;2. Condition: ...&#10;3. Features:&#10;   •&#10;4. What's included:&#10;5. Ships within 1 business day from Orlando FL. 30-day returns accepted."
              rows={8}
              className="w-full px-3 py-2 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none resize-none transition-colors font-mono text-[12px] leading-snug"
            />
            {state.description.length < 400 && state.description.length > 0 && (
              <p className="text-[11px] text-amber-500 mt-0.5">{400 - state.description.length} more chars needed</p>
            )}
          </div>
        </div>

        {/* ── 4. Item Details ───────────────────────────────────────────────── */}
        <SectionHeader icon={<Package size={14} />} title="Item Details" />
        <div className="px-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-t3 font-medium block mb-1">Brand *</label>
              <input
                type="text"
                value={state.brand}
                onChange={e => set('brand', e.target.value)}
                placeholder="Brand name"
                className="w-full h-9 px-3 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-t3 font-medium block mb-1">Model / SKU</label>
              <input
                type="text"
                value={state.model}
                onChange={e => set('model', e.target.value)}
                placeholder="Model number"
                className="w-full h-9 px-3 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-t3 font-medium block mb-1">Size</label>
              <input
                type="text"
                value={state.size}
                onChange={e => set('size', e.target.value)}
                placeholder="e.g. L, 10.5 US, 32x34"
                className="w-full h-9 px-3 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-t3 font-medium block mb-1">Color</label>
              <input
                type="text"
                value={state.color}
                onChange={e => set('color', e.target.value)}
                placeholder="Color"
                className="w-full h-9 px-3 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-t3 font-medium block mb-1">Department</label>
              <div className="relative">
                <select
                  value={state.department}
                  onChange={e => set('department', e.target.value)}
                  className="w-full h-9 px-3 pr-7 rounded-lg bg-s1 text-[13px] text-b1 border border-transparent focus:border-blue-500/50 focus:outline-none appearance-none transition-colors"
                >
                  {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <CaretDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-t3 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-t3 font-medium block mb-1">Material</label>
              <input
                type="text"
                value={state.material}
                onChange={e => set('material', e.target.value)}
                placeholder="Material"
                className="w-full h-9 px-3 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-t3 font-medium block mb-1">UPC / EAN / GTIN</label>
              <input
                type="text"
                value={state.upc}
                onChange={e => set('upc', e.target.value)}
                placeholder="Barcode number"
                className="w-full h-9 px-3 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-t3 font-medium block mb-1">eBay Category ID *</label>
              <input
                type="text"
                value={state.ebayCategoryId}
                onChange={e => set('ebayCategoryId', e.target.value)}
                placeholder="e.g. 26676"
                className="w-full h-9 px-3 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {/* Item Specifics */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-t3 font-medium">Item Specifics</label>
              <button
                onClick={addSpecific}
                className="flex items-center gap-1 text-[10px] text-blue-400 font-medium active:scale-95"
                style={{ touchAction: 'manipulation' }}
              >
                <Plus size={11} /> Add row
              </button>
            </div>
            <div className="space-y-1.5">
              {state.itemSpecifics.map((spec, idx) => (
                <div key={idx} className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={spec.key}
                    onChange={e => updateSpecific(idx, 'key', e.target.value)}
                    placeholder="Key"
                    className="flex-1 h-8 px-2 rounded-md bg-s1 text-[12px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/40 focus:outline-none transition-colors"
                  />
                  <input
                    type="text"
                    value={spec.value}
                    onChange={e => updateSpecific(idx, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 h-8 px-2 rounded-md bg-s1 text-[12px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/40 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={() => removeSpecific(idx)}
                    className="w-8 h-8 flex items-center justify-center text-t3 hover:text-red-500 rounded-md active:scale-95 transition-colors flex-none"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Trash size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 5. Pricing ────────────────────────────────────────────────────── */}
        <SectionHeader icon={<CurrencyDollar size={14} />} title="Pricing" />
        <div className="px-4 space-y-3">
          {/* Comp range */}
          {(state.compLow != null || state.compHigh != null) && (
            <div className="flex items-center gap-2 bg-s1/80 rounded-lg px-3 py-2">
              <span className="text-[11px] text-t3">eBay Sold Range:</span>
              <span className="text-[12px] font-semibold text-b1">
                {state.compLow != null ? `$${state.compLow.toFixed(2)}` : '—'}
                {' – '}
                {state.compHigh != null ? `$${state.compHigh.toFixed(2)}` : '—'}
              </span>
            </div>
          )}

          <div>
            <label className="text-[11px] text-t3 font-medium block mb-1">Listing Price *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-t2 font-semibold text-[14px]">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={state.price}
                onChange={e => set('price', e.target.value)}
                placeholder="0.00"
                className="w-full h-12 pl-7 pr-3 rounded-lg bg-s1 text-[18px] font-bold text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
              />
            </div>
            {/* Break-even + profit display */}
            <div className="flex items-center gap-3 mt-1.5 text-[11px]">
              <span className="text-t3">Break Even: <span className="font-semibold text-b1">${breakEven.toFixed(2)}</span></span>
              {netProfit != null && (
                <span className={cn('font-semibold', netProfit >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {netProfit >= 0 ? '+' : ''}{netProfit.toFixed(2)} net
                </span>
              )}
              {priceNum > 0 && priceNum <= breakEven && (
                <span className="text-red-500 flex items-center gap-0.5">
                  <XCircle size={11} weight="fill" /> Below break-even
                </span>
              )}
            </div>
          </div>

          {/* Best Offer */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-t3 font-medium">Best Offer</label>
              <button
                onClick={() => set('bestOfferEnabled', !state.bestOfferEnabled)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors',
                  state.bestOfferEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-s1 text-t3'
                )}
              >
                {state.bestOfferEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {state.bestOfferEnabled && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-t3 block mb-1">Auto-Accept ($)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t3 text-[12px]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={state.autoAccept}
                      onChange={e => set('autoAccept', e.target.value)}
                      className="w-full h-9 pl-6 pr-2 rounded-lg bg-s1 text-[13px] text-b1 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <p className="text-[10px] text-t3 mt-0.5">88% of price</p>
                </div>
                <div>
                  <label className="text-[10px] text-t3 block mb-1">Auto-Decline ($)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t3 text-[12px]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={state.autoDecline}
                      onChange={e => set('autoDecline', e.target.value)}
                      className="w-full h-9 pl-6 pr-2 rounded-lg bg-s1 text-[13px] text-b1 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <p className="text-[10px] text-t3 mt-0.5">73% of price</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 6. Shipping ───────────────────────────────────────────────────── */}
        <SectionHeader icon={<Truck size={14} />} title="Shipping" />
        <div className="px-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-t3 font-medium block mb-1">Shipping Strategy</label>
              <div className="relative">
                <select
                  value={state.shippingStrategy}
                  onChange={e => set('shippingStrategy', e.target.value)}
                  className="w-full h-9 px-2.5 pr-7 rounded-lg bg-s1 text-[12px] text-b1 border border-transparent focus:border-blue-500/50 focus:outline-none appearance-none transition-colors"
                >
                  {SHIPPING_STRATEGY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <CaretDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-t3 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-t3 font-medium block mb-1">Item Weight (oz)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={state.weightOz}
                onChange={e => set('weightOz', e.target.value)}
                placeholder="e.g. 24"
                className="w-full h-9 px-2.5 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Package dimensions — optional, improves calculated shipping */}
          <div>
            <label className="text-[10px] text-t3 font-medium block mb-1">
              Package Dimensions (in) <span className="text-t3/50 font-normal">L × W × H — optional, improves shipping calc</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['packageLengthIn', 'packageWidthIn', 'packageHeightIn'] as const).map((field, i) => (
                <input
                  key={field}
                  type="number"
                  step="0.5"
                  min="0"
                  value={state[field]}
                  onChange={e => set(field, e.target.value)}
                  placeholder={['L', 'W', 'H'][i]}
                  className="w-full h-9 px-2.5 rounded-lg bg-s1 text-[13px] text-b1 placeholder:text-t3 border border-transparent focus:border-blue-500/50 focus:outline-none transition-colors text-center"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between bg-s1/80 rounded-lg px-3 py-2.5">
            <div>
              <div className="text-[12px] font-medium text-b1">Free Shipping</div>
              <div className="text-[10px] text-t3">Include shipping cost in price</div>
            </div>
            <button
              onClick={() => set('freeShipping', !state.freeShipping)}
              className={cn(
                'text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors',
                state.freeShipping ? 'bg-blue-500/20 text-blue-400' : 'bg-s2 text-t3'
              )}
            >
              {state.freeShipping ? 'Yes' : 'No'}
            </button>
          </div>
        </div>

        {/* Spacer at bottom so CTA doesn't cover last section */}
        <div className="h-4" />
      </div>

      {/* ── Gate Drawer ─────────────────────────────────────────────────────── */}
      <Drawer open={gateOpen} onOpenChange={(open) => { if (!isPushing) setGateOpen(open) }}>
        <DrawerContent className="max-h-[85vh] flex flex-col">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-[15px]">
              {gateResult.allRequiredPass
                ? '✅ Ready to Push'
                : `Pre-Push Checklist — ${gateResult.required.filter(r => !r.pass).length} item${gateResult.required.filter(r => !r.pass).length !== 1 ? 's' : ''} required`
              }
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4">
            {/* Required checks */}
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-t3 uppercase tracking-wide mb-2">Required</p>
              <div className="space-y-1.5">
                {gateResult.required.map(check => (
                  <div key={check.id} className="flex items-center gap-2.5">
                    {check.pass
                      ? <CheckCircle size={14} weight="fill" className="text-green-500 flex-none" />
                      : <XCircle size={14} weight="fill" className="text-red-500 flex-none" />
                    }
                    <span className={cn('text-[12px]', check.pass ? 'text-t2' : 'text-b1 font-medium')}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings */}
            <div>
              <p className="text-[10px] font-semibold text-t3 uppercase tracking-wide mb-2">Warnings (optional)</p>
              <div className="space-y-1.5">
                {gateResult.warnings.map(w => (
                  <div key={w.id} className="flex items-center gap-2.5">
                    {w.pass
                      ? <CheckCircle size={14} weight="fill" className="text-green-500 flex-none" />
                      : <Warning size={14} weight="fill" className="text-amber-400 flex-none" />
                    }
                    <span className="text-[12px] text-t2">{w.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Item summary */}
            <div className="mt-4 bg-s1/60 rounded-lg px-3 py-2.5 space-y-0.5">
              <div className="text-[11px] text-t3">
                <span className="text-b1 font-semibold">{state.title.slice(0, 50) || 'Untitled'}</span>
                {state.title.length > 50 ? '...' : ''}
              </div>
              <div className="text-[11px] text-t3">
                Price: <span className="text-b1 font-semibold">${priceNum.toFixed(2)}</span>
                {netProfit != null && <span className={cn('ml-2 font-semibold', netProfit >= 0 ? 'text-green-500' : 'text-red-500')}>
                  ({netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)} net)
                </span>}
              </div>
              <div className="text-[11px] text-t3">Photos: {state.photoUrls.length || 'pending upload'}</div>
            </div>

            {/* Upload progress */}
            {uploadProgress && (
              <div className="mt-3 flex items-center gap-2 text-[12px] text-t2">
                <CircleNotch size={14} className="animate-spin flex-none text-blue-400" />
                Uploading {uploadProgress.done}/{uploadProgress.total} photos...
              </div>
            )}

            {/* Push error */}
            {pushError && (
              <div className="mt-3 p-3 bg-red-500/10 rounded-lg text-[12px] text-red-400">
                {pushError}
              </div>
            )}
          </div>

          <DrawerFooter className="pt-2">
            <button
              onClick={handleConfirmPush}
              disabled={!gateResult.allRequiredPass || isPushing}
              className={cn(
                'w-full h-12 rounded-xl text-[13px] font-bold text-white transition-all active:scale-[0.98]',
                gateResult.allRequiredPass && !isPushing
                  ? 'opacity-100 cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              )}
              style={{
                background: gateResult.allRequiredPass && !isPushing
                  ? 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)'
                  : '#555',
                touchAction: 'manipulation',
              }}
            >
              {isPushing
                ? <span className="flex items-center justify-center gap-2">
                    <CircleNotch size={15} className="animate-spin" />
                    {uploadProgress ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...` : 'Pushing to eBay...'}
                  </span>
                : 'Confirm & Push to eBay'
              }
            </button>
            {!gateResult.allRequiredPass && (
              <p className="text-[11px] text-t3 text-center">
                Fix {gateResult.required.filter(r => !r.pass).length} required item{gateResult.required.filter(r => !r.pass).length !== 1 ? 's' : ''} above to enable push
              </p>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
