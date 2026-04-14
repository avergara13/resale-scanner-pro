#!/usr/bin/env node
/**
 * Notion Push Smoke Test
 *
 * Exercises the exact path the app uses:
 *   1. Create a page in Master Inventory with the canonical property shape
 *      produced by src/lib/notion-service.ts `pushListing`.
 *   2. Patch its Status (simulating the 'ready' → 'published' transition done
 *      immediately after a successful push).
 *   3. Patch it to 'sold' (simulating the sold → shipped transition).
 *   4. Archive the page so we don't pollute the live DB.
 *
 * Reads NOTION_API_KEY from .env.local. DB ID is hard-coded to the canonical
 * Master Inventory UUID; override with NOTION_INVENTORY_DATABASE_ID if needed.
 *
 * Usage: node scripts/test-notion-push.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')

// ── Load .env.local (no dotenv dep) ──────────────────────────────────────────
const envPath = path.join(repoRoot, '.env.local')
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
}

const apiKey = process.env.NOTION_API_KEY || process.env.VITE_NOTION_API_KEY
if (!apiKey) {
  console.error('❌ NOTION_API_KEY missing from .env.local')
  process.exit(1)
}

function normalizeUuid(id) {
  if (typeof id !== 'string') return id
  const hex = id.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) return id
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const dbId = normalizeUuid(
  process.env.NOTION_INVENTORY_DATABASE_ID ||
    process.env.VITE_NOTION_DATABASE_ID ||
    '3318ed3e-1385-45d3-9a60-63a628eeefff',
)

const headers = {
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
}

async function notion(method, pathname, body) {
  const res = await fetch(`https://api.notion.com/v1${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = new Error(data?.message || `${res.status} ${res.statusText}`)
    err.status = res.status
    err.payload = data
    throw err
  }
  return data
}

function rt(content) {
  return { rich_text: [{ text: { content: (content || '').slice(0, 2000) } }] }
}

// Mirror the full property shape pushListing produces
function buildTestProperties() {
  const title = `🧪 RSP Smoke Test · ${new Date().toISOString()}`
  return {
    // GROUP 1
    'Item Name': { title: [{ text: { content: title } }] },
    Category: { select: { name: 'Electronics' } },
    // GROUP 2
    Condition: { select: { name: 'Used – Good' } },
    // GROUP 3
    'Purchase Price': { number: 5.0 },
    'Listing Price': { number: 25.0 },
    'Min Acceptable Price': { number: 7.5 },
    'eBay Listing Type': { select: { name: 'Buy It Now' } },
    // GROUP 4
    'Shipping Strategy': { select: { name: 'USPS Ground Advantage' } },
    'Free Shipping': { checkbox: true },
    'Handling Time': { select: { name: '🟢 1 Day' } },
    'Ship From ZIP': rt('32806'),
    'Local Pickup': { checkbox: false },
    'Return Policy': { select: { name: '✅ 30-Day Free Returns' } },
    // GROUP 5
    'AI Researched': { checkbox: true },
    'Photos Taken': { checkbox: false },
    'Date Acquired': { date: { start: new Date().toISOString() } },
    // Extended
    'SEO Title': rt('Smoke Test Item - Do Not Buy - RSP Automated Test'),
    Brand: rt('Test Brand'),
    'Item Description': rt('This is an automated smoke test from the RSP test-notion-push script. It should be archived immediately.'),
    'AI Confidence': { select: { name: 'High' } },
    'Market Notes': rt('Smoke test — auto-archived'),
    'Photo Count': { number: 0 },
    'Source / Vendor': rt('RSP Smoke Test'),
    // Session
    'Expense Type': { select: { name: '💼 Business' } },
    'Session #': { number: 9999 },
    'Session ID': rt('SMOKE-TEST'),
  }
}

const children = [
  {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Item Description' } }] },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          text: {
            content: 'Automated smoke test. Will be archived immediately.',
          },
        },
      ],
    },
  },
]

async function main() {
  console.log('🧪 Notion Push Smoke Test')
  console.log(`   DB: ${dbId}`)
  console.log(`   API key: ${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`)
  console.log('')

  let pageId = null
  let step = 'init'

  try {
    // ── Step 1: Retrieve DB (verifies API key + integration access) ────────
    step = 'retrieve-database'
    console.log('→ Retrieving DB schema (auth + access check)…')
    const db = await notion('GET', `/databases/${dbId}`)
    console.log(`  ✅ DB accessible: "${db.title?.[0]?.plain_text || '<untitled>'}"`)

    // ── Step 2: Create page with full property shape ───────────────────────
    step = 'create-page-full'
    console.log('→ Creating page with FULL property shape (mirrors pushListing)…')
    const created = await notion('POST', '/pages', {
      parent: { database_id: dbId },
      properties: buildTestProperties(),
      children,
    })
    pageId = created.id
    console.log(`  ✅ Page created: ${pageId}`)
    console.log(`     URL: ${created.url}`)

    // ── Step 3: Patch status → published ──────────────────────────────────
    step = 'status-published'
    console.log('→ Patching Status → "🟣 Listed – Awaiting Sale" (ready→published)…')
    await notion('PATCH', `/pages/${pageId}`, {
      properties: {
        Status: { select: { name: '🟣 Listed – Awaiting Sale' } },
      },
    })
    console.log('  ✅ Status updated')

    // ── Step 4: Patch status → sold ───────────────────────────────────────
    step = 'status-sold'
    console.log('→ Patching Status → "✅ Sold" + Sale Price + Date Sold…')
    await notion('PATCH', `/pages/${pageId}`, {
      properties: {
        Status: { select: { name: '✅ Sold' } },
        'Sale Price': { number: 25.0 },
        'Date Sold': { date: { start: new Date().toISOString() } },
        Carrier: { select: { name: 'USPS' } },
      },
    })
    console.log('  ✅ Sold transition ok')

    // ── Step 5: Archive ──────────────────────────────────────────────────
    step = 'archive'
    console.log('→ Archiving test page…')
    await notion('PATCH', `/pages/${pageId}`, { archived: true })
    console.log('  ✅ Archived (removed from Master Inventory)')

    console.log('')
    console.log('🎉 ALL CHECKS PASSED — push path is healthy.')
    process.exit(0)
  } catch (err) {
    console.error('')
    console.error(`❌ FAILED at step: ${step}`)
    console.error(`   Status: ${err.status || 'n/a'}`)
    console.error(`   Message: ${err.message}`)
    if (err.payload) {
      console.error('   Payload:')
      console.error(JSON.stringify(err.payload, null, 2).split('\n').map(l => '     ' + l).join('\n'))
    }
    if (pageId) {
      console.error('')
      console.error(`   Partial page was created: ${pageId} — attempting archive…`)
      try {
        await notion('PATCH', `/pages/${pageId}`, { archived: true })
        console.error('   ✅ Archived.')
      } catch (cleanupErr) {
        console.error(`   ⚠️  Archive failed: ${cleanupErr.message}`)
        console.error(`   Manual cleanup needed: ${pageId}`)
      }
    }
    process.exit(1)
  }
}

main()
