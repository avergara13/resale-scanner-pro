import type { ScannedItem, MarketData, ResalePlatform, PlatformListing, OptimizedListing as AppOptimizedListing } from '@/types'
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
${marketData.ebayRecentSales?.slice(0, 3).map(sale => `  - "${sale.title}" sold for $${sale.price}`).join('\n') || ''}
` : ''

    const competitorContext = competitorTitles && competitorTitles.length > 0 ? `
Competitor Titles (SEO inspiration):
${competitorTitles.slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join('\n')}
` : ''

    const brandContext = brandInfo ? `
Brand Information:
- Brand: ${brandInfo.name}
${brandInfo.model ? `- Model: ${brandInfo.model}` : ''}
${brandInfo.year ? `- Year: ${brandInfo.year}` : ''}
` : ''

    const lensContext = item.lensResults && item.lensResults.length > 0 ? `
Google Lens Matches:
${item.lensResults.slice(0, 2).map((r, i) => `${i + 1}. "${r.title}" — ${r.source}${r.price ? ` (${r.price})` : ''}`).join('\n')}
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
- Base price on SOLD comps from the market data above — not asking prices or MSRP
- Aim for middle-high of the sold price range (above average, below highest)
- Account for ALL seller costs:
  • eBay final value fee: 12.9% of sale price
  • eBay Promoted Listings ad fee: 3% of sale price
  • Per-order fee: $0.30
  • Shipping: ~$5-8 (seller pays, offers free shipping to buyer)
  • Shipping materials: $0.75 per item
- Total effective fee rate: ~15.9% + $1.05 fixed per sale
- Ensure minimum ${context.item.profitMargin ?? 30}% NET profit margin after ALL costs
- If sell-through rate is LOW (<40%), consider pricing more aggressively

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

  async generatePlatformListing(
    item: ScannedItem,
    platform: ResalePlatform,
    ebayListing: AppOptimizedListing
  ): Promise<PlatformListing> {
    const platformRules: Record<ResalePlatform, { name: string; titleMax: number; feePercent: number; rules: string }> = {
      ebay: {
        name: 'eBay',
        titleMax: 80,
        feePercent: 12.9,
        rules: 'Professional tone. Use | separators. Front-load brand and model. Include condition keywords (NWT, NWOT, NIB, etc). Add item specifics in title when space allows.',
      },
      mercari: {
        name: 'Mercari',
        titleMax: 80,
        feePercent: 10,
        rules: 'Casual, friendly tone. No HTML in description — plain text only. Concise bullet-point description. Emphasize condition clearly. Include brand and model upfront. Mercari buyers are value-hunters so highlight the deal.',
      },
      poshmark: {
        name: 'Poshmark',
        titleMax: 60,
        feePercent: 20,
        rules: 'Fashion-forward, aspirational tone. Title ≤60 chars. Add 3-5 relevant #hashtags at the END of the description (e.g. #nike #running #sneakers). Poshmark charges 20% on items over $15, so price accordingly. Emphasize style, brand prestige, and occasion.',
      },
      whatnot: {
        name: 'Whatnot',
        titleMax: 80,
        feePercent: 8,
        rules: 'Auction-format listing. Title should be snappy and exciting for live streaming. Description MUST include: condition grade (1-10), any flaws, what is included in the lot, authenticity notes. Include a suggested starting bid price as well as buy-now price. Whatnot buyers are collectors — mention rarity, edition, and lot contents.',
      },
      facebook: {
        name: 'Facebook Marketplace',
        titleMax: 100,
        feePercent: 0,
        rules: 'Local buyer tone — conversational and direct. No shipping required (local pickup). No strict brand restrictions. Mention city/area availability. Price should be negotiable-friendly (slightly above target). Description should be brief (3-5 sentences max). No formal return policy needed.',
      },
    }

    const p = platformRules[platform]
    if (!this.geminiApiKey) {
      return this.generateFallbackPlatformListing(item, platform, ebayListing, p)
    }

    const feeMultiplier = 1 + p.feePercent / 100
    const suggestedPrice = ebayListing.price * feeMultiplier / (1 + 0.129) // re-normalize from eBay fee base

    const systemPrompt = `You are a professional resale listing copywriter specializing in ${p.name}. You adapt eBay listings to each platform's unique audience, rules, and fee structure to maximize conversions and profit.

Platform: ${p.name}
Fee: ${p.feePercent}% (price your listing so the SELLER nets the same margin after fees)
Title limit: ${p.titleMax} characters
Platform rules: ${p.rules}`

    const prompt = `Adapt the following eBay listing for ${p.name}.

SOURCE eBay LISTING:
Title: ${ebayListing.title}
Description: ${ebayListing.description}
Price: $${ebayListing.price.toFixed(2)}
Condition: ${ebayListing.condition}
Category: ${ebayListing.category}
Item Specifics: ${JSON.stringify(ebayListing.itemSpecifics)}
Shipping: $${ebayListing.shippingCost.toFixed(2)}

ITEM CONTEXT:
- Product: ${item.productName || 'Unknown'}
- Purchase price: $${item.purchasePrice.toFixed(2)}
- Target net: $${suggestedPrice.toFixed(2)} after ${p.feePercent}% ${p.name} fee

REQUIREMENTS:
1. Title: max ${p.titleMax} chars, optimized for ${p.name} search
2. Description: adapted tone and format for ${p.name} — follow platform rules above
3. Price: set so seller nets the same profit after ${p.feePercent}% fee
4. Shipping: $0 if Facebook Marketplace (local only), otherwise suggest appropriate flat rate
5. platformNotes: one line of actionable advice specific to selling THIS item on ${p.name}

Return ONLY valid JSON:
{
  "title": "...",
  "description": "...",
  "price": 0.00,
  "category": "...",
  "condition": "...",
  "shippingCost": 0.00,
  "platformNotes": "..."
}`

    try {
      const response = await callLLM(prompt, {
        task: 'listing',
        geminiApiKey: this.geminiApiKey,
        jsonMode: true,
        maxTokens: 1200,
        systemPrompt,
      })
      const parsed = JSON.parse(response)
      return {
        title: (parsed.title || ebayListing.title).slice(0, p.titleMax),
        description: parsed.description || ebayListing.description,
        price: parsed.price > 0 ? parsed.price : suggestedPrice,
        category: parsed.category || ebayListing.category,
        condition: parsed.condition || ebayListing.condition,
        shippingCost: platform === 'facebook' ? 0 : (parsed.shippingCost ?? ebayListing.shippingCost),
        platformNotes: parsed.platformNotes,
        generatedAt: Date.now(),
      }
    } catch {
      return this.generateFallbackPlatformListing(item, platform, ebayListing, p)
    }
  }

  private generateFallbackPlatformListing(
    _item: ScannedItem,
    platform: ResalePlatform,
    ebayListing: AppOptimizedListing,
    p: { name: string; titleMax: number; feePercent: number }
  ): PlatformListing {
    const adjustedPrice = platform === 'facebook'
      ? ebayListing.price * 0.85
      : ebayListing.price * (1 + p.feePercent / 100) / 1.129
    return {
      title: ebayListing.title.slice(0, p.titleMax),
      description: ebayListing.description,
      price: Math.round(adjustedPrice * 100) / 100,
      category: ebayListing.category,
      condition: ebayListing.condition,
      shippingCost: platform === 'facebook' ? 0 : ebayListing.shippingCost,
      platformNotes: `Configure AI in Settings for optimized ${p.name} listings`,
      generatedAt: Date.now(),
    }
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
