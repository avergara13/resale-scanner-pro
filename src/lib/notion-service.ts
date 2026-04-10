import { retryFetch } from './retry-service'

export interface NotionListingData {
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
  /** Session traceability — critical for tax/financial records */
  sessionId?: string
  sessionNumber?: number
  /** Exact Notion Select option name — emoji prefix required for field match */
  expenseType?: '💼 Business' | '🏡 Personal'
}

export interface NotionPushResponse {
  success: boolean
  pageId?: string
  url?: string
  error?: string
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

    // Base properties — guaranteed to exist in the Notion database schema.
    const baseProperties: Record<string, unknown> = {
      'Title': {
        title: [{ text: { content: listing.title } }]
      },
      'Price': { number: listing.price },
      'Purchase Price': { number: listing.purchasePrice },
      'Profit': { number: listing.profit },
      'Profit Margin': { number: listing.profitMargin },
      'Category': { select: { name: listing.category || 'General' } },
      'Condition': { select: { name: listing.condition || 'Good' } },
      'Status': { select: { name: listing.status } },
      'Tags': { multi_select: listing.tags.map(tag => ({ name: tag })) },
      'Item ID': {
        rich_text: [{ text: { content: listing.itemId } }]
      },
      'Date Added': {
        date: { start: new Date(listing.timestamp).toISOString() }
      },
    }

    // Session traceability for tax / financial records. Expense Type drives
    // Business vs Personal bucket in Notion rollups at tax time.
    // Optional — added only if database has the columns. See retry-without-
    // session-fields fallback below for schemas that don't yet have them.
    const sessionProperties: Record<string, unknown> = {}
    if (listing.expenseType) {
      sessionProperties['Expense Type'] = { select: { name: listing.expenseType } }
    }
    if (typeof listing.sessionNumber === 'number') {
      sessionProperties['Session #'] = { number: listing.sessionNumber }
    }
    if (listing.sessionId) {
      sessionProperties['Session ID'] = {
        rich_text: [{ text: { content: listing.sessionId } }]
      }
    }

    const children = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: 'Description' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: { content: listing.description || 'No description available' }
          }]
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
      const data = await attemptPush({ ...baseProperties, ...sessionProperties })
      return { success: true, pageId: data.id, url: data.url }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      // Notion rejects requests with unknown property names. If that happened
      // and we sent session fields, retry without them so the push still
      // succeeds and the user sees a one-time warning to add the columns.
      const looksLikeUnknownProperty =
        Object.keys(sessionProperties).length > 0 &&
        (msg.includes('property') || msg.includes('validation_error') || msg.includes('400'))

      if (looksLikeUnknownProperty) {
        console.warn(
          '[notion] Push succeeded WITHOUT session fields. Add these columns ' +
          'to your Notion database for business/personal tax tracking: ' +
          '"Expense Type" (Select: Business, Personal), ' +
          '"Session #" (Number), "Session ID" (Text)'
        )
        try {
          const data = await attemptPush(baseProperties)
          return { success: true, pageId: data.id, url: data.url }
        } catch (retryError) {
          console.error('Failed to push to Notion (retry):', retryError)
          return {
            success: false,
            error: retryError instanceof Error ? retryError.message : 'Unknown error',
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
      if (update.soldPrice !== undefined) {
        properties['Sold Price'] = { number: update.soldPrice }
      }
      if (update.soldOn) {
        properties['Sold On'] = { select: { name: update.soldOn } }
      }
      if (update.trackingNumber) {
        properties['Tracking Number'] = { rich_text: [{ text: { content: update.trackingNumber } }] }
      }
      if (update.shippingCarrier) {
        properties['Shipping Carrier'] = { rich_text: [{ text: { content: update.shippingCarrier } }] }
      }
      if (update.soldDate) {
        properties['Sold Date'] = { date: { start: new Date(update.soldDate).toISOString() } }
      }
      if (update.shippedDate) {
        properties['Shipped Date'] = { date: { start: new Date(update.shippedDate).toISOString() } }
      }
      if (update.returnedDate) {
        properties['Returned Date'] = { date: { start: new Date(update.returnedDate).toISOString() } }
      }
      if (update.returnReason) {
        properties['Return Reason'] = { rich_text: [{ text: { content: update.returnReason } }] }
      }
      if (update.delistedDate) {
        properties['Delisted Date'] = { date: { start: new Date(update.delistedDate).toISOString() } }
      }

      await retryFetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({ properties }),
      }, { maxRetries: 2, initialDelay: 1000, timeout: 15000 })

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
      
      if (result.success) {
        successful++
      } else {
        failed++
      }

      await new Promise(resolve => setTimeout(resolve, 350))
    }

    return { successful, failed, results }
  }
}

export function createNotionService(apiKey?: string, databaseId?: string): NotionService | null {
  if (!apiKey || !databaseId) {
    return null
  }
  return new NotionService(apiKey, databaseId)
}
