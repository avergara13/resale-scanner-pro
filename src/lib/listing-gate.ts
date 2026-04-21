// ─────────────────────────────────────────────────────────────────────────────
// Canonical listing gate — single source of truth for pre-publish readiness.
//
// Both ListingBuilder (full form) and QueueScreen (card badge) import from here.
// Previously these drifted: the queue card used a 7-check simplified subset while
// ListingBuilder enforced 9 required + 5 warning checks, so cards showed "5/7"
// while ListingBuilder showed "5/9" for the same item.
//
// Keep this file in lockstep with the runGate() semantics — any new required
// check goes here, and both call sites pick it up automatically.
// ─────────────────────────────────────────────────────────────────────────────

import type { ScannedItem } from '@/types'

/** Shipping tier table — mirrors server.js and ListingBuilder breakeven math. */
export function computeBreakEven(purchasePrice: number, weightOzNum: number): number {
  const shipping = weightOzNum <= 0
    ? 7.90
    : weightOzNum <= 15.99
    ? 4.19
    : weightOzNum <= 32
    ? 7.90
    : 12.40
  // 13.25% eBay FVF + 3% ad fee = 16.25% combined
  const combinedFeeRate = (13.25 + 3.0) / 100
  return (purchasePrice + shipping + 0.75 + 0.30) / (1 - combinedFeeRate)
}

/** Single gate check result. */
export interface GateItem {
  id: string
  label: string
  pass: boolean
}

/** Full gate result — required checks block publishing, warnings are advisory. */
export interface GateResult {
  required: GateItem[]
  warnings: GateItem[]
  allRequiredPass: boolean
  /** Convenience: passed/total across required checks (for queue card badge). */
  passedCount: number
  totalCount: number
}

/**
 * Normalized input for the gate — decouples gate logic from any one UI state shape.
 * ListingBuilder populates this from its form state; QueueScreen populates it
 * from the ScannedItem snapshot via gateInputFromItem().
 */
export interface GateInput {
  title: string
  condition: string
  description: string
  photoCount: number
  price: number
  purchasePrice: number
  weightOz: number
  brand: string
  ebayCategoryId: string
  upc: string
  subtitleEnabled: boolean
  subtitle: string
  compLow: number | null
  compHigh: number | null
  /** Count of itemSpecifics entries where both key and value are non-blank. */
  specificsCount: number
}

/** Canonical gate — 9 required checks + 5 warnings. */
export function runListingGate(input: GateInput): GateResult {
  const breakEven = computeBreakEven(input.purchasePrice, input.weightOz)

  const required: GateItem[] = [
    { id: 'title',           label: 'Title present and ≤80 chars',                 pass: !!input.title.trim() && input.title.length <= 80 },
    { id: 'title-pipe',      label: 'No pipe symbols (|) in title',                pass: !input.title.includes('|') },
    { id: 'condition',       label: 'Condition set',                               pass: !!input.condition },
    { id: 'description',     label: 'Description ≥400 chars',                      pass: input.description.length >= 400 },
    { id: 'photo',           label: 'At least 1 photo',                            pass: input.photoCount >= 1 },
    { id: 'price',           label: 'Listing Price > 0',                           pass: input.price > 0 },
    { id: 'price-breakeven', label: `Price > Break Even ($${breakEven.toFixed(2)})`, pass: input.price > breakEven },
    { id: 'category',        label: 'eBay category set (not "Other")',             pass: !!input.ebayCategoryId && input.ebayCategoryId !== '99' },
    { id: 'brand',           label: 'Brand not blank',                             pass: !!input.brand.trim() },
  ]

  const warnings: GateItem[] = [
    { id: 'upc',          label: 'No UPC/EAN — catalog match reduced',         pass: !!input.upc.trim() },
    { id: 'subtitle',     label: 'No subtitle — search visibility reduced',    pass: !input.subtitleEnabled || !!input.subtitle.trim() },
    { id: 'comps',        label: 'No comp data — price unverified',            pass: input.compLow != null || input.compHigh != null },
    { id: 'specifics',    label: 'Item Specifics empty',                       pass: input.specificsCount > 0 },
    { id: 'photos-count', label: 'Only 1 photo (eBay recommends 8+)',          pass: input.photoCount >= 8 },
  ]

  const passedCount = required.filter(r => r.pass).length
  return {
    required,
    warnings,
    allRequiredPass: passedCount === required.length,
    passedCount,
    totalCount: required.length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ScannedItem adapter — used by QueueScreen card badge.
//
// Maps the nested ScannedItem/optimizedListing shape into the flat GateInput
// the gate expects. Prefers optimizedListing values when present and falls
// back to top-level ScannedItem fields so unoptimized items still get a
// meaningful score (rather than scoring 0/9 on everything).
// ─────────────────────────────────────────────────────────────────────────────
export function gateInputFromItem(item: ScannedItem): GateInput {
  const l = item.optimizedListing

  // Prefer optimized title, fall back to productName
  const title = (l?.title || item.productName || '').trim()

  // Condition from listing or from scanned condition string
  const condition = l?.condition || item.condition || ''

  const description = l?.description || item.description || ''

  const photoCount =
    (item.photoUrls?.length || 0) +
    (item.additionalImageData?.length || 0) +
    (item.imageData ? 1 : 0)

  const price = l?.price || item.estimatedSellPrice || 0

  // Brand: prefer explicit Item Specifics "Brand", else first capitalized token
  // from productName (same heuristic the old QueueScreen gate used).
  const brandFromSpecifics = l?.itemSpecifics?.['Brand']
  const brandFromName = item.productName?.match(/^([A-Z][a-zA-Z&]{1,19})(?:\s|$)/)?.[1]
  const brand = (brandFromSpecifics || brandFromName || '').trim()

  const ebayCategoryId = l?.ebayCategoryId || ''

  // Subtitle gate only penalizes if the user turned subtitle ON but left it blank.
  // Queue card can't know the user's intent, so treat "no subtitle" as a
  // never-failing check (subtitleEnabled=false).
  const subtitle = l?.subtitle || ''
  const subtitleEnabled = !!subtitle

  const specificsCount = l?.itemSpecifics
    ? Object.entries(l.itemSpecifics).filter(([k, v]) => k.trim() && v.trim()).length
    : 0

  return {
    title,
    condition,
    description,
    photoCount,
    price,
    purchasePrice: item.purchasePrice || 0,
    weightOz: l?.weightOz || 0,
    brand,
    ebayCategoryId,
    upc: '', // ScannedItem has no upc field — always fails this warning
    subtitleEnabled,
    subtitle,
    compLow: null,
    compHigh: null,
    specificsCount,
  }
}
