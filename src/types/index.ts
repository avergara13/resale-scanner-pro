export type Screen = 'session' | 'research' | 'ai' | 'queue' | 'settings' | 'listing' | 'chat' | 'history'

export type PipelinePhase = 'vision' | 'lens' | 'market' | 'profit' | 'decision'

export type Decision = 'GO' | 'PASS' | 'PENDING'

export interface PipelineStep {
  id: PipelinePhase
  label: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  data?: any
  error?: string
}

export interface ScannedItem {
  id: string
  timestamp: number
  imageUrl?: string
  imageData?: string
  purchasePrice: number
  productName?: string
  description?: string
  category?: string
  estimatedSellPrice?: number
  profitMargin?: number
  decision: Decision
  lensResults?: GoogleLensResult[]
  marketData?: MarketData
  notes?: string
  inQueue: boolean
}

export interface GoogleLensResult {
  title: string
  link: string
  thumbnail?: string
  price?: string
  source: string
}

export interface MarketData {
  ebayAvgSold?: number
  ebayMedianSold?: number
  ebayActiveListings?: number
  ebaySoldCount?: number
  ebayPriceRange?: {
    min: number
    max: number
  }
  ebaySellThroughRate?: number
  ebayRecentSales?: Array<{
    title: string
    price: number
    soldDate: string
    condition: string
  }>
  ebayActiveItems?: Array<{
    title: string
    price: number
    quantity: number
  }>
  googleShoppingMin?: number
  googleShoppingMax?: number
  competitorCount?: number
  sellThroughRate?: number
  recommendedPrice?: number
}

export interface Session {
  id: string
  startTime: number
  endTime?: number
  itemsScanned: number
  goCount: number
  passCount: number
  totalPotentialProfit: number
  active: boolean
}

export interface AppSettings {
  geminiApiKey?: string
  anthropicApiKey?: string
  ebayApiKey?: string
  ebayAppId?: string
  ebayDevId?: string
  ebayCertId?: string
  googleApiKey?: string
  supabaseUrl?: string
  supabaseKey?: string
  n8nWebhookUrl?: string
  notionApiKey?: string
  notionDatabaseId?: string
  preferredAiModel?: 'gemini-2.0-flash-exp' | 'gemini-1.5-pro' | 'gemini-1.5-flash' | 'claude-3-5-sonnet'
  voiceEnabled: boolean
  autoCapture: boolean
  agenticMode: boolean
  liveSearchEnabled: boolean
  minProfitMargin: number
  defaultShippingCost: number
  ebayFeePercent: number
  paypalFeePercent: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface EbayListing {
  itemId: string
  title: string
  description: string
  price: number
  shippingCost: number
  images: string[]
  category: string
  condition: string
  status: 'draft' | 'published'
}
