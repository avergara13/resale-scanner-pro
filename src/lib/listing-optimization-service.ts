import type { ScannedItem, MarketData } from '@/types'
import { callLLM } from './llm-service'

export interface OptimizedListing {
  title: string
  description: string
  category: string
  condition: string
  price: number
  shippingCost: number
  itemSpecifics: Record<string, string>
  keywords: string[]
  suggestedTags: string[]
  seoScore: number
  recommendations: string[]
}

export interface ListingOptimizationContext {
  item: ScannedItem
  marketData?: MarketData
  competitorTitles?: string[]
  targetKeywords?: string[]
  brandInfo?: {
    name: string
    model?: string
    year?: string
  }
}

export class ListingOptimizationService {
  private geminiApiKey?: string

  constructor(geminiApiKey?: string) {
    this.geminiApiKey = geminiApiKey
  }

  async generateOptimizedListing(context: ListingOptimizationContext): Promise<OptimizedListing> {
    if (!this.geminiApiKey) {
      return this.generateFallbackListing(context)
    }

    try {
      const prompt = this.buildOptimizationPrompt(context)
      const response = await callLLM(prompt, {
        task: 'listing',
        geminiApiKey: this.geminiApiKey,
        jsonMode: true,
      })
      const parsed = JSON.parse(response)

      return {
        title: parsed.title || this.generateFallbackTitle(context.item),
        description: parsed.description || this.generateFallbackDescription(context.item),
        category: parsed.category || context.item.category || 'Other',
        condition: parsed.condition || 'Good',
        price: parsed.price || context.item.estimatedSellPrice || context.item.purchasePrice * 3,
        shippingCost: parsed.shippingCost || 0,
        itemSpecifics: parsed.itemSpecifics || {},
        keywords: parsed.keywords || [],
        suggestedTags: parsed.suggestedTags || [],
        seoScore: this.calculateSEOScore(parsed.title, parsed.description, parsed.keywords),
        recommendations: parsed.recommendations || []
      }
    } catch (error) {
      console.error('Failed to generate optimized listing:', error)
      return this.generateFallbackListing(context)
    }
  }

  private buildOptimizationPrompt(context: ListingOptimizationContext) {
    const { item, marketData, competitorTitles, brandInfo } = context

    const marketContext = marketData ? `
Market Data:
- Average sold price: $${marketData.ebayAvgSold?.toFixed(2) || 'N/A'}
- Sell-through rate: ${marketData.ebaySellThroughRate?.toFixed(1) || 'N/A'}%
- Active listings: ${marketData.ebayActiveListings || 0}
- Recent sales: ${marketData.ebaySoldCount || 0}
${marketData.ebayRecentSales?.slice(0, 8).map(sale => `  - "${sale.title}" sold for $${sale.price}`).join('\n') || ''}
` : ''

    const competitorContext = competitorTitles && competitorTitles.length > 0 ? `
Competitor Titles (use for SEO inspiration):
${competitorTitles.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n')}
` : ''

    const brandContext = brandInfo ? `
Brand Information:
- Brand: ${brandInfo.name}
${brandInfo.model ? `- Model: ${brandInfo.model}` : ''}
${brandInfo.year ? `- Year: ${brandInfo.year}` : ''}
` : ''

    // Google Lens results for product identification
    const lensContext = item.lensResults && item.lensResults.length > 0 ? `
Google Lens Product Matches (top results identifying this item):
${item.lensResults.slice(0, 5).map((r, i) => `${i + 1}. "${r.title}" — ${r.source}${r.price ? ` (${r.price})` : ''}`).join('\n')}
` : ''

    // Existing tags from scan-time tag suggestion
    const existingTagsContext = item.tags && item.tags.length > 0 ? `
Existing Item Tags (MUST include all of these in suggestedTags):
${item.tags.join(', ')}
` : ''

    // Auto-detected item specifics from lens/vision
    const detectedSpecifics: Record<string, string> = {}
    if (item.lensAnalysis?.bestMatch?.title) {
      const title = item.lensAnalysis.bestMatch.title
      // Try to extract brand from lens best match title (first word often is brand)
      const firstWord = title.split(/\s+/)[0]
      if (firstWord && firstWord.length > 2) detectedSpecifics['Brand'] = firstWord
    }
    const specificsSeedContext = Object.keys(detectedSpecifics).length > 0 ? `
Pre-detected Item Specifics (use as starting point, expand with more):
${Object.entries(detectedSpecifics).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
` : ''

    const promptText = `You are an expert eBay listing optimizer specializing in creating high-converting, SEO-optimized product listings.

Product Information:
- Name: ${item.productName || 'Unknown Product'}
- Category: ${item.category || 'General'}
- Purchase Price: $${item.purchasePrice}
- Estimated Sell Price: $${item.estimatedSellPrice || item.purchasePrice * 3}
- Vision Analysis: ${item.description || 'No description available'}
${item.notes ? `- Notes: ${item.notes}` : ''}

${marketContext}
${competitorContext}
${lensContext}
${existingTagsContext}
${specificsSeedContext}
${brandContext}

Create an optimized eBay listing following these best practices:

TITLE OPTIMIZATION (80 characters max):
- Front-load with brand name and model (use Google Lens results to identify the brand)
- Include key searchable terms from competitor titles above
- Use power words (NWT, Vintage, Rare, Limited, etc.)
- Add relevant specifications (size, color, model number)
- Avoid special characters and ALL CAPS
- Use vertical bars | to separate key features

DESCRIPTION OPTIMIZATION:
- Base the description on the Vision Analysis above, expanding with selling points
- Start with a compelling hook highlighting the item's best feature
- Include detailed condition description
- List all features and specifications in bullet points
- Add measurements/dimensions if applicable
- Mention what's included
- Describe intended use or occasions
- End with shipping and return policy
- Use proper formatting with line breaks
- Include relevant keywords naturally (no keyword stuffing)
- Professional, friendly tone

TAGS:
- You MUST include ALL existing item tags (listed above) in your suggestedTags output
- Add additional relevant tags based on the product, category, and keywords

ITEM SPECIFICS:
- Pre-fill as many item specifics as possible from the Vision Analysis, Google Lens results, and competitor titles
- At minimum include: Brand, Model/Style, Condition, Color, Size (if applicable), Material (if applicable)

PRICING:
- Competitive based on market data and recent sold prices above
- Consider sell-through rate
- Account for eBay fees (12.9%) and PayPal fees (3.49%)
- Ensure minimum ${context.item.profitMargin || 30}% profit margin

CONDITION CODES:
- New with tags (NWT)
- New without tags (NWOT)  
- New with box (NIB)
- Like New
- Excellent
- Good
- Fair
- For Parts

SEO KEYWORDS:
- Extract 8-12 relevant search terms
- Include synonyms and related terms
- Mix of broad and specific keywords

Return a JSON object with this exact structure:
{
  "title": "Optimized 80-char eBay title with | separators",
  "description": "Full multi-paragraph formatted description with bullets",
  "category": "eBay category name",
  "condition": "Condition from list above",
  "price": 49.99,
  "shippingCost": 5.99,
  "itemSpecifics": {
    "Brand": "Brand Name",
    "Model": "Model Number",
    "Size": "Size",
    "Color": "Color",
    "Material": "Material"
  },
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "recommendations": ["tip1", "tip2", "tip3"]
}`

    return promptText
  }

  private generateFallbackTitle(item: ScannedItem): string {
    const parts: string[] = []
    
    if (item.productName) {
      parts.push(item.productName)
    }
    
    if (item.category && item.category !== 'General') {
      parts.push(item.category)
    }

    if (parts.length === 0) {
      parts.push('Quality Item')
    }

    return parts.join(' | ').slice(0, 80)
  }

  private generateFallbackDescription(item: ScannedItem): string {
    const sections: string[] = []

    sections.push(`${item.productName || 'Quality Item'}\n`)

    if (item.description) {
      sections.push(`${item.description}\n`)
    }

    sections.push('CONDITION:')
    sections.push('This item is in good condition and ready for use.\n')

    sections.push('SHIPPING:')
    sections.push('Ships within 1-2 business days.')
    sections.push('Carefully packaged to ensure safe delivery.\n')

    sections.push('RETURNS:')
    sections.push('30-day return policy for your peace of mind.\n')

    if (item.notes) {
      sections.push('ADDITIONAL NOTES:')
      sections.push(item.notes)
    }

    return sections.join('\n')
  }

  private generateFallbackListing(context: ListingOptimizationContext): OptimizedListing {
    const { item } = context

    return {
      title: this.generateFallbackTitle(item),
      description: this.generateFallbackDescription(item),
      category: item.category || 'Other',
      condition: 'Good',
      price: item.estimatedSellPrice || item.purchasePrice * 3,
      shippingCost: 5.99,
      itemSpecifics: {},
      keywords: [],
      suggestedTags: [],
      seoScore: 50,
      recommendations: [
        'Configure AI API key in Settings for optimized listings',
        'Add more product details for better optimization',
        'Include high-quality photos from multiple angles'
      ]
    }
  }

  private calculateSEOScore(title: string, description: string, keywords: string[]): number {
    let score = 0

    if (title.length >= 60 && title.length <= 80) score += 20
    else if (title.length >= 40) score += 10

    if (description.length >= 200) score += 20
    else if (description.length >= 100) score += 10

    if (keywords.length >= 8) score += 20
    else if (keywords.length >= 5) score += 15
    else if (keywords.length >= 3) score += 10

    const titleWords = title.toLowerCase().split(/\s+/)
    const keywordsInTitle = keywords.filter(kw => 
      titleWords.some(word => word.includes(kw.toLowerCase()))
    ).length
    score += Math.min(keywordsInTitle * 5, 20)

    const descWords = description.toLowerCase().split(/\s+/)
    const keywordsInDesc = keywords.filter(kw =>
      descWords.some(word => word.includes(kw.toLowerCase()))
    ).length
    score += Math.min(keywordsInDesc * 3, 20)

    return Math.min(score, 100)
  }

  async batchOptimizeListings(
    items: ScannedItem[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, OptimizedListing>> {
    const results = new Map<string, OptimizedListing>()

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      if (onProgress) {
        onProgress(i + 1, items.length)
      }

      try {
        const optimized = await this.generateOptimizedListing({
          item,
          marketData: item.marketData
        })
        
        results.set(item.id, optimized)
      } catch (error) {
        console.error(`Failed to optimize item ${item.id}:`, error)
        results.set(item.id, this.generateFallbackListing({ item }))
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return results
  }
}

export function createListingOptimizationService(
  geminiApiKey?: string
): ListingOptimizationService {
  return new ListingOptimizationService(geminiApiKey)
}
