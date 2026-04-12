import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Toaster, toast } from 'sonner'
import { logActivity, ACTIVITY_LOG_KEY, MAX_ACTIVITY_ENTRIES, type ActivityEntry } from './lib/activity-log'
import { logDebug, DEBUG_LOG_KEY, MAX_DEBUG_ENTRIES, type DebugEntry } from './lib/debug-log'
import { AnimatePresence, motion } from 'framer-motion'
import { BottomNav } from './components/BottomNav'
import { AppHeader } from './components/AppHeader'
import { CameraOverlay } from './components/CameraOverlay'
import { BatchAnalysisProgress } from './components/BatchAnalysisProgress'
import { RetryStatusIndicator } from './components/RetryStatusIndicator'
import { AIScreen } from './components/screens/AIScreen'
import { AgentScreen } from './components/screens/AgentScreen'
import { SessionScreen } from './components/screens/SessionScreen'
import { QueueScreen } from './components/screens/QueueScreen'
import { SettingsScreen } from './components/screens/SettingsScreen'
import { TagAnalyticsScreen } from './components/screens/TagAnalyticsScreen'
import { LocationInsightsScreen } from './components/screens/LocationInsightsScreen'
import { CostTrackingScreen } from './components/screens/CostTrackingScreen'
import { ScanHistoryScreen } from './components/screens/ScanHistoryScreen'
import { SoldScreen } from './components/screens/SoldScreen'
import { SessionDetailScreen } from './components/screens/SessionDetailScreen'
import { ListingDetailScreen } from './components/screens/ListingDetailScreen'
import { createEbayService, calculateProfitFallback } from './lib/ebay-service'
import { retryOperation } from './lib/retry-service'
import { getRetryOptions } from './lib/retry-config'
import { callLLM, researchProduct, parseResearchPrice } from './lib/llm-service'
import { createGeminiService } from './lib/gemini-service'
import { createGoogleLensService } from './lib/google-lens-service'
import { createTagSuggestionService } from './lib/tag-suggestion-service'
import { createListingOptimizationService } from './lib/listing-optimization-service'
import { createNotionService } from './lib/notion-service'
import { fetchSoldItems, updateSoldItemShipping } from './lib/sold-service'
import { useCaptureState } from './hooks/use-capture-state'
import { useTheme } from './hooks/use-theme'
import { useImageOptimization } from './hooks/use-image-optimization'
import { useRetryTracker } from './hooks/use-retry-tracker'
import type { GeminiVisionResponse } from './lib/gemini-service'
import type { GoogleLensAnalysis } from './lib/google-lens-service'
import type { BarcodeProduct } from './lib/barcode-service'
import type { Screen, ScannedItem, PipelineStep, Session, AppSettings, ItemTag, ThriftStoreLocation, ProfitGoal, ResalePlatform, SoldItem, SoldShippingUpdateInput } from './types'
import { cn } from './lib/utils'

/** Pure helper — determines BUY/PASS/PENDING from profit metrics */
function makeDecision(
  sellPrice: number,
  buyPrice: number,
  profitMargin: number,
  netProfit: number,
  minMargin: number
): 'BUY' | 'PASS' | 'PENDING' {
  if (sellPrice <= 0) return 'PENDING'
  if (buyPrice === 0) return netProfit > 0 ? 'BUY' : 'PASS'
  return profitMargin > minMargin ? 'BUY' : 'PASS'
}

function App() {
  const [screen, setScreen] = useState<Screen>('session')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [showSessionTrends, setShowSessionTrends] = useState(false)
  const [agentPendingMessage, setAgentPendingMessage] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraMode, setCameraMode] = useState<'new-scan' | 'add-photo' | 'replace-primary'>('new-scan')
  const [currentItem, setCurrentItem] = useState<ScannedItem | undefined>()
  const [pipeline, setPipeline] = useState<PipelineStep[]>([])
  // Tracks whether the current scan-result was opened from the Agent Scans tab (Reopen)
  // vs a fresh camera scan. Used to show "← Scans" back label in the header.
  const [openedFromScans, setOpenedFromScans] = useState(false)
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentItemName: '' })
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [liveSoldItems, setLiveSoldItems] = useState<SoldItem[]>([])
  const [soldWarnings, setSoldWarnings] = useState<string[]>([])
  const [soldLoading, setSoldLoading] = useState(false)
  const [soldError, setSoldError] = useState<string | null>(null)
  const [soldSyncedAt, setSoldSyncedAt] = useState<number | null>(null)

  
  const [queue, setQueue] = useKV<ScannedItem[]>('queue', [])
  // Ref mirror of `queue` — used by pipeline handlers to escape stale closures
  // when the Agent runs multi-step flows (batch-analyze → optimize → push) and
  // subsequent handlers need the latest queue state, not the pre-pipeline snapshot.
  const queueRef = useRef(queue)
  useEffect(() => { queueRef.current = queue }, [queue])
  const [scanHistory, setScanHistory] = useKV<ScannedItem[]>('scan-history', [])
  const [session, setSession] = useKV<Session | undefined>('currentSession', undefined)
  const [allSessions, setAllSessions] = useKV<Session[]>('all-sessions', [])
  const [allTags] = useKV<ItemTag[]>('all-tags', [])
  const [profitGoals] = useKV<ProfitGoal[]>('profit-goals', [])
  const [, setActivityLog] = useKV<ActivityEntry[]>(ACTIVITY_LOG_KEY, [])
  const [, setDebugLog] = useKV<DebugEntry[]>(DEBUG_LOG_KEY, [])
  const [settings, setSettings] = useKV<AppSettings>('settings', {
    voiceEnabled: true,
    autoCapture: true,
    agenticMode: true,
    liveSearchEnabled: true,
    darkMode: false,
    themeMode: 'auto',
    useAmbientLight: false,
    apiNotificationsEnabled: false,
    minProfitMargin: 30,
    defaultShippingCost: 5.0,
    ebayFeePercent: 12.9,
    ebayAdFeePercent: 3.0,
    shippingMaterialsCost: 0.75,
    paypalFeePercent: 0,
    preferredAiModel: 'gemini-2.5-flash',
    notionDatabaseId: '7e49058fa8874889b9f6ae5a6c3bf8e7',
    imageQuality: { preset: 'balanced' },
    // Pre-populated from Railway env vars — both users get keys automatically.
    // Overridable per-device in Settings if needed.
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    anthropicApiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
    notionApiKey: import.meta.env.VITE_NOTION_API_KEY || '',
    googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
    googleSearchEngineId: import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID || '',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  })
  
  const { captureState, triggerCapture, startAnalyzing, triggerSuccess, triggerFail, reset } = useCaptureState()
  const { themeMode, setTheme, toggleAmbientLight } = useTheme()
  const imageQualityPreset = settings?.imageQuality?.preset || 'balanced'
  const { optimizeAndCache } = useImageOptimization(imageQualityPreset)
  const { state: retryState } = useRetryTracker()

  const ebayService = useMemo(() => {
    return createEbayService(
      settings?.ebayAppId,
      settings?.ebayDevId,
      settings?.ebayCertId,
      settings?.ebayApiKey
    )
  }, [settings?.ebayAppId, settings?.ebayDevId, settings?.ebayCertId, settings?.ebayApiKey])

  const geminiService = useMemo(() => {
    // Use stored setting first; fall back to env var so both phones work automatically.
    const key = settings?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY
    return createGeminiService(key, settings?.preferredAiModel)
  }, [settings?.geminiApiKey, settings?.preferredAiModel])

  const googleLensService = useMemo(() => {
    const key = settings?.googleApiKey || import.meta.env.VITE_GOOGLE_API_KEY
    const engineId = settings?.googleSearchEngineId || import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID
    return createGoogleLensService(key, engineId)
  }, [settings?.googleApiKey, settings?.googleSearchEngineId])

  const tagSuggestionService = useMemo(() => createTagSuggestionService(), [])

  const listingOptimizationService = useMemo(() => {
    const key = settings?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY
    return createListingOptimizationService(key)
  }, [settings?.geminiApiKey])

  const notionService = useMemo(() => {
    const key = settings?.notionApiKey || import.meta.env.VITE_NOTION_API_KEY
    return createNotionService(key, settings?.notionDatabaseId)
  }, [settings?.notionApiKey, settings?.notionDatabaseId])

  // Set of session IDs marked as personal — used to exclude from business profit calculations
  const personalSessionIds = useMemo(() => {
    const ids = new Set<string>()
    ;(allSessions || []).forEach(s => { if (s.sessionType === 'personal') ids.add(s.id) })
    return ids
  }, [allSessions])

  // Filter out soft-deleted sessions from all UI consumers
  const visibleSessions = useMemo(() =>
    (allSessions || []).filter(s => !s.deletedAt),
  [allSessions])

  const deletedSessions = useMemo(() =>
    (allSessions || []).filter(s => s.deletedAt),
  [allSessions])

  const handleRestoreSession = useCallback((sessionId: string) => {
    setAllSessions((prev) => (prev || []).map(s =>
      s.id === sessionId ? { ...s, deletedAt: undefined } : s
    ))
    logActivity('Session restored')
  }, [setAllSessions])

  const handlePermanentDeleteSession = useCallback((sessionId: string) => {
    setAllSessions((prev) => (prev || []).filter(s => s.id !== sessionId))
  }, [setAllSessions])

  const simulateProgress = useCallback((stepIndex: number, duration: number) => {
    const updateInterval = 80
    const totalUpdates = Math.floor(duration / updateInterval)
    let currentUpdate = 0
    
    const progressCurve = (t: number) => {
      return Math.floor(t * t * 95)
    }
    
    const intervalId = setInterval(() => {
      currentUpdate++
      const progress = progressCurve(currentUpdate / totalUpdates)
      
      setPipeline(prev => prev.map((s, idx) => 
        idx === stepIndex ? { ...s, progress: Math.min(progress, 95) } : s
      ))
      
      if (currentUpdate >= totalUpdates) {
        clearInterval(intervalId)
      }
    }, updateInterval)
    
    return () => clearInterval(intervalId)
  }, [])
  
  const completeStep = useCallback((stepIndex: number) => {
    setPipeline(prev => prev.map((s, idx) => 
      idx === stepIndex ? { ...s, progress: 100, status: 'complete' } : s
    ))
  }, [])

  const handleCapture = useCallback(async (imageData: string, price: number, location?: ThriftStoreLocation, barcodeProduct?: BarcodeProduct, existingItem?: ScannedItem) => {
    // Route to add-photo handler — append this image to the current item without a new pipeline run
    if (cameraMode === 'add-photo') {
      setCameraMode('new-scan')
      setCameraOpen(false)
      await handleAddPhotoToCurrentItem(imageData)
      return
    }

    // Replace-primary mode — treat currentItem as the existing item so ID is preserved
    const effectiveExistingItem =
      cameraMode === 'replace-primary' && currentItem ? currentItem : existingItem
    if (cameraMode === 'replace-primary') setCameraMode('new-scan')

    triggerCapture()
    setCameraOpen(false)

    try {
      const optimized = await optimizeAndCache(imageData)

    // If re-analyzing an existing item, preserve its ID and metadata so we don't
    // create a duplicate card in scan history. Otherwise create a fresh item.
    const newItem: ScannedItem = effectiveExistingItem
      ? {
          ...effectiveExistingItem,
          imageData: optimized.original,
          imageThumbnail: optimized.thumbnail,
          imageOptimized: optimized.original,
          decision: 'PENDING' as const,   // reset for clean pipeline run
        }
      : {
          id: Date.now().toString(),
          timestamp: Date.now(),
          imageData: optimized.original,
          imageThumbnail: optimized.thumbnail,
          imageOptimized: optimized.original,
          purchasePrice: price,
          decision: 'PENDING',
          inQueue: false,
          location,
          sessionId: session?.id,
          // Pre-seed from barcode lookup; Gemini vision will overwrite with better data if available
          productName: barcodeProduct?.title || undefined,
        }
    setCurrentItem(newItem)
    setScreen('scan-result')

    const steps: PipelineStep[] = [
      { id: 'vision', label: 'Vision Analysis', status: 'processing', progress: 0 },
      { id: 'lens', label: 'Google Lens', status: 'pending', progress: 0 },
      { id: 'market', label: 'Market Research', status: 'pending', progress: 0 },
      { id: 'profit', label: 'Profit Calculation', status: 'pending', progress: 0 },
      { id: 'decision', label: 'Decision', status: 'pending', progress: 0 },
    ]
    setPipeline(steps)
    
    startAnalyzing()
    logDebug('Scan pipeline started', 'info', 'scan', { price, hasGemini: !!geminiService, hasLens: !!googleLensService })

    try {
      let visionResult: GeminiVisionResponse | undefined
      // Fall back to barcode title if Gemini vision is unavailable
      let mockProductName = barcodeProduct?.title || 'Unknown Product'

      simulateProgress(0, 3000)
      
      if (geminiService) {
        try {
          visionResult = await geminiService.analyzeProductImage(
            imageData,
            {},
            price,
            newItem.additionalImageData?.length ? newItem.additionalImageData : undefined,
          )
          mockProductName = visionResult.productName
          
          completeStep(0)
          await new Promise(resolve => setTimeout(resolve, 100))
          setPipeline(prev => prev.map((s, i) => 
            i === 0 ? { 
              ...s, 
              data: `${visionResult?.productName || mockProductName} - ${visionResult?.brand || 'Generic'} (${visionResult ? Math.round(visionResult.confidence * 100) : 0}% confident)` 
            } : s
          ))
        } catch (error) {
          console.error('Gemini vision failed:', error)
          completeStep(0)
          await new Promise(resolve => setTimeout(resolve, 100))
          setPipeline(prev => prev.map((s, i) => 
            i === 0 ? { 
              ...s, 
              data: 'Vision analysis unavailable - configure Gemini API key in Settings' 
            } : s
          ))
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000))
        completeStep(0)
        await new Promise(resolve => setTimeout(resolve, 100))
        setPipeline(prev => prev.map((s, i) => 
          i === 0 ? { 
            ...s, 
            data: 'Configure Gemini API key in Settings for real vision analysis' 
          } : s
        ))
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      setPipeline(prev => prev.map((s, i) => 
        i === 0 ? s : i === 1 ? { ...s, status: 'processing', progress: 0 } : s
      ))
      
      let lensAnalysis: GoogleLensAnalysis | undefined

      // Cost optimization: skip Google Lens if Gemini is already highly confident
      // Saves a Custom Search API call (~100/day free tier) on clear identifications
      const geminiConfidence = visionResult ? visionResult.confidence : 0
      const lensThreshold = settings?.lensSkipConfidence || 0.85
      const skipLens = geminiConfidence >= lensThreshold

      simulateProgress(1, skipLens ? 800 : 2500)

      if (googleLensService && !skipLens) {
        try {
          lensAnalysis = await googleLensService.searchByImage(imageData, visionResult?.productName || mockProductName)
          
          completeStep(1)
          await new Promise(resolve => setTimeout(resolve, 100))
          setPipeline(prev => prev.map((s, i) =>
            i === 1 ? {
              ...s,
              data: skipLens
                ? `Skipped — Gemini ${Math.round(geminiConfidence * 100)}% confident (saves API call)`
                : `Found ${lensAnalysis?.results.length || 0} matches. Range: ${lensAnalysis?.priceRange ? `$${lensAnalysis.priceRange.min.toFixed(2)}-$${lensAnalysis.priceRange.max.toFixed(2)}` : 'No prices'}`
            } : s
          ))
        } catch (error) {
          console.error('Google Lens failed:', error)
          completeStep(1)
          await new Promise(resolve => setTimeout(resolve, 100))
          setPipeline(prev => prev.map((s, i) =>
            i === 1 ? {
              ...s,
              data: 'Google Lens unavailable — using Gemini only'
            } : s
          ))
        }
      } else if (!googleLensService) {
        await new Promise(resolve => setTimeout(resolve, 400))
        completeStep(1)
        await new Promise(resolve => setTimeout(resolve, 100))
        setPipeline(prev => prev.map((s, i) =>
          i === 1 ? {
            ...s,
            data: 'Configure Google API key in Settings for visual search'
          } : s
        ))
      } else {
        // skipLens = true (high confidence) — fast path
        await new Promise(resolve => setTimeout(resolve, 400))
        completeStep(1)
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      setPipeline(prev => prev.map((s, i) => 
        i <= 1 ? { ...s, status: 'complete' } : s
      ))
      
      await new Promise(resolve => setTimeout(resolve, 500))
      setPipeline(prev => prev.map((s, i) => 
        i <= 1 ? s : i === 2 ? { ...s, status: 'processing', progress: 0 } : s
      ))
      
      let marketData: typeof newItem.marketData = undefined
      // Start at 0 — apply ranked fallback after eBay phase: eBay → Lens avg → 4.5x markup
      let ebayAvgPrice = 0

      simulateProgress(2, 3800)

      if (ebayService) {
        await retryOperation(
          async () => {
            const searchTerm = visionResult?.searchTerms?.[0] || mockProductName
            const categoryId = await ebayService.getCategoryId(searchTerm)
            const searchResults = await ebayService.searchCompletedListings(searchTerm, categoryId)

            marketData = {
              ebayAvgSold: searchResults.averageSoldPrice,
              ebayMedianSold: searchResults.medianSoldPrice,
              ebayActiveListings: searchResults.activeCount,
              ebaySoldCount: searchResults.soldCount,
              ebayPriceRange: searchResults.priceRange,
              ebaySellThroughRate: searchResults.sellThroughRate,
              ebayRecentSales: searchResults.soldItems.slice(0, 10),
              ebayActiveItems: searchResults.activeListings.slice(0, 10),
              recommendedPrice: searchResults.recommendedPrice,
            }

            ebayAvgPrice = searchResults.recommendedPrice > 0 ? searchResults.recommendedPrice : 0

            setPipeline(prev => prev.map((s, i) =>
              i === 2 ? {
                ...s,
                data: `Found ${searchResults.soldCount} sold, ${searchResults.activeCount} active. Avg: $${searchResults.averageSoldPrice.toFixed(2)}`
              } : s
            ))
          },
          {
            ...getRetryOptions('ebay-search'),
            onRetry: (_err, attempt) => {
              setPipeline(prev => prev.map((s, i) =>
                i === 2 ? { ...s, data: `Retrying market data (${attempt}/5)...` } : s
              ))
            },
          }
        ).catch(() => {
          setPipeline(prev => prev.map((s, i) =>
            i === 2 ? { ...s, data: 'Using estimated pricing (eBay API unavailable)' } : s
          ))
        })
        completeStep(2)
        await new Promise(resolve => setTimeout(resolve, 100))
      } else {
        // No eBay API — use Gemini Google Search grounding to get real market comps
        const geminiKey = settings?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY
        if (geminiKey) {
          setPipeline(prev => prev.map((s, i) =>
            i === 2 ? { ...s, data: 'Searching eBay, Mercari, Poshmark, Whatnot, StockX...' } : s
          ))
          try {
            const researchText = await researchProduct(
              visionResult?.productName || mockProductName,
              { purchasePrice: price, category: visionResult?.category, brand: visionResult?.brand },
              geminiKey
            )
            // Store for listing detail agent context
            marketData = { ...(marketData || {}), researchSummary: researchText }
            // Parse recommended sell price from research text
            const researchPrice = parseResearchPrice(researchText)
            if (researchPrice > 0) {
              ebayAvgPrice = researchPrice
              setPipeline(prev => prev.map((s, i) =>
                i === 2 ? { ...s, data: `Market price ~$${researchPrice.toFixed(2)} (Google Search)` } : s
              ))
            } else {
              // Tier 2: direct Gemini ask — fixed options object (Anthropic tried at Tier 3 via task:'complex')
              const productLabel = visionResult?.productName || mockProductName
              const anthropicKey = settings?.anthropicApiKey || import.meta.env.VITE_ANTHROPIC_API_KEY
              let gotPrice = false
              try {
                const directPriceText = await callLLM(
                  `What is the current average resale price for "${productLabel}" on eBay or Mercari? Reply with ONLY a single dollar amount like "$24.99".`,
                  { geminiApiKey: geminiKey, anthropicApiKey: anthropicKey, task: 'chat' }
                )
                const directPrice = parseResearchPrice(directPriceText)
                if (directPrice > 0) {
                  ebayAvgPrice = directPrice
                  gotPrice = true
                  setPipeline(prev => prev.map((s, i) =>
                    i === 2 ? { ...s, data: `Est. market value ~$${directPrice.toFixed(2)}` } : s
                  ))
                }
              } catch { /* fall through to Tier 3 */ }

              if (!gotPrice) {
                // Tier 3: Claude deep research fallback (task: 'complex' tries Anthropic first)
                try {
                  const tier3Text = await callLLM(
                    `You are a resale expert. Based on eBay, Mercari, and Poshmark sold comps, what is the median resale price for "${productLabel}"? Reply ONLY with: RECOMMENDED_SELL_PRICE: $XX.XX`,
                    { geminiApiKey: geminiKey, anthropicApiKey: anthropicKey, task: 'complex' }
                  )
                  const tier3Price = parseResearchPrice(tier3Text)
                  if (tier3Price > 0) {
                    ebayAvgPrice = tier3Price
                    marketData = { ...(marketData || {}), researchSummary: (marketData?.researchSummary || '') + '\n\n' + tier3Text }
                    setPipeline(prev => prev.map((s, i) =>
                      i === 2 ? { ...s, data: `Est. value ~$${tier3Price.toFixed(2)} (AI research)` } : s
                    ))
                  } else {
                    setPipeline(prev => prev.map((s, i) =>
                      i === 2 ? { ...s, data: 'Market data unavailable — enter price above' } : s
                    ))
                  }
                } catch {
                  setPipeline(prev => prev.map((s, i) =>
                    i === 2 ? { ...s, data: 'Market data unavailable — enter price above' } : s
                  ))
                }
              }
            }
          } catch {
            // Gemini grounded search failed entirely — try Anthropic/Gemini directly
            const anthropicKey = settings?.anthropicApiKey || import.meta.env.VITE_ANTHROPIC_API_KEY
            const productLabel = visionResult?.productName || mockProductName
            let recovered = false
            try {
              const fallbackText = await callLLM(
                `Based on eBay and Mercari sold listings, what is the median resale price for "${productLabel}"? Reply ONLY with: RECOMMENDED_SELL_PRICE: $XX.XX`,
                { geminiApiKey: geminiKey, anthropicApiKey: anthropicKey, task: 'complex' }
              )
              const fallbackPrice = parseResearchPrice(fallbackText)
              if (fallbackPrice > 0) {
                ebayAvgPrice = fallbackPrice
                marketData = { researchSummary: fallbackText }
                recovered = true
                setPipeline(prev => prev.map((s, i) =>
                  i === 2 ? { ...s, data: `Est. value ~$${fallbackPrice.toFixed(2)} (Claude research)` } : s
                ))
              }
            } catch { /* both failed */ }
            if (!recovered) {
              setPipeline(prev => prev.map((s, i) =>
                i === 2 ? { ...s, data: 'Search unavailable' } : s
              ))
            }
          }
        } else {
          setPipeline(prev => prev.map((s, i) =>
            i === 2 ? { ...s, data: 'Add Gemini API key in Settings for live market search' } : s
          ))
        }
        completeStep(2)
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Sell price fallback chain: eBay/Gemini research → Google Lens average → 4.5× markup (only if price > 0)
      if (ebayAvgPrice <= 0) {
        const lensAvg = lensAnalysis?.priceRange?.average || 0
        if (lensAvg > 0) {
          ebayAvgPrice = lensAvg
        } else if (price > 0) {
          // Last resort: use purchase-price multiplier only when user actually entered a price
          ebayAvgPrice = price * 4.5
        }
        // If price=0 and no market data: ebayAvgPrice stays 0 → decision stays PENDING
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      setPipeline(prev => prev.map((s, i) => 
        i <= 2 ? s : i === 3 ? { ...s, status: 'processing', progress: 0 } : s
      ))
      
      simulateProgress(3, 1600)
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const sellPrice = ebayAvgPrice
      const profitMetrics = ebayService?.calculateProfitMetrics(
        price,
        sellPrice,
        settings?.defaultShippingCost ?? 5.0,
        settings?.ebayFeePercent ?? 12.9,
        0,                                          // paypalFeePercent (deprecated)
        0.30,                                       // perOrderFee (eBay fixed)
        settings?.ebayAdFeePercent ?? 3.0,          // ad/promoted listings fee from Business Rules
        settings?.shippingMaterialsCost ?? 0.75     // packaging materials cost from Business Rules
      ) || calculateProfitFallback(
        price,
        sellPrice,
        settings?.defaultShippingCost ?? 5.0,
        settings?.ebayFeePercent ?? 12.9,
        0.30,
        settings?.ebayAdFeePercent ?? 3.0,
        settings?.shippingMaterialsCost ?? 0.75
      )

      const minMargin = settings?.minProfitMargin || 30
      const decision = makeDecision(ebayAvgPrice, price, profitMetrics.profitMargin, profitMetrics.netProfit, minMargin)

      // Free item on standard platforms: if fees eat all profit, recommend fee-free local platform
      const freeItemPlatformHint =
        price === 0 && decision === 'PASS'
          ? 'Facebook Marketplace (local, no fees)'
          : undefined

      if (decision === 'BUY') {
        triggerSuccess()
      } else {
        triggerFail()
      }
      
      completeStep(3)
      await new Promise(resolve => setTimeout(resolve, 100))
      setPipeline(prev => prev.map((s, i) => 
        i === 3 ? { 
          ...s, 
          data: `Margin: ${profitMetrics.profitMargin.toFixed(1)}%, ROI: ${profitMetrics.roi.toFixed(0)}%`
        } : s
      ))
      
      await new Promise(resolve => setTimeout(resolve, 500))
      completeStep(4)
      
      const updatedItem: ScannedItem = {
        ...newItem,
        productName: visionResult?.productName || barcodeProduct?.title || mockProductName,
        description: visionResult?.description || barcodeProduct?.description || 'Product analysis unavailable',
        category: visionResult?.category || barcodeProduct?.category || 'General',
        estimatedSellPrice: sellPrice > 0 ? sellPrice : undefined,
        profitMargin: sellPrice > 0 ? profitMetrics.profitMargin : undefined,
        decision,
        lensAnalysis,
        lensResults: lensAnalysis?.results,
        marketData: {
          ...marketData,
          // Preserve barcode lookup data for listing generation context
          ...(barcodeProduct ? { barcodeProduct } : {}),
          // Free-item platform recommendation when standard platform fees eat all profit
          ...(freeItemPlatformHint ? { recommendedPlatform: freeItemPlatformHint } : {}),
        },
      }

      // Non-blocking enrichment: runs only when eBay was used (research already ran in pipeline
      // when eBay was absent — skip to avoid a double call and API cost)
      const alreadyResearched = !ebayService && !!marketData?.researchSummary
      const geminiKeyForResearch = settings?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY
      if (!alreadyResearched && geminiKeyForResearch) {
        researchProduct(
          visionResult?.productName || mockProductName,
          { purchasePrice: price, category: visionResult?.category, brand: visionResult?.brand },
          geminiKeyForResearch
        ).then(researchText => {
          const itemId = newItem.id
          setQueue(prev => (prev || []).map(i =>
            i.id === itemId ? { ...i, marketData: { ...i.marketData, researchSummary: researchText } } : i
          ))
        }).catch((err: unknown) => {
          // Non-blocking enrichment — log for ops visibility but never surface to UI
          const msg = err instanceof Error ? err.message : String(err)
          console.warn('[research] Non-blocking enrichment failed for', newItem.id, '—', msg)
        })
      }

      const tagSuggestions = tagSuggestionService.suggestTags(updatedItem)
      const autoTags = tagSuggestions.slice(0, 5).map(s => s.tag.id)
      updatedItem.tags = autoTags
      
      setCurrentItem(updatedItem)

      // Log to scan history — strip large base64 images to avoid localStorage quota issues
      // Only persist the thumbnail; full images are only needed during the AI pipeline (in memory)
      const persistableItem = { ...updatedItem }
      delete persistableItem.imageData
      delete persistableItem.imageOptimized
      delete persistableItem.additionalImageData  // strip full base64; keep additionalImages thumbnails
      setScanHistory(prev => {
        const existing = prev || []
        if (effectiveExistingItem) {
          // Re-analyze path: replace the existing scan history entry in-place (no new card)
          const idx = existing.findIndex(i => i.id === effectiveExistingItem.id)
          if (idx !== -1) return existing.map((i, j) => j === idx ? persistableItem : i)
        }
        return [persistableItem, ...existing.slice(0, 499)]
      })

      if (session?.active) {
        setSession((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            itemsScanned: prev.itemsScanned + 1,
            buyCount: decision === 'BUY' ? prev.buyCount + 1 : prev.buyCount,
            passCount: decision === 'PASS' ? prev.passCount + 1 : prev.passCount,
            totalPotentialProfit: decision === 'BUY' ? prev.totalPotentialProfit + profitMetrics.netProfit : prev.totalPotentialProfit,
          }
        })
      }

      logActivity(decision === 'BUY' ? '✅ Analysis complete — it\'s a BUY!' : '❌ Analysis done — PASS')
      logDebug(`Scan complete — ${decision}`, 'info', 'scan', {
        product: updatedItem.productName,
        buyPrice: updatedItem.purchasePrice,
        sellPrice: updatedItem.estimatedSellPrice,
        margin: updatedItem.profitMargin,
      })
      setScreen('scan-result')
    } catch (error) {
      console.error('Pipeline error:', error)
      setPipeline(prev => prev.map(s => ({ 
        ...s, 
        status: s.status === 'processing' ? 'error' : s.status,
        error: 'Analysis failed'
      })))
      toast.error('Analysis failed. Please try again.')
      }
    } catch (outerError) {
      // Catch errors from optimizeAndCache or any unhandled rejection
      const msg = outerError instanceof Error ? outerError.message : 'Unknown error'
      console.error('Capture failed:', msg)
      toast.error(msg.toLowerCase().includes('quota') ? 'Storage full — clearing cache and retrying. Please try again.' : `Capture failed: ${msg}`)
    }
  }, [settings, session, setSession, ebayService, geminiService, googleLensService, optimizeAndCache, triggerCapture, startAnalyzing, triggerSuccess, triggerFail, simulateProgress, completeStep, tagSuggestionService, setScanHistory])

  const handleRemoveFromQueue = useCallback((id: string) => {
    setQueue((prev) => (prev || []).filter(item => item.id !== id))
    // silent removal
  }, [setQueue])

  const handleStartSession = useCallback(() => {
    const now = new Date()
    const hour = now.getHours()
    const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'
    const dayName = now.toLocaleDateString('en-US', { weekday: 'short' })
    const monthDay = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const sessionNumber = ((allSessions || []).filter(s => !s.deletedAt).length + 1)
    const name = `#${String(sessionNumber).padStart(3, '0')} — ${dayName} ${timeOfDay} — ${monthDay}`
    const id = Date.now().toString()
    const newSession: Session = {
      id,
      name,
      sessionNumber,
      startTime: Date.now(),
      itemsScanned: 0,
      buyCount: 0,
      passCount: 0,
      totalPotentialProfit: 0,
      active: true,
      sessionType: 'business',
    }
    setAllSessions((prev) => [...(prev || []), newSession])
    setSession(newSession)
    setSelectedSessionId(id)
    setScreen('session-detail')
    logActivity('Session started')
  }, [allSessions, setSession, setAllSessions, setSelectedSessionId, setScreen])

  // Resume an existing open session — navigate to its detail screen
  const handleResumeSession = useCallback((sessionId: string) => {
    const found = (allSessions || []).find(s => s.id === sessionId)
    if (found && found.active) {
      setSession(found)
      setSelectedSessionId(sessionId)
      setScreen('session-detail')
    }
  }, [allSessions, setSession, setSelectedSessionId, setScreen])

  // Soft-delete: 10s undo toast, recoverable for 60s, then permanently deleted
  const handleDeleteSession = useCallback((sessionId: string) => {
    setAllSessions((prev) => (prev || []).map(s =>
      s.id === sessionId ? { ...s, deletedAt: Date.now() } : s
    ))
    if (session?.id === sessionId) {
      setSession(undefined)
      lastSyncedSession.current = ''
    }
    toast('Session deleted', {
      description: 'You have 60 seconds to recover it from the Session tab.',
      action: {
        label: 'Undo',
        onClick: () => {
          setAllSessions((prev) => (prev || []).map(s =>
            s.id === sessionId ? { ...s, deletedAt: undefined } : s
          ))
          logActivity('Session restored')
        },
      },
      duration: 10000,
    })
    // Hard-delete after 60 seconds if not restored
    setTimeout(() => {
      setAllSessions((prev) => {
        const sess = (prev || []).find(s => s.id === sessionId)
        if (sess?.deletedAt) {
          return (prev || []).filter(s => s.id !== sessionId)
        }
        return prev || []
      })
    }, 60000)
  }, [session, setSession, setAllSessions])

  const handleEndSession = useCallback(() => {
    if (session) {
      // Strip heavy blobs from PASS items that belong to this session
      setQueue(prev => (prev || []).map(item => {
        if (item.decision !== 'PASS' || item.sessionId !== session.id) return item
        const { imageData: _i, imageThumbnail: _t, imageOptimized: _o,
                marketData: _m, lensAnalysis: _la, lensResults: _lr,
                detectedProducts: _dp, ...lean } = item as ScannedItem & { detectedProducts?: unknown }
        return lean as ScannedItem
      }))
      const endedSession = { ...session, endTime: Date.now(), active: false }
      // Update in allSessions
      setAllSessions((prev) =>
        (prev || []).map(s => s.id === session.id ? endedSession : s)
      )
      setSession(undefined)
      logActivity('Session ended')
    }
  }, [session, setSession, setAllSessions, setQueue])

  const handleReopenSession = useCallback((sessionId: string) => {
    const sess = (allSessions || []).find(s => s.id === sessionId)
    if (!sess) return
    const reopened: Session = { ...sess, active: true, endTime: undefined }
    setAllSessions((prev) => (prev || []).map(s => s.id === sessionId ? reopened : s))
    setSession(reopened)
    logActivity('Session reopened')
  }, [allSessions, setAllSessions, setSession])

  // Keep allSessions in sync with the current active session (scan counts, profit, etc.)
  // Only sync if the session still exists in allSessions (hasn't been deleted)
  const lastSyncedSession = useRef<string>('')
  useEffect(() => {
    if (!session?.active || !session.id) return
    const fingerprint = `${session.id}:${session.itemsScanned}:${session.buyCount}:${session.passCount}:${session.totalPotentialProfit}:${session.name}:${session.location?.name}:${session.profitGoal}`
    if (fingerprint === lastSyncedSession.current) return
    lastSyncedSession.current = fingerprint
    setAllSessions((prev) => {
      const existing = (prev || []).find(s => s.id === session.id)
      if (!existing) return prev || [] // Session was deleted — don't re-add
      return (prev || []).map(s => s.id === session.id ? session : s)
    })
  }, [session, setAllSessions])

  const handleEditSession = useCallback((sessionId: string, updates: Partial<Session>) => {
    // Update active session if it matches
    if (session?.id === sessionId) {
      setSession(prev => prev ? { ...prev, ...updates } : prev)
    }
    // Update in allSessions
    setAllSessions(prev =>
      (prev || []).map(s => s.id === sessionId ? { ...s, ...updates } : s)
    )
  }, [session, setSession, setAllSessions])

  const handleUpdateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const defaults: AppSettings = {
        voiceEnabled: true,
        autoCapture: true,
        agenticMode: true,
        liveSearchEnabled: true,
        darkMode: false,
        themeMode: 'auto',
        useAmbientLight: false,
        minProfitMargin: 30,
        defaultShippingCost: 5.0,
        ebayFeePercent: 12.9,
        ebayAdFeePercent: 0,
        shippingMaterialsCost: 0,
        paypalFeePercent: 0,
        preferredAiModel: 'gemini-2.5-flash',
      }
      const newSettings = { ...(prev || defaults), ...updates }
      
      if ('themeMode' in updates && updates.themeMode !== undefined) {
        setTheme(updates.themeMode)
      }
      
      if ('useAmbientLight' in updates && updates.useAmbientLight !== undefined) {
        const currentAmbientLight = prev?.useAmbientLight || false
        if (currentAmbientLight !== updates.useAmbientLight) {
          toggleAmbientLight()
        }
      }
      
      if ('darkMode' in updates && updates.darkMode !== undefined && !('themeMode' in updates)) {
        setTheme(updates.darkMode ? 'dark' : 'light')
      }
      
      return newSettings
    })
  }, [setSettings, setTheme, toggleAmbientLight])

  const handleOptimizeItem = useCallback(async (itemId: string) => {
    // Read fresh queue via ref to avoid stale closure when agent pipeline
    // chains batch-analyze → optimize (items that just flipped PENDING→BUY)
    const item = (queueRef.current || []).find(i => i.id === itemId)
    if (!item || item.decision !== 'BUY' || item.optimizedListing) return
    const optimized = await listingOptimizationService.generateOptimizedListing({
      item,
      marketData: item.marketData,
    })
    // Merge suggestedTags back onto item.tags (deduplicated)
    const mergedTags = Array.from(new Set([
      ...(item.tags || []),
      ...(optimized.suggestedTags || []),
    ]))
    setQueue((prev) => (prev || []).map(i =>
      i.id === itemId
        ? { ...i, tags: mergedTags, optimizedListing: { ...optimized, optimizedAt: Date.now() }, listingStatus: 'ready' }
        : i
    ))
  }, [setQueue, listingOptimizationService])

  const handlePushToNotion = useCallback(async (itemId: string) => {
    if (!notionService) {
      toast.error('Configure Notion API key and Database ID in Settings')
      return
    }
    // Read fresh queue via ref — pipeline just optimized this item, stale
    // closure would still show optimizedListing as undefined.
    const item = (queueRef.current || []).find(i => i.id === itemId)
    if (!item || item.notionPageId || !item.optimizedListing) return

    const listing = item.optimizedListing
    const profit = listing
      ? listing.price - item.purchasePrice
      : (item.estimatedSellPrice || 0) - item.purchasePrice

    const result = await notionService.pushListing({
      title: listing?.title || item.productName || 'Unknown Item',
      description: listing?.description || item.description || '',
      price: listing?.price || item.estimatedSellPrice || 0,
      purchasePrice: item.purchasePrice,
      category: listing?.category || item.category || 'General',
      condition: listing?.condition || 'Good',
      tags: listing?.suggestedTags || [],
      images: item.imageData ? [item.imageData] : [],
      profit,
      profitMargin: item.profitMargin || 0,
      status: 'ready',
      itemId: item.id,
      timestamp: item.timestamp,
      location: item.location?.name,
      notes: item.notes,
    })

    if (result.success) {
      setQueue((prev) => (prev || []).map(i =>
        i.id === itemId
          ? { ...i, notionPageId: result.pageId, notionUrl: result.url, listingStatus: 'published', publishedDate: Date.now() }
          : i
      ))
      // Update Notion status from 'ready' → 'published'
      if (result.pageId && notionService) {
        notionService.updateListingStatus(result.pageId, { status: 'published' }).catch(e => console.warn('Notion status update failed:', e))
      }
      logActivity('Pushed to Notion ✓')
    } else {
      toast.error(`Notion error: ${result.error}`)
    }
  }, [setQueue, notionService])

  const handleMarkAsSold = useCallback((
    itemId: string,
    soldPrice: number,
    soldOn: 'ebay' | 'mercari' | 'poshmark' | 'facebook' | 'whatnot' | 'other'
  ) => {
    const soldDate = Date.now()
    const item = (queue || []).find(i => i.id === itemId)
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId ? { ...i, listingStatus: 'sold', soldPrice, soldDate, soldOn } : i
    ))
    if (item?.notionPageId && notionService) {
      notionService.updateListingStatus(item.notionPageId, { status: 'sold', soldPrice, soldOn, soldDate }).catch(e => console.warn('Notion sync failed:', e))
    }
    logActivity('Item marked as sold')
  }, [setQueue, queue, notionService])

  const loadLiveSoldItems = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setSoldLoading(true)
    try {
      const response = await fetchSoldItems()
      setLiveSoldItems(response.items)
      setSoldWarnings(response.warnings)
      setSoldSyncedAt(response.fetchedAt)
      setSoldError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load live sold items.'
      setSoldError(message)
      if (!silent) toast.error(message)
    } finally {
      setSoldLoading(false)
    }
  }, [])

  const handleUpdateLiveSoldShipping = useCallback(async (pageId: string, update: SoldShippingUpdateInput) => {
    try {
      await updateSoldItemShipping(pageId, update)
      await loadLiveSoldItems({ silent: true })
      logActivity('Shipping details saved')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save shipping details'
      toast.error(message)
      throw e
    }
  }, [loadLiveSoldItems])

  const handleMarkShipped = useCallback((itemId: string, trackingNumber: string, shippingCarrier: string) => {
    const shippedDate = Date.now()
    const item = (queue || []).find(i => i.id === itemId)
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId ? { ...i, listingStatus: 'shipped', trackingNumber, shippingCarrier, shippedDate } : i
    ))
    if (item?.notionPageId && notionService) {
      notionService.updateListingStatus(item.notionPageId, { status: 'shipped', trackingNumber, shippingCarrier, shippedDate }).catch(e => console.warn('Notion sync failed:', e))
    }
    logActivity('Item marked as shipped')
  }, [setQueue, queue, notionService])

  const handleMarkCompleted = useCallback((itemId: string) => {
    const item = (queue || []).find(i => i.id === itemId)
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId ? { ...i, listingStatus: 'completed' } : i
    ))
    if (item?.notionPageId && notionService) {
      notionService.updateListingStatus(item.notionPageId, { status: 'completed' }).catch(e => console.warn('Notion sync failed:', e))
    }
    logActivity('Transaction completed')
  }, [setQueue, queue, notionService])

  const handleMarkReturned = useCallback((itemId: string, reason?: string) => {
    const returnedDate = Date.now()
    const item = (queue || []).find(i => i.id === itemId)
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId ? { ...i, listingStatus: 'returned' as const, returnedDate, returnReason: reason } : i
    ))
    if (item?.notionPageId && notionService) {
      notionService.updateListingStatus(item.notionPageId, { status: 'returned', returnedDate, returnReason: reason }).catch(e => console.warn('Notion sync failed:', e))
    }
    logActivity('Item marked as returned')
  }, [setQueue, queue, notionService])

  const handleDelist = useCallback((itemId: string) => {
    const delistedDate = Date.now()
    const item = (queue || []).find(i => i.id === itemId)
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId ? { ...i, listingStatus: 'delisted' as const, delistedDate } : i
    ))
    if (item?.notionPageId && notionService) {
      notionService.updateListingStatus(item.notionPageId, { status: 'delisted', delistedDate }).catch(e => console.warn('Notion sync failed:', e))
    }
    logActivity('Item delisted')
  }, [setQueue, queue, notionService])

  const handleRelistItem = useCallback((itemId: string) => {
    const item = (queue || []).find(i => i.id === itemId)
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId
        ? {
            ...i,
            listingStatus: 'ready' as const,
            soldPrice: undefined,
            soldDate: undefined,
            soldOn: undefined,
            soldBuyerName: undefined,
            trackingNumber: undefined,
            shippedDate: undefined,
            shippingCarrier: undefined,
            returnedDate: undefined,
            returnReason: undefined,
            delistedDate: undefined,
          }
        : i
    ))
    if (item?.notionPageId && notionService) {
      notionService.updateListingStatus(item.notionPageId, { status: 'ready' }).catch(e => console.warn('Notion sync failed:', e))
    }
    logActivity('Item re-listed')
  }, [setQueue, queue, notionService])

  const handleSaveDraft = useCallback((price: number, notes: string) => {
    if (!currentItem?.imageData && !currentItem?.imageThumbnail) {
      toast.error('No image to save')
      return
    }

    const { imageData: _img, imageOptimized: _opt, ...lightweight } = currentItem!
    const draftItem: ScannedItem = {
      ...lightweight,
      purchasePrice: Number.isFinite(price) && price >= 0 ? price : currentItem!.purchasePrice,
      notes: notes || currentItem!.notes,
      inQueue: true,
    }

    setQueue((prev) => {
      const current = prev || []
      if (current.some(i => i.id === draftItem.id)) return current
      return [...current, draftItem]
    })
    setCurrentItem(undefined)
    setPipeline([])
    setScreen('agent')
    logActivity('Draft saved to queue')
  }, [currentItem, setQueue, setScreen])

  // Opens a specific ScannedItem (from session/history) directly into the scan-result screen
  const handleOpenItemFromSession = useCallback((item: ScannedItem) => {
    setCurrentItem(item)
    setScreen('scan-result')
  }, [setCurrentItem, setScreen])

  const handleReanalyzeCurrentItem = useCallback(() => {
    // Use the best available image — full base64 first, then optimized/thumbnail fallbacks.
    // Re-analyze NEVER opens the camera; that's the camera button's job.
    const imageToUse = currentItem?.imageData || currentItem?.imageOptimized || currentItem?.imageThumbnail
    if (!imageToUse || !currentItem) {
      toast.error('No image in memory to re-analyze. Use the camera button to add a new photo.')
      return
    }
    // Re-run the full AI pipeline on the existing photo, preserving the item ID.
    // This lets the user retry a failed scan or get a second opinion without creating a duplicate card.
    handleCapture(
      imageToUse,
      currentItem.purchasePrice,
      currentItem.location,
      undefined,
      currentItem,   // existingItem → pipeline updates in place, scan history entry replaced
    )
  }, [currentItem, handleCapture])

  // ─── Multi-photo handlers ──────────────────────────────────────────────────

  // Appends a new photo to the current item without triggering a new pipeline run.
  // Called when cameraMode === 'add-photo' routes back from handleCapture.
  const handleAddPhotoToCurrentItem = useCallback(async (imageData: string) => {
    if (!currentItem) return
    const totalPhotos = 1 + (currentItem.additionalImages?.length || 0)
    if (totalPhotos >= 5) {
      toast.error('Maximum 5 photos per item reached')
      return
    }
    const optimized = await optimizeAndCache(imageData)
    setCurrentItem(prev => prev ? {
      ...prev,
      additionalImages: [...(prev.additionalImages || []), optimized.thumbnail],
      additionalImageData: [...(prev.additionalImageData || []), optimized.original],
    } : prev)
    toast('Photo added — tap Re-analyze to scan with all photos')
  }, [currentItem, optimizeAndCache])

  const handleDeleteAdditionalPhoto = useCallback((index: number) => {
    setCurrentItem(prev => {
      if (!prev) return prev
      const imgs = [...(prev.additionalImages || [])]
      const data = [...(prev.additionalImageData || [])]
      imgs.splice(index, 1)
      data.splice(index, 1)
      return { ...prev, additionalImages: imgs, additionalImageData: data }
    })
  }, [])

  const handleDeletePrimaryPhoto = useCallback(() => {
    if (!currentItem) return
    const additional = currentItem.additionalImages || []
    const additionalData = currentItem.additionalImageData || []
    if (additional.length > 0) {
      // Promote first additional image to primary
      setCurrentItem(prev => prev ? {
        ...prev,
        imageThumbnail: additional[0],
        imageData: additionalData[0] || prev.imageData,
        additionalImages: additional.slice(1),
        additionalImageData: additionalData.slice(1),
      } : prev)
      toast('Primary photo updated')
    } else {
      // No alternatives — open camera to take a replacement primary photo
      setCameraMode('replace-primary')
      setCameraOpen(true)
    }
  }, [currentItem])

  const openCameraForAddPhoto = useCallback(() => {
    setCameraMode('add-photo')
    setCameraOpen(true)
  }, [])

  const handleRecalculate = useCallback((newPrice: number, newSellPrice?: number, newShipping?: number) => {
    if (!Number.isFinite(newPrice) || newPrice < 0) {
      toast.error('Enter a valid price (0 or more)')
      return
    }

    // Use form-provided sell price first; fall back to existing item value.
    // This unblocks PENDING items where the AI found no market price — the
    // user can manually enter both buy and sell prices and get a real decision.
    const effectiveSellPrice = (newSellPrice && newSellPrice > 0)
      ? newSellPrice
      : currentItem?.estimatedSellPrice

    if (!effectiveSellPrice || effectiveSellPrice <= 0) {
      toast.error('Enter a sell price in the Listing Draft to recalculate')
      return
    }

    // Use form-provided shipping if valid; fall back to settings default.
    const effectiveShipping = (newShipping != null && Number.isFinite(newShipping) && newShipping >= 0)
      ? newShipping
      : (settings?.defaultShippingCost || 5.0)

    const feePercent = settings?.ebayFeePercent || 12.9
    const adFeePercent = settings?.ebayAdFeePercent || 3.0
    const minMargin = settings?.minProfitMargin || 30

    const profitMetrics = calculateProfitFallback(
      newPrice,
      effectiveSellPrice,
      effectiveShipping,
      feePercent,
      0.30,                                     // per-order fee
      adFeePercent,
      settings?.shippingMaterialsCost ?? 0.75,  // packaging materials from Business Rules
    )

    const decision = makeDecision(
      effectiveSellPrice,
      newPrice,
      profitMetrics.profitMargin,
      profitMetrics.netProfit,
      minMargin,
    )

    const freeItemPlatformHint =
      newPrice === 0 && decision === 'PASS'
        ? 'Facebook Marketplace (local, no fees)'
        : undefined

    if (decision === 'BUY') {
      triggerSuccess()
    } else {
      triggerFail()
    }

    const updatedMarketData = {
      ...currentItem?.marketData,
      ...(freeItemPlatformHint ? { recommendedPlatform: freeItemPlatformHint } : { recommendedPlatform: undefined }),
    }

    setCurrentItem(prev => prev ? {
      ...prev,
      purchasePrice: newPrice,
      // Persist the sell price so Quick Summary and Queue card both reflect
      // the user-entered value, not a stale 0 from the failed AI lookup.
      estimatedSellPrice: effectiveSellPrice,
      profitMargin: profitMetrics.profitMargin,
      decision,
      marketData: updatedMarketData,
    } : prev)

    setPipeline(prev => prev.map((s, i) => {
      if (i === 3) return { ...s, data: `Margin: ${profitMetrics.profitMargin.toFixed(1)}%, ROI: ${profitMetrics.roi.toFixed(0)}%` }
      if (i === 4) return { ...s, data: `Decision: ${decision} (recalculated)` }
      return s
    }))

    logActivity(`Recalculated: ${decision} — buy $${newPrice.toFixed(2)} sell $${effectiveSellPrice.toFixed(2)} → ${profitMetrics.profitMargin.toFixed(1)}% margin`)
  }, [currentItem, settings, triggerSuccess, triggerFail])

  const handleCreateListingFromScan = useCallback(async (
    price: number,
    notes: string,
    draft?: {
      productName?: string
      category?: string
      condition?: string
      description?: string
      estimatedSellPrice?: number
      shippingCost?: number
      platform?: string
    },
  ) => {
    if (!currentItem?.imageData && !currentItem?.imageThumbnail) {
      toast.error('No image to save')
      return
    }
    const { imageData: _img, imageOptimized: _opt, ...lightweight } = currentItem!
    // NaN means the field was left empty — fall back to the analyzed price
    const effectivePrice = Number.isFinite(price) && price >= 0 ? price : currentItem!.purchasePrice
    const effectiveSellPrice =
      draft?.estimatedSellPrice && draft.estimatedSellPrice > 0
        ? draft.estimatedSellPrice
        : currentItem!.estimatedSellPrice
    // Recompute profitMargin/decision whenever buy price, sell price, OR shipping differs
    // from the analyzed values — any of these changes makes the stored metrics stale
    const effectiveShipping = draft?.shippingCost ?? settings?.defaultShippingCost ?? 5.0
    const buyPriceChanged = effectivePrice !== currentItem!.purchasePrice
    const sellPriceChanged =
      effectiveSellPrice != null && effectiveSellPrice !== currentItem!.estimatedSellPrice
    const shippingChanged =
      draft?.shippingCost != null && draft.shippingCost !== (settings?.defaultShippingCost ?? 5.0)
    let resolvedMargin = currentItem!.profitMargin
    let resolvedDecision = currentItem!.decision
    if ((buyPriceChanged || sellPriceChanged || shippingChanged) && effectiveSellPrice) {
      const freshMetrics = calculateProfitFallback(
        effectivePrice, effectiveSellPrice,
        effectiveShipping,
        settings?.ebayFeePercent ?? 12.9,
        0.30,
        settings?.ebayAdFeePercent ?? 3.0,
        settings?.shippingMaterialsCost ?? 0.75
      )
      resolvedMargin = freshMetrics.profitMargin
      resolvedDecision = makeDecision(effectiveSellPrice, effectivePrice, freshMetrics.profitMargin, freshMetrics.netProfit, settings?.minProfitMargin || 30)
    }
    const listingItem: ScannedItem = {
      ...lightweight,
      purchasePrice: effectivePrice,
      profitMargin: resolvedMargin,
      decision: resolvedDecision === 'PASS' ? 'BUY' : resolvedDecision, // user chose Add to Queue — treat as BUY intent
      notes: notes || currentItem!.notes,
      inQueue: true,
      ...(draft?.productName && { productName: draft.productName }),
      ...(draft?.category && { category: draft.category }),
      ...(draft?.condition && { condition: draft.condition }),
      ...(draft?.description && { description: draft.description }),
      ...(draft?.platform && { preferredPlatform: draft.platform }),
      ...(effectiveSellPrice !== currentItem!.estimatedSellPrice && { estimatedSellPrice: effectiveSellPrice }),
    }
    setQueue(prev => {
      const current = prev || []
      if (current.some(i => i.id === listingItem.id)) {
        return current.map(i => i.id === listingItem.id ? listingItem : i)
      }
      return [...current, listingItem]
    })
    // Navigate to queue immediately — optimization runs in the background
    setCurrentItem(undefined)
    setPipeline([])
    setScreen('queue')
    // Optimize directly with listingItem — avoids stale queue closure read
    // (handleOptimizeItem looks up the item from queue, which hasn't committed yet)
    try {
      const optimized = await listingOptimizationService.generateOptimizedListing({
        item: listingItem,
        marketData: listingItem.marketData,
      })
      const mergedTags = Array.from(new Set([
        ...(listingItem.tags || []),
        ...(optimized.suggestedTags || []),
      ]))
      setQueue(prev => (prev || []).map(i =>
        i.id === listingItem.id
          ? { ...i, tags: mergedTags, optimizedListing: { ...optimized, optimizedAt: Date.now() }, listingStatus: 'ready' }
          : i
      ))
      logActivity('Added to queue — listing optimized')
    } catch {
      toast.error('Optimization failed — item saved, edit manually in Queue')
    }
  }, [currentItem, setQueue, listingOptimizationService, settings])

  const handlePassFromScan = useCallback((price: number, notes: string) => {
    if (!currentItem?.imageData && !currentItem?.imageThumbnail) {
      toast.error('No image to save')
      return
    }
    // Strip heavy blobs — keep thumbnail for scan history display
    const { imageData: _img, imageOptimized: _opt, ...lightweight } = currentItem!
    const effectivePrice = Number.isFinite(price) && price >= 0 ? price : currentItem!.purchasePrice
    // Recompute metrics if price changed — keeps stored profitMargin accurate
    let resolvedMargin = currentItem!.profitMargin
    if (effectivePrice !== currentItem!.purchasePrice && currentItem!.estimatedSellPrice) {
      const freshMetrics = calculateProfitFallback(
        effectivePrice, currentItem!.estimatedSellPrice,
        settings?.defaultShippingCost ?? 5.0,
        settings?.ebayFeePercent ?? 12.9,
        0.30,
        settings?.ebayAdFeePercent ?? 3.0,
        settings?.shippingMaterialsCost ?? 0.75
      )
      resolvedMargin = freshMetrics.profitMargin
    }
    // PASS items go to scan history only — NOT the listing queue.
    // The listing queue is reserved exclusively for items the buyer intends to purchase.
    const passItem: ScannedItem = {
      ...lightweight,
      purchasePrice: effectivePrice,
      profitMargin: resolvedMargin,
      notes: notes || currentItem!.notes,
      inQueue: false,
      decision: 'PASS',
    }
    // Update the scan history entry (first written during handleCapture) with final prices/notes
    setScanHistory(prev => {
      const existing = prev || []
      const idx = existing.findIndex(i => i.id === passItem.id)
      if (idx !== -1) return existing.map((i, j) => j === idx ? passItem : i)
      return [passItem, ...existing.slice(0, 499)]  // fallback: prepend if somehow missing
    })
    setCurrentItem(undefined)
    setPipeline([])
    setScreen('session')
    logActivity('Passed — logged to scan history')
  }, [currentItem, setScanHistory, settings, setScreen])

  const handleMaybeFromScan = useCallback((price: number, notes: string) => {
    if (!currentItem?.imageData && !currentItem?.imageThumbnail) {
      toast.error('No image to save')
      return
    }
    const { imageData: _img, imageOptimized: _opt, ...lightweight } = currentItem!
    const effectivePrice = Number.isFinite(price) && price >= 0 ? price : currentItem!.purchasePrice
    // Maybe items go to scan history only — NOT the listing queue.
    // The buyer can reopen from Scan History to continue researching before deciding.
    const maybeItem: ScannedItem = {
      ...lightweight,
      purchasePrice: effectivePrice,
      notes: notes || currentItem!.notes,
      inQueue: false,
      decision: 'PENDING',
    }
    // Update the scan history entry with the current prices/notes
    setScanHistory(prev => {
      const existing = prev || []
      const idx = existing.findIndex(i => i.id === maybeItem.id)
      if (idx !== -1) return existing.map((i, j) => j === idx ? maybeItem : i)
      return [maybeItem, ...existing.slice(0, 499)]
    })
    setCurrentItem(undefined)
    setPipeline([])
    setScreen('agent')
    toast('Saved to Scans — tap it to continue researching')
    logActivity('Saved for later research — not added to queue')
  }, [currentItem, setScanHistory, setScreen])

  const handleQuickDraft = useCallback(async (imageData: string, price: number, location?: ThriftStoreLocation, barcodeProduct?: BarcodeProduct) => {
    const optimized = await optimizeAndCache(imageData)

    const draftItem: ScannedItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      imageThumbnail: optimized.thumbnail,
      purchasePrice: price,
      decision: 'PENDING',
      inQueue: true,
      productName: barcodeProduct?.title || 'Quick Draft',
      description: barcodeProduct?.description || 'Captured in quick draft mode - analyze later',
      category: barcodeProduct?.category || undefined,
      sessionId: session?.id,
      location,
      marketData: barcodeProduct ? { barcodeProduct } : undefined,
    }

    setQueue((prev) => [...(prev || []), draftItem])

    if (session?.active) {
      setSession((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          itemsScanned: prev.itemsScanned + 1,
        }
      })
    }
  }, [session, setSession, setQueue, optimizeAndCache])



  const handleEditQueueItem = useCallback((itemId: string, updates: Partial<ScannedItem>) => {
    setQueue((prev) => {
      const currentQueue = prev || []
      return currentQueue.map(item => item.id === itemId ? { ...item, ...updates } : item)
    })
  }, [setQueue])

  const handleReorderQueue = useCallback((reorderedItems: ScannedItem[]) => {
    setQueue(reorderedItems)
  }, [setQueue])

  const handleBatchAnalyze = useCallback(async () => {
    const unanalyzedItems = (queue || []).filter(item =>
      !item.productName ||
      item.productName === 'Quick Draft' ||
      item.description === 'Product analysis unavailable'
    )
    
    if (unanalyzedItems.length === 0) {
      logActivity('No quick drafts to analyze', 'info')
      return
    }

    setIsBatchAnalyzing(true)
    setBatchProgress({ current: 0, total: unanalyzedItems.length, currentItemName: '' })
    logActivity(`Analyzing ${unanalyzedItems.length} item${unanalyzedItems.length !== 1 ? 's' : ''}...`, 'info')

    let processedCount = 0
    let buyCount = 0
    let passCount = 0
    let totalNewProfit = 0
    // Capture root cause for each failure so we can give the user a specific
    // diagnosis instead of a blind "X items failed" count.
    const failedItems: Array<{ id: string; reason: string }> = []
    const skippedItems: string[] = []
    const updatedItemsMap = new Map<string, ScannedItem>()

    for (const item of unanalyzedItems) {
      // Fix 3: guard against missing imageData to prevent runtime crash
      if (!item.imageData) {
        skippedItems.push(item.id)
        console.warn(`Skipping item ${item.id}: no image data`)
        continue
      }

      setBatchProgress({ current: processedCount + 1, total: unanalyzedItems.length, currentItemName: `Item ${processedCount + 1}` })

      try {
        let visionResult: GeminiVisionResponse | undefined
        let mockProductName = 'Unknown Product'

        if (geminiService) {
          try {
            visionResult = await geminiService.analyzeProductImage(item.imageData, {}, item.purchasePrice)
            mockProductName = visionResult.productName
            setBatchProgress({ current: processedCount + 1, total: unanalyzedItems.length, currentItemName: visionResult.productName })
          } catch (error) {
            console.error('Gemini vision failed for item:', item.id, error)
          }
        }

        let lensAnalysis: GoogleLensAnalysis | undefined

        // Google Lens in batch mode — configurable via settings (default: enabled)
        // Also skip if Gemini confidence exceeds threshold (same logic as single-item mode)
        const batchGeminiConfidence = visionResult ? visionResult.confidence : 0
        const batchLensThreshold = settings?.lensSkipConfidence || 0.85
        const batchSkipLens = batchGeminiConfidence >= batchLensThreshold

        if (googleLensService && visionResult?.productName && item.imageData && settings?.enableLensInBatch !== false && !batchSkipLens) {
          try {
            lensAnalysis = await googleLensService.searchByImage(item.imageData, visionResult.productName)
          } catch (error) {
            console.error('Google Lens failed for item:', item.id, error)
          }
        }

        let marketData: typeof item.marketData = undefined
        let ebayAvgPrice = 0

        if (ebayService && visionResult) {
          try {
            const searchTerm = visionResult.searchTerms?.[0] || mockProductName
            const categoryId = await ebayService.getCategoryId(searchTerm)
            const searchResults = await ebayService.searchCompletedListings(searchTerm, categoryId)

            marketData = {
              ebayAvgSold: searchResults.averageSoldPrice,
              ebayMedianSold: searchResults.medianSoldPrice,
              ebayActiveListings: searchResults.activeCount,
              ebaySoldCount: searchResults.soldCount,
              ebayPriceRange: searchResults.priceRange,
              ebaySellThroughRate: searchResults.sellThroughRate,
              ebayRecentSales: searchResults.soldItems.slice(0, 10),
              ebayActiveItems: searchResults.activeListings.slice(0, 10),
              recommendedPrice: searchResults.recommendedPrice,
            }

            ebayAvgPrice = searchResults.recommendedPrice > 0 ? searchResults.recommendedPrice : 0
          } catch (error) {
            console.error('eBay API error for item:', item.id, error)
          }
        }

        // 3-tier fallback: eBay → Lens avg → 4.5x markup
        if (ebayAvgPrice <= 0) {
          const lensAvg = lensAnalysis?.priceRange?.average || 0
          ebayAvgPrice = lensAvg > 0 ? lensAvg : (item.purchasePrice > 0 ? item.purchasePrice * 4.5 : 0)
        }

        const sellPrice = ebayAvgPrice
        const profitMetrics = ebayService?.calculateProfitMetrics(
          item.purchasePrice,
          sellPrice,
          settings?.defaultShippingCost ?? 5.0,
          settings?.ebayFeePercent ?? 12.9,
          0,
          0.30,
          settings?.ebayAdFeePercent ?? 3.0,
          settings?.shippingMaterialsCost ?? 0.75
        ) || calculateProfitFallback(
          item.purchasePrice,
          sellPrice,
          settings?.defaultShippingCost ?? 5.0,
          settings?.ebayFeePercent ?? 12.9,
          0.30,
          settings?.ebayAdFeePercent ?? 3.0,
          settings?.shippingMaterialsCost ?? 0.75
        )

        const minMargin = settings?.minProfitMargin || 30
        const decision = makeDecision(sellPrice, item.purchasePrice, profitMetrics.profitMargin, profitMetrics.netProfit, minMargin)

        const updatedItem: ScannedItem = {
          ...item,
          productName: visionResult?.productName || mockProductName,
          description: visionResult?.description || 'Product analysis completed',
          category: visionResult?.category || 'General',
          estimatedSellPrice: sellPrice > 0 ? sellPrice : undefined,
          profitMargin: sellPrice > 0 ? profitMetrics.profitMargin : undefined,
          decision,
          lensAnalysis,
          lensResults: lensAnalysis?.results,
          marketData,
        }

        updatedItemsMap.set(item.id, updatedItem)

        processedCount++
        if (decision === 'BUY') {
          buyCount++
          totalNewProfit += profitMetrics.netProfit
        }
        if (decision === 'PASS') passCount++

        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        console.error('Failed to analyze item:', item.id, error)
        failedItems.push({ id: item.id, reason: reason.slice(0, 200) })
      }
    }

    // Apply all queue updates in a single batch to avoid race conditions
    if (updatedItemsMap.size > 0) {
      setQueue((prev) => {
        const currentQueue = prev || []
        return currentQueue.map(qItem => updatedItemsMap.get(qItem.id) || qItem)
      })
    }

    if (session?.active && (buyCount > 0 || passCount > 0)) {
      setSession((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          buyCount: prev.buyCount + buyCount,
          passCount: prev.passCount + passCount,
          totalPotentialProfit: prev.totalPotentialProfit + totalNewProfit,
        }
      })
    }

    setIsBatchAnalyzing(false)
    setBatchProgress({ current: 0, total: 0, currentItemName: '' })

    if (failedItems.length > 0) {
      // Surface the dominant failure reason so the user knows *why* batch failed
      // (API key missing, rate limit, timeout, etc.) rather than just a count.
      const reasonCounts = new Map<string, number>()
      for (const f of failedItems) {
        reasonCounts.set(f.reason, (reasonCounts.get(f.reason) || 0) + 1)
      }
      const [topReason] = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])
      toast.warning(
        `${failedItems.length} item(s) failed analysis`,
        topReason ? { description: topReason[0] } : undefined,
      )
    }
    if (skippedItems.length > 0) {
      logActivity(`${skippedItems.length} item(s) skipped (no image)`, 'info')
    }
    logActivity(`Analyzed ${processedCount} items: ${buyCount} BUY, ${passCount} PASS`)
  }, [queue, setQueue, settings, session, setSession, geminiService, googleLensService, ebayService])

  const handleUpdateCurrentItem = useCallback((itemId: string, updates: Partial<ScannedItem>) => {
    if (!itemId) return
    // Guard by explicit item id so a stale in-flight result never overwrites a different item
    setCurrentItem(prev => prev?.id === itemId ? { ...prev, ...updates } : prev)
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId ? { ...i, ...updates } : i
    ))
  }, [setQueue])

  const handleReanalyzeItem = useCallback(async (itemId: string) => {
    const item = (queue || []).find(i => i.id === itemId)
    if (!item) return

    const imageSource = item.imageData || item.imageThumbnail
    if (!imageSource) {
      // No image — navigate to scan-result with item pre-loaded so user can see it
      setCurrentItem(item)
      setPipeline([])
      setScreen('scan-result')
      toast('No image available — re-scan with camera to re-analyze', { duration: 3000 })
      return
    }

    // Navigate to scan-result first, then trigger pipeline — only remove from queue on success
    setCurrentItem(undefined)
    setPipeline([])
    setScreen('scan-result')
    try {
      await handleCapture(imageSource, item.purchasePrice, item.location)
      setQueue(prev => (prev || []).filter(i => i.id !== itemId))
    } catch {
      // handleCapture already shows a toast; item stays in queue so no data is lost
    }
  }, [queue, setQueue, setCurrentItem, setPipeline, setScreen, handleCapture])

  const handleOptimizeForPlatform = useCallback(async (itemId: string, platform: ResalePlatform) => {
    const item = (queue || []).find(i => i.id === itemId)
    if (!item) return

    // Ensure eBay listing exists first — generate it if not
    if (!item.optimizedListing) {
      await handleOptimizeItem(itemId)
    }

    const freshItem = (queue || []).find(i => i.id === itemId)
    if (!freshItem?.optimizedListing || !listingOptimizationService) return

    try {
      const platformListing = await listingOptimizationService.generatePlatformListing(
        freshItem,
        platform,
        freshItem.optimizedListing
      )
      setQueue(prev => (prev || []).map(i =>
        i.id === itemId
          ? {
              ...i,
              optimizedListing: {
                ...i.optimizedListing!,
                platformListings: { ...i.optimizedListing!.platformListings, [platform]: platformListing }
              }
            }
          : i
      ))
      logActivity(`${platform.charAt(0).toUpperCase() + platform.slice(1)} listing generated`)
    } catch (error) {
      console.error('Platform listing generation failed:', error)
      toast.error(`Failed to generate ${platform} listing`)
    }
  }, [queue, setQueue, listingOptimizationService, handleOptimizeItem])

  // Seed 3 test items so the queue cards can be verified (dev/debug only)
  useEffect(() => {
    if (import.meta.env.DEV && queue && queue.length === 0) {
      const testItems: ScannedItem[] = [
        {
          id: 'test-1',
          timestamp: Date.now() - 3600000,
          purchasePrice: 3.50,
          productName: 'Nike Air Max 90 — Size 10',
          description: 'Gently used Nike Air Max 90 in white/black colorway. Minor creasing on toe box, no sole wear. Original laces.',
          category: 'Clothing & Shoes',
          estimatedSellPrice: 45.00,
          profitMargin: 72.3,
          decision: 'BUY',
          inQueue: true,
          tags: [],
          marketData: { ebayAvgSold: 48.50, ebayMedianSold: 45.00, ebaySoldCount: 23, ebayActiveListings: 15, ebaySellThroughRate: 60.5, recommendedPrice: 45.00 },
        },
        {
          id: 'test-2',
          timestamp: Date.now() - 7200000,
          purchasePrice: 1.00,
          productName: 'Pyrex 4-Cup Glass Measuring Cup',
          description: 'Vintage Pyrex measuring cup, red lettering, no chips or cracks. Dishwasher safe.',
          category: 'Kitchen & Home',
          estimatedSellPrice: 12.00,
          profitMargin: 38.5,
          decision: 'BUY',
          inQueue: true,
          tags: [],
          marketData: { ebayAvgSold: 14.00, ebayMedianSold: 12.00, ebaySoldCount: 45, ebayActiveListings: 30, ebaySellThroughRate: 60.0, recommendedPrice: 12.00 },
        },
        {
          id: 'test-3',
          timestamp: Date.now() - 1800000,
          purchasePrice: 0.50,
          productName: 'Random Paperback Novel',
          description: 'Mass market paperback, slight yellowing on pages. Common title, low demand.',
          category: 'Books',
          estimatedSellPrice: 2.25,
          profitMargin: -170.7,
          decision: 'PASS',
          inQueue: true,
          tags: [],
        },
      ]
      setQueue(testItems)
    }
  }, [])

  useEffect(() => {
    if (!cameraOpen) {
      reset()
    }
  }, [cameraOpen, reset])

  // Auto-load sold items when user navigates to the Sold screen
  useEffect(() => {
    if (screen === 'sold') {
      loadLiveSoldItems()
    } else if (screen === 'agent') {
      // Agent needs live sold data for intelligence/reporting, but should never
      // surface a toast — errors here would leak onto unrelated tabs.
      loadLiveSoldItems({ silent: true })
    }
  }, [screen, loadLiveSoldItems])

  useEffect(() => {
    if (screen !== 'sold') return undefined

    loadLiveSoldItems()
    const intervalId = setInterval(() => {
      loadLiveSoldItems({ silent: true })
    }, 60000)

    return () => clearInterval(intervalId)
  }, [screen, loadLiveSoldItems])

  useEffect(() => {
    if (settings) {
      if (settings.themeMode) {
        if (settings.themeMode !== themeMode) {
          setTheme(settings.themeMode)
        }
      } else if (settings.darkMode !== undefined && !settings.themeMode) {
        const inferredMode = settings.darkMode ? 'dark' : 'light'
        if (inferredMode !== themeMode) {
          setTheme(inferredMode)
        }
      }
    }
  }, [])

  // Always start on the session list — clear currentSession view on app load
  useEffect(() => {
    setSession(undefined)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Activity log listener — persists silent activity events to KV
  useEffect(() => {
    const handler = (e: Event) => {
      const entry = (e as CustomEvent<ActivityEntry>).detail
      setActivityLog(prev => [entry, ...(prev || []).slice(0, MAX_ACTIVITY_ENTRIES - 1)])
    }
    window.addEventListener('rsp:activity', handler)
    return () => window.removeEventListener('rsp:activity', handler)
  }, [setActivityLog])

  // Debug log listener — persists rsp:debug events dispatched by logDebug() to KV
  useEffect(() => {
    const handler = (e: Event) => {
      const entry = (e as CustomEvent<DebugEntry>).detail
      setDebugLog(prev => [entry, ...(prev || []).slice(0, MAX_DEBUG_ENTRIES - 1)])
    }
    window.addEventListener('rsp:debug', handler)
    return () => window.removeEventListener('rsp:debug', handler)
  }, [setDebugLog])

  // Capture console.error + console.warn into the debug console
  useEffect(() => {
    let capturing = false // prevent recursion
    const origError = console.error.bind(console)
    const origWarn = console.warn.bind(console)
    console.error = (...args: unknown[]) => {
      origError(...args)
      if (!capturing) {
        capturing = true
        logDebug(args.map(a => a instanceof Error ? a.message : String(a)).join(' ').slice(0, 300), 'error', 'console')
        capturing = false
      }
    }
    console.warn = (...args: unknown[]) => {
      origWarn(...args)
      if (!capturing) {
        capturing = true
        logDebug(args.map(a => String(a)).join(' ').slice(0, 300), 'warn', 'console')
        capturing = false
      }
    }
    return () => {
      console.error = origError
      console.warn = origWarn
    }
  }, [])

  // Intercept fetch to log Gemini + eBay + Google API calls and errors
  useEffect(() => {
    const origFetch = window.fetch.bind(window)
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const url = typeof args[0] === 'string' ? args[0]
        : args[0] instanceof URL ? args[0].href
        : (args[0] as Request).url || ''
      const isGemini = url.includes('generativelanguage.googleapis.com')
      const isEbay = url.includes('api.ebay.com')
      const isLens = url.includes('customsearch.googleapis.com') || url.includes('lens.google')
      const service = isGemini ? 'gemini' : isEbay ? 'ebay' : isLens ? 'google-lens' : null
      if (service) {
        logDebug(`${service} request`, 'debug', service, { url: url.slice(0, 120) })
      }
      try {
        const res = await origFetch(...args)
        if (service && !res.ok) {
          logDebug(`${service} HTTP ${res.status}`, 'error', service, { status: res.status, url: url.slice(0, 120) })
        }
        return res
      } catch (err) {
        if (service) {
          logDebug(`${service} fetch failed`, 'error', service, { error: String(err) })
        }
        throw err
      }
    }
    return () => { window.fetch = origFetch }
  }, [])

  // Migrate legacy GO → BUY decision labels
  useEffect(() => {
    if (queue && queue.some(item => (item.decision as string) === 'GO')) {
      setQueue(prev => (prev || []).map(item =>
        (item.decision as string) === 'GO' ? { ...item, decision: 'BUY' as const } : item
      ))
    }
  }, []) // intentionally empty deps — runs once on mount

  useEffect(() => {
    if (allSessions && allSessions.some(s => (s as any).goCount !== undefined && s.buyCount === undefined)) {
      setAllSessions(prev => (prev || []).map(s => {
        const legacy = s as any
        if (legacy.goCount !== undefined && s.buyCount === undefined) {
          const { goCount, ...rest } = legacy
          return { ...rest, buyCount: goCount }
        }
        return s
      }))
    }
  }, []) // intentionally empty deps — runs once on mount

  // Directional slide transitions —————————————————————————————————————————
  // Tab screens have a fixed left-to-right order.  Secondary/push screens
  // (settings, session-detail, scan-result, …) always push in from the right
  // and pop back to the left.  The direction is computed once per screen
  // change (synchronously, before JSX evaluates) so framer-motion's
  // `custom` prop receives the correct value for both the entering and the
  // exiting motion.div.
  const SCREEN_TAB_ORDER: Partial<Record<Screen, number>> = {
    session: 0,
    agent: 1,
    'scan-result': 1.5, // lives between agent and queue
    queue: 2,
    sold: 3,
  }

  const prevScreenRef = useRef<Screen>(screen)
  const slideDir = useRef<'left' | 'right' | 'none'>('none')
  // Remembers where the user was before opening Settings so back returns there
  const settingsReturnScreen = useRef<Screen>('session')
  // Remembers where the user came from before opening any secondary screen
  // (cost-tracking, scan-history) so back returns to the originating screen
  const secondaryReturnScreen = useRef<Screen>('session')

  if (prevScreenRef.current !== screen) {
    const prevIdx = SCREEN_TAB_ORDER[prevScreenRef.current]
    const nextIdx = SCREEN_TAB_ORDER[screen]
    if (prevIdx !== undefined && nextIdx !== undefined) {
      slideDir.current = nextIdx > prevIdx ? 'right' : nextIdx < prevIdx ? 'left' : 'none'
    } else if (nextIdx === undefined) {
      slideDir.current = 'right'   // pushing into a secondary screen
    } else {
      slideDir.current = 'left'    // returning from a secondary screen to a tab
    }
    prevScreenRef.current = screen
  }

  type SlideDir = 'left' | 'right' | 'none'
  const screenVariants = {
    initial: (dir: SlideDir) => ({
      opacity: 0,
      x: dir === 'right' ? 22 : dir === 'left' ? -22 : 0,
    }),
    animate: { opacity: 1, x: 0 },
    exit: (dir: SlideDir) => ({
      opacity: 0,
      x: dir === 'right' ? -22 : dir === 'left' ? 22 : 0,
    }),
  }

  useEffect(() => {
    // Scroll all containers to top — immediate + delayed to catch late renders
    const resetScroll = () => {
      window.scrollTo(0, 0)
      document.getElementById('app-container')?.scrollTo(0, 0)
      document.querySelectorAll('.scrollable-content, [class*="overflow-y-auto"]').forEach(el => {
        el.scrollTop = 0
      })
    }
    resetScroll()
    requestAnimationFrame(resetScroll)
    // Final catch after transition completes (150ms fade)
    const timer = setTimeout(resetScroll, 200)
    return () => clearTimeout(timer)
  }, [screen])

  // Guard: if scan-result is shown with no item (e.g. deep-link or state cleared),
  // redirect to agent. Must be an effect — not inline in JSX — to avoid
  // calling setScreen during render (React render purity violation).
  useEffect(() => {
    if (screen === 'scan-result' && !currentItem) {
      setScreen('agent')
    }
  }, [screen, currentItem])

  return (
    <div 
      id="app-container" 
      className={cn(
        "relative transition-colors duration-300 flex flex-col h-screen overflow-hidden w-full max-w-full sm:max-w-[744px] md:max-w-[834px] lg:max-w-[1024px] xl:max-w-[1366px] mx-auto overflow-x-hidden",
        captureState === 'capturing' && "capture-flash",
        captureState === 'analyzing' && "analyzing-flash",
        captureState === 'success' && "success-flash",
        captureState === 'fail' && "fail-flash"
      )}
    >
      <RetryStatusIndicator 
        activeRetries={retryState.activeRetries}
        position="top-right"
        compact={false}
      />
      
      <AppHeader
        screen={screen}
        onNavigateToSettings={() => { settingsReturnScreen.current = screen; setScreen('settings') }}
        onNavigateToTrends={screen === 'session' ? () => setShowSessionTrends(prev => !prev) : undefined}
        showTrends={showSessionTrends}
        backLabel={screen === 'scan-result' && openedFromScans ? 'Scans' : undefined}
        onBack={
          screen === 'scan-result'
            ? () => { setOpenedFromScans(false); setScreen('agent') }
            : screen === 'settings'
            ? () => setScreen(settingsReturnScreen.current)
            : screen === 'session-detail'
            ? () => setScreen('session')
            : screen === 'scan-history' || screen === 'cost-tracking'
            ? () => setScreen(secondaryReturnScreen.current)
            : screen === 'tag-analytics' || screen === 'location-insights'
            ? () => setScreen('queue')
            : undefined
        }
      />

      <div
        className="flex-1 relative w-full overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {screen === 'session' && (
            <motion.div
              key="session"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0"
            >
              <SessionScreen
                showTrends={showSessionTrends}
                onCloseTrends={() => setShowSessionTrends(false)}
                onAgentMessage={(text) => setAgentPendingMessage(text)}
                onStartSession={handleStartSession}
                onResumeSession={handleResumeSession}
                onDeleteSession={handleDeleteSession}
                onViewSessionDetail={(id) => {
                  setSelectedSessionId(id)
                  setScreen('session-detail')
                }}
                allSessions={visibleSessions}
                deletedSessions={deletedSessions}
                onRestoreSession={handleRestoreSession}
                onPermanentDeleteSession={handlePermanentDeleteSession}
                queueItems={queue || []}
                scanHistory={scanHistory || []}
                onOpenItem={handleOpenItemFromSession}
                onNavigateTo={(s) => { secondaryReturnScreen.current = screen; setScreen(s) }}
              />
            </motion.div>
          )}

          {screen === 'agent' && (
            <motion.div
              key="agent"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0 overflow-hidden"
            >
              <AgentScreen
                isCurrentScreen={screen === 'agent' && !cameraOpen}
                queueItems={queue || []}
                soldItems={(queue || []).filter(i => i.listingStatus === 'sold')}
                settings={settings}
                pendingMessage={agentPendingMessage}
                onPendingMessageHandled={() => setAgentPendingMessage(null)}
                onCreateListing={handleOptimizeItem}
                onOptimizeItem={handleOptimizeItem}
                onPushToNotion={handlePushToNotion}
                onBatchAnalyze={handleBatchAnalyze}
                onEditItem={handleEditQueueItem}
                onMarkAsSold={handleMarkAsSold}
                onMarkShipped={handleMarkShipped}
                onNavigateToQueue={() => setScreen('queue')}
                onOpenCamera={() => setCameraOpen(true)}
                onStartSession={handleStartSession}
                onEndSession={handleEndSession}
                onEditSession={handleEditSession}
                allSessions={allSessions || []}
                scanHistory={scanHistory || []}
                profitGoals={profitGoals || []}
                onOpenScanItem={(item) => {
                  setCurrentItem(item)
                  setPipeline([])
                  setOpenedFromScans(true)
                  setScreen('scan-result')
                }}
              />
            </motion.div>
          )}
          {screen === 'scan-result' && currentItem && (
            <motion.div
              key="scan-result"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0"
            >
              <AIScreen
                currentItem={currentItem}
                pipeline={pipeline}
                settings={settings}
                onSaveDraft={handleSaveDraft}
                onCreateListing={handleCreateListingFromScan}
                onPassItem={handlePassFromScan}
                onMaybeItem={handleMaybeFromScan}
                onRecalculate={handleRecalculate}
                onRescan={handleReanalyzeCurrentItem}
                onOpenCamera={openCameraForAddPhoto}
                onAddPhoto={openCameraForAddPhoto}
                onDeletePhoto={handleDeleteAdditionalPhoto}
                onDeletePrimaryPhoto={handleDeletePrimaryPhoto}
              />
            </motion.div>
          )}
          {screen === 'queue' && (
            <motion.div
              key="queue"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0"
            >
              <QueueScreen
                queueItems={queue || []}
                onRemove={handleRemoveFromQueue}
                onCreateListing={handleOptimizeItem}
                onEdit={handleEditQueueItem}
                onReorder={handleReorderQueue}
                onBatchAnalyze={handleBatchAnalyze}
                onAddManualItem={(item) => {
                  const stamped = { ...item, sessionId: session?.id }
                  setQueue((prev) => {
                    const current = prev || []
                    if (current.some(i => i.id === stamped.id)) return current
                    return [...current, stamped]
                  })
                  setScanHistory(prev => [stamped, ...(prev || []).slice(0, 499)])
                }}
                isBatchAnalyzing={isBatchAnalyzing}
                geminiService={geminiService}
                onNavigateToTagAnalytics={() => setScreen('tag-analytics')}
                onNavigateToLocationInsights={() => setScreen('location-insights')}
                onMarkAsSold={handleMarkAsSold}
                onDelist={handleDelist}
                personalSessionIds={personalSessionIds}
                onReanalyze={handleReanalyzeItem}
                onOpenDetail={(item) => setDetailItemId(item.id)}
              />
            </motion.div>
          )}
          {/* ListingDetailScreen — overlaid on top of queue when a detail item is selected */}
          {detailItemId && (() => {
            const detailItem = (queue || []).find(i => i.id === detailItemId)
            return detailItem ? (
              <ListingDetailScreen
                item={detailItem}
                onClose={() => setDetailItemId(null)}
                onOptimize={handleOptimizeItem}
                onOptimizeForPlatform={handleOptimizeForPlatform}
                settings={settings}
                onEdit={handleEditQueueItem}
              />
            ) : null
          })()}
          {screen === 'sold' && (
            <motion.div
              key="sold"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0"
            >
              <SoldScreen
                soldItems={liveSoldItems}
                loading={soldLoading}
                error={soldError}
                warnings={soldWarnings}
                lastSyncedAt={soldSyncedAt}
                onRefresh={() => loadLiveSoldItems()}
                onUpdateShipping={handleUpdateLiveSoldShipping}
              />
            </motion.div>
          )}
          {screen === 'settings' && settings && (
            <motion.div
              key="settings"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0 overflow-hidden"
            >
              <SettingsScreen
                settings={settings}
                onUpdate={handleUpdateSettings}
                onBack={() => setScreen('session')}
              />
            </motion.div>
          )}
          {screen === 'tag-analytics' && (
            <motion.div
              key="tag-analytics"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0"
            >
              <TagAnalyticsScreen
                items={queue || []}
                tags={allTags || []}
                onBack={() => setScreen('queue')}
              />
            </motion.div>
          )}
          {screen === 'location-insights' && (
            <motion.div
              key="location-insights"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0"
            >
              <LocationInsightsScreen
                items={queue || []}
                onBack={() => setScreen('queue')}
              />
            </motion.div>
          )}
          {screen === 'cost-tracking' && (
            <motion.div
              key="cost-tracking"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0"
            >
              <CostTrackingScreen
                onBack={() => setScreen('settings')}
                queueItems={queue || []}
                scanHistory={scanHistory || []}
              />
            </motion.div>
          )}
          {screen === 'scan-history' && (
            <motion.div
              key="scan-history"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0"
            >
              <ScanHistoryScreen
                onBack={() => setScreen('session')}
                onSaveAsDraft={(item) => {
                  setQueue(prev => {
                    const current = prev || []
                    if (current.some(i => i.id === item.id)) return current
                    return [...current, { ...item, inQueue: true }]
                  })
                }}
              />
            </motion.div>
          )}
          {screen === 'session-detail' && selectedSessionId && (
            <motion.div
              key="session-detail"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0"
            >
              <SessionDetailScreen
                sessionId={selectedSessionId}
                onBack={() => setScreen('session')}
                onDeleteSession={handleDeleteSession}
                onEndSession={handleEndSession}
                onReopenSession={handleReopenSession}
                allSessions={visibleSessions}
                onUpdateSessions={setAllSessions}
                queueItems={queue || []}
                scanHistory={scanHistory || []}
                onOpenItem={handleOpenItemFromSession}
                onOpenChat={() => setScreen('agent')}
                onNavigateTo={(s) => { secondaryReturnScreen.current = screen; setScreen(s) }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Spacer exactly matches BottomNav height: h-[52px] grid + max(safe-area-inset-bottom, 4px) */}
      <div className="flex-shrink-0" style={{ height: 'max(56px, calc(52px + env(safe-area-inset-bottom, 0px)))' }} />

      <BottomNav
        currentScreen={screen}
        onNavigate={setScreen}
        onCameraOpen={() => setCameraOpen(true)}
        captureState={captureState}
      />

      <CameraOverlay
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
        onQuickDraft={handleQuickDraft}
        geminiApiKey={settings?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY}
      />

      {isBatchAnalyzing && (
        <BatchAnalysisProgress
          current={batchProgress.current}
          total={batchProgress.total}
          currentItemName={batchProgress.currentItemName}
        />
      )}

      <Toaster
        position="bottom-center"
        richColors
        offset="80px"
        toastOptions={{
          style: {
            borderRadius: '14px',
            padding: '12px 16px',
            fontSize: '13px',
            maxWidth: '360px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          },
          duration: 2500,
        }}
      />
    </div>
  )
}

export default App