export type Screen = 'session' | 'ai' | 'queue' | 'settings' | 'listing' | 'chat' | 'history'

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
  ebayActiveListings?: number
  ebaySoldCount?: number
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
  ebayApiKey?: string
  googleApiKey?: string
  voiceEnabled: boolean
  autoCapture: boolean
  minProfitMargin: number
  defaultShippingCost: number
  ebayFeePercent: number
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
