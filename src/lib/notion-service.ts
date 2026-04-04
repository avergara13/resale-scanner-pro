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
