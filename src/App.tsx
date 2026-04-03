import { useState, useCallback, useMemo, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Toaster, toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { BottomNav } from './components/BottomNav'
import { CameraOverlay } from './components/CameraOverlay'
import { ConnectionHealthMonitor } from './components/ConnectionHealthMonitor'
import { BatchAnalysisProgress } from './components/BatchAnalysisProgress'
import { AIScreen } from './components/screens/AIScreen'
import { SessionScreen } from './components/screens/SessionScreen'
import { AgentScreen } from './components/screens/AgentScreen'
import { IncidentsScreen } from './components/screens/IncidentsScreen'
import { QueueScreen } from './components/screens/QueueScreen'
import { SettingsScreen } from './components/screens/SettingsScreen'
import { TagAnalyticsScreen } from './components/screens/TagAnalyticsScreen'
import { LocationInsightsScreen } from './components/screens/LocationInsightsScreen'
import { createEbayService } from './lib/ebay-service'
import { createGeminiService } from './lib/gemini-service'
import { createGoogleLensService } from './lib/google-lens-service'
import { createObjectDetectionService } from './lib/object-detection-service'
import { createTagSuggestionService } from './lib/tag-suggestion-service'
import { useCaptureState } from './hooks/use-capture-state'
import { useTheme } from './hooks/use-theme'
import type { GeminiVisionResponse } from './lib/gemini-service'
import type { GoogleLensAnalysis } from './lib/google-lens-service'
import type { Screen, ScannedItem, PipelineStep, Session, AppSettings, ItemTag, ThriftStoreLocation } from './types'
import { cn } from './lib/utils'

function App() {
  const [screen, setScreen] = useState<Screen>('agent')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [currentItem, setCurrentItem] = useState<ScannedItem | undefined>()
  const [pipeline, setPipeline] = useState<PipelineStep[]>([])
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentItemName: '' })
  
  const { captureState, triggerCapture, startAnalyzing, triggerSuccess, triggerFail, reset } = useCaptureState()
  const { theme, themeMode, setTheme, useAmbientLight, toggleAmbientLight } = useTheme()
  
  const [queue, setQueue] = useKV<ScannedItem[]>('queue', [])
  const [session, setSession] = useKV<Session | undefined>('currentSession', undefined)
  const [allSessions, setAllSessions] = useKV<Session[]>('all-sessions', [])
  const [allTags, setAllTags] = useKV<ItemTag[]>('all-tags', [])
  const [settings, setSettings] = useKV<AppSettings>('settings', {
    voiceEnabled: true,
    autoCapture: true,
    agenticMode: true,
    liveSearchEnabled: true,
    darkMode: false,
    minProfitMargin: 30,
    defaultShippingCost: 5.0,
    ebayFeePercent: 12.9,
    paypalFeePercent: 3.49,
    preferredAiModel: 'gemini-2.0-flash-exp',
  })

  const ebayService = useMemo(() => {
    return createEbayService(
      settings?.ebayAppId,
      settings?.ebayDevId,
      settings?.ebayCertId,
      settings?.ebayApiKey
    )
  }, [settings?.ebayAppId, settings?.ebayDevId, settings?.ebayCertId, settings?.ebayApiKey])

  const geminiService = useMemo(() => {
    return createGeminiService(
      settings?.geminiApiKey,
      settings?.preferredAiModel
    )
  }, [settings?.geminiApiKey, settings?.preferredAiModel])

  const googleLensService = useMemo(() => {
    return createGoogleLensService(
      settings?.googleApiKey,
      settings?.googleSearchEngineId
    )
  }, [settings?.googleApiKey, settings?.googleSearchEngineId])

  const objectDetectionService = useMemo(() => {
    return createObjectDetectionService(
      settings?.geminiApiKey,
      settings?.preferredAiModel
    )
  }, [settings?.geminiApiKey, settings?.preferredAiModel])

  const tagSuggestionService = useMemo(() => createTagSuggestionService(), [])

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

  const handleCapture = useCallback(async (imageData: string, price: number, location?: ThriftStoreLocation) => {
    triggerCapture()
    setCameraOpen(false)
    
    const newItem: ScannedItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      imageData,
      purchasePrice: price,
      decision: 'PENDING',
      inQueue: false,
      location,
    }
    setCurrentItem(newItem)
    setScreen('ai')
    
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
      let mockProductName = 'Unknown Product'
      
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
      
      simulateProgress(1, 2500)
      
      if (googleLensService) {
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
              data: `Found ${resultCount} matches. Range: ${priceInfo}`
            } : s
          ))
        } catch (error) {
          console.error('Google Lens failed:', error)
          completeStep(1)
          await new Promise(resolve => setTimeout(resolve, 100))
          setPipeline(prev => prev.map((s, i) => 
            i === 1 ? { 
              ...s, 
              data: 'Configure Google API key in Settings for real Lens search'
            } : s
          ))
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000))
        completeStep(1)
        await new Promise(resolve => setTimeout(resolve, 100))
        setPipeline(prev => prev.map((s, i) => 
          i === 1 ? { 
            ...s, 
            data: 'Configure Google API key in Settings for Lens visual search'
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
      let ebayAvgPrice = price * 4.5
      
      simulateProgress(2, 3800)
      
      if (ebayService) {
        try {
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
          
          ebayAvgPrice = searchResults.recommendedPrice > 0 ? searchResults.recommendedPrice : ebayAvgPrice
          
          completeStep(2)
          await new Promise(resolve => setTimeout(resolve, 100))
          setPipeline(prev => prev.map((s, i) => 
            i === 2 ? { 
              ...s, 
              data: `Found ${searchResults.soldCount} sold, ${searchResults.activeCount} active. Avg: $${searchResults.averageSoldPrice.toFixed(2)}` 
            } : s
          ))
        } catch (error) {
          console.error('eBay API error:', error)
          completeStep(2)
          await new Promise(resolve => setTimeout(resolve, 100))
          setPipeline(prev => prev.map((s, i) => 
            i === 2 ? { 
              ...s, 
              data: 'Using estimated pricing (eBay API unavailable)' 
            } : s
          ))
        }
      } else {
        completeStep(2)
        await new Promise(resolve => setTimeout(resolve, 100))
        setPipeline(prev => prev.map((s, i) => 
          i === 2 ? { 
            ...s, 
            data: 'Configure eBay API in Settings for real market data' 
          } : s
        ))
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
      ) || {
        netProfit: sellPrice - price,
        profitMargin: ((sellPrice - price) / sellPrice) * 100,
        roi: ((sellPrice - price) / price) * 100,
      }
      
      const minMargin = settings?.minProfitMargin || 30
      const decision = profitMetrics.profitMargin > minMargin ? 'GO' : 'PASS'
      
      if (decision === 'GO') {
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
        productName: visionResult?.productName || mockProductName,
        description: visionResult?.description || 'Product analysis unavailable',
        category: visionResult?.category || 'General',
        estimatedSellPrice: sellPrice,
        profitMargin: profitMetrics.profitMargin,
        decision,
        lensAnalysis,
        lensResults: lensAnalysis?.results,
        marketData,
      }
      
      const tagSuggestions = tagSuggestionService.suggestTags(updatedItem)
      const autoTags = tagSuggestions.slice(0, 5).map(s => s.tag.id)
      updatedItem.tags = autoTags
      
      setCurrentItem(updatedItem)
      
      if (session?.active) {
        setSession((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            itemsScanned: prev.itemsScanned + 1,
            goCount: decision === 'GO' ? prev.goCount + 1 : prev.goCount,
            passCount: decision === 'PASS' ? prev.passCount + 1 : prev.passCount,
            totalPotentialProfit: decision === 'GO' ? prev.totalPotentialProfit + profitMetrics.netProfit : prev.totalPotentialProfit,
          }
        })
      }
      
      toast.success(decision === 'GO' ? '✅ GO Decision!' : '❌ PASS Decision')
    } catch (error) {
      console.error('Pipeline error:', error)
      setPipeline(prev => prev.map(s => ({ 
        ...s, 
        status: s.status === 'processing' ? 'error' : s.status,
        error: 'Analysis failed'
      })))
      toast.error('Analysis failed. Please try again.')
    }
  }, [settings, session, setSession, ebayService, geminiService, googleLensService])

  const handleAddToQueue = useCallback(() => {
    if (currentItem && currentItem.decision === 'GO') {
      setQueue((prev) => [...(prev || []), { ...currentItem, inQueue: true }])
      toast.success('Added to queue')
    }
  }, [currentItem, setQueue])

  const handleRemoveFromQueue = useCallback((id: string) => {
    setQueue((prev) => (prev || []).filter(item => item.id !== id))
    toast.success('Removed from queue')
  }, [setQueue])

  const handleStartSession = useCallback(() => {
    const newSession: Session = {
      id: Date.now().toString(),
      startTime: Date.now(),
      itemsScanned: 0,
      goCount: 0,
      passCount: 0,
      totalPotentialProfit: 0,
      active: true,
    }
    setSession(newSession)
    toast.success('Session started')
  }, [setSession])

  const handleEndSession = useCallback(() => {
    if (session) {
      const endedSession = { ...session, endTime: Date.now(), active: false }
      setSession(endedSession)
      setAllSessions((prev) => [...(prev || []), endedSession])
      toast.success('Session ended')
    }
  }, [session, setSession, setAllSessions])

  const handleUpdateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const defaults: AppSettings = {
        voiceEnabled: true,
        autoCapture: true,
        agenticMode: true,
        liveSearchEnabled: true,
        darkMode: false,
        minProfitMargin: 30,
        defaultShippingCost: 5.0,
        ebayFeePercent: 12.9,
        paypalFeePercent: 3.49,
        preferredAiModel: 'gemini-2.0-flash-exp',
      }
      const newSettings = { ...(prev || defaults), ...updates }
      
      if ('themeMode' in updates && updates.themeMode !== undefined) {
        setTheme(updates.themeMode)
      }
      
      if ('useAmbientLight' in updates && updates.useAmbientLight !== undefined) {
        toggleAmbientLight()
      }
      
      if ('darkMode' in updates && updates.darkMode !== undefined && !('themeMode' in updates)) {
        setTheme(updates.darkMode ? 'dark' : 'light')
      }
      
      return newSettings
    })
  }, [setSettings, setTheme, toggleAmbientLight])

  const handleSaveDraft = useCallback((price: number, notes: string) => {
    if (!currentItem?.imageData) {
      toast.error('No image to save')
      return
    }

    const draftItem: ScannedItem = {
      ...currentItem,
      purchasePrice: price > 0 ? price : currentItem.purchasePrice,
      notes: notes || currentItem.notes,
      inQueue: true,
    }

    setQueue((prev) => [...(prev || []), draftItem])
    toast.success('Draft saved to queue')
    setScreen('queue')
  }, [currentItem, setQueue])

  const handleQuickDraft = useCallback((imageData: string, price: number, location?: ThriftStoreLocation) => {
    const draftItem: ScannedItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      imageData,
      purchasePrice: price,
      decision: 'PENDING',
      inQueue: true,
      productName: 'Quick Draft',
      description: 'Captured in quick draft mode - analyze later',
      location,
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
  }, [session, setSession, setQueue])

  const handleMultiCapture = useCallback((products: import('@/types').DetectedProduct[], baseImageData: string, totalPrice: number, location?: ThriftStoreLocation) => {
    const timestamp = Date.now()
    const parentId = `multi-${timestamp}`
    
    products.forEach((product, index) => {
      const itemPrice = totalPrice / products.length
      
      const multiItem: ScannedItem = {
        id: `${parentId}-${index}`,
        timestamp: timestamp + index,
        imageData: product.croppedImageData,
        purchasePrice: itemPrice,
        productName: product.name,
        description: `Part of multi-item capture (${index + 1} of ${products.length})`,
        decision: 'PENDING',
        inQueue: true,
        isMultiProduct: true,
        parentItemId: parentId,
        detectedProducts: [product],
        location,
      }
      
      setQueue((prev) => [...(prev || []), multiItem])
    })

    if (session?.active) {
      setSession((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          itemsScanned: prev.itemsScanned + products.length,
        }
      })
    }

    toast.success(`Added ${products.length} items to queue`)
    setScreen('queue')
  }, [session, setSession, setQueue])

  const handleEditQueueItem = useCallback((itemId: string, updates: Partial<ScannedItem>) => {
    setQueue((prev) => {
      const currentQueue = prev || []
      return currentQueue.map(item => item.id === itemId ? { ...item, ...updates } : item)
    })
  }, [setQueue])

  const handleBatchAnalyze = useCallback(async () => {
    const unanalyzedItems = (queue || []).filter(item => !item.productName || item.productName === 'Quick Draft')
    
    if (unanalyzedItems.length === 0) {
      toast.info('No quick drafts to analyze')
      return
    }

    setIsBatchAnalyzing(true)
    setBatchProgress({ current: 0, total: unanalyzedItems.length, currentItemName: '' })
    toast.info(`Analyzing ${unanalyzedItems.length} item${unanalyzedItems.length !== 1 ? 's' : ''}...`)

    let processedCount = 0
    let goCount = 0
    let passCount = 0

    for (const item of unanalyzedItems) {
      setBatchProgress({ current: processedCount + 1, total: unanalyzedItems.length, currentItemName: `Item ${processedCount + 1}` })
      
      try {
        let visionResult: GeminiVisionResponse | undefined
        let mockProductName = 'Unknown Product'
        
        if (geminiService) {
          try {
            visionResult = await geminiService.analyzeProductImage(item.imageData!, {}, item.purchasePrice)
            mockProductName = visionResult.productName
            setBatchProgress({ current: processedCount + 1, total: unanalyzedItems.length, currentItemName: visionResult.productName })
          } catch (error) {
            console.error('Gemini vision failed for item:', item.id, error)
          }
        }

        let lensAnalysis: GoogleLensAnalysis | undefined
        
        if (googleLensService && visionResult) {
          try {
            lensAnalysis = await googleLensService.searchByImage(item.imageData!, visionResult.productName)
          } catch (error) {
            console.error('Google Lens failed for item:', item.id, error)
          }
        }

        let marketData: typeof item.marketData = undefined
        let ebayAvgPrice = item.purchasePrice * 4.5
        
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
            
            ebayAvgPrice = searchResults.recommendedPrice > 0 ? searchResults.recommendedPrice : ebayAvgPrice
          } catch (error) {
            console.error('eBay API error for item:', item.id, error)
          }
        }

        const sellPrice = ebayAvgPrice
        const profitMetrics = ebayService?.calculateProfitMetrics(
          item.purchasePrice,
          sellPrice,
          settings?.defaultShippingCost || 5.0,
          settings?.ebayFeePercent || 12.9,
          settings?.paypalFeePercent || 3.49
        ) || {
          netProfit: sellPrice - item.purchasePrice,
          profitMargin: ((sellPrice - item.purchasePrice) / sellPrice) * 100,
          roi: ((sellPrice - item.purchasePrice) / item.purchasePrice) * 100,
        }
        
        const minMargin = settings?.minProfitMargin || 30
        const decision = profitMetrics.profitMargin > minMargin ? 'GO' : 'PASS'

        const updatedItem: ScannedItem = {
          ...item,
          productName: visionResult?.productName || mockProductName,
          description: visionResult?.description || 'Product analysis completed',
          category: visionResult?.category || 'General',
          estimatedSellPrice: sellPrice,
          profitMargin: profitMetrics.profitMargin,
          decision,
          lensAnalysis,
          lensResults: lensAnalysis?.results,
          marketData,
        }

        setQueue((prev) => {
          const currentQueue = prev || []
          return currentQueue.map(qItem => qItem.id === item.id ? updatedItem : qItem)
        })

        processedCount++
        if (decision === 'GO') goCount++
        if (decision === 'PASS') passCount++

        if (session?.active) {
          setSession((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              goCount: decision === 'GO' ? prev.goCount + 1 : prev.goCount,
              passCount: decision === 'PASS' ? prev.passCount + 1 : prev.passCount,
              totalPotentialProfit: decision === 'GO' ? prev.totalPotentialProfit + profitMetrics.netProfit : prev.totalPotentialProfit,
            }
          })
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('Failed to analyze item:', item.id, error)
      }
    }

    setIsBatchAnalyzing(false)
    setBatchProgress({ current: 0, total: 0, currentItemName: '' })
    toast.success(`Analyzed ${processedCount} items: ${goCount} GO, ${passCount} PASS`)
  }, [queue, setQueue, settings, session, setSession, geminiService, googleLensService, ebayService])

  useEffect(() => {
    if (!cameraOpen) {
      reset()
    }
  }, [cameraOpen, reset])

  useEffect(() => {
    if (settings) {
      if (settings.themeMode) {
        setTheme(settings.themeMode)
      } else if (settings.darkMode !== undefined) {
        setTheme(settings.darkMode ? 'dark' : 'light')
      }
    }
  }, [settings?.themeMode, settings?.darkMode, setTheme])

  const screenVariants = {
    initial: (direction: number) => ({
      opacity: 0,
      x: direction > 0 ? 60 : -60,
      scale: 0.96,
      filter: 'blur(4px)'
    }),
    animate: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: 'blur(0px)'
    },
    exit: (direction: number) => ({
      opacity: 0,
      x: direction > 0 ? -60 : 60,
      scale: 0.96,
      filter: 'blur(4px)'
    })
  }

  const screenOrder: Record<Screen, number> = {
    'session': 0,
    'agent': 1,
    'ai': 2,
    'queue': 3,
    'incidents': 4,
    'settings': 5,
    'listing': 6,
    'chat': 7,
    'history': 8,
    'tag-analytics': 9,
    'location-insights': 10
  }

  const [prevScreen, setPrevScreen] = useState<Screen>(screen)
  const direction = screenOrder[screen] - screenOrder[prevScreen]

  useEffect(() => {
    setPrevScreen(screen)
  }, [screen])

  return (
    <div 
      id="app-container" 
      className={cn(
        "relative transition-colors duration-300 flex flex-col min-h-screen w-full max-w-[480px] mx-auto",
        captureState === 'capturing' && "capture-flash",
        captureState === 'analyzing' && "analyzing-flash",
        captureState === 'success' && "success-flash",
        captureState === 'fail' && "fail-flash"
      )}
    >
      <ConnectionHealthMonitor settings={settings} enabled={true} notifyOnChange={true} />
      
      <div className="flex-1 relative w-full" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <AnimatePresence mode="wait" custom={direction}>
          {screen === 'session' && (
            <motion.div
              key="session"
              custom={direction}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="w-full h-full"
            >
              <SessionScreen
                session={session}
                onStartSession={handleStartSession}
                onEndSession={handleEndSession}
              />
            </motion.div>
          )}
          {screen === 'agent' && (
            <motion.div
              key="agent"
              custom={direction}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="w-full h-full"
            >
              <AgentScreen
                queueItems={queue || []}
                settings={settings}
                onNavigateToQueue={() => setScreen('queue')}
              />
            </motion.div>
          )}
          {screen === 'incidents' && (
            <motion.div
              key="incidents"
              custom={direction}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="w-full h-full"
            >
              <IncidentsScreen settings={settings} />
            </motion.div>
          )}
          {screen === 'ai' && (
            <motion.div
              key="ai"
              custom={direction}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="w-full h-full"
            >
              <AIScreen
                currentItem={currentItem}
                pipeline={pipeline}
                settings={settings}
                onAddToQueue={handleAddToQueue}
                onDeepSearch={() => toast.info('Deep search feature coming soon')}
                onSaveDraft={handleSaveDraft}
              />
            </motion.div>
          )}
          {screen === 'queue' && (
            <motion.div
              key="queue"
              custom={direction}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="w-full h-full"
            >
              <QueueScreen
                queueItems={queue || []}
                onRemove={handleRemoveFromQueue}
                onCreateListing={() => toast.info('Listing creation coming soon')}
                onEdit={handleEditQueueItem}
                onBatchAnalyze={handleBatchAnalyze}
                isBatchAnalyzing={isBatchAnalyzing}
                geminiService={geminiService}
                onNavigateToTagAnalytics={() => setScreen('tag-analytics')}
                onNavigateToLocationInsights={() => setScreen('location-insights')}
              />
            </motion.div>
          )}
          {screen === 'settings' && settings && (
            <motion.div
              key="settings"
              custom={direction}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="w-full h-full"
            >
              <SettingsScreen
                settings={settings}
                onUpdate={handleUpdateSettings}
              />
            </motion.div>
          )}
          {screen === 'tag-analytics' && (
            <motion.div
              key="tag-analytics"
              custom={direction}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
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
              custom={direction}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="w-full h-full"
            >
              <LocationInsightsScreen
                items={queue || []}
                onBack={() => setScreen('queue')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-[80px] flex-shrink-0" />

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
        onMultiCapture={handleMultiCapture}
        objectDetectionService={objectDetectionService}
      />

      {isBatchAnalyzing && (
        <BatchAnalysisProgress
          current={batchProgress.current}
          total={batchProgress.total}
          currentItemName={batchProgress.currentItemName}
        />
      )}

      <Toaster position="top-center" richColors />
    </div>
  )
}

export default App