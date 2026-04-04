import { retryFetch, aggressiveRetry } from './retry-service'

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
  suggestedTags?: string[]
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

  private extractResponseText(data: any): string {
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error('Gemini returned empty or blocked response')
    }
    return text
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
      const data = await retryFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, {
        maxRetries: 3,
        initialDelay: 1000,
        timeout: 45000,
        onRetry: (error, attempt, delay) => {
          console.log(`Gemini API retry attempt ${attempt} after ${delay}ms:`, error.message)
        }
      })

      const textContent = this.extractResponseText(data)
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
        suggestedTags: result.suggestedTags || [],
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
  "confidence": 0.0-1.0 confidence score in identification accuracy,
  "suggestedTags": ["Array of 3-6 descriptive tags like 'Vintage', 'Designer', 'Rare', 'High Value', 'Quick Flip', 'Electronics', 'Collectible', 'Brand New', etc."]
}

Focus on:
- Accurate product identification for market research
- Resale-relevant details (brand, condition, unique features)
- Keywords that would help find comparable items on eBay
- Honest condition assessment
- Avoiding speculation - use "Unknown" if uncertain

Be specific and searchable. Prioritize information that helps determine resale value.`
  }

  async removeBackground(
    imageData: string,
    backgroundColor: 'white' | 'transparent' = 'white'
  ): Promise<string> {
    const base64Data = imageData.includes('base64,') 
      ? imageData.split('base64,')[1] 
      : imageData

    const prompt = `Analyze this product image and identify the main subject (product). Provide a pixel-by-pixel segmentation mask where the product is marked as foreground and everything else is background. Return as JSON with:
{
  "maskDescription": "Brief description of what was identified as the product",
  "confidence": 0.0-1.0 confidence in segmentation,
  "boundingBox": {"x": number, "y": number, "width": number, "height": number}
}

Focus on clearly identifying the product boundaries to create a clean cutout.`

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
        temperature: 0.2,
        topK: 32,
        topP: 1,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`
    const url = `${endpoint}?key=${this.apiKey}`

    try {
      const data = await retryFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, {
        maxRetries: 2,
        initialDelay: 1000,
        timeout: 30000,
        onRetry: (error, attempt, delay) => {
          console.log(`Gemini background removal retry attempt ${attempt} after ${delay}ms:`, error.message)
        }
      })

      const textContent = this.extractResponseText(data)
      const result = JSON.parse(textContent)

      return this.applyBackgroundRemoval(imageData, result.boundingBox, backgroundColor)
    } catch (error) {
      console.error('Gemini background removal failed:', error)
      throw error
    }
  }

  private applyBackgroundRemoval(
    imageData: string,
    boundingBox: { x: number; y: number; width: number; height: number },
    backgroundColor: 'white' | 'transparent'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        canvas.width = img.width
        canvas.height = img.height

        if (backgroundColor === 'white') {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        ctx.drawImage(img, 0, 0)

        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageDataObj.data

        const centerX = img.width / 2
        const centerY = img.height / 2
        const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY)

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4

            const inBoundingBox = 
              x >= boundingBox.x && 
              x <= boundingBox.x + boundingBox.width &&
              y >= boundingBox.y && 
              y <= boundingBox.y + boundingBox.height

            if (!inBoundingBox) {
              const dx = x - centerX
              const dy = y - centerY
              const distance = Math.sqrt(dx * dx + dy * dy)
              const alpha = Math.max(0, 1 - (distance / maxDistance) * 2)

              const r = data[idx]
              const g = data[idx + 1]
              const b = data[idx + 2]
              
              const edges = this.detectEdges(data, x, y, canvas.width, canvas.height)
              
              if (edges > 30 && inBoundingBox) {
                data[idx + 3] = 255
              } else if (backgroundColor === 'white') {
                data[idx] = 255
                data[idx + 1] = 255
                data[idx + 2] = 255
                data[idx + 3] = 255
              } else {
                data[idx + 3] = Math.floor(alpha * 255)
              }
            }
          }
        }

        ctx.putImageData(imageDataObj, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageData
    })
  }

  private detectEdges(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number
  ): number {
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
      return 0
    }

    const idx = (y * width + x) * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]

    let totalDiff = 0
    const neighbors = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],           [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ]

    for (const [dx, dy] of neighbors) {
      const nx = x + dx
      const ny = y + dy
      const nIdx = (ny * width + nx) * 4
      const nR = data[nIdx]
      const nG = data[nIdx + 1]
      const nB = data[nIdx + 2]

      totalDiff += Math.abs(r - nR) + Math.abs(g - nG) + Math.abs(b - nB)
    }

    return totalDiff / 8
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
      const data = await retryFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, {
        maxRetries: 3,
        initialDelay: 1000,
        timeout: 30000,
        onRetry: (error, attempt, delay) => {
          console.log(`Gemini chat retry attempt ${attempt} after ${delay}ms:`, error.message)
        }
      })

      return this.extractResponseText(data)
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
      const data = await retryFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, {
        maxRetries: 3,
        initialDelay: 1000,
        timeout: 40000,
        onRetry: (error, attempt, delay) => {
          console.log(`Gemini listing generation retry attempt ${attempt} after ${delay}ms:`, error.message)
        }
      })

      const textContent = this.extractResponseText(data)
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
