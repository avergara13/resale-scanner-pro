import { retryFetch } from './retry-service'

export interface GoogleLensResult {
  title: string
  link: string
  thumbnail?: string
  price?: string
  source: string
  snippet?: string
}

export interface GoogleLensAnalysis {
  results: GoogleLensResult[]
  bestMatch?: GoogleLensResult
  priceRange?: {
    min: number
    max: number
    average: number
  }
  dominantSources: string[]
}

export class GoogleLensService {
  private apiKey: string
  private searchEngineId?: string

  constructor(apiKey: string, searchEngineId?: string) {
    this.apiKey = apiKey
    this.searchEngineId = searchEngineId
  }

  async searchByImage(imageData: string, productName?: string): Promise<GoogleLensAnalysis> {
    // No internal console.error — the caller (App.tsx handleCapture) logs once
    // with pipeline context. Previously we logged here AND at the call site,
    // producing every failure as a duplicate pair in the DEBUG panel.
    const results = await this.performVisualSearch(imageData, productName)
    if (results.length === 0) {
      return { results: [], dominantSources: [] }
    }
    return this.analyzeResults(results)
  }

  private async performVisualSearch(imageData: string, productName?: string): Promise<GoogleLensResult[]> {
    const base64Data = imageData.includes('base64,') 
      ? imageData.split('base64,')[1] 
      : imageData

    if (this.searchEngineId) {
      return this.searchWithCustomSearch(base64Data, productName)
    } else {
      return this.searchWithVisionAPI(base64Data, productName)
    }
  }

  private async searchWithVisionAPI(base64Data: string, productName?: string): Promise<GoogleLensResult[]> {
    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`
    
    const data = await retryFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Data,
            },
            features: [
              { type: 'WEB_DETECTION', maxResults: 10 },
              { type: 'LABEL_DETECTION', maxResults: 5 },
              { type: 'PRODUCT_SEARCH', maxResults: 10 },
            ],
          },
        ],
      }),
    }, {
      maxRetries: 3,
      initialDelay: 1000,
      timeout: 30000,
      onRetry: (error, attempt, delay) => {
        console.log(`Google Vision API retry attempt ${attempt} after ${delay}ms:`, error.message)
      }
    })

    return this.parseVisionResponse(data)
  }

  private async searchWithCustomSearch(base64Data: string, productName?: string): Promise<GoogleLensResult[]> {
    if (!productName) {
      return []
    }

    const endpoint = 'https://www.googleapis.com/customsearch/v1'
    const params = new URLSearchParams({
      key: this.apiKey,
      cx: this.searchEngineId!,
      q: `${productName} buy shopping`,
      searchType: 'image',
      num: '10',
    })

    const data = await retryFetch(`${endpoint}?${params.toString()}`, {}, {
      maxRetries: 3,
      initialDelay: 1000,
      timeout: 30000,
      onRetry: (error, attempt, delay) => {
        console.log(`Google Custom Search retry attempt ${attempt} after ${delay}ms:`, error.message)
      }
    })
    
    return this.parseCustomSearchResponse(data)
  }

  private parseVisionResponse(data: any): GoogleLensResult[] {
    const results: GoogleLensResult[] = []
    const webDetection = data.responses?.[0]?.webDetection

    if (webDetection?.webEntities) {
      webDetection.webEntities.forEach((entity: any) => {
        if (entity.description) {
          results.push({
            title: entity.description,
            link: `https://www.google.com/search?q=${encodeURIComponent(entity.description)}`,
            source: 'google.com',
            snippet: entity.description,
          })
        }
      })
    }

    if (webDetection?.pagesWithMatchingImages) {
      webDetection.pagesWithMatchingImages.slice(0, 5).forEach((page: any) => {
        try {
          const url = new URL(page.url)
          results.push({
            title: page.pageTitle || url.hostname,
            link: page.url,
            thumbnail: page.fullMatchingImages?.[0]?.url,
            source: url.hostname,
            snippet: page.pageTitle,
            price: this.extractPrice(page.pageTitle || ''),
          })
        } catch (e) {
          console.error('Invalid URL:', page.url)
        }
      })
    }

    return results
  }

  private parseCustomSearchResponse(data: any): GoogleLensResult[] {
    if (!data.items || data.items.length === 0) {
      return []
    }

    return data.items.map((item: any) => {
      try {
        const url = new URL(item.link)
        return {
          title: item.title || '',
          link: item.link || '',
          thumbnail: item.image?.thumbnailLink,
          source: url.hostname,
          snippet: item.snippet,
          price: this.extractPrice(item.snippet || item.title || ''),
        }
      } catch (e) {
        return {
          title: item.title || '',
          link: item.link || '',
          source: 'unknown',
        }
      }
    })
  }

  private analyzeResults(results: GoogleLensResult[]): GoogleLensAnalysis {
    const prices = results
      .map(r => r.price)
      .filter((p): p is string => !!p)
      .map(p => parseFloat(p.replace(/[^0-9.]/g, '')))
      .filter(p => !isNaN(p) && p > 0)

    const priceRange = prices.length > 0 ? {
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: prices.reduce((a, b) => a + b, 0) / prices.length,
    } : undefined

    const sourceCounts = results.reduce((acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const dominantSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([source]) => source)

    const bestMatch = results.find(r => r.price) || results[0]

    return {
      results,
      bestMatch,
      priceRange,
      dominantSources,
    }
  }

  private extractPrice(text: string): string | undefined {
    const pricePatterns = [
      /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|dollars?)/i,
      /price[:\s]+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    ]

    for (const pattern of pricePatterns) {
      const match = text.match(pattern)
      if (match) {
        return match[0].includes('$') ? match[0] : `$${match[1]}`
      }
    }

    return undefined
  }
}

export function createGoogleLensService(
  apiKey?: string, 
  searchEngineId?: string
): GoogleLensService | null {
  if (!apiKey || apiKey.length < 10) {
    return null
  }
  return new GoogleLensService(apiKey, searchEngineId)
}
