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

const port    = Number(process.env.PORT || 3000)
const distDir = path.join(__dirname, 'dist')
const notionApiKey = process.env.NOTION_API_KEY || process.env.VITE_NOTION_API_KEY || ''
// Notion Master Inventory DB — source of truth for listed items (photos, price, SKU).
// Fallback is the canonical Master Inventory DB ID; Railway env var always wins.
const notionInventoryDbId = process.env.NOTION_INVENTORY_DATABASE_ID || process.env.VITE_NOTION_DATABASE_ID || '3318ed3e-1385-45d3-9a60-63a628eeefff'
// Notion Sales DB — source of truth for WF-01 email-parsed sales. Railway env var wins;
// fallback is the canonical Sales DB ID per the Sold Tab data contract.
const notionSalesDbId = process.env.NOTION_SALES_DATABASE_ID || 'a8a86796-187c-4ef8-9ac0-e92d9f8df665'
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

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

// Notion rejects 32-char hex IDs without dashes with HTTP 400. Normalize anything
// that's 32 hex chars (with or without existing dashes) into canonical 8-4-4-4-12
// UUID form before forwarding. No-op for strings that don't match.
function normalizeUuid(id) {
  if (typeof id !== 'string') return id
  const hex = id.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) return id
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
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
    properties['Ship Date'] = { date: { start: new Date().toISOString().slice(0, 10) } }
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

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' })
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
    sendFile(res, filePath)
    return
  }

  // SPA fallback — all routes serve index.html
  const indexPath = path.join(distDir, 'index.html')
  if (fs.existsSync(indexPath)) {
    sendFile(res, indexPath)
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
})
