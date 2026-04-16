export type Screen = 'session' | 'session-detail' | 'agent' | 'scan-result' | 'queue' | 'sold' | 'settings' | 'tag-analytics' | 'location-insights' | 'cost-tracking' | 'scan-history' | 'photo-manager' | 'listing-builder'

export type SoldShippingStatus = '🔴 Need Label' | '🟡 Label Ready' | '📦 Packed' | '✅ Shipped'

export type SoldDelistStatus = '⏳ Pending Delist' | '✅ Delisted — All Platforms' | '⚠️ Manual Delist Needed'

export interface ShippingRateQuote {
  id: string
  carrier: 'USPS' | 'UPS'
  service: string
  amount: number
  currency: 'USD'
  eta: string
  note?: string
  source: 'guide-estimate'
  isBestValue?: boolean
}

export interface SoldItem {
  id: string
  salePageId: string
  inventoryPageId?: string | null
  title: string
  imageUrl?: string | null
  platform: string
  salePrice?: number | null
  /** Platform fee (commission) extracted from sale email by WF-01 */
  platformFee?: number | null
  /** Computed: salePrice − platformFee − labelCost (server-side) */
  netIncome?: number | null
  saleDate?: string | null
  shippingStatus: SoldShippingStatus
  /** Cross-platform delist tracking — populated by WF-01 / WF-09 */
  delistStatus?: string | null
  trackingNumber?: string | null
  labelProvider?: string | null
  /** What was paid for the postage label (dollar string) */
  labelCost?: string | null
  labelUrl?: string | null
  buyerZip?: string | null
  buyerInfo?: string | null
  shipFromZip: string
  packageDims?: string | null
  itemWeightLbs?: string | null
  orderNumber?: string | null
  rawEmailSnippet?: string | null
  inventoryStatus?: string | null
  metadataSource: 'inventory' | 'scan' | 'sale' | 'manual'
  /** True when the item was logged via the manual fallback (no Notion/API) */
  isManualEntry?: boolean
}

export interface SoldShippingUpdateInput {
  shippingStatus: SoldShippingStatus
  trackingNumber?: string
  labelProvider?: string
  labelCost?: string
  labelUrl?: string
  shipFromZip?: string
  packageDims?: string
  itemWeightLbs?: string
  shipNotes?: string
  delistStatus?: SoldDelistStatus
}

/** Manual sale entry — used when email-parsing automation isn't running (offline / API down) */
export interface ManualSaleEntry {
  id: string
  createdAt: number
  title: string
  platform: string
  salePrice: number
  platformFee?: number
  orderNumber?: string
  buyerInfo?: string
  buyerZip?: string
  saleDate?: string
  itemWeightLbs?: string
  packageDims?: string
  shippingStatus: SoldShippingStatus
  trackingNumber?: string
  labelProvider?: string
  labelCost?: string
  notes?: string
}

export interface SoldFeedResponse {
  items: SoldItem[]
  warnings: string[]
  fetchedAt: number
}

export type ResalePlatform = 'ebay' | 'mercari' | 'poshmark' | 'whatnot' | 'facebook'

/** @deprecated Platform-specific listing generation moved to n8n downstream pipeline. RSP is data collection only. */
export interface PlatformListing {
  title: string
  description: string
  price: number
  category: string
  condition: string
  shippingCost: number
  platformNotes?: string
  generatedAt: number
}

export type PipelinePhase = 'vision' | 'lens' | 'market' | 'profit' | 'decision'

export type Decision = 'BUY' | 'PASS' | 'MAYBE' | 'PENDING'

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
  /**
   * Photo lifecycle fields — understand the layering before touching renders or pipelines.
   *
   * PERSISTENCE CONTRACT:
   * - `photoUrls` is the ONLY photo field guaranteed to survive KV persistence. It is the
   *   durable source of truth once the user finishes the Photo Manager.
   * - `imageData`, `additionalImageData`, `photos`, `imageOptimized` are in-memory base64.
   *   They are stripped before persisting to KV (localStorage quota) and will be `undefined`
   *   after reload for any item that was KV-persisted.
   * - `imageThumbnail` and `additionalImages` are low-res thumbnails that DO survive KV —
   *   safe to render as fallback but not Gemini-quality.
   *
   * RESOLUTION PRIORITY (see src/lib/photo.ts → getCardPhoto):
   *   photoUrls[primaryPhotoIndex ?? 0] → imageThumbnail → imageData → undefined
   *
   * RE-ANALYZE: when `imageData` is stripped post-KV, `handleReanalyzeItem` fetches
   *   photoUrls[primary] via urlToDataUrl() so Gemini can consume base64.
   *
   * DELETE CASCADE: when an item is permanently deleted, its `photoUrls` must be passed
   *   to supabaseService.deletePhotos() — UNLESS `ebayListingId` is set (live listing;
   *   deleting Supabase-hosted photos would break image URLs buyers see on eBay.com).
   */
  imageData?: string                // full base64 from capture / Gemini input; in-memory only
  imageThumbnail?: string           // small base64 thumbnail; survives KV persistence
  imageOptimized?: string           // compressed base64 for pipeline processing; in-memory only
  additionalImages?: string[]       // thumbnails for photos 2–5; persisted with item
  additionalImageData?: string[]    // full base64 for photos 2–5; in-memory only (stripped on KV save)
  photos?: string[]                 // ordered base64/data-URL array managed by Photo Manager; stripped on KV save
  primaryPhotoIndex?: number        // index of eBay hero photo in photoUrls[]; default 0
  photoUrls?: string[]              // Supabase Storage public URLs — DURABLE source of truth (persisted in KV)
  purchasePrice: number
  productName?: string
  description?: string
  category?: string
  condition?: string
  preferredPlatform?: string
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
  listingStatus?: 'not-started' | 'optimizing' | 'ready' | 'published' | 'sold' | 'shipped' | 'completed' | 'returned' | 'delisted'
  upcEan?: string            // from Gemini vision if barcode visible in photo
  ebayListingId?: string
  notionPageId?: string
  notionUrl?: string
  sessionId?: string
  scannedBy?: string  // operatorId of who performed this scan
  publishedDate?: number
  soldPrice?: number
  soldDate?: number
  soldOn?: 'ebay' | 'mercari' | 'poshmark' | 'facebook' | 'whatnot' | 'other'
  soldBuyerName?: string
  trackingNumber?: string
  shippedDate?: number
  shippingCarrier?: string
  returnedDate?: number
  returnReason?: string
  delistedDate?: number
  actualShippingCost?: number
  platformComparison?: import('../lib/platform-roi-service').PlatformROIResult[]
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
  /** @deprecated Platform-specific listings moved to n8n. RSP is data collection only. */
  platformListings?: Partial<Record<ResalePlatform, PlatformListing>>

  // ── eBay enrichment fields (PKT-20260414-001) ──────────────────────────────
  ebayCategoryId?: string           // from ebay-category-table
  subtitle?: string                 // 55-char eBay subtitle
  subtitleCostFlag?: boolean        // true = subtitle generated ($0.15/listing)
  conditionDescription?: string     // honest flaw/wear description ≤1000 chars
  seoKeywords?: string[]            // alias for keywords; 10–15 comma-sep terms
  department?: string               // Men | Women | Unisex | Boys | Girls | N/A
  size?: string                     // extracted or inferred size string
  listingFormat?: string            // Fixed Price | Auction
  listingDuration?: string          // GTC
  bestOfferEnabled?: boolean
  autoAcceptPrice?: number          // 88% of listing price
  autoDeclinePrice?: number         // 73% of listing price
  weightOz?: number                 // item weight in oz
  shippingService?: string          // recommended shipping service
  estShippingLabelCost?: number     // estimated label cost in USD
  ebayFvfRate?: number              // category FVF % (e.g. 13.25)
  breakEvenPrice?: number
  grossProfitEst?: number
  roiPctEst?: number
  netPayoutEst?: number
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
  recommendedPlatform?: string
  researchSummary?: string
  barcodeProduct?: import('../lib/barcode-service').BarcodeProduct
}

export interface UserProfile {
  operatorId: string       // slug: 'angel', 'wife', or custom
  operatorName: string     // display: 'Angel', 'Wife'
  operatorInitial: string  // badge: 'A', 'W'
  color?: string           // badge accent: 'blue' | 'purple' | 'green' | 'amber'
  focus?: string           // 'Electronics, Sneakers' — shown on session cards
  aiContext?: string       // freeform notes injected into every AI prompt
}

export interface Session {
  id: string
  /** Stable sequential number (1, 2, 3...) — used as default name (#001) and Notion session key */
  sessionNumber?: number
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
  deletedAt?: number
  /** Operator who started this session — used for ownership guards + audit */
  operatorId?: string
  operatorName?: string
  operatorInitial?: string
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
  openaiApiKey?: string
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
  ebayAdFeePercent: number
  shippingMaterialsCost: number
  paypalFeePercent: number  // Deprecated — kept for backward compat, always 0
  imageQuality?: ImageQualitySettings
  enableLensInBatch?: boolean
  lensSkipConfidence?: number
  userProfile?: UserProfile
}

export interface SharedTodo {
  id: string
  text: string
  completed: boolean
  createdBy: 'user' | 'agent'
  createdAt: number
}

export interface AgentToolCall {
  tool: 'rerun_pipeline' | 'create_listing' | 'update_item' | 'batch_analyze_queue'
       | 'add_task' | 'complete_task' | 'clear_tasks'
       | 'mark_as_sold' | 'mark_shipped' | 'add_remove_from_queue'
  itemId?: string
  updates?: Partial<ScannedItem>
  taskText?: string
  taskId?: string
  soldPrice?: number
  soldMarketplace?: 'ebay' | 'mercari' | 'poshmark' | 'facebook' | 'whatnot' | 'other'
  trackingNumber?: string
  shippingCarrier?: string
  queueAction?: 'add' | 'remove'
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
