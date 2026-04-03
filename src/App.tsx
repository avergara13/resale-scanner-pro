import { useState, useCallback, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { Toaster, toast } from 'sonner'
import { BottomNav } from './components/BottomNav'
import { CameraOverlay } from './components/CameraOverlay'
import { AIScreen } from './components/screens/AIScreen'
import { SessionScreen } from './components/screens/SessionScreen'
import { ResearchScreen } from './components/screens/ResearchScreen'
import { QueueScreen } from './components/screens/QueueScreen'
import { SettingsScreen } from './components/screens/SettingsScreen'
import { createEbayService } from './lib/ebay-service'
import { createGeminiService } from './lib/gemini-service'
import { createGoogleLensService } from './lib/google-lens-service'
import type { GeminiVisionResponse } from './lib/gemini-service'
import type { GoogleLensAnalysis } from './lib/google-lens-service'
import type { Screen, ScannedItem, PipelineStep, Session, AppSettings } from './types'

function App() {
  const [screen, setScreen] = useState<Screen>('ai')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [currentItem, setCurrentItem] = useState<ScannedItem | undefined>()
  const [pipeline, setPipeline] = useState<PipelineStep[]>([])
  
  const [queue, setQueue] = useKV<ScannedItem[]>('queue', [])
  const [session, setSession] = useKV<Session | undefined>('currentSession', undefined)
  const [settings, setSettings] = useKV<AppSettings>('settings', {
    voiceEnabled: true,
    autoCapture: true,
    agenticMode: true,
    liveSearchEnabled: true,
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

  const handleCapture = useCallback(async (imageData: string, price: number) => {
    setCameraOpen(false)
    
    const newItem: ScannedItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      imageData,
      purchasePrice: price,
      decision: 'PENDING',
      inQueue: false,
    }
    setCurrentItem(newItem)
    setScreen('ai')
    
    const steps: PipelineStep[] = [
      { id: 'vision', label: 'Vision Analysis', status: 'processing' },
      { id: 'lens', label: 'Google Lens', status: 'pending' },
      { id: 'market', label: 'Market Research', status: 'pending' },
      { id: 'profit', label: 'Profit Calculation', status: 'pending' },
      { id: 'decision', label: 'Decision', status: 'pending' },
    ]
    setPipeline(steps)
    
    try {
      let visionResult: GeminiVisionResponse | undefined
      let mockProductName = 'Unknown Product'
      
      if (geminiService) {
        try {
          visionResult = await geminiService.analyzeProductImage(imageData, {}, price)
          mockProductName = visionResult.productName
          
          setPipeline(prev => prev.map((s, i) => 
            i === 0 ? { 
              ...s, 
              status: 'complete', 
              data: `${visionResult?.productName || mockProductName} - ${visionResult?.brand || 'Generic'} (${visionResult ? Math.round(visionResult.confidence * 100) : 0}% confident)` 
            } : s
          ))
        } catch (error) {
          console.error('Gemini vision failed:', error)
          setPipeline(prev => prev.map((s, i) => 
            i === 0 ? { 
              ...s, 
              status: 'complete', 
              data: 'Vision analysis unavailable - configure Gemini API key in Settings' 
            } : s
          ))
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000))
        setPipeline(prev => prev.map((s, i) => 
          i === 0 ? { 
            ...s, 
            status: 'complete', 
            data: 'Configure Gemini API key in Settings for real vision analysis' 
          } : s
        ))
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      setPipeline(prev => prev.map((s, i) => 
        i === 0 ? s : i === 1 ? { ...s, status: 'processing' } : s
      ))
      
      let lensAnalysis: GoogleLensAnalysis | undefined
      
      if (googleLensService) {
        try {
          lensAnalysis = await googleLensService.searchByImage(imageData, visionResult?.productName || mockProductName)
          
          const resultCount = lensAnalysis.results.length
          const priceInfo = lensAnalysis.priceRange 
            ? `$${lensAnalysis.priceRange.min.toFixed(2)}-$${lensAnalysis.priceRange.max.toFixed(2)}` 
            : 'No prices'
          
          setPipeline(prev => prev.map((s, i) => 
            i === 1 ? { 
              ...s, 
              status: 'complete',
              data: `Found ${resultCount} matches. Range: ${priceInfo}`
            } : s
          ))
        } catch (error) {
          console.error('Google Lens failed:', error)
          setPipeline(prev => prev.map((s, i) => 
            i === 1 ? { 
              ...s, 
              status: 'complete',
              data: 'Configure Google API key in Settings for real Lens search'
            } : s
          ))
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000))
        setPipeline(prev => prev.map((s, i) => 
          i === 1 ? { 
            ...s, 
            status: 'complete',
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
        i <= 1 ? s : i === 2 ? { ...s, status: 'processing' } : s
      ))
      
      let marketData: typeof newItem.marketData = undefined
      let ebayAvgPrice = price * 4.5
      
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
          
          setPipeline(prev => prev.map((s, i) => 
            i === 2 ? { 
              ...s, 
              status: 'complete', 
              data: `Found ${searchResults.soldCount} sold, ${searchResults.activeCount} active. Avg: $${searchResults.averageSoldPrice.toFixed(2)}` 
            } : s
          ))
        } catch (error) {
          console.error('eBay API error:', error)
          setPipeline(prev => prev.map((s, i) => 
            i === 2 ? { 
              ...s, 
              status: 'complete', 
              data: 'Using estimated pricing (eBay API unavailable)' 
            } : s
          ))
        }
      } else {
        setPipeline(prev => prev.map((s, i) => 
          i === 2 ? { 
            ...s, 
            status: 'complete', 
            data: 'Configure eBay API in Settings for real market data' 
          } : s
        ))
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      setPipeline(prev => prev.map((s, i) => 
        i <= 2 ? s : i === 3 ? { ...s, status: 'processing' } : s
      ))
      
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
      
      setPipeline(prev => prev.map((s, i) => 
        i === 3 ? { 
          ...s, 
          status: 'complete',
          data: `Margin: ${profitMetrics.profitMargin.toFixed(1)}%, ROI: ${profitMetrics.roi.toFixed(0)}%`
        } : s
      ))
      
      await new Promise(resolve => setTimeout(resolve, 500))
      setPipeline(prev => prev.map(s => ({ ...s, status: 'complete' })))
      
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
      setSession({ ...session, endTime: Date.now(), active: false })
      toast.success('Session ended')
    }
  }, [session, setSession])

  const handleUpdateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const defaults: AppSettings = {
        voiceEnabled: true,
        autoCapture: true,
        agenticMode: true,
        liveSearchEnabled: true,
        minProfitMargin: 30,
        defaultShippingCost: 5.0,
        ebayFeePercent: 12.9,
        paypalFeePercent: 3.49,
        preferredAiModel: 'gemini-2.0-flash-exp',
      }
      return { ...(prev || defaults), ...updates }
    })
  }, [setSettings])

  return (
    <div id="app-container" className="relative">
      {screen === 'session' && (
        <SessionScreen
          session={session}
          onStartSession={handleStartSession}
          onEndSession={handleEndSession}
        />
      )}
      {screen === 'research' && (
        <ResearchScreen />
      )}
      {screen === 'ai' && (
        <AIScreen
          currentItem={currentItem}
          pipeline={pipeline}
          onAddToQueue={handleAddToQueue}
          onDeepSearch={() => toast.info('Deep search feature coming soon')}
        />
      )}
      {screen === 'queue' && (
        <QueueScreen
          queueItems={queue || []}
          onRemove={handleRemoveFromQueue}
          onCreateListing={() => toast.info('Listing creation coming soon')}
        />
      )}
      {screen === 'settings' && settings && (
        <SettingsScreen
          settings={settings}
          onUpdate={handleUpdateSettings}
        />
      )}

      <div style={{ height: '80px' }} />

      <BottomNav
        currentScreen={screen}
        onNavigate={setScreen}
        onCameraOpen={() => setCameraOpen(true)}
      />

      <CameraOverlay
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
      />

      <Toaster position="top-center" richColors />
    </div>
  )
}

export default App