import { useState, useCallback, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { Toaster, toast } from 'sonner'
import { BottomNav } from './components/BottomNav'
import { CameraOverlay } from './components/CameraOverlay'
import { AIScreen } from './components/screens/AIScreen'
import { SessionScreen } from './components/screens/SessionScreen'
import { QueueScreen } from './components/screens/QueueScreen'
import { SettingsScreen } from './components/screens/SettingsScreen'
import { createEbayService } from './lib/ebay-service'
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
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockProductName = 'Vintage Leather Jacket'
      setPipeline(prev => prev.map((s, i) => 
        i === 0 ? { ...s, status: 'complete', data: `Product identified: ${mockProductName}` } : s
      ))
      
      await new Promise(resolve => setTimeout(resolve, 500))
      setPipeline(prev => prev.map((s, i) => 
        i === 0 ? s : i === 1 ? { ...s, status: 'processing' } : s
      ))
      
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
          const categoryId = await ebayService.getCategoryId(mockProductName)
          const searchResults = await ebayService.searchCompletedListings(mockProductName, categoryId)
          
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
        productName: mockProductName,
        description: 'Classic brown leather jacket, excellent condition',
        category: 'Clothing & Accessories',
        estimatedSellPrice: sellPrice,
        profitMargin: profitMetrics.profitMargin,
        decision,
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
  }, [settings, session, setSession, ebayService])

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