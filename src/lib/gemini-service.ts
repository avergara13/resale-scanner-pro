export interface GeminiVisionResponse {
  productName: string
  description: string
  category: string
  condition: string
  brand?: string
  model?: string
  keyFeatures: string[]
  searchTerms: string[]
  confidence: number
}

export interface GeminiAnalysisOptions {
  includeCondition?: boolean
  includeBrand?: boolean
  includeSearchTerms?: boolean
  customPrompt?: string
}

export class GeminiService {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = 'gemini-2.0-flash-exp') {
    this.apiKey = apiKey
    this.model = model
  }

  async analyzeProductImage(
    imageData: string,
    options: GeminiAnalysisOptions = {},
    purchasePrice?: number
  ): Promise<GeminiVisionResponse> {
    const base64Data = imageData.includes('base64,') 
      ? imageData.split('base64,')[1] 
      : imageData

    const prompt = this.buildVisionPrompt(options, purchasePrice)

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`
    const url = `${endpoint}?key=${this.apiKey}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No candidates returned from Gemini API')
      }

      const textContent = data.candidates[0].content.parts[0].text
      const result = JSON.parse(textContent) as GeminiVisionResponse

      return {
        productName: result.productName || 'Unknown Product',
        description: result.description || '',
        category: result.category || 'General',
        condition: result.condition || 'Used',
        brand: result.brand,
        model: result.model,
        keyFeatures: result.keyFeatures || [],
        searchTerms: result.searchTerms || [result.productName],
        confidence: result.confidence || 0.5,
      }
    } catch (error) {
      console.error('Gemini vision analysis failed:', error)
      throw error
    }
  }

  private buildVisionPrompt(options: GeminiAnalysisOptions, purchasePrice?: number): string {
    if (options.customPrompt) {
      return options.customPrompt
    }

    const priceContext = purchasePrice 
      ? `The seller is asking $${purchasePrice.toFixed(2)} for this item.` 
      : ''

    return `You are an expert product identification system for resale businesses. Analyze this image and identify the product with details optimized for eBay/online resale.

${priceContext}

Provide your response as a JSON object with the following structure:
{
  "productName": "Concise, searchable product name (max 80 chars)",
  "description": "Detailed description noting condition, materials, features (max 500 chars)",
  "category": "Primary eBay category (e.g., 'Clothing & Accessories', 'Electronics', 'Collectibles')",
  "condition": "Condition assessment (New, Like New, Excellent, Good, Fair, Poor)",
  "brand": "Brand name if identifiable, otherwise null",
  "model": "Model number/name if applicable, otherwise null",
  "keyFeatures": ["List of 3-5 notable features or selling points"],
  "searchTerms": ["Array of 5-10 keywords for searching eBay/Google, including brand, category, key descriptors"],
  "confidence": 0.0-1.0 confidence score in identification accuracy
}

Focus on:
- Accurate product identification for market research
- Resale-relevant details (brand, condition, unique features)
- Keywords that would help find comparable items on eBay
- Honest condition assessment
- Avoiding speculation - use "Unknown" if uncertain

Be specific and searchable. Prioritize information that helps determine resale value.`
  }

  async chat(
    message: string,
    context?: {
      productName?: string
      category?: string
      purchasePrice?: number
      estimatedSellPrice?: number
      marketData?: any
    }
  ): Promise<string> {
    const systemContext = context
      ? `Current item context:
Product: ${context.productName || 'Unknown'}
Category: ${context.category || 'Unknown'}
Purchase Price: $${context.purchasePrice?.toFixed(2) || 'N/A'}
Estimated Sell Price: $${context.estimatedSellPrice?.toFixed(2) || 'N/A'}
${context.marketData ? `Market Data Available: Yes` : ''}

You are an expert resale consultant helping a reseller make informed buying decisions.`
      : 'You are an expert resale consultant helping resellers make profitable buying decisions.'

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `${systemContext}\n\nUser question: ${message}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 512,
      },
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`
    const url = `${endpoint}?key=${this.apiKey}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const data = await response.json()
      return data.candidates[0].content.parts[0].text
    } catch (error) {
      console.error('Gemini chat failed:', error)
      throw error
    }
  }

  async generateListingContent(
    productName: string,
    description: string,
    category: string,
    keyFeatures: string[],
    condition: string,
    brand?: string
  ): Promise<{ title: string; description: string; tags: string[] }> {
    const prompt = `Generate an optimized eBay listing for this product:

Product: ${productName}
Brand: ${brand || 'N/A'}
Category: ${category}
Condition: ${condition}
Features: ${keyFeatures.join(', ')}
Description: ${description}

Provide response as JSON:
{
  "title": "SEO-optimized eBay title (max 80 chars, include brand, key features, condition)",
  "description": "Professional HTML-formatted listing description (300-500 words) with bullet points for features, condition notes, and shipping info",
  "tags": ["Array of 10-15 relevant search tags/keywords"]
}

Make the title compelling and searchable. The description should be professional, detailed, and conversion-focused.`

    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.6,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`
    const url = `${endpoint}?key=${this.apiKey}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const data = await response.json()
      const textContent = data.candidates[0].content.parts[0].text
      return JSON.parse(textContent)
    } catch (error) {
      console.error('Gemini listing generation failed:', error)
      throw error
    }
  }
}

export function createGeminiService(
  apiKey?: string,
  model?: string
): GeminiService | null {
  if (!apiKey || apiKey.length < 10) {
    return null
  }
  return new GeminiService(apiKey, model)
}
