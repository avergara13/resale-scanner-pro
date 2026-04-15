import { retryFetch } from './retry-service'

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
  // ── eBay enrichment fields (PKT-20260414-001) ──────────────────────────────
  size?: string              // e.g. "10 Men's", "L", "32x34"
  colorDetails?: string      // e.g. "Black with White Stripes"
  estimatedWeightOz?: number // visual weight estimate in oz
  countryOfOrigin?: string   // e.g. "China", "Vietnam"
  conditionNotes?: string    // specific visible flaws/wear (≤200 chars)
  upcEan?: string            // barcode if clearly legible, else null
}

export interface GeminiAnalysisOptions {
  includeCondition?: boolean
  includeBrand?: boolean
  includeSearchTerms?: boolean
  customPrompt?: string
  /** User-reported condition captured at the camera. When present, it anchors the
   *  sale-price estimate so Gemini values the item against eBay sold comps in the
   *  same condition bucket (New ≠ Good ≠ For Parts). Flows through to ROI math. */
  condition?: string
}

export class GeminiService {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
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
    purchasePrice?: number,
    additionalImages?: string[]    // optional photos 2-5 for richer context
  ): Promise<GeminiVisionResponse> {
    const base64Data = imageData.includes('base64,')
      ? imageData.split('base64,')[1]
      : imageData

    const imageParts = [
      { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
      ...(additionalImages || []).map(img => ({
        inline_data: {
          mime_type: 'image/jpeg',
          data: img.includes('base64,') ? img.split('base64,')[1] : img,
        }
      }))
    ]

    const multiImageNote = (additionalImages?.length)
      ? `\nYou have received ${additionalImages.length + 1} photos of the same item from different angles. Analyze all photos together for the most accurate product identification, pricing, and condition assessment.`
      : ''

    const prompt = this.buildVisionPrompt(options, purchasePrice) + multiImageNote

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            ...imageParts,
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

      // Gemini may return markdown-fenced JSON or malformed output —
      // strip fences before parsing and fall back to regex extraction.
      let result: GeminiVisionResponse
      try {
        const cleaned = textContent.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
        result = JSON.parse(cleaned) as GeminiVisionResponse
      } catch {
        // Attempt to extract key fields from the raw text as a fallback
        console.warn('Gemini returned non-JSON vision response, attempting regex extraction')
        const nameMatch = textContent.match(/"productName"\s*:\s*"([^"]+)"/)
        const descMatch = textContent.match(/"description"\s*:\s*"([^"]+)"/)
        const catMatch = textContent.match(/"category"\s*:\s*"([^"]+)"/)
        const condMatch = textContent.match(/"condition"\s*:\s*"([^"]+)"/)
        const brandMatch = textContent.match(/"brand"\s*:\s*"([^"]+)"/)
        const confMatch = textContent.match(/"confidence"\s*:\s*([\d.]+)/)
        result = {
          productName: nameMatch?.[1] || 'Unknown Product',
          description: descMatch?.[1] || '',
          category: catMatch?.[1] || 'General',
          condition: condMatch?.[1] || 'Used',
          brand: brandMatch?.[1] || undefined,
          model: undefined,
          keyFeatures: [],
          searchTerms: [],
          confidence: confMatch ? parseFloat(confMatch[1]) : 0.3,
          suggestedTags: [],
        } as GeminiVisionResponse
      }

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
        size: result.size,
        colorDetails: result.colorDetails,
        estimatedWeightOz: result.estimatedWeightOz,
        countryOfOrigin: result.countryOfOrigin,
        conditionNotes: result.conditionNotes,
        upcEan: result.upcEan,
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

    const conditionContext = options.condition
      ? `The user reports this item is in "${options.condition}" condition. Base your estimated sale price and market comps on eBay sold listings in "${options.condition}" condition — adjust up for New / Like New and down for Good / Acceptable / For Parts.`
      : ''

    return `You are an expert product identification system for resale businesses. Analyze this image and identify the product with details optimized for eBay/online resale.

${priceContext}
${conditionContext}

Provide your response as a JSON object with the following structure:
{
  "productName": "Concise, searchable product name (max 80 chars)",
  "description": "Detailed description noting condition, materials, features (max 500 chars)",
  "category": "Primary eBay category (e.g., 'Clothing & Accessories', 'Electronics', 'Collectibles')",
  "condition": "Condition. Return EXACTLY ONE of: 'New – Sealed', 'New – Open Box', 'Used – Like New', 'Used – Very Good', 'Used – Good', 'Used – Acceptable', 'For Parts / Repair'. RULE: Item in original sealed packaging → 'New – Sealed'. Original packaging opened, item unused → 'New – Open Box'. Visible wear/scratches/stains/prior-use → use Used grades based on severity. Broken/missing components → 'For Parts / Repair'.",
  "brand": "Brand name if identifiable, otherwise null",
  "model": "Model number/name if applicable, otherwise null",
  "keyFeatures": ["List of 3-5 notable features or selling points"],
  "searchTerms": ["Array of 5-10 keywords for searching eBay/Google, including brand, category, key descriptors"],
  "confidence": 0.0-1.0 confidence score in identification accuracy,
  "suggestedTags": ["Array of 3-6 descriptive tags like 'Vintage', 'Designer', 'Rare', 'High Value', 'Quick Flip', 'Electronics', 'Collectible', 'Brand New', etc."],
  "size": "All size markings visible — shoe size (e.g. '10.5 US Men\\'s / 44.5 EU'), clothing size (S/M/L/XL or numeric), dimensions. null if not applicable",
  "colorDetails": "Primary and secondary colors plus any patterns (e.g. 'Black with White Stripes', 'Red Plaid'). null if not determinable",
  "estimatedWeightOz": "Best estimate in oz based on visual size and category. Sneakers ~24-32oz, t-shirt ~6oz, hoodie ~16oz, jacket ~32oz, phone ~6oz, console ~48oz. Return a number, not a string",
  "countryOfOrigin": "Country of Manufacture if visible on label or tag (e.g. 'China', 'Vietnam', 'USA'). null if not visible",
  "conditionNotes": "Specific visible flaws, wear, scratches, stains, missing parts in plain text — max 200 chars. Be honest. Use 'No visible flaws' if item looks clean. Do NOT repeat the overall condition field",
  "upcEan": "Barcode number (UPC-A 12 digits, EAN-13 13 digits, or UPC-E 8 digits) if clearly legible in photo. Return digits only, no spaces. null if not visible"
}

Focus on:
- Accurate product identification for market research
- Resale-relevant details (brand, condition, unique features)
- Keywords that would help find comparable items on eBay
- Honest condition assessment
- Avoiding speculation - use null if uncertain

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
