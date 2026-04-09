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
let anchorMissCount = 0  // tracks silent patch failures — non-zero means Spark refactored an anchor

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

  // ── 4. Notion DB ID default ────────────────────────────────────────────────
  {
    name: 'Default: notionDatabaseId pre-filled',
    detect: src => src.includes('notionDatabaseId:'),
    patch: src => src.replace(
      "    preferredAiModel: 'gemini-2.0-flash-exp',\n  })",
      `    preferredAiModel: 'gemini-2.0-flash-exp',\n    notionDatabaseId: '${NOTION_DB_ID}', // Hobbyst Resale Inventory DB\n  })`
    )
  },

  // ── 5. handleOptimizeItem + handlePushToNotion handlers ───────────────────
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
  // Guard: only patch if <AgentScreen is actually rendered in App.tsx.
  // App.tsx currently uses <AIScreen for the agent tab (a different component
  // that does not accept onOptimizeItem/onPushToNotion). Skip this check when
  // AgentScreen is absent so we don't add props to the wrong component.
  {
    name: 'JSX: AgentScreen onOptimizeItem + onPushToNotion props',
    detect: src => !src.includes('<AgentScreen') || src.includes('onOptimizeItem={handleOptimizeItem}'),
    patch: src => src.replace(
      /(<AgentScreen[\s\S]*?)(onNavigateToQueue=\{[^}]+\})/,
      '$1onOptimizeItem={handleOptimizeItem}\n                onPushToNotion={handlePushToNotion}\n                $2'
    )
  },

  // ── 7. Profit math integrity guard ────────────────────────────────────────
  // Detect-only. Does NOT patch. Warns loudly if Spark has removed
  // calculateProfitMetrics from App.tsx. CI run will show the warning
  // in the wiring script output. CE-VS or SA-VS should investigate before deploy.
  {
    name: 'Guard: calculateProfitMetrics present in App.tsx',
    detect: src => src.includes('calculateProfitMetrics'),
    patch: src => {
      console.error('🚨 PROFIT MATH MISSING: calculateProfitMetrics not found in App.tsx.')
      console.error('   Spark may have removed or renamed handleCapture/handleBatchAnalyze.')
      console.error('   Do NOT deploy until the profit calculation is restored.')
      return src  // detect-only — never auto-patch business logic
    }
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
      anchorMissCount++
    }
  }
}

console.log()

if (changed) {
  writeFileSync(APP, src, 'utf8')
  console.log(`✅  Wiring complete — ${appliedCount} patch(es) applied to src/App.tsx`)
} else {
  console.log('✅  All wiring already present — no changes needed')
}

if (anchorMissCount > 0) {
  console.warn(`\n⚠️  ${anchorMissCount} wiring anchor(s) not found in App.tsx.`)
  console.warn('   Spark may have refactored those locations. Update apply-wiring.mjs to match.')
  console.warn('   Deploy will continue — the tsc + lint gates catch any code issues.\n')
}

console.log('🚀  Ready to push to deploy/production')
