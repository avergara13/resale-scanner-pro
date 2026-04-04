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
  source?: 'upc-database' | 'open-food-facts' | 'barcode-lookup' | 'cache'
}

export function createBarcodeService() {
  const cache = new Map<string, BarcodeProduct>()

  const lookupUPCDatabase = async (barcode: string): Promise<BarcodeProduct | null> => {
    try {
      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`)
      if (!response.ok) return null
      
      const data = await response.json()
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
    } catch (error) {
      console.error('UPC Database lookup failed:', error)
      return null
    }
  }

  const lookupOpenFoodFacts = async (barcode: string): Promise<BarcodeProduct | null> => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
      if (!response.ok) return null
      
      const data = await response.json()
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
    } catch (error) {
      console.error('Open Food Facts lookup failed:', error)
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
      return {
        success: true,
        product,
        source: 'open-food-facts',
      }
    }

    product = await lookupUPCDatabase(barcode)
    if (product) {
      cache.set(barcode, product)
      return {
        success: true,
        product,
        source: 'upc-database',
      }
    }

    return {
      success: false,
      error: 'Product not found in databases',
    }
  }

  return {
    lookupBarcode,
  }
}
