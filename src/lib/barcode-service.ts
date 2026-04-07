import { retryFetch } from './retry-service'

export interface BarcodeProduct {
  barcode: string
  format: string
  title?: string
  brand?: string
  category?: string
  description?: string
  imageUrl?: string
  upcDatabase?: {
    ean: string
    title: string
    brand: string
    category: string
  }
}

export interface BarcodeLookupResult {
  success: boolean
  product?: BarcodeProduct
  error?: string
  source?: 'upc-database' | 'open-food-facts' | 'gemini-search' | 'cache'
}

export function createBarcodeService(geminiApiKey?: string) {
  const cache = new Map<string, BarcodeProduct>()

  const lookupUPCDatabase = async (barcode: string): Promise<BarcodeProduct | null> => {
    try {
      const data = await retryFetch<{ items?: Array<{ title?: string; brand?: string; category?: string; description?: string; images?: string[] }> }>(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
        undefined,
        { maxRetries: 2, timeout: 8000 }
      )
      if (data.items && data.items.length > 0) {
        const item = data.items[0]
        return {
          barcode,
          format: 'EAN/UPC',
          title: item.title,
          brand: item.brand,
          category: item.category,
          description: item.description,
          imageUrl: item.images?.[0],
        }
      }
      return null
    } catch {
      return null
    }
  }

  const lookupOpenFoodFacts = async (barcode: string): Promise<BarcodeProduct | null> => {
    try {
      const data = await retryFetch<{ status?: number; product?: { product_name?: string; product_name_en?: string; brands?: string; categories?: string; generic_name?: string; image_url?: string } }>(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        undefined,
        { maxRetries: 2, timeout: 8000 }
      )
      if (data.status === 1 && data.product) {
        const product = data.product
        return {
          barcode,
          format: 'EAN/UPC',
          title: product.product_name || product.product_name_en,
          brand: product.brands,
          category: product.categories,
          description: product.generic_name,
          imageUrl: product.image_url,
        }
      }
      return null
    } catch {
      return null
    }
  }

  const lookupViaGemini = async (barcode: string): Promise<BarcodeProduct | null> => {
    if (!geminiApiKey) return null
    try {
      const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
      const model = 'gemini-2.5-flash'
      const url = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${geminiApiKey}`

      const prompt = `What product has barcode/UPC "${barcode}"? Search for it and return ONLY valid JSON with no markdown fences:
{"title":"full product name","brand":"brand name","category":"product category","description":"brief product description"}`

      type GeminiResponse = { candidates?: Array<{ content: { parts: Array<{ text?: string }> } }> }
      const data = await retryFetch<GeminiResponse>(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
          }),
        },
        { maxRetries: 2, initialDelay: 1000, timeout: 20000 }
      )

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) return null

      // Strip markdown fences if present
      const jsonText = text.replace(/```(?:json)?\n?/g, '').trim()
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null

      const parsed = JSON.parse(jsonMatch[0]) as { title?: string; brand?: string; category?: string; description?: string }
      if (!parsed.title) return null

      return {
        barcode,
        format: 'EAN/UPC',
        title: parsed.title,
        brand: parsed.brand,
        category: parsed.category,
        description: parsed.description,
      }
    } catch {
      return null
    }
  }

  const lookupBarcode = async (barcode: string): Promise<BarcodeLookupResult> => {
    if (cache.has(barcode)) {
      return {
        success: true,
        product: cache.get(barcode),
        source: 'cache',
      }
    }

    let product = await lookupOpenFoodFacts(barcode)
    if (product) {
      cache.set(barcode, product)
      return { success: true, product, source: 'open-food-facts' }
    }

    product = await lookupUPCDatabase(barcode)
    if (product) {
      cache.set(barcode, product)
      return { success: true, product, source: 'upc-database' }
    }

    product = await lookupViaGemini(barcode)
    if (product) {
      cache.set(barcode, product)
      return { success: true, product, source: 'gemini-search' }
    }

    return {
      success: false,
      error: 'Product not found in databases',
    }
  }

  return { lookupBarcode }
}
