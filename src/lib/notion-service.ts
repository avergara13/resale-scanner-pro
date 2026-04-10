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
  sessionId?: string
  sessionNumber?: number
  /** Exact Notion Select option name — emoji prefix required for field match */
  expenseType?: '💼 Business' | '🏡 Personal'

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
}

export interface NotionPushResponse {
  success: boolean
  pageId?: string
  url?: string
  error?: string
}

// ── Normalise condition string → exact Notion Select option ──────────────────
function normaliseCondition(raw: string): string {
  const s = raw.toLowerCase().trim()
  if (s.includes('sealed') || s.includes('unopened'))   return 'New – Sealed'
  if (s.includes('open box') || s.includes('open-box')) return 'New – Open Box'
  if (s === 'new' || s.includes('brand new'))            return 'New'
  if (s.includes('like new') || s.includes('excellent') || s.includes('mint')) return 'Used – Like New'
  if (s.includes('very good'))                           return 'Used – Very Good'
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
      'Profit':         { number: listing.profit },
      'Profit Margin':  { number: listing.profitMargin },
      'Min Acceptable Price': { number: minAcceptable },
      'Quantity Available':   rt('1'),
      'eBay Listing Type':    { select: { name: 'Buy It Now' } },

      // GROUP 4 — Shipping defaults
      'Shipping Strategy': { select: { name: 'USPS Ground Advantage' } },
      'Free Shipping':     { checkbox: (listing.price >= 20) },
      'Handling Time':     { select: { name: '🟢 1 Day' } },
      'Ship From ZIP':     rt(listing.shipFromZip || '32806'),
      'Local Pickup':      { checkbox: false },
      'Return Policy':     { select: { name: '✅ 30-Day Free Returns' } },

      // GROUP 5 — Research flags
      'AI Researched': { checkbox: true },
      'Photos Taken':  { checkbox: !!(listing.hasImage || (listing.images && listing.images.length > 0)) },

      // Legacy / existing fields kept for backward compat
      'Price':          { number: listing.price },
      'Item ID':        rt(listing.itemId),
      'Date Added':     { date: { start: new Date(listing.timestamp).toISOString() } },
      'Tags':           { multi_select: listing.tags.map(tag => ({ name: tag })) },
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
    if (listing.bestOfferMin)           extended['Best Offer Min $']       = rt(listing.bestOfferMin)
    if (listing.packageWeightLbs != null) extended['Package Weight (lbs)'] = { number: listing.packageWeightLbs }
    if (listing.packageSize)            extended['Package Size']           = { select: { name: listing.packageSize } }
    if (listing.packageDims)            extended['Package Dims']           = rt(listing.packageDims)
    if (listing.aiConfidence)           extended['AI Confidence']          = { select: { name: listing.aiConfidence } }
    if (listing.marketNotes)            extended['Market Notes']           = rt(listing.marketNotes)
    if (listing.photoCount != null)     extended['Photo Count']            = { number: listing.photoCount }
    if (listing.sourceVendor)           extended['Source / Vendor']        = rt(listing.sourceVendor)
    if (listing.notes)                  extended['Market Notes']           = rt(listing.notes)

    // ── Session traceability ─────────────────────────────────────────────────
    const sessionProperties: Record<string, unknown> = {}
    if (listing.expenseType)          sessionProperties['Expense Type'] = { select: { name: listing.expenseType } }
    if (typeof listing.sessionNumber === 'number') sessionProperties['Session #'] = { number: listing.sessionNumber }
    if (listing.sessionId)            sessionProperties['Session ID']   = rt(listing.sessionId)

    // Description block in page body
    const children = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: 'Item Description' } }] }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: (listing.description || 'No description available').slice(0, 2000) } }]
        }
      }
    ]

    const attemptPush = async (properties: Record<string, unknown>) => {
      return await retryFetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          parent: { database_id: this.databaseId },
          properties,
          children,
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
      const properties: Record<string, unknown> = {
        'Status': { select: { name: update.status } },
      }
      if (update.soldPrice !== undefined) properties['Sold Price']       = { number: update.soldPrice }
      if (update.soldOn)                  properties['Sold On']           = { select: { name: update.soldOn } }
      if (update.trackingNumber)          properties['Tracking Number']   = rt(update.trackingNumber)
      if (update.shippingCarrier)         properties['Shipping Carrier']  = rt(update.shippingCarrier)
      if (update.soldDate)                properties['Sold Date']         = { date: { start: new Date(update.soldDate).toISOString() } }
      if (update.shippedDate)             properties['Shipped Date']      = { date: { start: new Date(update.shippedDate).toISOString() } }
      if (update.returnedDate)            properties['Returned Date']     = { date: { start: new Date(update.returnedDate).toISOString() } }
      if (update.returnReason)            properties['Return Reason']     = rt(update.returnReason)
      if (update.delistedDate)            properties['Delisted Date']     = { date: { start: new Date(update.delistedDate).toISOString() } }

      // Status updates are the most-visible Notion writes (Sold → Shipped → Delisted chain).
      // Bump retries + widen backoff so transient 429/503s don't strand an item in the wrong state.
      await retryFetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
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
