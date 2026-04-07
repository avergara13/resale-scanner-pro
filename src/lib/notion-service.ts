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

    try {
      const data = await retryFetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          parent: {
            database_id: this.databaseId
          },
          properties: {
            'Title': {
              title: [
                {
                  text: {
                    content: listing.title
                  }
                }
              ]
            },
            'Price': {
              number: listing.price
            },
            'Purchase Price': {
              number: listing.purchasePrice
            },
            'Profit': {
              number: listing.profit
            },
            'Profit Margin': {
              number: listing.profitMargin
            },
            'Category': {
              select: {
                name: listing.category || 'General'
              }
            },
            'Condition': {
              select: {
                name: listing.condition || 'Good'
              }
            },
            'Status': {
              select: {
                name: listing.status
              }
            },
            'Tags': {
              multi_select: listing.tags.map(tag => ({ name: tag }))
            },
            'Item ID': {
              rich_text: [
                {
                  text: {
                    content: listing.itemId
                  }
                }
              ]
            },
            'Date Added': {
              date: {
                start: new Date(listing.timestamp).toISOString()
              }
            }
          },
          children: [
            {
              object: 'block',
              type: 'heading_2',
              heading_2: {
                rich_text: [
                  {
                    text: {
                      content: 'Description'
                    }
                  }
                ]
              }
            },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  {
                    text: {
                      content: listing.description || 'No description available'
                    }
                  }
                ]
              }
            }
          ]
        })
      }, {
        maxRetries: 2,
        initialDelay: 1000,
        timeout: 25000,
        onRetry: (error, attempt, delay) => {
          console.log(`Notion API retry attempt ${attempt} after ${delay}ms:`, error.message)
        }
      })
      
      return {
        success: true,
        pageId: data.id,
        url: data.url
      }
    } catch (error) {
      console.error('Failed to push to Notion:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
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
