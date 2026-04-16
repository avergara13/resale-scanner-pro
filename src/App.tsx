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
import { PhotoManager } from './components/screens/PhotoManager'
import { ListingBuilder } from './components/screens/ListingBuilder'
import { createEbayService, calculateProfitFallback } from './lib/ebay-service'
import { retryOperation } from './lib/retry-service'
import { getRetryOptions } from './lib/retry-config'
import { callLLM, researchProduct, parseResearchPrice, parseSellThroughRate } from './lib/llm-service'
import { calculatePlatformROI } from './lib/platform-roi-service'
import { createGeminiService } from './lib/gemini-service'
import { createGoogleLensService } from './lib/google-lens-service'
import { createTagSuggestionService } from './lib/tag-suggestion-service'
import { createListingOptimizationService } from './lib/listing-optimization-service'
import { createNotionService } from './lib/notion-service'
import { SupabaseService } from './lib/supabase-service'
import { urlToDataUrl } from './lib/photo'
import { fetchSoldItems, updateSoldItemShipping } from './lib/sold-service'
import { useCaptureState } from './hooks/use-capture-state'
import { useTheme } from './hooks/use-theme'
import { useImageOptimization } from './hooks/use-image-optimization'
import { useRetryTracker } from './hooks/use-retry-tracker'
import type { GeminiVisionResponse } from './lib/gemini-service'
import type { GoogleLensAnalysis } from './lib/google-lens-service'
import type { BarcodeProduct } from './lib/barcode-service'
import type { Screen, ScannedItem, PipelineStep, Session, AppSettings, ItemTag, ThriftStoreLocation, ProfitGoal, SoldItem, SoldShippingUpdateInput, UserProfile, ResalePlatform } from './types'
import { cn } from './lib/utils'
import { useDeviceId } from './hooks/use-device-id'

/** Pure helper — determines BUY / MAYBE / PASS from profit metrics.
 *  MAYBE fires when margin lands within 6 pp below the user's minMargin threshold
 *  (e.g. threshold 30% → margin 24.0–29.99% = MAYBE; ≥30% = BUY; <24% = PASS). */
function makeDecision(
  sellPrice: number,
  buyPrice: number,
  profitMargin: number,
  netProfit: number,
  minMargin: number
): 'BUY' | 'PASS' | 'MAYBE' | 'PENDING' {
  if (sellPrice <= 0) return 'PASS'
  if (buyPrice === 0) return netProfit > 0 ? 'BUY' : 'PASS'
  if (profitMargin >= minMargin) return 'BUY'
  if (profitMargin >= minMargin - 6) return 'MAYBE'
  return 'PASS'
}

// Synthesize a completed 5-step pipeline for items re-opened from the scan queue.
// Mirrors the shape handleCapture builds at scan time, but marks every step complete
// so AIScreen renders the same end-of-scan visual the user saw originally — no empty
// space above the action bar. Pure function; no network calls, no re-analysis.
function buildCompletedPipeline(): PipelineStep[] {
  return [
    { id: 'vision', label: 'Vision Analysis', status: 'complete', progress: 100 },
    { id: 'lens', label: 'Google Lens', status: 'complete', progress: 100 },
    { id: 'market', label: 'Market Research', status: 'complete', progress: 100 },
    { id: 'profit', label: 'Profit Calculation', status: 'complete', progress: 100 },
    { id: 'decision', label: 'Decision', status: 'complete', progress: 100 },
  ]
}

function App() {
  const [screen, setScreen] = useState<Screen>('session')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [showSessionTrends, setShowSessionTrends] = useState(false)
  const [agentPendingMessage, setAgentPendingMessage] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraMode, setCameraMode] = useState<'new-scan' | 'add-photo' | 'replace-primary' | 'listing-photo'>('new-scan')
  const [currentItem, setCurrentItem] = useState<ScannedItem | undefined>()
  const [pipeline, setPipeline] = useState<PipelineStep[]>([])
  // Tracks whether the current scan-result was opened from the Agent Scans tab (Reopen)
  // vs a fresh camera scan. Used to show "← Scans" back label in the header.
  const [openedFromScans, setOpenedFromScans] = useState(false)

  // Photo Manager state — set before navigating to 'photo-manager'; cleared on Done or Back.
  // Correction 1: existingUrls are already-uploaded https:// URLs (pass through, no re-upload).
  //               localPhotos are new base64/data-URLs captured this session (uploaded on Done).
  const [pendingPhotoDecision, setPendingPhotoDecision] = useState<{
    item: ScannedItem              // lightweight (imageData stripped), ready for queue/history
    existingUrls: string[]         // already-uploaded Supabase URLs — pass through unchanged
    localPhotos: string[]          // new base64/data-URLs — these get uploaded on Done
    decision: 'BUY' | 'MAYBE' | 'edit'
    returnScreen?: Screen          // for edit-mode Back navigation (Entry Points B & C)
    capturedPhoto?: string         // image from listing camera overlay; consumed by PhotoManager
  } | null>(null)
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentItemName: '' })
  // WO-RSP-010: ListingBuilder screen state
  const [listingBuilderItemId, setListingBuilderItemId] = useState<string | null>(null)
  const [listingBuilderAutoGate, setListingBuilderAutoGate] = useState(false)
  const [listingBuilderMode, setListingBuilderMode] = useState<'browse' | 'list'>('browse')
  const [liveSoldItems, setLiveSoldItems] = useState<SoldItem[]>([])
  const [soldWarnings, setSoldWarnings] = useState<string[]>([])
  const [soldLoading, setSoldLoading] = useState(false)
  const [soldError, setSoldError] = useState<string | null>(null)
  const [soldSyncedAt, setSoldSyncedAt] = useState<number | null>(null)

  
  const deviceId = useDeviceId()

  const [queue, setQueue] = useKV<ScannedItem[]>('queue', [])
  const [hrboSkuCounter, setHrboSkuCounter] = useKV<number>('hrbo-sku-counter', 0)
  // Ref mirror of `queue` — used by pipeline handlers to escape stale closures
  // when the Agent runs multi-step flows (batch-analyze → optimize → push) and
  // subsequent handlers need the latest queue state, not the pre-pipeline snapshot.
  const queueRef = useRef(queue)
  useEffect(() => { queueRef.current = queue }, [queue])
  const [scanHistory, setScanHistory] = useKV<ScannedItem[]>('scan-history', [])
  // Device-scoped: each device has its own active session — prevents cross-device collisions
  const [session, setSession] = useKV<Session | undefined>(`device-current-session-${deviceId}`, undefined)
  const [allSessions, setAllSessions] = useKV<Session[]>('all-sessions', [])
  const [allTags] = useKV<ItemTag[]>('all-tags', [])
  const [profitGoals] = useKV<ProfitGoal[]>('profit-goals', [])
  const [, setActivityLog] = useKV<ActivityEntry[]>(ACTIVITY_LOG_KEY, [])
  const [, setDebugLog] = useKV<DebugEntry[]>(DEBUG_LOG_KEY, [])
  const [, setAgentActiveTab] = useKV<'chat' | 'scans' | 'tasks'>('agent-active-tab', 'chat')
  // Global profile — not device-scoped so operator identity syncs across all devices
  const [globalProfile, setGlobalProfile] = useKV<UserProfile | undefined>('user-profile', undefined)
  // Device-scoped: each device has its own settings (thresholds, API keys, profile)
  const [settings, setSettings] = useKV<AppSettings>(`device-settings-${deviceId}`, {
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
    notionDatabaseId: '3318ed3e-1385-45d3-9a60-63a628eeefff',
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
      settings?.ebayCertId
    )
  }, [settings?.ebayAppId, settings?.ebayDevId, settings?.ebayCertId])

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
    return createListingOptimizationService(key, settings?.openaiApiKey, settings?.anthropicApiKey)
  }, [settings?.geminiApiKey, settings?.openaiApiKey, settings?.anthropicApiKey])

  const notionService = useMemo(() => {
    const key = settings?.notionApiKey || import.meta.env.VITE_NOTION_API_KEY
    return createNotionService(key, settings?.notionDatabaseId)
  }, [settings?.notionApiKey, settings?.notionDatabaseId])

  const supabaseService = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) return null
    return new SupabaseService(url, key)
  }, [])

  // One-time migration: earlier builds stored the Notion DB ID as a 32-char hex string
  // with no dashes, which Notion API rejects with HTTP 400. Rewrite to canonical
  // 8-4-4-4-12 UUID form on app load. No-op after first successful run.
  useEffect(() => {
    const id = settings?.notionDatabaseId
    if (!id || id.includes('-')) return
    if (!/^[0-9a-f]{32}$/i.test(id)) return
    const canonical = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`.toLowerCase()
    setSettings(prev => prev ? { ...prev, notionDatabaseId: canonical } : prev)
  }, [settings?.notionDatabaseId, setSettings])

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

  // Cascade cleanup for a hard-deleted session:
  //   - Collects photoUrls across queue + scanHistory for items in this session
  //   - Skips items with `ebayListingId` (live listing — deleting photos would
  //     break the live eBay listing's image URLs that buyers see)
  //   - Fire-and-forget Supabase storage delete (errors logged inside deletePhotos)
  //   - Removes session items from queue and scanHistory KV
  // Used by both handlePermanentDeleteSession (immediate) and the 60s hard-purge
  // inside handleDeleteSession (after undo window expires).
  const purgeSessionData = useCallback((sessionId: string) => {
    const allItems = [...(queue || []), ...(scanHistory || [])]
    const urlsToDelete = new Set<string>()
    for (const item of allItems) {
      if (item.sessionId !== sessionId) continue
      if (item.ebayListingId) continue   // live listing — leave photos on Supabase
      for (const url of item.photoUrls || []) urlsToDelete.add(url)
    }
    if (supabaseService && urlsToDelete.size > 0) {
      void supabaseService.deletePhotos(Array.from(urlsToDelete))
    }
    setQueue(prev => (prev || []).filter(i => i.sessionId !== sessionId))
    setScanHistory(prev => (prev || []).filter(i => i.sessionId !== sessionId))
  }, [queue, scanHistory, supabaseService, setQueue, setScanHistory])

  const handlePermanentDeleteSession = useCallback((sessionId: string) => {
    purgeSessionData(sessionId)
    setAllSessions((prev) => (prev || []).filter(s => s.id !== sessionId))
  }, [purgeSessionData, setAllSessions])

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

  // Pure session factory — returns a Session object without side effects.
  // Used by both handleStartSession (manual) and handleCapture (auto-start).
  const createSession = useCallback((): Session => {
    const profile = settings?.userProfile ?? globalProfile
    const operatorId = profile?.operatorId
    const operatorAllSessions = (allSessions || []).filter(s =>
      operatorId ? s.operatorId === operatorId : !s.operatorId
    )
    const sessionNumber = operatorAllSessions.reduce((max, s) => Math.max(max, s.sessionNumber || 0), 0) + 1
    const initial = profile?.operatorInitial || ''
    const prefix = initial ? `${initial}-` : '#'
    const name = `${prefix}${String(sessionNumber).padStart(3, '0')}`
    return {
      id: Date.now().toString(),
      name,
      sessionNumber,
      startTime: Date.now(),
      itemsScanned: 0,
      buyCount: 0,
      passCount: 0,
      totalPotentialProfit: 0,
      active: true,
      sessionType: 'business',
      operatorId: profile?.operatorId,
      operatorName: profile?.operatorName,
      operatorInitial: profile?.operatorInitial,
    }
  }, [allSessions, settings?.userProfile, globalProfile])

  const handleCapture = useCallback(async (imageData: string, price: number, barcodeProduct?: BarcodeProduct, condition?: string, existingItem?: ScannedItem) => {
    // Route captured image back to Photo Manager without a new pipeline run
    if (cameraMode === 'listing-photo') {
      triggerCapture()
      setCameraMode('new-scan')
      setCameraOpen(false)
      setPendingPhotoDecision(prev => {
        if (!prev) {
          // Photo Manager unmounted between camera open and capture — drop the photo with feedback
          toast.error('Photo Manager closed before capture completed.')
          return prev
        }
        return { ...prev, capturedPhoto: imageData }
      })
      return
    }

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

    // Guarantee every NEW scan has an active session — auto-create if none exists.
    // Uses the session ID directly (not via state) to eliminate race conditions.
    // Re-analyze / add-photo modes operate on existing items that already have a sessionId.
    let activeSession = session
    if (!effectiveExistingItem && !activeSession?.active) {
      activeSession = createSession()
      setAllSessions(prev => [...(prev || []), activeSession!])
      setSession(activeSession)
      setSelectedSessionId(activeSession.id)
    }

    // If re-analyzing an existing item, preserve its ID and metadata so we don't
    // create a duplicate card in scan history. Otherwise create a fresh item.
    let newItem: ScannedItem = effectiveExistingItem
      ? {
          ...effectiveExistingItem,
          imageData: optimized.original,
          imageThumbnail: optimized.thumbnail,
          imageOptimized: optimized.original,
          decision: 'PENDING' as const,   // reset for clean pipeline run
          listingStatus: undefined,       // re-analyze resets gate so optimize/push re-evaluates
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
          condition: condition || 'New',   // user-selected at camera; feeds Gemini + AIScreen
          sessionId: activeSession?.id,
          scannedBy: settings?.userProfile?.operatorId,
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
            { condition: newItem.condition || 'New' },   // anchor sale-price estimate to user-reported condition
            price,
            newItem.additionalImageData?.length ? newItem.additionalImageData : undefined,
          )
          mockProductName = visionResult.productName
          // PKT-004 Correction 3 — persist upcEan on newItem immediately so it's
          // available downstream (visionResult is out of scope in callbacks)
          if (visionResult.upcEan) {
            newItem = { ...newItem, upcEan: visionResult.upcEan }
          }

          setPipeline(prev => prev.map((s, i) =>
            i === 0 ? {
              ...s,
              status: 'complete' as const,
              progress: 100,
              data: `${visionResult?.productName || mockProductName} - ${visionResult?.brand || 'Generic'} (${visionResult ? Math.round(visionResult.confidence * 100) : 0}% confident)`
            } : s
          ))
        } catch (error) {
          console.error('Gemini vision failed:', error)
          setPipeline(prev => prev.map((s, i) =>
            i === 0 ? {
              ...s,
              status: 'complete' as const,
              progress: 100,
              data: 'Vision analysis unavailable - configure Gemini API key in Settings'
            } : s
          ))
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000))
        setPipeline(prev => prev.map((s, i) =>
          i === 0 ? {
            ...s,
            status: 'complete' as const,
            progress: 100,
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
              status: 'complete' as const,
              progress: 100,
              data: `Found ${lensAnalysis?.results.length || 0} matches. Range: ${lensAnalysis?.priceRange ? `$${lensAnalysis.priceRange.min.toFixed(2)}-$${lensAnalysis.priceRange.max.toFixed(2)}` : 'No prices'}`
            } : s
          ))
        } catch (error) {
          console.error('Google Lens failed:', error)
          setPipeline(prev => prev.map((s, i) =>
            i === 1 ? {
              ...s,
              status: 'complete' as const,
              progress: 100,
              data: 'Google Lens unavailable — using Gemini only'
            } : s
          ))
        }
      } else if (!googleLensService) {
        await new Promise(resolve => setTimeout(resolve, 400))
        setPipeline(prev => prev.map((s, i) =>
          i === 1 ? {
            ...s,
            status: 'complete' as const,
            progress: 100,
            data: 'Configure Google API key in Settings for visual search'
          } : s
        ))
      } else {
        // skipLens = true (high confidence) — fast path
        await new Promise(resolve => setTimeout(resolve, 400))
        setPipeline(prev => prev.map((s, i) =>
          i === 1 ? {
            ...s,
            progress: 100,
            status: 'complete' as const,
            data: `Skipped — Gemini ${Math.round(geminiConfidence * 100)}% confident (saves API call)`
          } : s
        ))
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
      }

      // Run Gemini market research if: no eBay service was available, OR eBay returned no usable price
      if (!ebayService || ebayAvgPrice === 0) {
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
            // Parse and store sell-through rate from research text
            const researchSellThrough = parseSellThroughRate(researchText)
            if (researchSellThrough > 0) {
              marketData = { ...marketData, sellThroughRate: researchSellThrough }
            }
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
                  { geminiApiKey: geminiKey, openaiApiKey: settings?.openaiApiKey, anthropicApiKey: anthropicKey, task: 'chat' }
                )
                const directPrice = parseResearchPrice(directPriceText)
                if (directPrice > 0) {
                  ebayAvgPrice = directPrice
                  gotPrice = true
                  setPipeline(prev => prev.map((s, i) =>
                    i === 2 ? { ...s, data: `Est. market value ~$${directPrice.toFixed(2)}` } : s
                  ))
                }
              } catch (e) { console.warn('[Scan] Tier 2 LLM pricing failed:', e) }

              if (!gotPrice) {
                // Tier 3: Claude deep research fallback (task: 'complex' tries Anthropic first)
                try {
                  const tier3Text = await callLLM(
                    `You are a resale expert. Based on eBay, Mercari, and Poshmark sold comps, what is the median resale price for "${productLabel}"? Reply ONLY with: RECOMMENDED_SELL_PRICE: $XX.XX`,
                    { geminiApiKey: geminiKey, openaiApiKey: settings?.openaiApiKey, anthropicApiKey: anthropicKey, task: 'complex' }
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
                } catch (e) {
                  console.warn('[Scan] Tier 3 Claude research failed:', e)
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
                { geminiApiKey: geminiKey, openaiApiKey: settings?.openaiApiKey, anthropicApiKey: anthropicKey, task: 'complex' }
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
            } catch (e) { console.warn('[Scan] Outer LLM fallback failed:', e) }
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
      }
      completeStep(2)
      await new Promise(resolve => setTimeout(resolve, 100))

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

      // Multi-platform ROI comparison (Mercari / Poshmark / Whatnot — eBay is primary, FB excluded)
      const platformComparison = sellPrice > 0 ? calculatePlatformROI(
        price,
        sellPrice,
        settings?.defaultShippingCost ?? 5.0,
        settings?.shippingMaterialsCost ?? 0.75,
        settings?.ebayFeePercent ?? 12.9,
        settings?.ebayAdFeePercent ?? 3.0
      ) : []
      const bestAlt = platformComparison.find(p => p.recommended)

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
          data: bestAlt && sellPrice > 0
            ? `eBay: ${profitMetrics.profitMargin.toFixed(1)}% margin · Best alt: ${bestAlt.platform} ${bestAlt.profitMargin.toFixed(1)}%`
            : `Margin: ${profitMetrics.profitMargin.toFixed(1)}%, ROI: ${profitMetrics.roi.toFixed(0)}%`
        } : s
      ))

      await new Promise(resolve => setTimeout(resolve, 500))
      completeStep(4)

      const updatedItem: ScannedItem = {
        ...newItem,
        // Re-analyze / replace-primary preserve existing productName — user may have edited it.
        // Fresh scan falls through to AI-derived name.
        productName: effectiveExistingItem?.productName || visionResult?.productName || barcodeProduct?.title || mockProductName,
        description: visionResult?.description || barcodeProduct?.description || 'Product analysis unavailable',
        category: visionResult?.category || barcodeProduct?.category || 'General',
        estimatedSellPrice: sellPrice > 0 ? sellPrice : undefined,
        profitMargin: sellPrice > 0 ? profitMetrics.profitMargin : undefined,
        decision,
        lensAnalysis,
        lensResults: lensAnalysis?.results,
        platformComparison: platformComparison.length > 0 ? platformComparison : undefined,
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
      delete persistableItem.photos               // strip working base64 array; photoUrls (remote URLs) are kept
      setScanHistory(prev => {
        const existing = prev || []
        if (effectiveExistingItem) {
          // Re-analyze path: replace the existing scan history entry in-place (no new card)
          const idx = existing.findIndex(i => i.id === effectiveExistingItem.id)
          if (idx !== -1) return existing.map((i, j) => j === idx ? persistableItem : i)
        }
        return [persistableItem, ...existing.slice(0, 499)]
      })

      // Re-analyze path: mirror the refreshed research into the queue in-place so the
      // listing-side card picks up new marketData / description / comps without losing
      // user-curated assets (photoUrls, primaryPhotoIndex, edited productName).
      // No-op if the item isn't in the queue (fresh scan or agent-only item).
      if (effectiveExistingItem) {
        setQueue(prev => (prev || []).map(i =>
          i.id === effectiveExistingItem.id
            ? {
                ...i,
                ...persistableItem,
                // Preserve curated assets — persistableItem has photoUrls intact, but be explicit:
                photoUrls: i.photoUrls,
                primaryPhotoIndex: i.primaryPhotoIndex,
                // Preserve user-edited name (persistableItem.productName already falls back to existing via handleCapture above):
                productName: i.productName || persistableItem.productName,
                // Reset listing gate so optimize / push re-evaluate against refreshed research:
                listingStatus: undefined,
              }
            : i
        ))
      }

      // Only increment itemsScanned here — decision counters (buyCount, passCount) change
      // at the confirmed user-decision moment (handlePhotoManagerDone for BUY,
      // handlePassFromScan for PASS, handlePassFromAgent for PASS-from-queue, etc.)
      if (activeSession?.active) {
        setSession((prev) => {
          if (!prev) return prev
          return { ...prev, itemsScanned: prev.itemsScanned + 1 }
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

      // Auto-optimization for BUY/MAYBE — non-blocking, runs after user sees result
      if ((decision === 'BUY' || decision === 'MAYBE') && listingOptimizationService) {
        const sku = updatedItem.tags?.find(t => t.startsWith('HRBO-')) || generateSku()
        listingOptimizationService.generateOptimizedListing({
          item: { ...updatedItem, condition: updatedItem.condition || condition || 'Good' },
          marketData: updatedItem.marketData,
          visionResult,
        }).then(optimized => {
          const mergedTags = Array.from(new Set([
            ...(updatedItem.tags || []).filter(t => !t.startsWith('HRBO-')),
            sku,
            ...(optimized.suggestedTags || []),
          ]))
          setQueue(prev => (prev || []).map(i =>
            i.id === updatedItem.id
              ? { ...i, optimizedListing: optimized, condition: optimized.condition || i.condition, tags: mergedTags }
              : i
          ))
          setScanHistory(prev => (prev || []).map(i =>
            i.id === updatedItem.id ? { ...i, optimizedListing: optimized } : i
          ))
        }).catch(e => console.warn('[opt] background optimization failed:', e))
      }
    } catch (error) {
      console.error('Pipeline error:', error)
      reset() // Clear stuck 'analyzing' captureState
      setPipeline(prev => prev.map(s => ({
        ...s,
        status: s.status === 'processing' ? 'error' : s.status,
        error: 'Analysis failed'
      })))
      toast.error('Analysis failed. Please try again.')
      }
    } catch (outerError) {
      // Catch errors from optimizeAndCache or any unhandled rejection
      reset() // Clear stuck 'analyzing' captureState
      const msg = outerError instanceof Error ? outerError.message : 'Unknown error'
      console.error('Capture failed:', msg)
      toast.error(msg.toLowerCase().includes('quota') ? 'Storage full — clearing cache and retrying. Please try again.' : `Capture failed: ${msg}`)
    }
    // `handleAddPhotoToCurrentItem` is referenced inside this callback but declared later in
    // the component (line ~1215). Adding it to deps would hit a TDZ error during render.
    // The closure picks it up correctly at call time; eslint-disable the rule locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode, currentItem, settings, session, setSession, ebayService, geminiService, googleLensService, optimizeAndCache, triggerCapture, startAnalyzing, triggerSuccess, triggerFail, reset, simulateProgress, completeStep, tagSuggestionService, setScanHistory, setQueue, createSession, setAllSessions, setSelectedSessionId])

  const handleRemoveFromQueue = useCallback((id: string) => {
    setQueue((prev) => (prev || []).filter(item => item.id !== id))
    // silent removal
  }, [setQueue])

  const handleStartSession = useCallback(() => {
    const newSession = createSession()
    setAllSessions((prev) => [...(prev || []), newSession])
    setSession(newSession)
    setSelectedSessionId(newSession.id)
    setScreen('session-detail')
    logActivity(`Session started${newSession.operatorName ? ` by ${newSession.operatorName}` : ''}`)
    logDebug('Session started', 'info', 'session', { id: newSession.id, operatorId: newSession.operatorId, sessionNumber: newSession.sessionNumber })
  }, [createSession, setSession, setAllSessions, setSelectedSessionId, setScreen])

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

    // Snapshot photo URLs NOW (at soft-delete time) so the 60s timer never
    // operates on a stale closure. Items can be added to queue/scanHistory
    // during the undo window; snapshot stays consistent with the decision point.
    const snapshotItems = [
      ...(queue || []).filter(i => i.sessionId === sessionId),
      ...(scanHistory || []).filter(i => i.sessionId === sessionId),
    ]
    const snapshotUrls = new Set<string>()
    for (const item of snapshotItems) {
      if (item.ebayListingId) continue
      for (const url of item.photoUrls || []) snapshotUrls.add(url)
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
    // Hard-delete after 60s if not restored — use snapshotted URLs to avoid stale closure
    setTimeout(() => {
      setAllSessions((prev) => {
        const sess = (prev || []).find(s => s.id === sessionId)
        if (!sess?.deletedAt) return prev || []
        // Delete Supabase photos using the snapshot captured at soft-delete time
        if (supabaseService && snapshotUrls.size > 0) {
          void supabaseService.deletePhotos(Array.from(snapshotUrls))
        }
        // Remove items from KV stores
        setQueue(qPrev => (qPrev || []).filter(i => i.sessionId !== sessionId))
        setScanHistory(hPrev => (hPrev || []).filter(i => i.sessionId !== sessionId))
        return (prev || []).filter(s => s.id !== sessionId)
      })
    }, 60000)
  }, [session, setSession, setAllSessions, queue, scanHistory, supabaseService, setQueue, setScanHistory])

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
    // Sync userProfile to global key so all devices share operator identity
    if (updates.userProfile) {
      setGlobalProfile(updates.userProfile)
    }
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
  }, [setSettings, setGlobalProfile, setTheme, toggleAmbientLight])

  const generateSku = useCallback((): string => {
    const next = (hrboSkuCounter || 0) + 1
    setHrboSkuCounter(next)
    return `HRBO-${String(next).padStart(3, '0')}`
  }, [hrboSkuCounter, setHrboSkuCounter])

  const handleOptimizeItem = useCallback(async (itemId: string) => {
    // Read fresh queue via ref to avoid stale closure when agent pipeline
    // chains batch-analyze → optimize (items that just flipped PENDING→BUY)
    const item = (queueRef.current || []).find(i => i.id === itemId)
    if (!item || item.decision !== 'BUY') return
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

  // ── WO-RSP-010: ListingBuilder navigation ────────────────────────────────
  // Open the in-app ListingBuilder for a queue item. This replaces the old
  // one-click "Push to Notion" and "Push to eBay" buttons — the new flow is
  // RSP → ListingBuilder gate → eBay → Notion (mirrored after eBay success).
  const handleOpenListingBuilder = useCallback((itemId: string) => {
    setListingBuilderItemId(itemId)
    setListingBuilderAutoGate(false)
    setListingBuilderMode('browse')
    setScreen('listing-builder')
  }, [])

  // Quick-list path: opens ListingBuilder with gate drawer pre-opened
  const handleListItem = useCallback((itemId: string) => {
    setListingBuilderItemId(itemId)
    setListingBuilderAutoGate(true)
    setListingBuilderMode('list')
    setScreen('listing-builder')
  }, [])

  // Called by ListingBuilder.onPushed after a successful eBay push.
  const handleListingPushed = useCallback((
    itemId: string,
    listingId: string,
    listingUrl: string,
    notionPageId: string,
  ) => {
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId
        ? { ...i, ebayListingId: listingId, notionPageId: notionPageId || i.notionPageId, listingStatus: 'published', publishedDate: Date.now() }
        : i
    ))
    setScreen('queue')
    toast.success(`eBay listing live: ${listingId}`, {
      action: { label: 'Open', onClick: () => window.open(listingUrl, '_blank', 'noopener,noreferrer') },
    })
    logActivity('Pushed to eBay ✓')
  }, [setQueue])

  // Batch photo uploader for ListingBuilder — wraps supabaseService so the
  // screen doesn't need to reach into settings or build its own client.
  const handleUploadPhotos = useCallback(async (photos: string[], sku: string): Promise<string[]> => {
    if (!supabaseService) return []
    const results = await Promise.allSettled(
      photos.map((data, i) => supabaseService.uploadPhoto(data, sku, `${sku}-0${i + 1}.jpg`))
    )
    return results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && !!r.value)
      .map(r => r.value)
  }, [supabaseService])

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

    const { imageData: _img, imageOptimized: _opt, photos: _photos, ...lightweight } = currentItem!
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
    // Reset cameraMode first so a stale 'add-photo' (from a cancelled camera session) doesn't
    // route this re-analyze into the add-photo handler and create a duplicate image.
    setCameraMode('new-scan')
    handleCapture(
      imageToUse,
      currentItem.purchasePrice,
      undefined,                       // barcodeProduct — not applicable on re-analyze
      currentItem.condition || 'New',  // preserve condition so Gemini re-prices with the same anchor
      currentItem,                     // existingItem → pipeline updates in place, scan history entry replaced
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

  // Merges barcode/QR lookup data into the current item during research phase.
  // Called by CameraOverlay when a barcode is scanned while `isAddPhotoMode === true`.
  // Fill-if-empty strategy — preserves richer AI-generated data, fills gaps from UPC lookup.
  // Full BarcodeProduct is always stored at marketData.barcodeProduct (same pattern as
  // new-scan flow at line ~701; Notion service reads from here for the UPC/EAN field).
  const handleMergeBarcodeIntoCurrentItem = useCallback((product: BarcodeProduct) => {
    if (!currentItem) return
    setCurrentItem(prev => {
      if (!prev) return prev
      return {
        ...prev,
        productName: prev.productName && prev.productName !== 'Unknown Product'
          ? prev.productName
          : product.title || prev.productName,
        description: prev.description && prev.description !== 'Product analysis unavailable'
          ? prev.description
          : product.description || prev.description,
        category: prev.category && prev.category !== 'General'
          ? prev.category
          : product.category || prev.category,
        marketData: {
          ...prev.marketData,
          barcodeProduct: product,
        },
      }
    })
    toast.success(`Barcode data added: ${product.title || product.barcode}`)
  }, [currentItem])

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
    const { imageData: _img, imageOptimized: _opt, photos: _photos, ...lightweight } = currentItem!
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
    // ── Photo Manager intercept ───────────────────────────────────────────────
    // Extract full photos BEFORE clearing currentItem so Photo Manager can display them.
    // currentItem is NOT cleared here — Back button from Photo Manager restores scan result.
    // The queue add + optimization run in handlePhotoManagerDone after the user taps Done.
    // existingUrls: use photoUrls if item was previously saved (e.g. reopened from scans).
    // localPhotos: base64 from this capture session (stripped on first save, so may be empty on reopen).
    const _pmExistingUrls = currentItem!.photoUrls || []
    const _pmLocalPhotos = [currentItem!.imageData, ...(currentItem!.additionalImageData || [])].filter(Boolean) as string[]
    setPendingPhotoDecision({
      item: listingItem,
      existingUrls: _pmExistingUrls,
      localPhotos: _pmLocalPhotos,
      decision: 'BUY',
    })
    setScreen('photo-manager')
  }, [currentItem, setPendingPhotoDecision, settings])

  const handlePassFromScan = useCallback((price: number, notes: string) => {
    if (!currentItem?.imageData && !currentItem?.imageThumbnail) {
      toast.error('No image to save')
      return
    }
    // Strip heavy blobs — keep thumbnail for scan history display
    const { imageData: _img, imageOptimized: _opt, photos: _photos, ...lightweight } = currentItem!
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
    // Increment passCount at the confirmed user-decision moment (not at AI-recommendation time)
    setSession(prev => prev ? { ...prev, passCount: prev.passCount + 1 } : prev)
    setCurrentItem(undefined)
    setPipeline([])
    setScreen('session')
    logActivity('Passed — logged to scan history')
  }, [currentItem, setScanHistory, setSession, settings, setScreen])

  const handleMaybeFromScan = useCallback((price: number, notes: string) => {
    if (!currentItem?.imageData && !currentItem?.imageThumbnail) {
      toast.error('No image to save')
      return
    }
    const { imageData: _img, imageOptimized: _opt, photos: _photos, ...lightweight } = currentItem!
    const effectivePrice = Number.isFinite(price) && price >= 0 ? price : currentItem!.purchasePrice
    // MAYBE items live in the working queue AND scan-history.
    // Queue lets the user reopen/edit the card indefinitely.
    // Scan-history is the permanent session record — it survives queue deletion
    // because handleRemoveFromQueue only touches setQueue, never setScanHistory.
    const maybeItem: ScannedItem = {
      ...lightweight,
      purchasePrice: effectivePrice,
      notes: notes || currentItem!.notes,
      inQueue: true,
      decision: 'MAYBE',
    }
    // ── Photo Manager intercept ───────────────────────────────────────────────
    // Extract full photos BEFORE clearing currentItem — Photo Manager needs them for display.
    // currentItem is NOT cleared here — Back button from Photo Manager restores scan result.
    // existingUrls: use photoUrls if item was previously saved (e.g. reopened from scans).
    // localPhotos: base64 from this capture session (stripped on first save, so may be empty on reopen).
    const _pmExistingUrlsMaybe = currentItem!.photoUrls || []
    const _pmLocalPhotos = [currentItem!.imageData, ...(currentItem!.additionalImageData || [])].filter(Boolean) as string[]
    setPendingPhotoDecision({
      item: maybeItem,
      existingUrls: _pmExistingUrlsMaybe,
      localPhotos: _pmLocalPhotos,
      decision: 'MAYBE',
    })
    setScreen('photo-manager')
  }, [currentItem, setPendingPhotoDecision, setScreen])

  // ── Photo Manager: Done ───────────────────────────────────────────────────────
  // Called by PhotoManager when the user taps Done.
  // Correction 1: existingUrls pass through unchanged; only localPhotos get uploaded.
  // Correction 2: dependency array is fully explicit (no `...` placeholder).
  const handlePhotoManagerDone = useCallback(async (
    existingUrls: string[],
    localPhotos: string[],
    primaryIndex: number,
  ) => {
    if (!pendingPhotoDecision) return
    const { item, decision, returnScreen } = pendingPhotoDecision

    // Upload new local photos only — existing URLs are already on Supabase
    let newlyUploadedUrls: string[] = []
    if (supabaseService && localPhotos.length > 0) {
      // Guarantee a SKU exists — generate one if missing so upload is never silently skipped
      let sku = item.tags?.find(t => t.startsWith('HRBO-'))
      if (!sku) {
        sku = generateSku()
        // Patch the item so the generated SKU is persisted with it
        pendingPhotoDecision.item = { ...pendingPhotoDecision.item, tags: [...(item.tags || []), sku] }
      }
      const startIndex = existingUrls.length  // offset filenames past existing photos
      const results = await Promise.allSettled(
        localPhotos.map((photo, i) =>
          supabaseService.uploadPhoto(photo, sku!, `${sku}-0${startIndex + i + 1}.jpg`)
        )
      )
      newlyUploadedUrls = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => (r as PromiseFulfilledResult<string>).value)
      const failedCount = localPhotos.length - newlyUploadedUrls.length
      if (failedCount > 0) {
        toast.warning(`📷 ${failedCount} photo${failedCount > 1 ? 's' : ''} failed to upload — item saved.`)
      }
    }

    const finalPhotoUrls = [...existingUrls, ...newlyUploadedUrls]
    // Use pendingPhotoDecision.item (may have been patched with generated SKU above)
    const latestItem = pendingPhotoDecision.item
    const finalItem: ScannedItem = {
      ...latestItem,
      primaryPhotoIndex: primaryIndex,
      ...(finalPhotoUrls.length > 0 && { photoUrls: finalPhotoUrls }),
    }

    // Clear pending state + currentItem (now safe since user confirmed Done)
    setPendingPhotoDecision(null)
    setCurrentItem(undefined)
    setPipeline([])

    if (decision === 'BUY') {
      setQueue(prev => {
        const current = prev || []
        if (current.some(i => i.id === finalItem.id)) return current.map(i => i.id === finalItem.id ? finalItem : i)
        return [...current, finalItem]
      })
      // Keep in scan history as permanent ledger — update decision, don't remove
      setScanHistory(prev => {
        const existing = prev || []
        const idx = existing.findIndex(i => i.id === finalItem.id)
        if (idx !== -1) {
          return existing.map((item, j) => j === idx ? { ...item, decision: 'BUY' as const, inQueue: true } : item)
        }
        return existing
      })
      // buyCount++ here (confirmed moment), not in handlePromoteToBuy (Photo Manager may be cancelled)
      setSession(prev => prev ? { ...prev, buyCount: prev.buyCount + 1 } : prev)
      setScreen('queue')
      toast('✅ Added to Listings — check Queue', { action: { label: 'Go to Queue', onClick: () => setScreen('queue') } })
      logActivity('Added to queue — photos saved')
      // Run optimization after navigating so user sees the queue immediately
      if (listingOptimizationService) {
        try {
          const optimized = await listingOptimizationService.generateOptimizedListing({
            item: finalItem,
            marketData: finalItem.marketData,
          })
          const mergedTags = Array.from(new Set([
            ...(finalItem.tags || []),
            ...(optimized.suggestedTags || []),
          ]))
          setQueue(prev => (prev || []).map(i =>
            i.id === finalItem.id
              ? { ...i, tags: mergedTags, optimizedListing: { ...optimized, optimizedAt: Date.now() }, listingStatus: 'ready' }
              : i
          ))
          logActivity('Listing optimized')
        } catch {
          toast.error('Optimization failed — item saved, edit manually in Queue')
        }
      }
    } else if (decision === 'MAYBE') {
      setQueue(prev => {
        const current = prev || []
        if (current.some(i => i.id === finalItem.id)) return current.map(i => i.id === finalItem.id ? finalItem : i)
        return [...current, finalItem]
      })
      setScanHistory(prev => {
        const existing = prev || []
        const idx = existing.findIndex(i => i.id === finalItem.id)
        if (idx !== -1) return existing.map((i, j) => j === idx ? finalItem : i)
        return [finalItem, ...existing.slice(0, 499)]
      })
      setAgentActiveTab('scans')
      setScreen('agent')
      toast('Saved to Scan Queue — tap to continue researching')
      logActivity('Saved for later research — added to queue')
    } else {
      // edit mode — item already in queue/history, just update with new photoUrls
      setQueue(prev => (prev || []).map(i => i.id === finalItem.id ? { ...i, photoUrls: finalItem.photoUrls, primaryPhotoIndex: finalItem.primaryPhotoIndex } : i))
      setScreen(returnScreen || 'queue')
      toast('✅ Photos updated')
    }
  }, [
    pendingPhotoDecision,
    supabaseService,
    listingOptimizationService,
    setQueue,
    setScanHistory,
    setSession,
    setScreen,
    setAgentActiveTab,
    setPendingPhotoDecision,
    setCurrentItem,
    setPipeline,
  ])

  // ── Photo Manager: Back ───────────────────────────────────────────────────────
  // Back from Photo Manager in BUY/MAYBE mode restores the scan result
  // (currentItem is still set — we intentionally did not clear it on intercept).
  // Back from edit mode returns to the originating screen.
  const handlePhotoManagerBack = useCallback(() => {
    const returnTo = pendingPhotoDecision?.returnScreen
    setPendingPhotoDecision(null)
    setScreen(returnTo || 'scan-result')
  }, [pendingPhotoDecision, setPendingPhotoDecision, setScreen])

  // ── Photo Manager: open listing camera overlay ───────────────────────────────
  const handleListingCameraOpen = useCallback((_currentPrimaryIndex: number) => {
    if (!pendingPhotoDecision) return
    setCameraMode('listing-photo')
    setCameraOpen(true)
  }, [pendingPhotoDecision])

  // Stable ref for PhotoManager useEffect — inline arrows would re-trigger on every App render
  const handleCapturedPhotoConsumed = useCallback(() => {
    setPendingPhotoDecision(prev =>
      prev ? { ...prev, capturedPhoto: undefined } : prev
    )
  }, [])

  // ── Photo Manager: open from item (Entry Points B & C) ───────────────────────
  const handleOpenPhotoManager = useCallback((item: ScannedItem, fromScreen: Screen) => {
    // Edit mode: existing photoUrls are remote URLs (pass through); no local photos yet
    setPendingPhotoDecision({
      item,
      existingUrls: item.photoUrls || (item.imageThumbnail ? [item.imageThumbnail] : []),
      localPhotos: [],
      decision: 'edit',
      returnScreen: fromScreen,
    })
    setScreen('photo-manager')
  }, [setPendingPhotoDecision, setScreen])

  // ── PASS Restore ──────────────────────────────────────────────────────────────
  const handleRestorePassItem = useCallback((item: ScannedItem) => {
    // 1. Update scanHistoryKV: PASS → MAYBE
    setScanHistory(prev => (prev || []).map(i =>
      i.id === item.id ? { ...i, decision: 'MAYBE' as const, inQueue: true } : i
    ))
    // 2. Re-add to working queue with full saved state
    const restoredItem: ScannedItem = { ...item, decision: 'MAYBE', inQueue: true }
    setQueue(prev => {
      const current = prev || []
      if (current.some(i => i.id === restoredItem.id)) return current.map(i => i.id === restoredItem.id ? restoredItem : i)
      return [...current, restoredItem]
    })
    // 3. Navigate to agent/scans tab
    setAgentActiveTab('scans')
    setScreen('agent')
    // 4. Adjust session counter — passCount down (maybeCount is computed as itemsScanned - buyCount - passCount)
    setSession(prev => prev ? { ...prev, passCount: Math.max(0, prev.passCount - 1) } : prev)
    // 5. Toast
    toast('Item restored to scan pile as MAYBE')
    logActivity(`${item.productName || 'Item'} restored from PASS → MAYBE`)
  }, [setScanHistory, setQueue, setAgentActiveTab, setScreen, setSession])

  // ── Listing Queue: Re-scan — return a BUY item to the scan pile for re-research ──
  // Preserves ALL enrichment data (AI analysis, market comps, photos, optimized listing).
  // Only resets decision to MAYBE and clears listingStatus. Not available once pushed to eBay.
  const handleReScanItem = useCallback((itemId: string) => {
    // Update item in queue: BUY → MAYBE, clear listing pipeline state, preserve all data
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId
        ? { ...i, decision: 'MAYBE' as const, listingStatus: undefined }
        : i
    ))
    // Mirror in scan history
    setScanHistory(prev => (prev || []).map(i =>
      i.id === itemId
        ? { ...i, decision: 'MAYBE' as const, inQueue: true }
        : i
    ))
    // Adjust session counter
    setSession(prev => prev ? { ...prev, buyCount: Math.max(0, prev.buyCount - 1) } : prev)
    // Navigate to scan pile
    setAgentActiveTab('scans')
    setScreen('agent')
    toast('Returned to scan pile — tap to review or BUY again')
    logActivity('Item returned to scan pile for re-research')
  }, [setQueue, setScanHistory, setSession, setAgentActiveTab, setScreen])

  // ── Agent screen: Promote scan card → BUY (via Photo Manager) ─────────────
  const handlePromoteToBuy = useCallback((item: ScannedItem) => {
    // After KV persistence, imageData/additionalImageData are stripped.
    // Use photoUrls (Supabase) as the source of truth; fall back to in-memory base64 only if still present.
    const existingUrls = item.photoUrls || []
    const localPhotos = [item.imageData, ...(item.additionalImageData || [])].filter(Boolean) as string[]
    // If no remote URLs and no local base64, show thumbnail as display-only fallback
    const displayFallback = existingUrls.length === 0 && localPhotos.length === 0 && item.imageThumbnail
      ? [item.imageThumbnail]
      : []
    setPendingPhotoDecision({
      item: { ...item, decision: 'BUY' as const, inQueue: true },
      existingUrls: existingUrls.length > 0 ? existingUrls : displayFallback,
      localPhotos,
      decision: 'BUY',
    })
    setScreen('photo-manager')
    // buyCount++ moved to handlePhotoManagerDone BUY branch (confirmed moment)
  }, [setPendingPhotoDecision, setScreen])

  // ── Agent screen: PASS scan card ──────────────────────────────────────────
  const handlePassFromAgent = useCallback((item: ScannedItem) => {
    const { imageData: _img, imageOptimized: _opt, photos: _photos, ...lightweight } = item
    const passItem: ScannedItem = { ...lightweight, decision: 'PASS', inQueue: false }
    setScanHistory(prev => {
      const existing = prev || []
      const idx = existing.findIndex(i => i.id === passItem.id)
      if (idx !== -1) return existing.map((i, j) => j === idx ? passItem : i)
      return [passItem, ...existing.slice(0, 499)]
    })
    setQueue(prev => (prev || []).filter(i => i.id !== item.id))
    setSession(prev => prev ? { ...prev, passCount: prev.passCount + 1 } : prev)
    toast('Passed — logged to scan history')
    logActivity(`${item.productName || 'Item'} passed from scan pile`)
  }, [setScanHistory, setQueue, setSession])

  // ── Scan-history bulk delete (Scan History screen — selected + clear all) ──
  // Cascades to Supabase photos for any deleted item EXCEPT those with a live
  // eBay listing (ebayListingId). If `ids` is omitted, clears the entire
  // scan-history KV.
  const handleScanHistoryDelete = useCallback((ids?: string[]) => {
    const idSet = ids ? new Set(ids) : null
    const targets = (scanHistory || []).filter(i => !idSet || idSet.has(i.id))
    const urlsToDelete = new Set<string>()
    for (const item of targets) {
      if (item.ebayListingId) continue
      for (const url of item.photoUrls || []) urlsToDelete.add(url)
    }
    if (supabaseService && urlsToDelete.size > 0) {
      void supabaseService.deletePhotos(Array.from(urlsToDelete))
    }
    setScanHistory(prev => idSet ? (prev || []).filter(i => !idSet.has(i.id)) : [])
  }, [scanHistory, supabaseService, setScanHistory])

  // ── Agent screen: Permanently delete scan card ────────────────────────────
  // Cascades to Supabase photo storage, but leaves photos intact if the item
  // has a live eBay listing (ebayListingId) — buyers on eBay.com would see
  // broken images otherwise.
  const handleDeleteFromAgent = useCallback((itemId: string) => {
    const item =
      (queue || []).find(i => i.id === itemId) ||
      (scanHistory || []).find(i => i.id === itemId)
    if (item && !item.ebayListingId && item.photoUrls?.length && supabaseService) {
      void supabaseService.deletePhotos(item.photoUrls)
    }
    setQueue(prev => (prev || []).filter(i => i.id !== itemId))
    setScanHistory(prev => (prev || []).filter(i => i.id !== itemId))
    toast('Permanently removed')
  }, [queue, scanHistory, supabaseService, setQueue, setScanHistory])

  // ── Agent screen: View in Queue ───────────────────────────────────────────
  const [highlightQueueItemId, setHighlightQueueItemId] = useState<string | null>(null)
  const handleViewInQueue = useCallback((itemId: string) => {
    setHighlightQueueItemId(itemId)
    setScreen('queue')
  }, [setScreen])

  const handleQuickDraft = useCallback(async (imageData: string, price: number, barcodeProduct?: BarcodeProduct, condition?: string) => {
    const optimized = await optimizeAndCache(imageData)

    // Same auto-session guard as handleCapture — every item must be session-scoped
    let activeSession = session
    if (!activeSession?.active) {
      activeSession = createSession()
      setAllSessions(prev => [...(prev || []), activeSession!])
      setSession(activeSession)
      setSelectedSessionId(activeSession.id)
    }

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
      sessionId: activeSession?.id,
      condition: condition || 'New',   // carry condition into the queue so batch-analyze prices it correctly
      marketData: barcodeProduct ? { barcodeProduct } : undefined,
    }

    setQueue((prev) => [...(prev || []), draftItem])

    // Write PENDING placeholder to scan history — ensures ledger is complete even if batch analysis never runs
    setScanHistory(prev => [draftItem, ...(prev || []).slice(0, 499)])

    if (activeSession?.active) {
      setSession((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          itemsScanned: prev.itemsScanned + 1,
        }
      })
    }
  }, [session, setSession, setQueue, setScanHistory, optimizeAndCache, createSession, setAllSessions, setSelectedSessionId])



  const handleEditQueueItem = useCallback((itemId: string, updates: Partial<ScannedItem>) => {
    setQueue((prev) => {
      const currentQueue = prev || []
      return currentQueue.map(item => item.id === itemId ? { ...item, ...updates } : item)
    })
    const { listingStatus } = updates
    if (listingStatus && listingStatus !== 'not-started' && listingStatus !== 'optimizing') {
      const item = queue?.find(i => i.id === itemId)
      if (item?.notionPageId && notionService) {
        notionService.updateListingStatus(item.notionPageId, { status: listingStatus }).catch(e => console.warn('Notion sync failed:', e))
      }
    }
  }, [setQueue, queue, notionService])

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
            visionResult = await geminiService.analyzeProductImage(item.imageData, { condition: item.condition || 'New' }, item.purchasePrice)
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

    // Move PASS items out of queue → scan-history only (they don't belong in either active container)
    const passItemIds = new Set<string>()
    for (const [id, item] of updatedItemsMap) {
      if (item.decision === 'PASS') passItemIds.add(id)
    }
    if (passItemIds.size > 0) {
      setScanHistory(prev => (prev || []).map(i => {
        const updated = updatedItemsMap.get(i.id)
        return updated && updated.decision === 'PASS'
          ? { ...i, ...updated, inQueue: false }
          : i
      }))
      setQueue(prev => (prev || []).filter(i => !passItemIds.has(i.id)))
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
  }, [queue, setQueue, setScanHistory, settings, session, setSession, geminiService, googleLensService, ebayService])

  const handleUpdateCurrentItem = useCallback((itemId: string, updates: Partial<ScannedItem>) => {
    if (!itemId) return
    // Guard by explicit item id so a stale in-flight result never overwrites a different item
    setCurrentItem(prev => prev?.id === itemId ? { ...prev, ...updates } : prev)
    setQueue(prev => (prev || []).map(i =>
      i.id === itemId ? { ...i, ...updates } : i
    ))
  }, [setQueue])

  const handleReanalyzeItem = useCallback(async (itemId: string) => {
    // Search queue first; fall back to scanHistory for items that have left the queue
    // (e.g. agent dispatch on a scan-history-only PASS item — silently no-op before this fix)
    const item =
      (queue || []).find(i => i.id === itemId) ||
      (scanHistory || []).find(i => i.id === itemId)
    if (!item) return

    // Resolve a base64 image source Gemini can consume.
    // Preference order:
    //   1. imageData — in-memory base64 (only present pre-KV-persistence)
    //   2. photoUrls[primary] — durable Supabase URL, fetched + converted to data URL
    //   3. imageThumbnail — small base64 survives KV persistence; low-res fallback
    let imageSource: string | undefined = item.imageData
    if (!imageSource && item.photoUrls && item.photoUrls.length > 0) {
      const idx = item.primaryPhotoIndex ?? 0
      const url = item.photoUrls[idx] ?? item.photoUrls[0]
      const fetchToast = toast.loading('Fetching photo…')
      try {
        imageSource = await urlToDataUrl(url)
      } catch (err) {
        console.warn('[re-analyze] urlToDataUrl failed for', url, err)
        toast.dismiss(fetchToast)
        toast.error('Could not fetch photo — re-scan with camera instead')
        return
      }
      toast.dismiss(fetchToast)
    }
    if (!imageSource) imageSource = item.imageThumbnail
    if (!imageSource) {
      // No image anywhere — park on scan-result so the user sees the item and can re-scan
      setCurrentItem(item)
      setPipeline([])
      setScreen('scan-result')
      toast('No image available — re-scan with camera to re-analyze', { duration: 3000 })
      return
    }

    // Navigate to scan-result and run pipeline in-place.
    // Passing `item` as existingItem makes handleCapture:
    //   - preserve id, sessionId, photoUrls, primaryPhotoIndex, tags, productName
    //   - reset decision → PENDING and listingStatus → undefined
    //   - mirror the refreshed research into scan history AND queue in-place
    setCurrentItem(undefined)
    setPipeline([])
    setScreen('scan-result')
    try {
      await handleCapture(imageSource, item.purchasePrice, undefined, item.condition || 'New', item)
    } catch {
      // handleCapture surfaces its own toast; item stays in queue so no data is lost
    }
  }, [queue, scanHistory, setCurrentItem, setPipeline, setScreen, handleCapture])

  // Alias for agent tool dispatch — delegates to the existing reanalyze logic
  const handleRerunPipeline = handleReanalyzeItem

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

  // Launch always lands on SessionScreen (session cards + Start New Session CTA).
  // Users can tap Resume on an active session card to continue — no auto-redirect.

  // One-time settings migration: copy global → device-scoped on first load
  const [legacySettings] = useKV<AppSettings | undefined>('settings', undefined)
  const hasMigratedRef = useRef(false)
  useEffect(() => {
    if (hasMigratedRef.current) return
    // Migrate if any meaningful legacy setting exists and the device slot is still empty.
    // Checking only geminiApiKey misses users whose legacy settings had Notion keys,
    // thresholds, or a user profile but no Gemini key.
    const hasLegacy = !!(legacySettings?.geminiApiKey || legacySettings?.notionApiKey || legacySettings?.userProfile)
    const hasDevice = !!(settings?.geminiApiKey || settings?.notionApiKey || settings?.userProfile)
    if (hasLegacy && !hasDevice) {
      hasMigratedRef.current = true
      setSettings((prev: AppSettings) => ({ ...prev, ...legacySettings }))
      logDebug('Settings auto-migrated from global to device scope', 'info', 'migration')
    }
  }, [legacySettings, settings]) // eslint-disable-line react-hooks/exhaustive-deps

  // Backfill global profile from device settings if device has a profile but global doesn't.
  // This runs once per device load — ensures existing users' profiles propagate globally.
  const hasBackfilledProfileRef = useRef(false)
  useEffect(() => {
    if (hasBackfilledProfileRef.current) return
    if (settings?.userProfile && !globalProfile) {
      hasBackfilledProfileRef.current = true
      setGlobalProfile(settings.userProfile)
      logDebug('User profile backfilled to global key from device settings', 'info', 'migration')
    }
  }, [settings, globalProfile, setGlobalProfile]) // eslint-disable-line react-hooks/exhaustive-deps

  // One-time backfill: assign sessionId to orphaned items that were created during a
  // session's time window but didn't get tagged (pre-PR#115 race condition).
  const hasBackfilledSessionIdsRef = useRef(false)
  useEffect(() => {
    if (hasBackfilledSessionIdsRef.current) return
    const sessions = allSessions || []
    if (sessions.length === 0) return
    hasBackfilledSessionIdsRef.current = true

    const assignSession = (item: ScannedItem): ScannedItem => {
      if (item.sessionId) return item
      // Find session whose time window contains this item's timestamp
      const match = sessions.find(s => {
        const end = s.endTime || Date.now()
        return item.timestamp >= s.startTime && item.timestamp <= end
      })
      return match ? { ...item, sessionId: match.id } : item
    }

    const currentQueue = queue || []
    const currentHistory = scanHistory || []
    const fixedQueue = currentQueue.map(assignSession)
    const fixedHistory = currentHistory.map(assignSession)
    const queueChanged = fixedQueue.some((item, i) => item !== currentQueue[i])
    const historyChanged = fixedHistory.some((item, i) => item !== currentHistory[i])
    if (queueChanged) setQueue(fixedQueue)
    if (historyChanged) setScanHistory(fixedHistory)
    if (queueChanged || historyChanged) {
      logDebug('Backfilled sessionId on orphaned items', 'info', 'migration')
    }
  }, [allSessions, queue, scanHistory]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Track the last non-settings screen so the settings back button always
  // returns to where the user came from, regardless of the navigation path.
  useEffect(() => {
    if (screen !== 'settings') {
      settingsReturnScreen.current = screen
    }
  }, [screen])

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
        onNavigateToSettings={() => setScreen('settings')}
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
                  setPipeline(buildCompletedPipeline())
                  setOpenedFromScans(true)
                  setScreen('scan-result')
                }}
                onPromoteToBuy={handlePromoteToBuy}
                onPassItem={handlePassFromAgent}
                onDeleteItem={handleDeleteFromAgent}
                onRestorePassItem={handleRestorePassItem}
                onViewInQueue={handleViewInQueue}
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
                onOpenListingBuilder={handleOpenListingBuilder}
                onListItem={handleListItem}
                highlightItemId={highlightQueueItemId}
                onHighlightClear={() => setHighlightQueueItemId(null)}
                onReScanItem={handleReScanItem}
              />
            </motion.div>
          )}
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
                onBack={() => setScreen(secondaryReturnScreen.current)}
                queueItems={queue || []}
                scanHistory={scanHistory || []}
                sessionId={secondaryReturnScreen.current === 'session-detail' ? selectedSessionId ?? undefined : undefined}
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
                onBack={() => setScreen(secondaryReturnScreen.current)}
                onSaveAsDraft={(item) => {
                  setQueue(prev => {
                    const current = prev || []
                    if (current.some(i => i.id === item.id)) return current
                    return [...current, { ...item, inQueue: true }]
                  })
                }}
                sessionId={secondaryReturnScreen.current === 'session-detail' ? selectedSessionId ?? undefined : undefined}
                scanHistory={secondaryReturnScreen.current === 'session-detail' ? scanHistory || [] : undefined}
                onDeleteItems={handleScanHistoryDelete}
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
                currentOperatorId={settings?.userProfile?.operatorId}
                onRestoreItem={handleRestorePassItem}
                onOpenPhotoManager={(item) => handleOpenPhotoManager(item, 'session-detail')}
              />
            </motion.div>
          )}
          {screen === 'photo-manager' && pendingPhotoDecision && (
            <motion.div
              key="photo-manager"
              custom={slideDir.current}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0"
            >
              <PhotoManager
                initialExistingUrls={pendingPhotoDecision.existingUrls}
                initialLocalPhotos={pendingPhotoDecision.localPhotos}
                initialPrimaryIndex={pendingPhotoDecision.item.primaryPhotoIndex ?? 0}
                itemName={pendingPhotoDecision.item.productName}
                sku={pendingPhotoDecision.item.tags?.find(t => t.startsWith('HRBO-'))}
                mode={
                  pendingPhotoDecision.decision === 'BUY' ? 'buy' :
                  pendingPhotoDecision.decision === 'MAYBE' ? 'maybe' : 'edit'
                }
                onDone={handlePhotoManagerDone}
                onBack={handlePhotoManagerBack}
                onAddViaCamera={handleListingCameraOpen}
                capturedPhoto={pendingPhotoDecision.capturedPhoto}
                onCapturedPhotoConsumed={handleCapturedPhotoConsumed}
              />
            </motion.div>
          )}

          {screen === 'listing-builder' && listingBuilderItemId && (() => {
            const lbItem = (queue || []).find(i => i.id === listingBuilderItemId)
            if (!lbItem) return null
            return (
              <motion.div
                key="listing-builder"
                custom={slideDir.current}
                variants={screenVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ willChange: 'opacity, transform' }}
                className="absolute inset-0"
              >
                <ListingBuilder
                  item={lbItem}
                  initialListing={lbItem.optimizedListing}
                  settings={settings}
                  onBack={() => { setScreen('queue'); setListingBuilderAutoGate(false); setListingBuilderMode('browse') }}
                  onPushed={handleListingPushed}
                  onEditPhotos={(item) => handleOpenPhotoManager(item, 'listing-builder' as Screen)}
                  onUploadPhotos={handleUploadPhotos}
                  onOptimize={handleOptimizeItem}
                  initialGateOpen={listingBuilderAutoGate}
                  mode={listingBuilderMode}
                />
              </motion.div>
            )
          })()}
        </AnimatePresence>
      </div>

      {/* Spacer exactly matches BottomNav height: h-[52px] grid + max(safe-area-inset-bottom, 4px) */}
      <div className="flex-shrink-0" style={{ height: 'max(56px, calc(52px + env(safe-area-inset-bottom, 0px)))' }} />

      <BottomNav
        currentScreen={screen}
        onNavigate={(s) => {
          // Session tab while a session is active → go straight to the session dashboard
          if (s === 'session' && session?.active) {
            setSelectedSessionId(session.id)
            setScreen('session-detail')
          } else {
            setScreen(s)
          }
        }}
        onCameraOpen={() => {
          // Already reviewing a scan result — the camera should append to that item,
          // not kick off a brand-new pipeline that replaces the user's current context.
          if (screen === 'scan-result' && currentItem) {
            openCameraForAddPhoto()
            return
          }
          // If no session is open, auto-start one so the scan is always session-scoped.
          // handleStartSession sets the KV session and navigates to session-detail;
          // the camera overlay opens on top of it so the first scan lands in the new session.
          if (!session?.active) {
            handleStartSession()
          }
          setCameraOpen(true)
        }}
        captureState={captureState}
        sessionMode={!session?.active}
      />

      <CameraOverlay
        isOpen={cameraOpen}
        onClose={() => { setCameraOpen(false); setCameraMode('new-scan') }}
        onCapture={handleCapture}
        onQuickDraft={handleQuickDraft}
        onBarcodeForCurrentItem={handleMergeBarcodeIntoCurrentItem}
        isAddPhotoMode={cameraMode === 'add-photo'}
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