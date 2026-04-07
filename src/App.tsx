import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Toaster, toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { BottomNav } from './components/BottomNav'
import { AppHeader } from './components/AppHeader'
import { CameraOverlay } from './components/CameraOverlay'
import { BatchAnalysisProgress } from './components/BatchAnalysisProgress'
import { RetryStatusIndicator } from './components/RetryStatusIndicator'
import { AIScreen } from './components/screens/AIScreen'
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
import { useCaptureState } from './hooks/use-capture-state'
import { useTheme } from './hooks/use-theme'
import { useImageOptimization } from './hooks/use-image-optimization'
import { useRetryTracker } from './hooks/use-retry-tracker'
import type { GeminiVisionResponse } from './lib/gemini-service'
import type { GoogleLensAnalysis } from './lib/google-lens-service'
import type { BarcodeProduct } from './lib/barcode-service'
import type { Screen, ScannedItem, PipelineStep, Session, AppSettings, ItemTag, ThriftStoreLocation, ProfitGoal, ResalePlatform } from './types'
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
  const [currentItem, setCurrentItem] = useState<ScannedItem | undefined>()
  const [pipeline, setPipeline] = useState<PipelineStep[]>([])
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentItemName: '' })
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  
  const [queue, setQueue] = useKV<ScannedItem[]>('queue', [])
  const [scanHistory, setScanHistory] = useKV<ScannedItem[]>('scan-history', [])
  const [session, setSession] = useKV<Session | undefined>('currentSession', undefined)
  const [allSessions, setAllSessions] = useKV<Session[]>('all-sessions', [])
  const [allTags, setAllTags] = useKV<ItemTag[]>('all-tags', [])
  const [profitGoals] = useKV<ProfitGoal[]>('profit-goals', [])
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
    paypalFeePercent: 3.49,
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
  const { theme, themeMode, setTheme, useAmbientLight, toggleAmbientLight } = useTheme()
  const imageQualityPreset = settings?.imageQuality?.preset || 'balanced'
  const { optimizeAndCache, isOptimizing: isOptimizingImage } = useImageOptimization(imageQualityPreset)
  const { state: retryState, startRetry, updateRetry, completeRetry } = useRetryTracker()

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
    toast.success('Session restored')
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

  const handleCapture = useCallback(async (imageData: string, price: number, location?: ThriftStoreLocation, barcodeProduct?: BarcodeProduct) => {
    triggerCapture()
    setCameraOpen(false)

    try {
      const optimized = await optimizeAndCache(imageData)
    
    const newItem: ScannedItem = {
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
    setScreen('agent')
    
    const steps: PipelineStep[] = [
      { id: 'vision', label: 'Vision Analysis', status: 'processing', progress: 0 },
      { id: 'lens', label: 'Google Lens', status: 'pending', progress: 0 },
      { id: 'market', label: 'Market Research', status: 'pending', progress: 0 },
      { id: 'profit', label: 'Profit Calculation', status: 'pending', progress: 0 },
      { id: 'decision', label: 'Decision', status: 'pending', progress: 0 },
    ]
    setPipeline(steps)
    
    startAnalyzing()
    
    try {
      let visionResult: GeminiVisionResponse | undefined
      // Fall back to barcode title if Gemini vision is unavailable
      let mockProductName = barcodeProduct?.title || 'Unknown Product'
      
      simulateProgress(0, 3000)
      
      if (geminiService) {
        try {
          visionResult = await geminiService.analyzeProductImage(imageData, {}, price)
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
          
          const resultCount = lensAnalysis.results.length
          const priceInfo = lensAnalysis.priceRange 
            ? `$${lensAnalysis.priceRange.min.toFixed(2)}-$${lensAnalysis.priceRange.max.toFixed(2)}` 
            : 'No prices'
          
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
              // Price extraction failed on the full report — ask Gemini directly for a number
              try {
                const productLabel = visionResult?.productName || mockProductName
                const directPriceText = await callLLM(
                  `What is the current average resale price for "${productLabel}" on eBay or Mercari? Reply with ONLY a single dollar amount, e.g. "$24.99". No other text.`,
                  geminiKey,
                  undefined
                )
                const directPrice = parseResearchPrice(directPriceText)
                if (directPrice > 0) {
                  ebayAvgPrice = directPrice
                  setPipeline(prev => prev.map((s, i) =>
                    i === 2 ? { ...s, data: `Est. market value ~$${directPrice.toFixed(2)}` } : s
                  ))
                } else {
                  setPipeline(prev => prev.map((s, i) =>
                    i === 2 ? { ...s, data: 'Market data unavailable — enter price manually' } : s
                  ))
                }
              } catch {
                setPipeline(prev => prev.map((s, i) =>
                  i === 2 ? { ...s, data: 'Market data unavailable — enter price manually' } : s
                ))
              }
            }
          } catch {
            setPipeline(prev => prev.map((s, i) =>
              i === 2 ? { ...s, data: 'Search unavailable — using estimate' } : s
            ))
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
        settings?.defaultShippingCost || 5.0,
        settings?.ebayFeePercent || 12.9,
        settings?.paypalFeePercent || 3.49
      ) || calculateProfitFallback(
        price,
        sellPrice,
        settings?.defaultShippingCost || 5.0,
        settings?.ebayFeePercent || 12.9
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
        }).catch(() => {/* silent — non-blocking enrichment */})
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
      setScanHistory(prev => [persistableItem, ...(prev || []).slice(0, 499)])

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
      
      toast.success(decision === 'BUY' ? '✅ BUY Decision!' : '❌ PASS Decision')
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
    const name = `${dayName} ${timeOfDay} — ${monthDay}`
    const id = Date.now().toString()
    const newSession: Session = {
      id,
      name,
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
    toast.success('Session started')
  }, [setSession, setAllSessions, setSelectedSessionId, setScreen])

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
          toast.success('Session restored')
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
      toast.success('Session ended')
    }
  }, [session, setSession, setAllSessions, setQueue])

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
        paypalFeePercent: 3.49,
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
    const item = (queue || []).find(i => i.id === itemId)
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
  }, [queue, setQueue, listingOptimizationService])

  const handlePushToNotion = useCallback(async (itemId: string) => {
    if (!notionService) {
      toast.error('Configure Notion API key and Database ID in Settings')
      return
    }
    const item = (queue || []).find(i => i.id === itemId)
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
      toast.success('Pushed to Notion ✓')
    } else {
      toast.error(`Notion error: ${result.error}`)
    }
  }, [queue, setQueue, notionService])

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
    toast.success('Item marked as sold')
  }, [setQueue, queue, notionService])

  const handleMarkShipped = useCallback((itemId: string, trackingNumber: string, shippingCarrier: string) => {
    const shippedDate = Date.now()
    const item = (queue || []).find(i => i.id === itemId)
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId ? { ...i, listingStatus: 'shipped', trackingNumber, shippingCarrier, shippedDate } : i
    ))
    if (item?.notionPageId && notionService) {
      notionService.updateListingStatus(item.notionPageId, { status: 'shipped', trackingNumber, shippingCarrier, shippedDate }).catch(e => console.warn('Notion sync failed:', e))
    }
    toast.success('Item marked as shipped')
  }, [setQueue, queue, notionService])

  const handleMarkCompleted = useCallback((itemId: string) => {
    const item = (queue || []).find(i => i.id === itemId)
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId ? { ...i, listingStatus: 'completed' } : i
    ))
    if (item?.notionPageId && notionService) {
      notionService.updateListingStatus(item.notionPageId, { status: 'completed' }).catch(e => console.warn('Notion sync failed:', e))
    }
    toast.success('Transaction completed')
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
    toast.success('Item marked as returned')
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
    toast.success('Item delisted')
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
    toast.success('Item re-listed')
  }, [setQueue, queue, notionService])

  const handleSaveDraft = useCallback((price: number, notes: string) => {
    if (!currentItem?.imageData && !currentItem?.imageThumbnail) {
      toast.error('No image to save')
      return
    }

    const { imageData: _img, imageOptimized: _opt, ...lightweight } = currentItem!
    const draftItem: ScannedItem = {
      ...lightweight,
      purchasePrice: price > 0 ? price : currentItem!.purchasePrice,
      notes: notes || currentItem!.notes,
      inQueue: true,
    }

    setQueue((prev) => {
      const current = prev || []
      if (current.some(i => i.id === draftItem.id)) return current
      return [...current, draftItem]
    })
    toast.success('Draft saved to queue')
    setScreen('queue')
  }, [currentItem, setQueue])

  const handleRescan = useCallback(() => {
    setCurrentItem(undefined)
    setPipeline([])
    setCameraOpen(true)
  }, [])

  const handleRecalculate = useCallback((newPrice: number) => {
    if (!currentItem?.estimatedSellPrice) {
      toast.error('No sell price available — scan an item first')
      return
    }
    const shipping = settings?.defaultShippingCost || 5.0
    const feePercent = settings?.ebayFeePercent || 12.9
    const minMargin = settings?.minProfitMargin || 30
    const profitMetrics = calculateProfitFallback(newPrice, currentItem.estimatedSellPrice, shipping, feePercent)

    const decision = makeDecision(currentItem.estimatedSellPrice, newPrice, profitMetrics.profitMargin, profitMetrics.netProfit, minMargin)

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
      ...currentItem.marketData,
      ...(freeItemPlatformHint ? { recommendedPlatform: freeItemPlatformHint } : { recommendedPlatform: undefined }),
    }

    setCurrentItem(prev => prev ? {
      ...prev,
      purchasePrice: newPrice,
      profitMargin: profitMetrics.profitMargin,
      decision,
      marketData: updatedMarketData,
    } : prev)

    setPipeline(prev => prev.map((s, i) => {
      if (i === 3) return { ...s, data: `Margin: ${profitMetrics.profitMargin.toFixed(1)}%, ROI: ${profitMetrics.roi.toFixed(0)}%` }
      if (i === 4) return { ...s, data: `Decision: ${decision} (recalculated)` }
      return s
    }))

    toast.success(`Recalculated: ${decision} — ${profitMetrics.profitMargin.toFixed(1)}% margin`)
  }, [currentItem, settings, triggerSuccess, triggerFail])

  const handleCreateListingFromScan = useCallback(async (price: number, notes: string) => {
    if (!currentItem?.imageData && !currentItem?.imageThumbnail) {
      toast.error('No image to save')
      return
    }
    const { imageData: _img, imageOptimized: _opt, ...lightweight } = currentItem!
    const listingItem: ScannedItem = {
      ...lightweight,
      purchasePrice: price > 0 ? price : currentItem!.purchasePrice,
      notes: notes || currentItem!.notes,
      inQueue: true,
      decision: 'BUY',
    }
    setQueue(prev => {
      const current = prev || []
      if (current.some(i => i.id === listingItem.id)) {
        return current.map(i => i.id === listingItem.id ? listingItem : i)
      }
      return [...current, listingItem]
    })
    setDetailItemId(listingItem.id)
    setScreen('queue')
    toast.loading('Creating listing...')
    // Optimize after navigating so the detail screen opens immediately
    setTimeout(() => handleOptimizeItem(listingItem.id), 50)
  }, [currentItem, setQueue, handleOptimizeItem])

  const handlePassFromScan = useCallback((price: number, notes: string) => {
    if (!currentItem?.imageData && !currentItem?.imageThumbnail) {
      toast.error('No image to save')
      return
    }
    // Keep imageThumbnail for queue display; strip heavy blobs
    const { imageData: _img, imageOptimized: _opt, ...lightweight } = currentItem!
    const passItem: ScannedItem = {
      ...lightweight,
      purchasePrice: price > 0 ? price : currentItem!.purchasePrice,
      notes: notes || currentItem!.notes,
      inQueue: true,
      decision: 'PASS',
    }
    setQueue(prev => {
      const current = prev || []
      if (current.some(i => i.id === passItem.id)) {
        return current.map(i => i.id === passItem.id ? passItem : i)
      }
      return [...current, passItem]
    })
    setCurrentItem(undefined)
    setPipeline([])
    toast.success('Passed — heavy image data will be removed at session end')
  }, [currentItem, setQueue])

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
      toast.info('No quick drafts to analyze')
      return
    }

    setIsBatchAnalyzing(true)
    setBatchProgress({ current: 0, total: unanalyzedItems.length, currentItemName: '' })
    toast.info(`Analyzing ${unanalyzedItems.length} item${unanalyzedItems.length !== 1 ? 's' : ''}...`)

    let processedCount = 0
    let buyCount = 0
    let passCount = 0
    let totalNewProfit = 0
    const failedItems: string[] = []
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
          settings?.defaultShippingCost || 5.0,
          settings?.ebayFeePercent || 12.9,
          settings?.paypalFeePercent || 3.49
        ) || calculateProfitFallback(
          item.purchasePrice,
          sellPrice,
          settings?.defaultShippingCost || 5.0,
          settings?.ebayFeePercent || 12.9
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
        console.error('Failed to analyze item:', item.id, error)
        failedItems.push(item.id)
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
      toast.warning(`${failedItems.length} item(s) failed analysis`)
    }
    if (skippedItems.length > 0) {
      toast.info(`${skippedItems.length} item(s) skipped (no image)`)
    }
    toast.success(`Analyzed ${processedCount} items: ${buyCount} BUY, ${passCount} PASS`)
  }, [queue, setQueue, settings, session, setSession, geminiService, googleLensService, ebayService])

  const handleReanalyzeItem = useCallback(async (itemId: string) => {
    const item = (queue || []).find(i => i.id === itemId)
    if (!item) return

    // Reset to re-analyzable state so handleBatchAnalyze picks it up
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId
        ? { ...i, productName: 'Quick Draft', description: 'Analyzing...', estimatedSellPrice: undefined, profitMargin: undefined }
        : i
    ))

    // Trigger batch analyze which now includes 'Quick Draft' items
    await handleBatchAnalyze()
  }, [queue, setQueue, handleBatchAnalyze])

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
      toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} listing generated`)
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

  const screenVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
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
        onNavigateToSettings={() => setScreen('settings')}
        onNavigateToTrends={screen === 'session' ? () => setShowSessionTrends(prev => !prev) : undefined}
        showTrends={showSessionTrends}
        onBack={
          screen === 'settings' || screen === 'session-detail' || screen === 'scan-history'
            ? () => setScreen('session')
            : screen === 'tag-analytics' || screen === 'location-insights'
            ? () => setScreen('queue')
            : screen === 'cost-tracking'
            ? () => setScreen('settings')
            : undefined
        }
      />

      <div
        className="flex-1 relative w-full pb-24"
        style={{
          minHeight: 'calc(100vh - 96px)',
        }}
      >
        <AnimatePresence mode="wait">
          {screen === 'session' && (
            <motion.div
              key="session"
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full"
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
              />
            </motion.div>
          )}
          {screen === 'agent' && (
            <motion.div
              key="agent"
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full"
            >
              <AIScreen
                currentItem={currentItem}
                pipeline={pipeline}
                settings={settings}
                queueItems={queue || []}
                onSaveDraft={handleSaveDraft}
                onCreateListing={handleCreateListingFromScan}
                onPassItem={handlePassFromScan}
                onRecalculate={handleRecalculate}
                onRescan={handleRescan}
                onOpenCamera={() => setCameraOpen(true)}
                pendingMessage={agentPendingMessage}
                onPendingMessageHandled={() => setAgentPendingMessage(null)}
              />
            </motion.div>
          )}
          {screen === 'queue' && (
            <motion.div
              key="queue"
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full"
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
              />
            ) : null
          })()}
          {screen === 'sold' && (
            <motion.div
              key="sold"
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full"
            >
              <SoldScreen
                soldItems={(queue || []).filter(i =>
                  i.listingStatus === 'sold' || i.listingStatus === 'shipped' || i.listingStatus === 'completed' || i.listingStatus === 'returned'
                )}
                onMarkShipped={handleMarkShipped}
                onMarkCompleted={handleMarkCompleted}
                onMarkReturned={handleMarkReturned}
                onRelistItem={handleRelistItem}
                personalSessionIds={personalSessionIds}
                settings={settings}
              />
            </motion.div>
          )}
          {screen === 'settings' && settings && (
            <motion.div
              key="settings"
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full"
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
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full"
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
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full"
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
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full"
            >
              <CostTrackingScreen
                onBack={() => setScreen('settings')}
              />
            </motion.div>
          )}
          {screen === 'scan-history' && (
            <motion.div
              key="scan-history"
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full"
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
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="w-full h-full"
            >
              <SessionDetailScreen
                sessionId={selectedSessionId}
                onBack={() => setScreen('session')}
                onDeleteSession={handleDeleteSession}
                onEndSession={handleEndSession}
                allSessions={visibleSessions}
                onUpdateSessions={setAllSessions}
                queueItems={queue || []}
                scanHistory={scanHistory || []}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-[80px] sm:h-[88px] flex-shrink-0" />

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