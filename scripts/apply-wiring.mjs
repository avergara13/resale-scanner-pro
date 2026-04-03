#!/usr/bin/env node
/**
 * apply-wiring.mjs — Idempotent Integration Wiring Script
 * Vergara Inc · Loft OS v1.0 · Hobbyst Resale Scanner Pro
 *
 * Runs after every Spark publish to main.
 * Checks each wiring concern independently.
 * Only touches what's missing — never overwrites Spark's UI work.
 *
 * Add new wiring concerns at the bottom of WIRING_CHECKS.
 * Each check: { name, detect, patch }
 *   detect(src) → boolean: returns true if wiring already present
 *   patch(src)  → string:  returns the patched source
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = resolve(__dir, '..')
const APP   = resolve(ROOT, 'src/App.tsx')

const NOTION_DB_ID = process.env.NOTION_DATABASE_ID || '7e49058fa8874889b9f6ae5a6c3bf8e7'

console.log('🔧  Loft OS Wiring Script — Resale Scanner Pro')
console.log(`📁  Repo: ${ROOT}`)
console.log(`📄  Target: src/App.tsx\n`)

let src = readFileSync(APP, 'utf8')
let changed = false
let appliedCount = 0

// ─────────────────────────────────────────────────────────────────────────────
// WIRING CHECKS
// Each check is independent. Order matters for patches — imports before usage.
// ─────────────────────────────────────────────────────────────────────────────

const WIRING_CHECKS = [

  // ── 1. ListingOptimizationService import ──────────────────────────────────
  {
    name: 'Import: createListingOptimizationService',
    detect: src => src.includes('createListingOptimizationService'),
    patch: src => src.replace(
      "import { createTagSuggestionService } from './lib/tag-suggestion-service'",
      "import { createTagSuggestionService } from './lib/tag-suggestion-service'\nimport { createListingOptimizationService } from './lib/listing-optimization-service'\nimport { createNotionService } from './lib/notion-service'"
    )
  },

  // ── 2. NotionService import (only if listing import didn't add it) ─────────
  {
    name: 'Import: createNotionService (standalone)',
    detect: src => src.includes('createNotionService'),
    patch: src => src.replace(
      "import { createTagSuggestionService } from './lib/tag-suggestion-service'",
      "import { createTagSuggestionService } from './lib/tag-suggestion-service'\nimport { createNotionService } from './lib/notion-service'"
    )
  },

  // ── 3. listingOptimizationService useMemo ─────────────────────────────────
  {
    name: 'Service: listingOptimizationService useMemo',
    detect: src => src.includes('listingOptimizationService'),
    patch: src => src.replace(
      "  const tagSuggestionService = useMemo(() => createTagSuggestionService(), [])",
      `  const tagSuggestionService = useMemo(() => createTagSuggestionService(), [])

  const listingOptimizationService = useMemo(() =>
    createListingOptimizationService(settings?.geminiApiKey, settings?.preferredAiModel),
    [settings?.geminiApiKey, settings?.preferredAiModel]
  )

  const notionService = useMemo(() =>
    createNotionService(settings?.notionApiKey, settings?.notionDatabaseId),
    [settings?.notionApiKey, settings?.notionDatabaseId]
  )`
    )
  },

  // ── 4. eBay Finding API — only needs appId, certId not required ──────────
  // The Finding API is designed for browser use. App ID is a public key.
  // certId is only needed for OAuth (Browse/Sell APIs) — not used yet.

  // ── 5. Notion DB ID default ────────────────────────────────────────────────
  {
    name: 'Default: notionDatabaseId pre-filled',
    detect: src => src.includes('notionDatabaseId:'),
    patch: src => src.replace(
      "    preferredAiModel: 'gemini-2.0-flash-exp',\n  })",
      `    preferredAiModel: 'gemini-2.0-flash-exp',\n    notionDatabaseId: '${NOTION_DB_ID}', // Hobbyst Resale Inventory DB\n  })`
    )
  },

  // ── 5. handleOptimizeItem handler ─────────────────────────────────────────
  {
    name: 'Handler: handleOptimizeItem',
    detect: src => src.includes('handleOptimizeItem'),
    patch: src => {
      const anchor = '  const handleSaveDraft = useCallback((price: number, notes: string) => {'
      const handler = `  const handleOptimizeItem = useCallback(async (itemId: string) => {
    const item = (queue || []).find(i => i.id === itemId)
    if (!item) return
    const optimized = await listingOptimizationService.generateOptimizedListing({
      item,
      marketData: item.marketData,
    })
    setQueue((prev) => (prev || []).map(i =>
      i.id === itemId
        ? { ...i, optimizedListing: { ...optimized, optimizedAt: Date.now() }, listingStatus: 'ready' }
        : i
    ))
  }, [queue, setQueue, listingOptimizationService])

  const handlePushToNotion = useCallback(async (itemId: string) => {
    if (!notionService) {
      toast.error('Configure Notion API key and Database ID in Settings')
      return
    }
    const item = (queue || []).find(i => i.id === itemId)
    if (!item) return
    const listing = item.optimizedListing
    const profit = listing
      ? listing.price - item.purchasePrice
      : (item.estimatedSellPrice || 0) - item.purchasePrice
    const result = await notionService.pushListing({
      title: listing?.title || item.productName || 'Unknown Item',
      description: listing?.description || item.description || '',
      price: listing?.price || item.estimatedSellPrice || 0,
      purchasePrice: item.purchasePrice,
      category: listing?.category || item.category || 'General',
      condition: listing?.condition || 'Good',
      tags: listing?.suggestedTags || [],
      images: item.imageData ? [item.imageData] : [],
      profit,
      profitMargin: item.profitMargin || 0,
      status: 'ready',
      itemId: item.id,
      timestamp: item.timestamp,
      location: item.location?.name,
      notes: item.notes,
    })
    if (result.success) {
      setQueue((prev) => (prev || []).map(i =>
        i.id === itemId
          ? { ...i, notionPageId: result.pageId, notionUrl: result.url, listingStatus: 'published' }
          : i
      ))
      toast.success('Pushed to Notion ✓')
    } else {
      toast.error(\`Notion error: \${result.error}\`)
    }
  }, [queue, setQueue, notionService])

  const handleSaveDraft = useCallback((price: number, notes: string) => {`

      return src.includes(anchor)
        ? src.replace(anchor, handler)
        : src  // anchor not found — Spark may have renamed it, skip safely
    }
  },

  // ── 6. AgentScreen JSX props ───────────────────────────────────────────────
  {
    name: 'JSX: AgentScreen onOptimizeItem + onPushToNotion props',
    detect: src => src.includes('onOptimizeItem={handleOptimizeItem}'),
    patch: src => src.replace(
      /(<AgentScreen[\s\S]*?)(onNavigateToQueue=\{[^}]+\})/,
      '$1onOptimizeItem={handleOptimizeItem}\n                onPushToNotion={handlePushToNotion}\n                $2'
    )
  },

]

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER — apply each check in order
// ─────────────────────────────────────────────────────────────────────────────

for (const check of WIRING_CHECKS) {
  if (check.detect(src)) {
    console.log(`  ✅  Already wired: ${check.name}`)
  } else {
    const patched = check.patch(src)
    if (patched !== src) {
      src = patched
      changed = true
      appliedCount++
      console.log(`  🔧  Applied: ${check.name}`)
    } else {
      console.log(`  ⚠️   Anchor not found (Spark may have refactored): ${check.name}`)
    }
  }
}

console.log()

if (changed) {
  writeFileSync(APP, src, 'utf8')
  console.log(`✅  Wiring complete — ${appliedCount} patch(es) applied to src/App.tsx`)
  console.log('🚀  Ready to commit and push to deploy/production')
} else {
  console.log('✅  All wiring already present — no changes needed')
  console.log('🚀  Pushing clean main to deploy/production')
}
