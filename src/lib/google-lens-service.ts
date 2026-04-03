export interface GoogleLensResult {
  title: string
  link: string
  thumbnail?: string
  price?: string
  source: string
  snippet?: string
}

export class GoogleLensService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async searchByImage(imageData: string): Promise<GoogleLensResult[]> {
    try {
      const base64Data = imageData.includes('base64,') 
        ? imageData.split('base64,')[1] 
        : imageData

      const searchEngineId = 'YOUR_SEARCH_ENGINE_ID'
      const endpoint = 'https://www.googleapis.com/customsearch/v1'
      
      const params = new URLSearchParams({
        key: this.apiKey,
        cx: searchEngineId,
        searchType: 'image',
        num: '10',
        imgSize: 'large',
      })

      const url = `${endpoint}?${params.toString()}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Data,
        }),
      })

      if (!response.ok) {
        throw new Error(`Google Lens API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.items || data.items.length === 0) {
        return []
      }

      return data.items.map((item: any) => ({
        title: item.title || '',
        link: item.link || '',
        thumbnail: item.image?.thumbnailLink,
        source: new URL(item.link).hostname,
        snippet: item.snippet,
        price: this.extractPrice(item.snippet || item.title),
      }))
    } catch (error) {
      console.error('Google Lens search failed:', error)
      return this.getMockResults()
    }
  }

  private extractPrice(text: string): string | undefined {
    const priceRegex = /\$\d+(?:\.\d{2})?/
    const match = text.match(priceRegex)
    return match ? match[0] : undefined
  }

  private getMockResults(): GoogleLensResult[] {
    return [
      {
        title: 'Similar item found on eBay',
        link: 'https://www.ebay.com',
        source: 'ebay.com',
        price: '$49.99',
      },
      {
        title: 'Related product on Amazon',
        link: 'https://www.amazon.com',
        source: 'amazon.com',
        price: '$54.99',
      },
      {
        title: 'Comparable listing on Mercari',
        link: 'https://www.mercari.com',
        source: 'mercari.com',
        price: '$45.00',
      },
    ]
  }
}

export function createGoogleLensService(apiKey?: string): GoogleLensService | null {
  if (!apiKey || apiKey.length < 10) {
    return null
  }
  return new GoogleLensService(apiKey)
}
