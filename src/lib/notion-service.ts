import { retryFetch } from './retry-service'

export interface NotionListingData {
  // Core
  title: string
  description: string
  price: number
  purchasePrice: number
  category: string
  condition: string
  tags: string[]
  images: string[]
  profit: number
  profitMargin: number
  status: 'draft' | 'ready' | 'published'
  itemId: string
  timestamp: number
  location?: string
  notes?: string
  ebayListingId?: string

  // Session traceability — critical for tax/financial records
  sessionId?: string       // human-readable session ID: 'AV-001'
  sessionNumber?: number
  /** Exact Notion Select option name — emoji prefix required for field match */
  expenseType?: '💼 Business' | '🏡 Personal'
  /** Operator who scanned this item (operatorId slug: 'angel', 'wife') */
  scannedBy?: string
  /** Operator display name: 'Angel', 'Wife' */
  operatorName?: string

  // GROUP 1 — Core Identity (pulled from AI/itemSpecifics)
  seoTitle?: string          // 80-char eBay optimized title
  subtitle?: string          // 55-char subtitle
  brand?: string
  modelSku?: string
  mpn?: string               // Manufacturer Part Number
  upcEanGtin?: string        // Barcode scan result — highest Cassini priority
  ebayCategoryId?: string

  // GROUP 2 — Item Specifics
  color?: string
  material?: string
  countryOfManufacture?: string
  itemSpecificsRaw?: string  // Pipe-separated "Key:Value|Key:Value" string
  dimensions?: string        // "L x W x H (in)"

  // GROUP 3 — Pricing & Market Data
  ebayAvgSold?: number
  ebayHigh?: number
  ebayLow?: number
  minAcceptablePrice?: number
  bestOfferMin?: string

  // GROUP 4 — Shipping
  packageWeightLbs?: number
  packageSize?: string
  packageDims?: string
  shipFromZip?: string

  // GROUP 5 — Research
  aiConfidence?: 'High' | 'Medium' | 'Low' | 'Needs Review'
  marketNotes?: string
  photoCount?: number
  hasImage?: boolean

  // GROUP 6 — Source
  sourceVendor?: string

  // ── PKT-20260414-001: 12 net-new columns ─────────────────────────────────
  conditionDescription?: string    // → "Condition Description" rich_text
  seoKeywords?: string             // → "SEO Keywords" rich_text, comma-separated
  size?: string                    // → "Size" rich_text
  department?: string              // → "Department" select
  itemWeightOz?: number            // → "Item Weight (oz)" number
  listingDuration?: string         // → "Listing Duration" select
  bestOfferEnabled?: boolean       // → "Best Offer Enabled" checkbox
  autoAcceptPrice?: number         // → "Best Offer Min $" (type ALTER → number)
  autoDeclinePrice?: number        // → "Auto-Decline Price" number
  soldCompCount?: number           // → "Sold Comp Count" number
  ebayFvfRate?: number             // → "eBay FVF Rate %" number
  estShippingLabelCost?: number    // → "Est. Shipping Label Cost" number
  subtitleCostFlag?: boolean       // → "Subtitle Cost Flag" checkbox
  photoUrls?: string[]             // → "Listing Photos" files (external URLs)
  notionStatus?: string            // → "Status" select auto-progression
  shippingStrategy?: string        // → "Shipping Strategy" SELECT (exact option string)
  listingType?: string             // → "eBay Listing Type" SELECT (exact option string)
}

export interface NotionPushResponse {
  success: boolean
  pageId?: string
  url?: string
  error?: string
}

export interface NotionHealthResult {
  ok: boolean
  dbTitle?: string
  dbId?: string
  propertyCount?: number
  stage?: string
  error?: string
}

// ── Normalise condition string → exact Notion Select option ──────────────────
function normaliseCondition(raw: string): string {
  const s = raw.toLowerCase().trim()
  if (s.includes('sealed') || s.includes('unopened'))   return 'New – Sealed'
  if (s.includes('new with tags') || s.includes('nwt'))     return 'New – Sealed'
  if (s.includes('new without tags') || s.includes('nwot')) return 'New – Open Box'
  if (s.includes('new with defects'))                        return 'New – Open Box'
  if (s.includes('open box') || s.includes('open-box'))     return 'New – Open Box'
  if (s === 'new' || s.includes('brand new'))            return 'New'
  if (s.includes('like new') || s.includes('excellent') || s.includes('mint')) return 'Used – Like New'
  if (s.includes('very good'))                           return 'Used – Very Good'
  if (s.includes('seller refurbished') || s.includes('refurb')) return 'Used – Acceptable'
  if (s.includes('good'))                                return 'Used – Good'
  if (s.includes('acceptab') || s.includes('fair') || s.includes('poor')) return 'Used – Acceptable'
  if (s.includes('part') || s.includes('repair') || s.includes('broken')) return 'For Parts / Repair'
  return 'Used – Good' // safe default
}

// ── Normalise category string → exact Notion Select option ──────────────────
function normaliseCategory(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes('electron') || s.includes('tech') || s.includes('computer') || s.includes('phone') || s.includes('camera') || s.includes('audio') || s.includes('video') || s.includes('gaming')) return 'Electronics'
  if (s.includes('toy') || s.includes('collecti') || s.includes('game') || s.includes('figure') || s.includes('doll') || s.includes('card') || s.includes('sport card') || s.includes('pokemon') || s.includes('lego')) return 'Toys & Collectibles'
  if (s.includes('kitchen') || s.includes('home') || s.includes('appliance') || s.includes('décor') || s.includes('decor') || s.includes('furniture') || s.includes('cookware') || s.includes('bedding')) return 'Kitchen & Home'
  if (s.includes('cloth') || s.includes('apparel') || s.includes('shoe') || s.includes('bag') || s.includes('accessory') || s.includes('fashion') || s.includes('jewelry') || s.includes('watch')) return 'Clothing & Accessories'
  if (s.includes('sport') || s.includes('outdoor') || s.includes('fitness') || s.includes('exercise') || s.includes('camping') || s.includes('fishing') || s.includes('bike')) return 'Sports & Outdoors'
  if (s.includes('book') || s.includes('media') || s.includes('dvd') || s.includes('music') || s.includes('vinyl') || s.includes('cd') || s.includes('movie') || s.includes('magazine')) return 'Books & Media'
  if (s.includes('tool') || s.includes('hardware') || s.includes('power tool') || s.includes('hand tool') || s.includes('automotive')) return 'Tools & Hardware'
  if (s.includes('vintage') || s.includes('antique') || s.includes('retro') || s.includes('classic') || s.includes('art')) return 'Vintage & Antiques'
  return 'Other'
}

function rt(content: string) {
  return { rich_text: [{ text: { content: (content || '').slice(0, 2000) } }] }
}

export class NotionService {
  private apiKey: string
  private databaseId: string

  constructor(apiKey?: string, databaseId?: string) {
    this.apiKey = apiKey || ''
    this.databaseId = databaseId || ''
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.databaseId)
  }

  /**
   * Preflight — verify API key + DB reachability + integration access via the
   * server-side /api/notion/health endpoint. Returns a structured result so the
   * Settings screen can show ✅ or the concrete error without forcing a user to
   * scan a real item first.
   */
  async testConnection(): Promise<NotionHealthResult> {
    if (!this.databaseId) {
      return {
        ok: false,
        stage: 'config',
        error: 'Database ID is not set. Add it in Settings.',
      }
    }
    try {
      const url = `/api/notion/health?dbId=${encodeURIComponent(this.databaseId)}`
      const response = await fetch(url, { method: 'GET' })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          ok: false,
          stage: data?.stage || 'request',
          error: data?.error || data?.message || `${response.status} ${response.statusText}`,
        }
      }
      return {
        ok: true,
        dbId: data?.dbId,
        dbTitle: data?.dbTitle,
        propertyCount: data?.propertyCount,
      }
    } catch (error) {
      return {
        ok: false,
        stage: 'network',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async pushListing(listing: NotionListingData): Promise<NotionPushResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Notion API not configured. Add API key and Database ID in Settings.'
      }
    }

    const notionCondition = normaliseCondition(listing.condition || 'Good')
    const notionCategory  = normaliseCategory(listing.category || 'Other')
    const minAcceptable   = listing.minAcceptablePrice ?? +(listing.purchasePrice * 1.35).toFixed(2)

    // ── Base properties — core identity + pricing ────────────────────────────
    const baseProperties: Record<string, unknown> = {
      // GROUP 1 — Core Identity
      'Item Name':      { title: [{ text: { content: listing.title } }] },
      'Category':       { select: { name: notionCategory } },

      // GROUP 2 — Condition
      'Condition':      { select: { name: notionCondition } },

      // GROUP 3 — Pricing
      'Purchase Price': { number: listing.purchasePrice },
      'Listing Price':  { number: listing.price },
      'Min Acceptable Price': { number: minAcceptable },
      'eBay Listing Type':    { select: { name: 'Buy It Now' } },

      // GROUP 4 — Shipping defaults (overridden by extended.shippingStrategy if set)
      'Shipping Strategy': { select: { name: listing.shippingStrategy || 'USPS Ground Advantage' } },
      'Free Shipping':     { checkbox: (listing.price >= 20) },
      'Handling Time':     { select: { name: '🟢 1 Day' } },
      'Ship From ZIP':     rt(listing.shipFromZip || '32806'),
      'Local Pickup':      { checkbox: false },
      'Return Policy':     { select: { name: '✅ 30-Day Free Returns' } },

      // GROUP 5 — Research flags
      'AI Researched': { checkbox: true },
      'Photos Taken':  { checkbox: !!(listing.hasImage || (listing.images && listing.images.length > 0)) },

      'Date Acquired':  { date: { start: new Date(listing.timestamp).toISOString() } },
    }

    // ── Extended optional properties ─────────────────────────────────────────
    const extended: Record<string, unknown> = {}

    if (listing.seoTitle)               extended['SEO Title']              = rt(listing.seoTitle.slice(0, 80))
    if (listing.subtitle)               extended['Subtitle']               = rt(listing.subtitle.slice(0, 55))
    if (listing.brand)                  extended['Brand']                  = rt(listing.brand)
    if (listing.modelSku)               extended['Model / SKU']            = rt(listing.modelSku)
    if (listing.mpn)                    extended['MPN']                    = rt(listing.mpn)
    if (listing.upcEanGtin)             extended['UPC / EAN / GTIN']       = rt(listing.upcEanGtin)
    if (listing.ebayCategoryId)         extended['eBay Category ID']       = rt(listing.ebayCategoryId)
    if (listing.color)                  extended['Color']                  = rt(listing.color)
    if (listing.material)               extended['Material']               = rt(listing.material)
    if (listing.countryOfManufacture)   extended['Country of Manufacture'] = rt(listing.countryOfManufacture)
    if (listing.itemSpecificsRaw)       extended['Item Specifics']         = rt(listing.itemSpecificsRaw)
    if (listing.dimensions)             extended['Item L x W x H (in)']    = rt(listing.dimensions)
    if (listing.description)            extended['Item Description']       = rt(listing.description)
    if (listing.ebayAvgSold != null)    extended['eBay Sold Avg']          = { number: listing.ebayAvgSold }
    if (listing.ebayHigh != null)       extended['eBay High']              = { number: listing.ebayHigh }
    if (listing.ebayLow != null)        extended['eBay Low']               = { number: listing.ebayLow }
    // "Best Offer Min $" → number (after schema type fix; holds autoAcceptPrice)
    if (listing.autoAcceptPrice != null) extended['Best Offer Min $']      = { number: listing.autoAcceptPrice }
    if (listing.packageWeightLbs != null) extended['Package Weight (lbs)'] = { number: listing.packageWeightLbs }
    if (listing.packageSize)            extended['Package Size']           = { select: { name: listing.packageSize } }
    if (listing.aiConfidence)           extended['AI Confidence']          = { select: { name: listing.aiConfidence } }
    if (listing.marketNotes)            extended['Market Notes']           = rt(listing.marketNotes)
    if (listing.photoCount != null)     extended['Photo Count']            = { number: listing.photoCount }
    if (listing.sourceVendor || listing.scannedBy) extended['Source / Vendor'] = rt(listing.sourceVendor || listing.scannedBy || '')
    if (listing.notes)                  extended['Market Notes']           = rt(listing.notes)

    // ── PKT-20260414-001: 12 net-new columns ──────────────────────────────────
    // NEVER write formula columns: Break Even Price, Gross Margin %, Gross Profit,
    // Net Payout, Projected Profit, ROI %, Total Cost, Days in Inventory, Last Updated
    if (listing.conditionDescription)      extended['Condition Description']   = rt(listing.conditionDescription)
    if (listing.seoKeywords)               extended['SEO Keywords']            = rt(listing.seoKeywords)
    if (listing.size)                      extended['Size']                    = rt(listing.size)
    if (listing.department)               extended['Department']              = { select: { name: listing.department } }
    if (listing.itemWeightOz != null)      extended['Item Weight (oz)']       = { number: listing.itemWeightOz }
    if (listing.listingDuration)          extended['Listing Duration']       = { select: { name: listing.listingDuration || 'GTC' } }
    if (listing.bestOfferEnabled != null) extended['Best Offer Enabled']     = { checkbox: listing.bestOfferEnabled }
    if (listing.autoDeclinePrice != null) extended['Auto-Decline Price']     = { number: listing.autoDeclinePrice }
    if (listing.soldCompCount != null)    extended['Sold Comp Count']        = { number: listing.soldCompCount }
    if (listing.ebayFvfRate != null)      extended['eBay FVF Rate %']        = { number: listing.ebayFvfRate }
    if (listing.estShippingLabelCost != null) extended['Est. Shipping Label Cost'] = { number: listing.estShippingLabelCost }
    if (listing.subtitleCostFlag != null) extended['Subtitle Cost Flag']     = { checkbox: listing.subtitleCostFlag }

    // Status auto-progression (overrides base shipping strategy default if set)
    if (listing.notionStatus)             extended['Status']                 = { select: { name: listing.notionStatus } }

    // Corrected SELECT fields using exact Notion option strings
    if (listing.shippingStrategy)         extended['Shipping Strategy']      = { select: { name: listing.shippingStrategy } }
    if (listing.listingType)              extended['eBay Listing Type']      = { select: { name: listing.listingType } }

    // PKT-002: Listing Photos — external URLs from Supabase Storage
    if (listing.photoUrls?.length) {
      extended['Listing Photos'] = {
        files: listing.photoUrls.map((url, i) => ({
          type: 'external',
          name: `${listing.modelSku || 'photo'}-0${i + 1}.jpg`,
          external: { url }
        }))
      }
      // Backup first URL to "Photo Links" URL property if it exists
      extended['Photo Links'] = { url: listing.photoUrls[0] }
    }

    // ── Session traceability ─────────────────────────────────────────────────
    const sessionProperties: Record<string, unknown> = {}
    if (listing.expenseType)          sessionProperties['Expense Type']   = { select: { name: listing.expenseType } }
    if (typeof listing.sessionNumber === 'number') sessionProperties['Session #'] = { number: listing.sessionNumber }
    if (listing.sessionId)            sessionProperties['Session ID']     = rt(listing.sessionId)

    // D5i: Page body block removed. 'Item Description' rich_text property is
    // the canonical location for the description; duplicating it into page
    // body heading_2 + paragraph blocks created visual noise in the Notion UI
    // and doubled the storage for no downstream consumer.

    const attemptPush = async (properties: Record<string, unknown>) => {
      // Route through backend proxy — browser can't call api.notion.com directly (CORS)
      return await retryFetch('/api/notion/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: this.databaseId },
          properties,
        })
      }, {
        maxRetries: 2,
        initialDelay: 1000,
        timeout: 25000,
        onRetry: (error, attempt, delay) => {
          console.log(`Notion API retry attempt ${attempt} after ${delay}ms:`, error.message)
        }
      })
    }

    try {
      const data = await attemptPush({ ...baseProperties, ...extended, ...sessionProperties })
      return { success: true, pageId: data.id, url: data.url }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)

      // Fallback: if unknown property rejected, retry with only guaranteed base fields
      const looksLikeUnknownProperty =
        msg.includes('property') || msg.includes('validation_error') || msg.includes('400')

      if (looksLikeUnknownProperty) {
        console.warn('[notion] Extended field rejected — retrying with base fields only. Check Notion DB schema.')
        try {
          // Drop extended + session, keep only base
          const data = await attemptPush(baseProperties)
          return { success: true, pageId: data.id, url: data.url }
        } catch (retryError) {
          // Last resort — minimal required fields only
          try {
            const minimalProps = {
              'Item Name': { title: [{ text: { content: listing.title } }] },
              'Purchase Price': { number: listing.purchasePrice },
              'Listing Price': { number: listing.price },
            }
            const data = await attemptPush(minimalProps)
            return { success: true, pageId: data.id, url: data.url }
          } catch (finalError) {
            console.error('Failed to push to Notion (all fallbacks exhausted):', finalError)
            return {
              success: false,
              error: finalError instanceof Error ? finalError.message : 'Unknown error',
            }
          }
        }
      }

      console.error('Failed to push to Notion:', error)
      return {
        success: false,
        error: msg || 'Unknown error occurred'
      }
    }
  }

  async updateListingStatus(pageId: string, update: {
    status: 'published' | 'sold' | 'shipped' | 'completed' | 'returned' | 'delisted' | 'ready'
    soldPrice?: number
    soldOn?: string
    trackingNumber?: string
    shippingCarrier?: string
    soldDate?: number
    shippedDate?: number
    returnedDate?: number
    returnReason?: string
    delistedDate?: number
  }): Promise<NotionPushResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Notion API not configured.' }
    }

    try {
      // Map workflow state → Notion Status select options (emoji-prefixed in DB).
      // Unmapped states (shipped/completed/delisted) fold into the nearest valid option;
      // side-channels (Carrier, Date Sold, Sale Price) capture the detail.
      const statusOption = (s: typeof update.status): string => {
        switch (s) {
          case 'published': return '🟣 Listed – Awaiting Sale'
          case 'ready':     return '📸 Ready to List'
          case 'sold':
          case 'shipped':
          case 'completed': return '✅ Sold'
          case 'returned':  return '↩️ Returned'
          case 'delisted':  return '📸 Ready to List' // delisted returns to inventory-ready
          default:          return '🟣 Listed – Awaiting Sale'
        }
      }

      // Normalize carrier string to the DB's Carrier select options. Missing match → skip.
      const carrierOption = (raw?: string): string | null => {
        if (!raw) return null
        const s = raw.toLowerCase()
        if (s.includes('usps'))  return 'USPS'
        if (s.includes('ups'))   return 'UPS'
        if (s.includes('fedex')) return 'FedEx'
        return null
      }

      const properties: Record<string, unknown> = {
        'Status': { select: { name: statusOption(update.status) } },
      }
      // Map to actual DB property names. Sold Price → Sale Price, Sold Date → Date Sold.
      if (update.soldPrice !== undefined) properties['Sale Price'] = { number: update.soldPrice }
      if (update.soldDate)                properties['Date Sold']  = { date: { start: new Date(update.soldDate).toISOString() } }

      // Carrier (select) — only set if we recognize the carrier name.
      const normalizedCarrier = carrierOption(update.shippingCarrier)
      if (normalizedCarrier)              properties['Carrier']    = { select: { name: normalizedCarrier } }

      // Tracking, soldOn, shipped/returned/delisted dates, returnReason: no matching DB columns.
      // Stash human-readable sync details into Listing Notes so nothing is lost.
      const notesLines: string[] = []
      if (update.trackingNumber)  notesLines.push(`Tracking: ${update.trackingNumber}`)
      if (update.soldOn)          notesLines.push(`Sold on: ${update.soldOn}`)
      if (update.shippedDate)     notesLines.push(`Shipped: ${new Date(update.shippedDate).toISOString().slice(0,10)}`)
      if (update.returnedDate)    notesLines.push(`Returned: ${new Date(update.returnedDate).toISOString().slice(0,10)}`)
      if (update.returnReason)    notesLines.push(`Return reason: ${update.returnReason}`)
      if (update.delistedDate)    notesLines.push(`Delisted: ${new Date(update.delistedDate).toISOString().slice(0,10)}`)
      if (notesLines.length > 0)  properties['Listing Notes'] = rt(notesLines.join(' • '))

      // Status updates are the most-visible Notion writes (Sold → Shipped → Delisted chain).
      // Bump retries + widen backoff so transient 429/503s don't strand an item in the wrong state.
      // Route through backend proxy — browser can't call api.notion.com directly (CORS)
      await retryFetch(`/api/notion/status/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      }, { maxRetries: 4, initialDelay: 1000, maxDelay: 8000, timeout: 20000 })

      return { success: true, pageId }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async pushMultipleListings(listings: NotionListingData[]): Promise<{
    successful: number
    failed: number
    results: NotionPushResponse[]
  }> {
    const results: NotionPushResponse[] = []
    let successful = 0
    let failed = 0

    for (const listing of listings) {
      const result = await this.pushListing(listing)
      results.push(result)
      if (result.success) successful++
      else failed++
      await new Promise(resolve => setTimeout(resolve, 350))
    }

    return { successful, failed, results }
  }
}

export function createNotionService(apiKey?: string, databaseId?: string): NotionService | null {
  if (!apiKey || !databaseId) return null
  return new NotionService(apiKey, databaseId)
}
