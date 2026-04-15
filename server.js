/**
 * Resale Scanner Pro — Static File Server
 * Vergara Inc · Loft OS v1.0
 *
 * Serves the Vite build output from dist/.
 * Same pattern as Sous Chef — proven on Railway.
 *
 * Railway injects PORT automatically. Do not hardcode it.
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Notion rejects 32-char hex IDs without dashes with HTTP 400. Normalize anything
// that's 32 hex chars (with or without existing dashes) into canonical 8-4-4-4-12
// UUID form. No-op for strings that don't match. Applied to env-var overrides so a
// legacy-format ID in Railway env never flows through to call sites that bypass the
// request-body normalizer in /api/notion/push.
function normalizeUuid(id) {
  if (typeof id !== 'string') return id
  const hex = id.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) return id
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const port    = Number(process.env.PORT || 3000)
const distDir = path.join(__dirname, 'dist')
const notionApiKey = process.env.NOTION_API_KEY || process.env.VITE_NOTION_API_KEY || ''
// Notion Master Inventory DB — source of truth for listed items (photos, price, SKU).
// Fallback is the canonical Master Inventory DB ID; Railway env var always wins.
// normalizeUuid() applied so an env-var override in legacy no-dashes format resolves
// to canonical form before any call site reads the constant.
const notionInventoryDbId = normalizeUuid(process.env.NOTION_INVENTORY_DATABASE_ID || process.env.VITE_NOTION_DATABASE_ID || '3318ed3e-1385-45d3-9a60-63a628eeefff')
// Notion Sales DB — source of truth for WF-01 email-parsed sales. Railway env var wins;
// fallback is the canonical Sales DB ID per the Sold Tab data contract.
const notionSalesDbId = normalizeUuid(process.env.NOTION_SALES_DATABASE_ID || 'a8a86796-187c-4ef8-9ac0-e92d9f8df665')
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ── eBay OAuth + Sell API config ─────────────────────────────────────────────
// EBAY_CERT_ID (Client Secret) MUST NEVER fall back to a VITE_ var — VITE_-prefixed
// vars are inlined into the public Vite bundle. The Client Secret is server-only.
// EBAY_APP_ID (Client ID) is a public identifier; VITE_ fallback is acceptable but
// flagged with a startup warning so the deprecated path is visible.
const ebayAppId = process.env.EBAY_APP_ID || process.env.VITE_EBAY_APP_ID || ''
const ebayAppIdViaVitefallback = !process.env.EBAY_APP_ID && !!process.env.VITE_EBAY_APP_ID
const ebayCertId = process.env.EBAY_CERT_ID || ''
const ebayRedirectUri = process.env.EBAY_REDIRECT_URI || ''
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || ''
const ebaySandbox = process.env.EBAY_SANDBOX_MODE === 'true'
const ebayBaseUrl = ebaySandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
const ebayAuthBaseUrl = ebaySandbox ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com'
// Single-instance Railway deploy → in-memory nonce store survives the auth-url →
// callback round-trip in normal operation. If Railway restarts mid-flow, ED just
// hits /api/ebay/auth-url again — there's no user-facing impact.
const ebayOAuthNonces = new Map() // nonce → expiry timestamp (ms)
const EBAY_NONCE_TTL_MS = 10 * 60 * 1000 // 10 min
const EBAY_OAUTH_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
].join(' ')
const EBAY_MERCHANT_LOCATION_KEY = 'hobbyst-orlando'
// Fixed UUID for the ebay_tokens singleton row. The table always holds exactly
// one row; using a known ID lets us UPSERT (Prefer: resolution=merge-duplicates)
// instead of DELETE+INSERT, which avoids PostgREST's UUID-parse error on
// ?id=neq.null (PostgREST treats the string "null" as a literal UUID value).
const EBAY_TOKENS_SINGLETON_ID = '00000000-0000-0000-0000-000000000001'

const DEFAULT_SHIP_FROM_ZIP = '32806'
const VALID_SHIPPING_STATUSES = new Set(['🔴 Need Label', '🟡 Label Ready', '📦 Packed', '✅ Shipped'])
const VALID_LABEL_PROVIDERS = new Set([
  '🏴‍☠️ Pirate Ship',
  '🛒 eBay Label',
  '🟢 Mercari Label',
  '🩷 Poshmark Label',
  '📮 USPS Direct',
  '📦 UPS Direct',
  '🟠 FedEx Direct',
])
const VALID_DELIST_STATUSES = new Set([
  '⏳ Pending Delist',
  '✅ Delisted — All Platforms',
  '⚠️ Manual Delist Needed',
])

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large'))
      }
    })
    req.on('end', () => {
      if (!body) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init)
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = data?.message || data?.error || `${response.status} ${response.statusText}`
    const error = new Error(message)
    error.status = response.status
    error.payload = data
    throw error
  }
  return data
}

function notionHeaders() {
  if (!notionApiKey) {
    throw new Error('Notion API key is not configured on the server.')
  }

  return {
    'Authorization': `Bearer ${notionApiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  }
}

async function notionRequest(pathname, init = {}) {
  return fetchJson(`https://api.notion.com/v1${pathname}`, {
    ...init,
    headers: {
      ...notionHeaders(),
      ...(init.headers || {}),
    },
  })
}

function supabaseHeaders() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials are not configured on the server.')
  }

  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  }
}

// Service-role headers — required for tables under RLS USING(false), like ebay_tokens.
// Never expose the service role key to the frontend; it bypasses ALL RLS policies.
function supabaseServiceHeaders() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase service role credentials are not configured on the server.')
  }

  return {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  }
}

// Throws if a Supabase REST response wasn't 2xx. Raw fetch (vs fetchJson) is needed
// for DELETE/PATCH/INSERT with Prefer:return=minimal because the body is empty —
// fetchJson would try to JSON-parse "" and fail. We still want loud errors though.
async function assertSupabaseOk(response, label) {
  if (response.ok) return
  let bodyText = ''
  try { bodyText = await response.text() } catch {}
  const err = new Error(`Supabase ${label} failed: ${response.status} ${bodyText.slice(0, 200)}`)
  err.status = response.status
  throw err
}

// Sweep expired nonces to keep the Map bounded. Called on each /api/ebay/auth-url hit.
function pruneEbayNonces() {
  const now = Date.now()
  for (const [nonce, expiresAt] of ebayOAuthNonces) {
    if (expiresAt < now) ebayOAuthNonces.delete(nonce)
  }
}

// Returns a valid eBay user access token, refreshing if it expires within 5 minutes.
// Throws Error('EBAY_OAUTH_NOT_COMPLETED') if no row exists in ebay_tokens — caller
// should translate to 503 with a clear instruction to visit /api/ebay/auth-url.
async function getValidEbayToken() {
  if (!ebayAppId || !ebayCertId) {
    throw new Error('EBAY_CREDENTIALS_MISSING')
  }
  // Fetch the singleton row by its known fixed ID — no ambiguity if stale
  // rows from earlier debugging are ever left behind.
  const rows = await fetchJson(
    `${supabaseUrl}/rest/v1/ebay_tokens?select=*&id=eq.${EBAY_TOKENS_SINGLETON_ID}`,
    { headers: supabaseServiceHeaders() }
  )
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
  if (!row) {
    const err = new Error('EBAY_OAUTH_NOT_COMPLETED')
    err.status = 503
    throw err
  }
  const expiresAtMs = new Date(row.expires_at).getTime()
  // Reuse if at least 5 min of life remains — eBay doesn't penalise unnecessary refreshes
  // but each call costs a round trip and burns rate limit headroom.
  if (expiresAtMs > Date.now() + 5 * 60 * 1000) {
    return row.access_token
  }
  // Refresh: POST to identity endpoint with grant_type=refresh_token + same scopes.
  const basicAuth = Buffer.from(`${ebayAppId}:${ebayCertId}`).toString('base64')
  const refreshBody = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
    scope: EBAY_OAUTH_SCOPES,
  }).toString()
  const tokenData = await fetchJson(`${ebayBaseUrl}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: refreshBody,
  })
  // PATCH the singleton row in place — refresh_token rotates only on full re-auth.
  const patchResp = await fetch(
    `${supabaseUrl}/rest/v1/ebay_tokens?id=eq.${EBAY_TOKENS_SINGLETON_ID}`,
    {
      method: 'PATCH',
      headers: { ...supabaseServiceHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        access_token: tokenData.access_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  )
  await assertSupabaseOk(patchResp, 'PATCH ebay_tokens (refresh)')
  return tokenData.access_token
}

function getPlainText(property) {
  if (!property) return ''
  if (property.type === 'title' || property.type === 'rich_text') {
    return (property[property.type] || []).map(part => part.plain_text || '').join('').trim()
  }
  if (property.type === 'select' || property.type === 'status') {
    return property[property.type]?.name || ''
  }
  if (property.type === 'date') {
    return property.date?.start || ''
  }
  if (property.type === 'url') {
    return property.url || ''
  }
  if (property.type === 'checkbox') {
    return property.checkbox ? 'true' : ''
  }
  if (property.type === 'multi_select') {
    return (property.multi_select || []).map(option => option.name).join(', ')
  }
  if (property.type === 'number') {
    return property.number == null ? '' : String(property.number)
  }
  return ''
}

function getNumber(property) {
  if (!property) return null
  if (property.type === 'number' && typeof property.number === 'number') return property.number
  const parsed = Number.parseFloat(getPlainText(property).replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function getSelectName(property) {
  if (!property) return null
  if (property.type === 'select') return property.select?.name || null
  if (property.type === 'status') return property.status?.name || null
  return null
}

function getDateValue(property) {
  if (!property || property.type !== 'date') return null
  return property.date?.start || null
}

function getCheckboxValue(property) {
  if (!property || property.type !== 'checkbox') return false
  return Boolean(property.checkbox)
}

function getRelationIds(property) {
  if (!property || property.type !== 'relation') return []
  return (property.relation || []).map(entry => entry.id)
}

function getFileUrl(property) {
  if (!property || property.type !== 'files') return null
  const file = (property.files || [])[0]
  if (!file) return null
  if (file.type === 'external') return file.external?.url || null
  if (file.type === 'file') return file.file?.url || null
  return null
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^[a-z]+ sale -\s*/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function extractZip(text) {
  const match = String(text || '').match(/\b\d{5}(?:-\d{4})?\b/)
  return match ? match[0] : null
}

function extractSaleItemTitle(name, snippet) {
  const explicit = String(snippet || '').match(/Item Title:\s*(.+?)\s+Sale Price:/i)
  if (explicit?.[1]) return explicit[1].trim()
  return String(name || '').replace(/^[a-z]+ sale -\s*/i, '').trim() || 'Untitled sale'
}

function normalizeInventoryPage(page) {
  const properties = page.properties || {}
  // Notion Master Inventory schema — exact property names (case-sensitive):
  // "Photo Links" is a URL property, not a Files property.
  // "Listing Price" / "Purchase Price" are the canonical numeric fields.
  // "Model / SKU" / "eBay Item Number" are the identifier text fields.
  return {
    pageId: page.id,
    title: getPlainText(properties['Item Name']),
    photoUrl: properties['Photo Links']?.url || null,
    status: getSelectName(properties['Status']),
    listedPrice: getNumber(properties['Listing Price']),
    costOfGoods: getNumber(properties['Purchase Price']),
    sku: getPlainText(properties['Model / SKU']),
    ebayListingId: getPlainText(properties['eBay Item Number']),
  }
}

function normalizeSalePage(page) {
  const properties = page.properties || {}
  const rawSnippet = getPlainText(properties['Raw Email Snippet'])
  const name = getPlainText(properties['Name'])
  return {
    pageId: page.id,
    title: name,
    itemTitle: extractSaleItemTitle(name, rawSnippet),
    relationIds: getRelationIds(properties['Item']),
    orderNumber: getPlainText(properties['Order Number']) || null,
    salePrice: getNumber(properties['Sale Price']),
    platformFee: getNumber(properties['Platform Fee']),
    saleDate: getDateValue(properties['Sale Date']) || null,
    platform: getSelectName(properties['Platform']) || 'Other',
    shippingStatus: getSelectName(properties['Shipping Status']) || (getCheckboxValue(properties['Shipped']) ? '✅ Shipped' : '🔴 Need Label'),
    delistStatus: getSelectName(properties['Delist Status']) || null,
    trackingNumber: getPlainText(properties['Tracking Number']) || null,
    labelProvider: getSelectName(properties['Label Provider']) || null,
    labelCost: getPlainText(properties['Label Cost']) || null,
    labelUrl: getPlainText(properties['Label URL']) || null,
    shipFromZip: getPlainText(properties['Ship From ZIP']) || DEFAULT_SHIP_FROM_ZIP,
    buyerZip: getPlainText(properties['Buyer ZIP']) || extractZip(rawSnippet),
    packageDims: getPlainText(properties['Package Dims']) || null,
    itemWeightLbs: getPlainText(properties['Item Weight lbs']) || null,
    buyerInfo: getPlainText(properties['Buyer Info']) || null,
    rawEmailSnippet: rawSnippet || null,
    createdAt: page.created_time,
  }
}

function scoreSaleRecord(sale) {
  let score = 0
  if (sale.relationIds.length) score += 4
  if (sale.buyerZip) score += 2
  if (sale.shippingStatus && sale.shippingStatus !== '🔴 Need Label') score += 2
  if (sale.packageDims) score += 1
  if (sale.itemWeightLbs) score += 1
  if (sale.labelProvider) score += 1
  if (sale.trackingNumber) score += 1
  return score
}

function dedupeSales(sales) {
  const deduped = new Map()

  for (const sale of sales) {
    const key = [sale.orderNumber || 'no-order', normalizeKey(sale.itemTitle), sale.saleDate || 'no-date'].join('|')
    const existing = deduped.get(key)

    if (!existing) {
      deduped.set(key, sale)
      continue
    }

    const existingScore = scoreSaleRecord(existing)
    const currentScore = scoreSaleRecord(sale)
    if (currentScore > existingScore || (currentScore === existingScore && sale.createdAt > existing.createdAt)) {
      deduped.set(key, sale)
    }
  }

  return Array.from(deduped.values())
}

function normalizeScanRow(row) {
  return {
    title: row.title || '',
    notionPageId: row.notion_page_id || null,
    ebayListingId: row.ebay_listing_id || null,
    rawAnalysis: row.raw_analysis || {},
  }
}

function buildLookup(items, keySelector) {
  const map = new Map()
  for (const item of items) {
    const key = keySelector(item)
    if (!key) continue
    map.set(key, item)
  }
  return map
}

async function querySalesPages() {
  const response = await notionRequest(`/databases/${notionSalesDbId}/query`, {
    method: 'POST',
    body: JSON.stringify({
      page_size: 100,
      sorts: [
        { property: 'Sale Date', direction: 'descending' },
        { timestamp: 'created_time', direction: 'descending' },
      ],
    }),
  })
  return (response.results || []).map(normalizeSalePage)
}

async function queryInventoryPages() {
  const response = await notionRequest(`/databases/${notionInventoryDbId}/query`, {
    method: 'POST',
    body: JSON.stringify({
      page_size: 100,
      filter: {
        or: [
          { property: 'Status', select: { equals: '✅ Sold' } },
          { property: 'Date Sold', date: { is_not_empty: true } },
        ],
      },
      sorts: [
        { timestamp: 'last_edited_time', direction: 'descending' },
      ],
    }),
  })
  return (response.results || []).map(normalizeInventoryPage)
}

async function querySupabaseScans() {
  if (!supabaseUrl || !supabaseAnonKey) return []

  const response = await fetch(`${supabaseUrl}/rest/v1/scans?select=*&order=created_at.desc&limit=200`, {
    headers: supabaseHeaders(),
  })

  if (!response.ok) return []
  const rows = await response.json()
  return rows.map(normalizeScanRow)
}

async function probeSupabaseSalesTable() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { available: false, warning: 'Supabase credentials are not configured on the server.' }
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/sales?select=id&limit=1`, {
    headers: supabaseHeaders(),
  })

  if (response.status === 404) {
    return { available: false, warning: 'Supabase sales table is not present; using live Notion Sales DB directly.' }
  }

  if (!response.ok) {
    return { available: false, warning: `Supabase sales probe failed with HTTP ${response.status}.` }
  }

  return { available: true, warning: null }
}

function buildSoldItems(sales, inventoryPages, scans) {
  const inventoryById = buildLookup(inventoryPages, item => item.pageId)
  const inventoryByTitle = buildLookup(inventoryPages, item => normalizeKey(item.title))
  const scansByNotionId = buildLookup(scans, item => item.notionPageId)
  const scansByEbayListingId = buildLookup(scans, item => item.ebayListingId)
  const scansByTitle = buildLookup(scans, item => normalizeKey(item.title))

  return dedupeSales(sales).map((sale) => {
    const relatedInventory = sale.relationIds.map(id => inventoryById.get(id)).find(Boolean)
    const titleKey = normalizeKey(sale.itemTitle)
    const inventory = relatedInventory || inventoryByTitle.get(titleKey) || null
    const scan =
      (inventory?.pageId ? scansByNotionId.get(inventory.pageId) : null) ||
      (inventory?.ebayListingId ? scansByEbayListingId.get(inventory.ebayListingId) : null) ||
      scansByTitle.get(titleKey) ||
      null

    // Compute net income: sale price minus platform fee minus label cost (best-effort parse)
    const labelCostNumber = sale.labelCost ? Number.parseFloat(String(sale.labelCost).replace(/[^0-9.]/g, '')) : null
    const netIncome = typeof sale.salePrice === 'number'
      ? sale.salePrice - (sale.platformFee || 0) - (Number.isFinite(labelCostNumber) ? labelCostNumber : 0)
      : null

    return {
      id: sale.pageId,
      salePageId: sale.pageId,
      inventoryPageId: inventory?.pageId || sale.relationIds[0] || null,
      title: inventory?.title || sale.itemTitle,
      imageUrl: inventory?.photoUrl || null,
      platform: sale.platform,
      salePrice: sale.salePrice,
      platformFee: sale.platformFee,
      netIncome: typeof netIncome === 'number' ? Math.round(netIncome * 100) / 100 : null,
      saleDate: sale.saleDate,
      shippingStatus: VALID_SHIPPING_STATUSES.has(sale.shippingStatus) ? sale.shippingStatus : '🔴 Need Label',
      delistStatus: VALID_DELIST_STATUSES.has(sale.delistStatus) ? sale.delistStatus : sale.delistStatus || null,
      trackingNumber: sale.trackingNumber,
      labelProvider: sale.labelProvider,
      labelCost: sale.labelCost,
      labelUrl: sale.labelUrl,
      buyerZip: sale.buyerZip,
      buyerInfo: sale.buyerInfo,
      shipFromZip: sale.shipFromZip || DEFAULT_SHIP_FROM_ZIP,
      packageDims: sale.packageDims || scan?.rawAnalysis?.package_dims || null,
      itemWeightLbs: sale.itemWeightLbs || scan?.rawAnalysis?.weight_lbs || null,
      orderNumber: sale.orderNumber,
      rawEmailSnippet: sale.rawEmailSnippet,
      inventoryStatus: inventory?.status || null,
      metadataSource: inventory ? 'inventory' : scan ? 'scan' : 'sale',
    }
  })
}

function buildShippingProperties(update) {
  const properties = {
    'Shipping Status': { select: { name: update.shippingStatus } },
    'Shipped': { checkbox: update.shippingStatus === '✅ Shipped' },
  }

  if (typeof update.shipFromZip === 'string') {
    properties['Ship From ZIP'] = { rich_text: update.shipFromZip ? [{ text: { content: update.shipFromZip } }] : [] }
  }

  if (typeof update.trackingNumber === 'string') {
    properties['Tracking Number'] = { rich_text: update.trackingNumber ? [{ text: { content: update.trackingNumber } }] : [] }
  }

  if (typeof update.labelProvider === 'string' && VALID_LABEL_PROVIDERS.has(update.labelProvider)) {
    properties['Label Provider'] = { select: { name: update.labelProvider } }
  }

  if (typeof update.labelCost === 'string') {
    properties['Label Cost'] = { rich_text: update.labelCost ? [{ text: { content: update.labelCost } }] : [] }
  }

  if (typeof update.labelUrl === 'string') {
    properties['Label URL'] = { url: update.labelUrl || null }
  }

  if (typeof update.packageDims === 'string') {
    properties['Package Dims'] = { rich_text: update.packageDims ? [{ text: { content: update.packageDims } }] : [] }
  }

  if (typeof update.itemWeightLbs === 'string') {
    properties['Item Weight lbs'] = { rich_text: update.itemWeightLbs ? [{ text: { content: update.itemWeightLbs } }] : [] }
  }

  if (typeof update.shipNotes === 'string') {
    properties['Ship Notes'] = { rich_text: update.shipNotes ? [{ text: { content: update.shipNotes } }] : [] }
  }

  if (typeof update.delistStatus === 'string' && VALID_DELIST_STATUSES.has(update.delistStatus)) {
    properties['Delist Status'] = { select: { name: update.delistStatus } }
  }

  if (update.shippingStatus === '✅ Shipped') {
    const shipDateIso = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const returnWindow = new Date(shipDateIso)
    returnWindow.setDate(returnWindow.getDate() + 30)
    const returnWindowIso = returnWindow.toISOString().split('T')[0] // YYYY-MM-DD

    properties['Ship Date'] = { date: { start: shipDateIso } }
    properties['Loop Status'] = { rich_text: [{ text: { content: `CLOSED — return window through ${returnWindowIso}` } }] }
    properties['Return Window Ends'] = { date: { start: returnWindowIso } }
  }

  return properties
}

async function getSoldFeed() {
  const warnings = []
  // Use allSettled so a single failing source (e.g. Notion integration not
  // invited to one DB, Supabase creds missing) degrades gracefully instead of
  // taking the whole sold feed offline.
  const [salesResult, inventoryResult, scansResult, salesProbeResult] = await Promise.allSettled([
    querySalesPages(),
    queryInventoryPages(),
    querySupabaseScans(),
    probeSupabaseSalesTable(),
  ])

  const sales = salesResult.status === 'fulfilled' ? salesResult.value : []
  const inventoryPages = inventoryResult.status === 'fulfilled' ? inventoryResult.value : []
  const scans = scansResult.status === 'fulfilled' ? scansResult.value : []
  const salesProbe = salesProbeResult.status === 'fulfilled'
    ? salesProbeResult.value
    : { available: false, warning: null }

  if (salesResult.status === 'rejected') {
    const msg = salesResult.reason instanceof Error ? salesResult.reason.message : String(salesResult.reason)
    console.error('[sold-items] sales DB query failed:', msg)
    warnings.push(`Notion Sales DB unavailable: ${msg}`)
  }
  if (inventoryResult.status === 'rejected') {
    const msg = inventoryResult.reason instanceof Error ? inventoryResult.reason.message : String(inventoryResult.reason)
    console.error('[sold-items] inventory DB query failed:', msg)
    warnings.push(`Notion Inventory DB unavailable: ${msg}`)
  }
  if (scansResult.status === 'rejected') {
    const msg = scansResult.reason instanceof Error ? scansResult.reason.message : String(scansResult.reason)
    console.error('[sold-items] supabase scans query failed:', msg)
    warnings.push(`Supabase scans unavailable: ${msg}`)
  }
  if (salesProbe.warning) {
    warnings.push(salesProbe.warning)
  }

  return {
    items: buildSoldItems(sales, inventoryPages, scans),
    warnings,
    fetchedAt: Date.now(),
  }
}

// Cache-Control strategy for static assets:
// - /assets/* — Vite emits content-hashed filenames (index-ABC123.js), so the URL
//   itself changes when content changes. Safe to cache forever with `immutable`.
// - index.html — the only entry point that isn't hashed. MUST be revalidated on
//   every request so users pick up new deploys immediately after they land.
// - Everything else (favicon, manifest, unhashed assets) — short cache, browser
//   will revalidate on refresh but not on every navigation.
function cacheControlFor(urlPath) {
  if (urlPath.startsWith('/assets/')) {
    return 'public, max-age=31536000, immutable'
  }
  if (urlPath === '/index.html' || urlPath === '/') {
    return 'no-cache, no-store, must-revalidate'
  }
  return 'public, max-age=3600'
}

function sendFile(res, filePath, urlPath = '') {
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': cacheControlFor(urlPath),
  })
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  // Health check for Railway
  if (requestUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('ok')
    return
  }

  // Debug endpoint — diagnose dist/ availability at runtime
  if (requestUrl.pathname === '/debug') {
    const distExists = fs.existsSync(distDir)
    let distFiles = null
    if (distExists) {
      try {
        distFiles = fs.readdirSync(distDir)
      } catch (e) {
        distFiles = `error reading dir: ${e.message}`
      }
    }
    const payload = {
      cwd: process.cwd(),
      __dirname,
      distDir,
      distExists,
      distFiles,
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(payload, null, 2))
    return
  }

  // ── Notion health — preflight check the Settings screen can call anytime.
  // Verifies: (1) API key present, (2) DB reachable, (3) integration has read
  // access to the target DB. A successful 200 implies push should work too —
  // the same credentials authorize /pages POST.
  if (requestUrl.pathname === '/api/notion/health' && req.method === 'GET') {
    try {
      if (!notionApiKey) {
        sendJson(res, 503, {
          ok: false,
          stage: 'api-key',
          error: 'NOTION_API_KEY is not configured on the server.',
        })
        return
      }
      const dbId = normalizeUuid(requestUrl.searchParams.get('dbId') || notionInventoryDbId)
      const db = await notionRequest(`/databases/${dbId}`)
      const dbTitle = db?.title?.[0]?.plain_text || '<untitled>'
      const propertyCount = db?.properties ? Object.keys(db.properties).length : 0
      sendJson(res, 200, {
        ok: true,
        dbId,
        dbTitle,
        propertyCount,
      })
    } catch (error) {
      const status = error.status || 500
      console.error('[notion/health] failed:', error.message)
      sendJson(res, status, {
        ok: false,
        stage: 'retrieve-database',
        error: error.message,
        ...(error.payload || {}),
      })
    }
    return
  }

  // ── Notion proxy — browser can't call api.notion.com directly (CORS) ──
  if (requestUrl.pathname === '/api/notion/push' && req.method === 'POST') {
    try {
      const body = await readRequestBody(req)
      // Defensive normalization: older frontend defaults stored the DB ID without dashes,
      // which Notion API rejects with HTTP 400. Canonicalize before forwarding.
      if (body?.parent?.database_id) {
        body.parent.database_id = normalizeUuid(body.parent.database_id)
      }
      const result = await notionRequest('/pages', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      sendJson(res, 200, result)
    } catch (error) {
      const status = error.status || 500
      console.error('[notion/push] failed:', error.message)
      sendJson(res, status, { error: error.message, ...(error.payload || {}) })
    }
    return
  }

  const notionStatusMatch = requestUrl.pathname.match(/^\/api\/notion\/status\/([^/]+)$/)
  if (notionStatusMatch && req.method === 'PATCH') {
    try {
      const pageId = notionStatusMatch[1]
      const body = await readRequestBody(req)
      const result = await notionRequest(`/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      sendJson(res, 200, result)
    } catch (error) {
      const status = error.status || 500
      console.error('[notion/status] failed:', error.message)
      sendJson(res, status, { error: error.message, ...(error.payload || {}) })
    }
    return
  }

  // ── eBay OAuth — Route A: build authorization URL for ED to visit once ──
  // ED hits this in a browser, gets a JSON {authUrl}, opens that URL, signs in
  // to eBay, grants the seller scopes, and gets redirected to /oauth-callback.
  if (requestUrl.pathname === '/api/ebay/auth-url' && req.method === 'GET') {
    try {
      if (!ebayAppId || !ebayCertId || !ebayRedirectUri) {
        sendJson(res, 503, {
          error: 'eBay OAuth credentials not configured on the server.',
          missing: {
            EBAY_APP_ID: !ebayAppId,
            EBAY_CERT_ID: !ebayCertId,
            EBAY_REDIRECT_URI: !ebayRedirectUri,
          },
        })
        return
      }
      pruneEbayNonces()
      // 32-char hex nonce — sufficient entropy for CSRF protection on a one-off admin flow.
      const nonce = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')
      ebayOAuthNonces.set(nonce, Date.now() + EBAY_NONCE_TTL_MS)
      const params = new URLSearchParams({
        client_id: ebayAppId,
        response_type: 'code',
        redirect_uri: ebayRedirectUri,
        scope: EBAY_OAUTH_SCOPES,
        state: nonce,
      })
      const authUrl = `${ebayAuthBaseUrl}/oauth2/authorize?${params.toString()}`
      sendJson(res, 200, { authUrl, sandbox: ebaySandbox })
    } catch (error) {
      console.error('[ebay/auth-url] failed:', error.message)
      sendJson(res, 500, { error: error.message })
    }
    return
  }

  // ── eBay OAuth — Route B: callback handler. eBay redirects ED here with ?code= ──
  // Exchanges the auth code for access + refresh tokens, stores them in ebay_tokens
  // (DELETE + INSERT — single-row table, never upsert), returns a confirmation page.
  if (requestUrl.pathname === '/api/ebay/oauth-callback' && req.method === 'GET') {
    try {
      const code = requestUrl.searchParams.get('code')
      const state = requestUrl.searchParams.get('state')
      const ebayError = requestUrl.searchParams.get('error')
      // DIAG-1: confirm route is reached and basic env state
      console.log('[oauth-cb] route hit', {
        hasCode: !!code,
        hasState: !!state,
        hasEbayError: !!ebayError,
        ebayAppId: ebayAppId ? `${ebayAppId.slice(0, 8)}…` : 'MISSING',
        ebayCertId: ebayCertId ? '✅ set' : '❌ MISSING',
        supabaseUrl: supabaseUrl ? `${supabaseUrl.slice(0, 32)}…` : 'MISSING',
        supabaseServiceKey: supabaseServiceKey ? '✅ set' : '❌ MISSING',
        sandbox: ebaySandbox,
      })
      if (!ebayAppId || !ebayCertId || !ebayRedirectUri) {
        res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h1>503 — eBay OAuth credentials not configured on the server.</h1>')
        return
      }
      if (ebayError) {
        const desc = requestUrl.searchParams.get('error_description') || ''
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<h1>eBay OAuth error</h1><p><strong>${ebayError}</strong>: ${desc}</p>`)
        return
      }
      if (!code || !state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h1>400 — Missing code or state parameter</h1>')
        return
      }
      pruneEbayNonces()
      if (!ebayOAuthNonces.has(state)) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h1>400 — Invalid or expired state nonce. Visit /api/ebay/auth-url again.</h1>')
        return
      }
      ebayOAuthNonces.delete(state)

      // Exchange auth code → tokens. Basic auth = base64(client_id:client_secret).
      const basicAuth = Buffer.from(`${ebayAppId}:${ebayCertId}`).toString('base64')
      const exchangeBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: ebayRedirectUri,
      }).toString()
      const tokenData = await fetchJson(`${ebayBaseUrl}/identity/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: exchangeBody,
      })
      // DIAG-2: confirm token exchange response shape
      console.log('[oauth-cb] token received', {
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        refreshExpiresIn: tokenData.refresh_token_expires_in,
        ebayUserId: tokenData.ebay_user_id || 'not-in-token',
      })

      // Singleton UPSERT: the ebay_tokens table is designed to hold exactly
      // one row. Using a fixed ID + Prefer:resolution=merge-duplicates makes
      // this atomic and race-free — no DELETE+INSERT window where the row
      // doesn't exist. Previous DELETE-then-INSERT approach failed because
      // PostgREST's ?id=neq.null treated the string "null" as a literal UUID.
      const upsertPayload = {
        id: EBAY_TOKENS_SINGLETON_ID,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || 'User',
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        refresh_expires_at: tokenData.refresh_token_expires_in
          ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000).toISOString()
          : null,
        scope: tokenData.scope || EBAY_OAUTH_SCOPES,
        updated_at: new Date().toISOString(),
      }
      const upsertResp = await fetch(
        `${supabaseUrl}/rest/v1/ebay_tokens?on_conflict=id`,
        {
          method: 'POST',
          headers: {
            ...supabaseServiceHeaders(),
            Prefer: 'resolution=merge-duplicates, return=minimal',
          },
          body: JSON.stringify(upsertPayload),
        }
      )
      // DIAG-3: UPSERT result (replaced old DIAG-3/4 DELETE+INSERT pair)
      console.log('[oauth-cb] UPSERT result', { status: upsertResp.status, ok: upsertResp.ok })
      if (!upsertResp.ok) {
        const errBody = await upsertResp.text().catch(() => '')
        console.error('[oauth-cb] UPSERT error body:', errBody)
      }
      await assertSupabaseOk(upsertResp, 'UPSERT ebay_tokens')

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<!doctype html><html><head><title>eBay Connected</title>` +
        `<style>body{font-family:system-ui;background:#0a0a0a;color:#fff;padding:48px;text-align:center}` +
        `h1{color:#10b981;font-size:32px}p{color:#a3a3a3;font-size:16px}code{background:#1a1a1a;padding:8px 12px;border-radius:6px}</style>` +
        `</head><body><h1>✅ eBay account connected</h1>` +
        `<p>Tokens stored. You can close this tab and return to RSP.</p>` +
        `<p style="margin-top:24px"><code>Mode: ${ebaySandbox ? 'SANDBOX' : 'PRODUCTION'}</code></p>` +
        `</body></html>`
      )
    } catch (error) {
      console.error('[ebay/oauth-callback] failed:', error.message, error.payload || '')
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<h1>500 — Token exchange failed</h1><pre>${error.message}</pre>`)
    }
    return
  }

  // ── eBay OAuth — Route C: manual refresh trigger (debugging / verification) ──
  // Production code paths use getValidEbayToken() which refreshes inline; this
  // route exists so ED can confirm the refresh path works after STOP-1.
  if (requestUrl.pathname === '/api/ebay/refresh-token' && req.method === 'POST') {
    try {
      const accessToken = await getValidEbayToken()
      sendJson(res, 200, {
        ok: true,
        accessTokenPreview: `${accessToken.slice(0, 16)}…(${accessToken.length} chars)`,
      })
    } catch (error) {
      const status = error.status || 500
      console.error('[ebay/refresh-token] failed:', error.message)
      sendJson(res, status, { error: error.message })
    }
    return
  }

  // ── eBay setup-policies — fetch fulfillment/return/payment policy IDs and ensure
  // the merchant inventory location exists. Run once after OAuth completes (STOP-2).
  // ED takes the returned IDs and adds them to Railway as EBAY_*_POLICY_ID env vars.
  if (requestUrl.pathname === '/api/ebay/setup-policies' && req.method === 'GET') {
    try {
      const accessToken = await getValidEbayToken()
      const ebayAuthHeaders = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Language': 'en-US',
      }

      // Fetch all three policy lists in parallel — independent reads.
      const [fulfillment, returns, payment] = await Promise.all([
        fetchJson(
          `${ebayBaseUrl}/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US`,
          { headers: ebayAuthHeaders }
        ).catch(e => ({ error: e.message, status: e.status })),
        fetchJson(
          `${ebayBaseUrl}/sell/account/v1/return_policy?marketplace_id=EBAY_US`,
          { headers: ebayAuthHeaders }
        ).catch(e => ({ error: e.message, status: e.status })),
        fetchJson(
          `${ebayBaseUrl}/sell/account/v1/payment_policy?marketplace_id=EBAY_US`,
          { headers: ebayAuthHeaders }
        ).catch(e => ({ error: e.message, status: e.status })),
      ])

      // Merchant inventory location — create if it doesn't exist. eBay returns 404
      // for missing locations, so we use a raw fetch to inspect the status code
      // instead of fetchJson (which throws on non-2xx).
      let locationStatus = 'unknown'
      let locationCreatedNow = false
      const locationCheck = await fetch(
        `${ebayBaseUrl}/sell/inventory/v1/location/${EBAY_MERCHANT_LOCATION_KEY}`,
        { headers: ebayAuthHeaders }
      )
      if (locationCheck.status === 200) {
        const locData = await locationCheck.json().catch(() => ({}))
        locationStatus = locData.merchantLocationStatus || 'EXISTS'
      } else if (locationCheck.status === 404) {
        // Create it. Address is the canonical Hobbyst Resale Orlando HQ (32806).
        const createResp = await fetch(
          `${ebayBaseUrl}/sell/inventory/v1/location/${EBAY_MERCHANT_LOCATION_KEY}`,
          {
            method: 'POST',
            headers: ebayAuthHeaders,
            body: JSON.stringify({
              location: {
                address: {
                  addressLine1: '1 Hobbyst HQ',
                  city: 'Orlando',
                  stateOrProvince: 'FL',
                  postalCode: DEFAULT_SHIP_FROM_ZIP,
                  country: 'US',
                },
              },
              locationTypes: ['WAREHOUSE'],
              name: 'Hobbyst Resale Orlando',
              merchantLocationStatus: 'ENABLED',
            }),
          }
        )
        if (createResp.ok || createResp.status === 204) {
          locationStatus = 'ENABLED'
          locationCreatedNow = true
        } else {
          const errText = await createResp.text().catch(() => '')
          locationStatus = `create-failed-${createResp.status}: ${errText.slice(0, 200)}`
        }
      } else {
        locationStatus = `check-failed-${locationCheck.status}`
      }

      sendJson(res, 200, {
        ok: true,
        sandbox: ebaySandbox,
        merchantLocation: {
          key: EBAY_MERCHANT_LOCATION_KEY,
          status: locationStatus,
          createdNow: locationCreatedNow,
        },
        fulfillmentPolicies: fulfillment,
        returnPolicies: returns,
        paymentPolicies: payment,
        instructions: 'Add the chosen policy IDs to Railway as EBAY_FULFILLMENT_POLICY_ID, EBAY_RETURN_POLICY_ID, EBAY_PAYMENT_POLICY_ID before Phase B.',
      })
    } catch (error) {
      const status = error.status || 500
      console.error('[ebay/setup-policies] failed:', error.message, error.payload || '')
      sendJson(res, status, { error: error.message, ...(error.payload || {}) })
    }
    return
  }

  if (requestUrl.pathname === '/api/sold-items' && req.method === 'GET') {
    try {
      sendJson(res, 200, await getSoldFeed())
    } catch (error) {
      console.error('[sold-items] failed to build feed', error)
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Failed to load sold items.' })
    }
    return
  }

  const shippingMatch = requestUrl.pathname.match(/^\/api\/sold-items\/([^/]+)\/shipping$/)
  if (shippingMatch && req.method === 'POST') {
    try {
      const pageId = shippingMatch[1]
      const body = await readRequestBody(req)

      if (!VALID_SHIPPING_STATUSES.has(body.shippingStatus)) {
        sendJson(res, 400, { error: 'Invalid shipping status.' })
        return
      }

      await notionRequest(`/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: buildShippingProperties(body),
        }),
      })

      // Audit comment — written when the sold loop closes (Shipped).
      // Non-fatal: comment failure must never block the shipping status update.
      if (body.shippingStatus === '✅ Shipped') {
        const labelPart = body.labelProvider ? ` via ${body.labelProvider}` : ''
        const trackingPart = body.trackingNumber ? ` · Tracking ${body.trackingNumber}` : ''
        const auditText = `Shipped${labelPart}${trackingPart} · ${new Date().toISOString()}`
        notionRequest('/comments', {
          method: 'POST',
          body: JSON.stringify({
            parent: { page_id: pageId },
            rich_text: [{ type: 'text', text: { content: auditText } }],
          }),
        }).catch(err => {
          console.warn('[sold-items] audit comment failed (non-fatal):', err.message || err)
        })
      }

      const refreshedFeed = await getSoldFeed()
      const item = refreshedFeed.items.find(candidate => candidate.salePageId === pageId)
      if (!item) {
        sendJson(res, 404, { error: 'Updated sale item could not be reloaded.' })
        return
      }

      sendJson(res, 200, { item, warnings: refreshedFeed.warnings })
    } catch (error) {
      console.error('[sold-items] failed to update shipping state', error)
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Failed to update shipping state.' })
    }
    return
  }

  // Serve static file or fall back to index.html (SPA routing)
  const safePath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname
  const filePath = path.join(distDir, safePath.replace(/^\/+/, '').split('?')[0])

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath, safePath)
    return
  }

  // SPA fallback — all routes serve index.html. Always use '/index.html' as the
  // cache key so unknown routes get the no-cache policy, not the 1h default.
  const indexPath = path.join(distDir, 'index.html')
  if (fs.existsSync(indexPath)) {
    sendFile(res, indexPath, '/index.html')
    return
  }

  // dist/ not found — log for diagnosis
  if (!fs.existsSync(distDir)) {
    console.error(`[ERROR] dist/ directory not found at ${distDir}. Build output may not have been preserved in the runtime image.`)
  } else {
    console.error(`[ERROR] index.html not found inside ${distDir}. dist/ exists but may be empty or malformed.`)
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('not found')
})

server.listen(port, '0.0.0.0', () => {
  // Startup check — confirm dist/ is present before accepting traffic
  const distExists = fs.existsSync(distDir)
  if (distExists) {
    let fileCount = 0
    try { fileCount = fs.readdirSync(distDir).length } catch (_) {}
    console.log(`🔍 Resale Scanner Pro · http://localhost:${port}`)
    console.log(`✅ dist/ found at ${distDir} (${fileCount} entries)`)
  } else {
    console.error(`🔍 Resale Scanner Pro · http://localhost:${port}`)
    console.error(`❌ dist/ NOT found at ${distDir} — app will serve 404. Check that the build step ran and the output was preserved in the runtime image.`)
  }

  // Integration diagnostics — log which env vars are present so Railway logs
  // make it obvious whether the Sold tab / Notion sync will work at runtime.
  console.log(`🗄️  Notion: ${notionApiKey ? '✅ API key set' : '❌ NO API KEY — Sold tab will fail'} | Sales DB: ${notionSalesDbId} | Inventory DB: ${notionInventoryDbId}`)
  console.log(`🔌 Supabase: ${supabaseUrl && supabaseAnonKey ? '✅ credentials set' : '⚠️  credentials missing — scan history merge disabled'}`)
  // eBay OAuth diagnostics — Phase A (WO-RSP-008). All three required for OAuth routes.
  // SUPABASE_SERVICE_ROLE_KEY is required separately for token storage (RLS bypass).
  const ebayConfigParts = [
    ebayAppId ? '✅ App ID' : '❌ App ID',
    ebayCertId ? '✅ Cert ID' : '❌ Cert ID',
    ebayRedirectUri ? '✅ Redirect URI' : '❌ Redirect URI',
    supabaseServiceKey ? '✅ Service Role Key' : '❌ Service Role Key',
  ]
  console.log(`🛒 eBay OAuth: ${ebayConfigParts.join(' · ')} | Mode: ${ebaySandbox ? 'SANDBOX' : 'PRODUCTION'}`)
  if (ebayAppIdViaVitefallback) {
    console.warn('⚠️  EBAY_APP_ID falling back to deprecated VITE_EBAY_APP_ID. Set EBAY_APP_ID in Railway and remove the VITE_ var.')
  }
})
