export type Screen = 'session' | 'research' | 'ai' | 'queue' | 'settings' | 'listing' | 'chat' | 'history' | 'incidents'

export type PipelinePhase = 'vision' | 'lens' | 'market' | 'profit' | 'decision'

export type Decision = 'GO' | 'PASS' | 'PENDING'

export interface PipelineStep {
  id: PipelinePhase
  label: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  progress?: number
  data?: any
  error?: string
}

export interface DetectedProduct {
  id: string
  name: string
  confidence: number
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  croppedImageData?: string
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
  lensAnalysis?: GoogleLensAnalysis
  marketData?: MarketData
  notes?: string
  inQueue: boolean
  detectedProducts?: DetectedProduct[]
  isMultiProduct?: boolean
  parentItemId?: string
}

export interface GoogleLensResult {
  title: string
  link: string
  thumbnail?: string
  price?: string
  source: string
  snippet?: string
}

export interface GoogleLensAnalysis {
  results: GoogleLensResult[]
  bestMatch?: GoogleLensResult
  priceRange?: {
    min: number
    max: number
    average: number
  }
  dominantSources: string[]
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
  googleSearchEngineId?: string
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
  darkMode: boolean
  themeMode?: 'light' | 'dark' | 'auto'
  useAmbientLight?: boolean
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

export interface ConnectionEvent {
  id: string
  timestamp: number
  service: 'gemini' | 'googleLens' | 'ebay' | 'overall'
  previousStatus: 'healthy' | 'degraded' | 'offline' | 'checking'
  newStatus: 'healthy' | 'degraded' | 'offline' | 'checking'
  latency?: number
  error?: string
  duration?: number
}

export interface DowntimeIncident {
  id: string
  service: 'gemini' | 'googleLens' | 'ebay' | 'overall'
  startTime: number
  endTime?: number
  duration?: number
  resolved: boolean
  error?: string
  impactedOperations?: number
}

export interface ConnectionHistoryStats {
  totalEvents: number
  totalDowntime: number
  averageUptime: number
  incidentCount: number
  mostUnreliableService?: string
  lastIncident?: DowntimeIncident
  uptimePercentage: Record<string, number>
}

export interface DetectionHistoryEntry {
  id: string
  timestamp: number
  imageData: string
  detectedCount: number
  detectedProducts: DetectedProduct[]
  userConfirmedCount?: number
  acceptedProducts?: string[]
  rejectedProducts?: string[]
  accuracy?: number
  processingTimeMs: number
  modelUsed: string
}

export interface DetectionHistoryStats {
  totalScans: number
  totalDetections: number
  averageDetectionsPerScan: number
  averageAccuracy: number
  averageProcessingTime: number
  mostCommonProductCount: number
  fastestScan: number
  slowestScan: number
  totalUserCorrections: number
}
