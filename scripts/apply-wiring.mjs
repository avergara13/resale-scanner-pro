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
const ROOT   = resolve(__dir, '..')
const APP    = resolve(ROOT, 'src/App.tsx')
const SERVER = resolve(ROOT, 'server.js')

const NOTION_DB_ID = process.env.NOTION_DATABASE_ID || '7e49058fa8874889b9f6ae5a6c3bf8e7'

console.log('🔧  Loft OS Wiring Script — Resale Scanner Pro')
console.log(`📁  Repo: ${ROOT}`)
console.log(`📄  Target: src/App.tsx\n`)

let src       = readFileSync(APP, 'utf8')
const serverSrc = readFileSync(SERVER, 'utf8')
let changed = false
let appliedCount = 0
let anchorMissCount  = 0  // structural anchor misses — warn only, tsc/lint are the real gate
let fatalMissCount   = 0  // App.tsx integrity guard failures — always block deploy
let backendFatalCount = 0 // server.js route guard failures — always block deploy

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
  // Detect-only. Does NOT patch. Blocks deploy if calculateProfitMetrics is
  // missing — tsc/lint cannot catch this because the code remains valid without
  // it. fatal:true means a miss here always blocks deploy. Only structural
  // anchor misses from wiring patches are non-fatal warnings.
  {
    name: 'Guard: calculateProfitMetrics present in App.tsx',
    fatal: true,
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
    } else if (check.fatal) {
      console.error(`  ❌  FATAL guard failed: ${check.name}`)
      fatalMissCount++
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

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND GUARDS — detect-only, all fatal, guard server.js routes
// Runs against serverSrc (separate from App.tsx checks).
// server.js is plain JS — tsc/lint cannot catch a missing route.
// A miss here means a required API route has been removed.
// Add new backend guards here when new server.js routes are added.
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_GUARDS = [

  // Railway health check — without this Railway marks the service unhealthy
  // and stops routing traffic. Every deploy is dead on arrival without /health.
  {
    name: 'Route: GET /health in server.js',
    detect: src => src.includes("pathname === '/health'"),
  },

  // Sold items feed — SoldScreen shows permanent error state without this.
  // Confirmed pattern from server.js line 514:
  //   if (requestUrl.pathname === '/api/sold-items' && req.method === 'GET')
  {
    name: 'Route: GET /api/sold-items in server.js',
    detect: src => src.includes("pathname === '/api/sold-items'") && src.includes("req.method === 'GET'"),
  },

  // Shipping update — the label/tracking workflow is broken without this.
  // Route is POST (not PATCH — Notion uses PATCH internally but the HTTP
  // endpoint the client calls is POST via shippingMatch regex).
  // Confirmed pattern from server.js line 524-525:
  //   const shippingMatch = requestUrl.pathname.match(...)
  //   if (shippingMatch && req.method === 'POST')
  {
    name: "Route: POST /api/sold-items/:id/shipping in server.js",
    detect: src => src.includes('shippingMatch') && src.includes("req.method === 'POST'"),
  },

]

console.log('\n📡  Checking backend routes in server.js...')
for (const guard of BACKEND_GUARDS) {
  if (guard.detect(serverSrc)) {
    console.log(`  ✅  Backend route OK: ${guard.name}`)
  } else {
    console.error(`  ❌  FATAL: ${guard.name}`)
    backendFatalCount++
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL EXIT — all checks have run, report all failures before exiting
// ─────────────────────────────────────────────────────────────────────────────

const totalFatal = fatalMissCount + backendFatalCount
if (totalFatal > 0) {
  if (fatalMissCount > 0) {
    console.error(`\n❌ DEPLOY BLOCKED: ${fatalMissCount} App.tsx integrity guard(s) failed.`)
    console.error('   These guards check invariants that tsc/lint cannot detect.')
    console.error('   Restore the missing logic in App.tsx before deploying.')
  }
  if (backendFatalCount > 0) {
    console.error(`\n❌ DEPLOY BLOCKED: ${backendFatalCount} backend route(s) missing from server.js.`)
    console.error('   These routes are required by the client. Restore them before deploying.')
  }
  process.exit(1)
}

console.log('\n🚀  Ready to push to deploy/production')
