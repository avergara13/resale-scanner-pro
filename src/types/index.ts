export type Screen = 'session' | 'session-detail' | 'agent' | 'ai' | 'queue' | 'sold' | 'settings' | 'tag-analytics' | 'location-insights' | 'cost-tracking' | 'scan-history'

export type PipelinePhase = 'vision' | 'lens' | 'market' | 'profit' | 'decision'

export type Decision = 'BUY' | 'PASS' | 'PENDING'

export interface PipelineStep {
  id: PipelinePhase
  label: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  progress?: number
  data?: string
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

export interface ItemTag {
  id: string
  name: string
  color: string
  icon?: string
}

export interface CategoryPreset {
  id: string
  name: string
  description?: string
  tags: string[]
  filters?: {
    minProfit?: number
    maxProfit?: number
    decision?: Decision[]
    dateRange?: {
      start?: number
      end?: number
    }
  }
  sortBy?: 'profit' | 'date' | 'price' | 'name'
  sortOrder?: 'asc' | 'desc'
  color?: string
  icon?: string
  createdAt: number
  updatedAt: number
  isDefault?: boolean
}

export interface ScannedItem {
  id: string
  timestamp: number
  imageUrl?: string
  imageData?: string
  imageThumbnail?: string
  imageOptimized?: string
  purchasePrice: number
  productName?: string
  description?: string
  category?: string
  tags?: string[]
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
  location?: ThriftStoreLocation
  optimizedListing?: OptimizedListing
  listingStatus?: 'not-started' | 'optimizing' | 'ready' | 'published' | 'sold' | 'shipped' | 'completed'
  ebayListingId?: string
  notionPageId?: string
  notionUrl?: string
  sessionId?: string
  soldPrice?: number
  soldDate?: number
  soldOn?: 'ebay' | 'mercari' | 'poshmark' | 'facebook' | 'whatnot' | 'other'
  soldBuyerName?: string
  trackingNumber?: string
  shippedDate?: number
  shippingCarrier?: string
}

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
  optimizedAt: number
}

export interface ThriftStoreLocation {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  latitude?: number
  longitude?: number
  type?: 'goodwill' | 'salvation-army' | 'ross' | 'tjmaxx' | 'marshalls' | 'homegoods' | 'ollies' | 'burlington' | 'thrift-store' | 'estate-sale' | 'garage-sale' | 'flea-market' | 'other'
}

export interface LocationPerformance {
  location: ThriftStoreLocation
  totalScans: number
  buyCount: number
  passCount: number
  totalProfit: number
  averageProfit: number
  buyRate: number
  lastVisit?: number
  bestCategories: Array<{
    category: string
    count: number
    avgProfit: number
  }>
  recentFinds: ScannedItem[]
  weeklyPerformance?: Array<{
    weekStart: number
    weekEnd: number
    scans: number
    profit: number
    buyCount: number
    passCount: number
  }>
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
  name?: string
  startTime: number
  endTime?: number
  itemsScanned: number
  buyCount: number
  passCount: number
  totalPotentialProfit: number
  active: boolean
  profitGoal?: number
  location?: ThriftStoreLocation
  sessionType?: 'business' | 'personal'
}

export interface ProfitGoal {
  id: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  targetAmount: number
  startDate: number
  endDate: number
  createdAt: number
  active: boolean
}

export interface ProfitGoalProgress {
  goal: ProfitGoal
  currentAmount: number
  percentageComplete: number
  remainingAmount: number
  daysRemaining: number
  onTrack: boolean
  projectedTotal: number
  dailyAverageNeeded: number
}

export type ImageQualityPreset = 'fast' | 'balanced' | 'quality' | 'maximum'

export interface ImageQualitySettings {
  preset: ImageQualityPreset
  customSettings?: {
    thumbnailQuality: number
    thumbnailSize: number
    previewQuality: number
    previewMaxSize: number
    format: 'jpeg' | 'webp'
  }
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
  preferredAiModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'claude-3-5-sonnet'
  voiceEnabled: boolean
  autoCapture: boolean
  agenticMode: boolean
  liveSearchEnabled: boolean
  darkMode: boolean
  themeMode?: 'light' | 'dark' | 'auto'
  useAmbientLight?: boolean
  apiNotificationsEnabled?: boolean
  minProfitMargin: number
  defaultShippingCost: number
  ebayFeePercent: number
  paypalFeePercent: number
  imageQuality?: ImageQualitySettings
  enableLensInBatch?: boolean
  lensSkipConfidence?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ChatSession {
  id: string
  name: string
  createdAt: number
  lastMessageAt: number
  messages: ChatMessage[]
  isActive: boolean
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

export type ApiService = 'gemini' | 'googleLens' | 'ebay' | 'notion' | 'googleCustomSearch' | 'openai'

export interface ApiCostConfig {
  service: ApiService
  name: string
  pricing: {
    inputTokenCost?: number
    outputTokenCost?: number
    requestCost?: number
    imageCost?: number
    searchCost?: number
    freeTier?: {
      monthly?: number
      daily?: number
      perRequest?: number
    }
  }
}

export interface ApiUsageLog {
  id: string
  timestamp: number
  service: ApiService
  operation: string
  cost: number
  details: {
    inputTokens?: number
    outputTokens?: number
    imageSize?: number
    searchQueries?: number
    success: boolean
    errorMessage?: string
    sessionId?: string
    itemId?: string
  }
}

export interface ServiceCostSummary {
  service: ApiService
  totalCost: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageCostPerRequest: number
  costByOperation: Record<string, number>
  lastUsed?: number
}

export interface CostTrackingPeriod {
  period: 'today' | 'week' | 'month' | 'all'
  startDate: number
  endDate: number
  totalCost: number
  totalRequests: number
  services: ServiceCostSummary[]
  topCostOperations: Array<{
    service: ApiService
    operation: string
    cost: number
    count: number
  }>
  projectedMonthlyCost?: number
  budgetRemaining?: number
}

export interface CostBudget {
  id: string
  period: 'daily' | 'weekly' | 'monthly'
  limit: number
  warningThreshold: number
  startDate: number
  endDate: number
  active: boolean
  serviceSpecific?: {
    service: ApiService
    limit: number
  }[]
}

export interface CostAlert {
  id: string
  timestamp: number
  type: 'budget-warning' | 'budget-exceeded' | 'spike-detected' | 'quota-exceeded'
  service?: ApiService
  message: string
  cost: number
  threshold?: number
  acknowledged: boolean
}
