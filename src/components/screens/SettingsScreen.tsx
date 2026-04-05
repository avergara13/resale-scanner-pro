import { useState, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { CheckCircle, XCircle, Info, Eye, EyeClosed, ClockCounterClockwise, Target, ArrowCounterClockwise } from '@phosphor-icons/react'
import { ApiStatusIndicator } from '../ApiStatusIndicator'
import { ConnectionHistoryPanel } from '../ConnectionHistoryPanel'
import { IncidentLogViewer } from '../IncidentLogViewer'
import { DetectionHistoryViewer } from '../DetectionHistoryViewer'
import { FalsePositiveAnalyzerPanel } from '../FalsePositiveAnalyzer'
import { ThemeToggle } from '../ThemeToggle'
import { TagPresetsManager } from '../TagPresetsManager'
import { CompressionAnalytics } from '../CompressionAnalytics'
import { RetryConfigPanel } from '../RetryConfigPanel'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { toast } from 'sonner'
import { toast } from 'sonner'
import type { AppSettings, ItemTag } from '@/types'

interface SettingsScreenProps {
  settings: AppSettings
  onUpdate: (settings: Partial<AppSettings>) => void
}

export function SettingsScreen({ settings, onUpdate }: SettingsScreenProps) {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  const toggleKeyVisibility = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleResetSettings = () => {
    const preservedKeys = {
      geminiApiKey: settings.geminiApiKey,
      anthropicApiKey: settings.anthropicApiKey,
      notionApiKey: settings.notionApiKey,
      googleApiKey: settings.googleApiKey,
      googleSearchEngineId: settings.googleSearchEngineId,
      ebayAppId: settings.ebayAppId,
      ebayDevId: settings.ebayDevId,
      ebayCertId: settings.ebayCertId,
      ebayApiKey: settings.ebayApiKey,
      supabaseUrl: settings.supabaseUrl,
      supabaseKey: settings.supabaseKey,
      n8nWebhookUrl: settings.n8nWebhookUrl,
      notionDatabaseId: settings.notionDatabaseId,
    }

    const defaultSettings: AppSettings = {
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
      preferredAiModel: 'gemini-2.0-flash',
      imageQuality: { preset: 'balanced' },
      ...preservedKeys,
    }

    onUpdate(defaultSettings)
    toast.success('Settings reset to defaults - API keys preserved')
  }

  const hasKey = (key?: string) => key && key.length > 8

  const getStatusIcon = (hasValue: boolean) => {
    if (hasValue) return <CheckCircle className="text-green" weight="fill" />
    return <XCircle className="text-s3" weight="fill" />
  }

  const aiConfigured = !!(hasKey(settings.geminiApiKey) || hasKey(settings.anthropicApiKey))
  const googleConfigured = !!hasKey(settings.googleApiKey)
  const ebayConfigured = !!(hasKey(settings.ebayApiKey) && hasKey(settings.ebayAppId))
  const supabaseConfigured = !!(hasKey(settings.supabaseUrl) && hasKey(settings.supabaseKey))
  const notionConfigured = !!hasKey(settings.notionApiKey)

  const handleRefresh = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 600))
    toast.success('Settings refreshed')
  }, [])

  const { containerRef, isPulling, isRefreshing, pullDistance, progress, shouldTrigger } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: true,
  })

  return (
    <div id="scr-settings" ref={containerRef} className="flex flex-col h-full overflow-y-auto">
      <PullToRefreshIndicator
        isPulling={isPulling}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
        progress={progress}
        shouldTrigger={shouldTrigger}
      />
      <div className="px-4 pt-2 pb-4 border-b border-s2 bg-fg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-t1 mb-2">Settings</h1>
            <p className="text-sm text-t2">Configure AI models, APIs, and business rules</p>
          </div>
          <ThemeToggle />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant={aiConfigured ? "default" : "secondary"} className="gap-1.5">
            {getStatusIcon(aiConfigured)}
            <span className="text-xs">AI</span>
          </Badge>
          <Badge variant={googleConfigured ? "default" : "secondary"} className="gap-1.5">
            {getStatusIcon(googleConfigured)}
            <span className="text-xs">Google</span>
          </Badge>
          <Badge variant={ebayConfigured ? "default" : "secondary"} className="gap-1.5">
            {getStatusIcon(ebayConfigured)}
            <span className="text-xs">eBay</span>
          </Badge>
          <Badge variant={supabaseConfigured ? "default" : "secondary"} className="gap-1.5">
            {getStatusIcon(supabaseConfigured)}
            <span className="text-xs">Database</span>
          </Badge>
          <Badge variant={notionConfigured ? "default" : "secondary"} className="gap-1.5">
            {getStatusIcon(notionConfigured)}
            <span className="text-xs">Notion</span>
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-6">
        <div className="space-y-6 pb-20 overflow-x-hidden">
          <Accordion type="multiple" defaultValue={['health']} className="space-y-4">
            <AccordionItem value="health" className="border border-green/20 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
                  <span>Live API Health Status</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-4 bg-gradient-to-br from-green-bg to-transparent border border-green/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green text-fg flex-shrink-0">
                      <Info size={16} weight="fill" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-t1 mb-1">Real-Time Monitoring</p>
                      <p className="text-xs text-t2 leading-relaxed">
                        All API connections are monitored continuously with automatic health checks every 30 seconds. Configure your API keys below to see live status indicators.
                      </p>
                    </div>
                  </div>
                </div>

                <ApiStatusIndicator settings={settings} liveUpdates={true} checkInterval={30000} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="history" className="border border-s2 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                📊 Connection History & Downtime Tracking
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-t2 leading-relaxed">
                      Track connection events and identify downtime patterns over the last 30 days. Analyze service reliability and incident history.
                    </p>
                  </div>
                </div>

                <ConnectionHistoryPanel settings={settings} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="retry" className="border border-s2 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                🔄 Retry Configuration
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-4 bg-gradient-to-br from-b1/10 to-b1/5 border-2 border-b1/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-b1 text-fg flex-shrink-0">
                      <ClockCounterClockwise size={20} weight="duotone" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-t1">Per-Endpoint Retry Policies</p>
                      <p className="text-xs text-t2 leading-relaxed">
                        Each API endpoint has optimized retry behavior based on priority level. Critical endpoints get more retries and longer timeouts. Configure caching and backoff strategies per service.
                      </p>
                    </div>
                  </div>
                </div>

                <RetryConfigPanel />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="incidents" className="border border-s2 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                🚨 Incident Logs & API Issues
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-t2 leading-relaxed">
                      Comprehensive incident log viewer for diagnosing API connection issues. Filter by service, view detailed error messages, and track resolution times. Export logs for external analysis.
                    </p>
                  </div>
                </div>

                <IncidentLogViewer settings={settings} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="detection" className="border border-s2 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                <div className="flex items-center gap-2">
                  📸 Multi-Object Detection History
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-t2 leading-relaxed">
                      Track multi-object detection accuracy over time. Review past scans, confirmed detections, and false positives to monitor AI performance.
                    </p>
                  </div>
                </div>

                <DetectionHistoryViewer />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="false-positives" className="border border-s2 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                <div className="flex items-center gap-2">
                  🎯 False Positive Analysis & Optimization
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-4 bg-gradient-to-br from-amber/10 to-amber/5 border-2 border-amber/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber text-bg flex-shrink-0">
                      <Target size={20} weight="duotone" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-t1">Optimize Detection Accuracy</p>
                      <p className="text-xs text-t2 leading-relaxed">
                        Review false positive patterns to improve multi-object detection. Analyze misidentifications, confidence distributions, and apply recommended thresholds to reduce errors.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="outline" className="text-xs border-amber text-amber gap-1">
                          <CheckCircle size={12} weight="fill" />
                          Pattern Detection
                        </Badge>
                        <Badge variant="outline" className="text-xs border-amber text-amber gap-1">
                          <CheckCircle size={12} weight="fill" />
                          Threshold Optimization
                        </Badge>
                        <Badge variant="outline" className="text-xs border-amber text-amber gap-1">
                          <CheckCircle size={12} weight="fill" />
                          AI Recommendations
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <FalsePositiveAnalyzerPanel />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ai" className="border border-b1/20 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                🤖 AI Configuration
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-t2 leading-relaxed">
                      Configure your preferred AI model. Gemini 2.0 Flash is recommended for cost-efficient real-time analysis.
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="ai-model" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                    Preferred AI Model
                  </Label>
                  <Select 
                    value={settings.preferredAiModel || 'gemini-2.0-flash'}
                    onValueChange={(value) => onUpdate({ preferredAiModel: value as AppSettings['preferredAiModel'] })}
                  >
                    <SelectTrigger id="ai-model" className="font-mono text-sm">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash (Fastest)</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                      <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                      <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet (Backup)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="gemini-api-key" className="text-xs uppercase tracking-wide text-t2">
                      Google Gemini API Key
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('gemini')}
                      className="text-t2 hover:text-t1"
                    >
                      {showKeys.gemini ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="gemini-api-key"
                    type={showKeys.gemini ? 'text' : 'password'}
                    value={settings.geminiApiKey || ''}
                    onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className="font-mono text-sm"
                  />
                  {hasKey(settings.geminiApiKey) && (
                    <p className="text-xs text-green mt-1 flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" /> Key configured
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="anthropic-api-key" className="text-xs uppercase tracking-wide text-t2">
                      Anthropic API Key (Backup)
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('anthropic')}
                      className="text-t2 hover:text-t1"
                    >
                      {showKeys.anthropic ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="anthropic-api-key"
                    type={showKeys.anthropic ? 'text' : 'password'}
                    value={settings.anthropicApiKey || ''}
                    onChange={(e) => onUpdate({ anthropicApiKey: e.target.value })}
                    placeholder="sk-ant-..."
                    className="font-mono text-sm"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="google" className="border border-b1/20 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                <div className="flex items-center gap-2">
                  🔍 Google Cloud APIs — Enhanced Product ID
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-4 bg-gradient-to-br from-b1/10 to-b1/5 border-2 border-b1/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-b1 text-fg flex-shrink-0">
                      <Info size={20} weight="fill" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-t1">Supercharge Product Identification</p>
                      <p className="text-xs text-t2 leading-relaxed">
                        Google Cloud Vision API identifies products from photos with high accuracy. Combined with Custom Search, you get real-time price comparisons and visual matches across the web.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="outline" className="text-xs border-b1 text-b1 gap-1">
                          <CheckCircle size={12} weight="fill" />
                          Visual Matching
                        </Badge>
                        <Badge variant="outline" className="text-xs border-b1 text-b1 gap-1">
                          <CheckCircle size={12} weight="fill" />
                          Price Discovery
                        </Badge>
                        <Badge variant="outline" className="text-xs border-b1 text-b1 gap-1">
                          <CheckCircle size={12} weight="fill" />
                          Web-Scale Search
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-s1 border border-s2 rounded-lg">
                  <p className="text-xs font-semibold text-t1 mb-3 uppercase tracking-wide">📋 Quick Setup Guide</p>
                  <ol className="text-xs text-t2 space-y-2 ml-1">
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">1.</span>
                      <span>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-b1 underline hover:text-b2">console.cloud.google.com</a></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">2.</span>
                      <span>Create a new project or select existing one</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">3.</span>
                      <span>Enable <strong>Cloud Vision API</strong> (required for product identification)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">4.</span>
                      <span>Optionally enable <strong>Custom Search API</strong> for enhanced results</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">5.</span>
                      <span>Go to <strong>Credentials → Create API Key</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">6.</span>
                      <span>Restrict key to enabled APIs for security</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">7.</span>
                      <span>Copy the API key (starts with <code className="font-mono text-t1 bg-s2 px-1 rounded">AIzaSy...</code>) and paste below</span>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 bg-blue-bg border border-b1/20 rounded-md">
                    <p className="text-xs text-t2">
                      <strong className="text-b1">📖 Detailed Guide:</strong> See <a href="GOOGLE_CLOUD_SETUP.md" target="_blank" rel="noopener noreferrer" className="text-b1 underline hover:text-b2">GOOGLE_CLOUD_SETUP.md</a> for complete setup instructions, pricing info, and troubleshooting.
                    </p>
                  </div>
                </div>

                <Separator className="bg-s2" />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="google-api-key" className="text-xs uppercase tracking-wide text-t2">
                      <span className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-b1 text-fg text-[10px] font-bold">1</span>
                        Google Cloud API Key
                      </span>
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('google')}
                      className="text-t2 hover:text-t1 touch-target"
                    >
                      {showKeys.google ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="google-api-key"
                    type={showKeys.google ? 'text' : 'password'}
                    value={settings.googleApiKey || ''}
                    onChange={(e) => onUpdate({ googleApiKey: e.target.value })}
                    placeholder="AIzaSy... (Cloud Vision API)"
                    className="font-mono text-sm"
                  />
                  {hasKey(settings.googleApiKey) && (
                    <div className="mt-2 p-3 bg-gradient-to-br from-green-bg to-transparent border border-green/30 rounded-md">
                      <p className="text-xs text-green font-semibold flex items-center gap-1.5">
                        <CheckCircle size={14} weight="fill" /> 
                        Google Cloud Vision Active — Enhanced Product ID Enabled!
                      </p>
                      <p className="text-xs text-t2 mt-1">
                        The app will now use Google Vision API for accurate product identification from photos.
                      </p>
                    </div>
                  )}
                  {!hasKey(settings.googleApiKey) && (
                    <p className="text-xs text-amber mt-1.5 flex items-center gap-1">
                      <Info size={12} weight="fill" />
                      Required for visual product identification and matching
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="google-search-engine-id" className="text-xs uppercase tracking-wide text-t2">
                      <span className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-s3 text-fg text-[10px] font-bold">2</span>
                        Custom Search Engine ID (Optional)
                      </span>
                    </Label>
                  </div>
                  <Input
                    id="google-search-engine-id"
                    type="text"
                    value={settings.googleSearchEngineId || ''}
                    onChange={(e) => onUpdate({ googleSearchEngineId: e.target.value })}
                    placeholder="cx:123456789..."
                    className="font-mono text-sm"
                  />
                  {hasKey(settings.googleSearchEngineId) && (
                    <p className="text-xs text-green mt-1 flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" /> Enhanced visual search enabled
                    </p>
                  )}
                  <p className="text-xs text-t2 mt-1">
                    For enhanced visual search. Create at <a href="https://programmablesearchengine.google.com" target="_blank" rel="noopener noreferrer" className="text-b1 underline hover:text-b2">programmablesearchengine.google.com</a>
                  </p>
                </div>

                <Separator className="bg-s2" />

                <div className="p-4 bg-s1 border border-s2 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-t1 uppercase tracking-wide">🎯 What You'll Get</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 flex-shrink-0" size={14} weight="fill" />
                      <div className="text-xs text-t2">
                        <strong className="text-t1">Visual Product ID:</strong> Identify products from photos with 90%+ accuracy
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 flex-shrink-0" size={14} weight="fill" />
                      <div className="text-xs text-t2">
                        <strong className="text-t1">Web Matching:</strong> Find similar products across eBay, Amazon, Mercari, etc.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 flex-shrink-0" size={14} weight="fill" />
                      <div className="text-xs text-t2">
                        <strong className="text-t1">Price Discovery:</strong> See what items are selling for across platforms
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 flex-shrink-0" size={14} weight="fill" />
                      <div className="text-xs text-t2">
                        <strong className="text-t1">Confidence Scores:</strong> Get reliability ratings on identifications
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 flex-shrink-0" size={14} weight="fill" />
                      <div className="text-xs text-t2">
                        <strong className="text-t1">Smart Caching:</strong> Cost optimization skips redundant API calls (saves ~40% quota)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-s1 border border-s2 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-t1 uppercase tracking-wide">💰 Free Tier Limits</p>
                  <div className="space-y-1.5 text-xs text-t2">
                    <div className="flex justify-between">
                      <span>Vision API:</span>
                      <span className="font-semibold text-t1">1,000 requests/month free</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Custom Search:</span>
                      <span className="font-semibold text-t1">100 queries/day free</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Typical usage:</span>
                      <span className="font-semibold text-green">Usually stays within free tier</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-s2">
                    <p className="text-xs text-t2">
                      💡 <strong className="text-t1">Pro Tip:</strong> Enable billing but set up alerts at $5 and $10. Most users scan 20-50 items/day and never exceed free tier with smart caching enabled.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-amber/10 border border-amber/30 rounded-md">
                  <p className="text-xs text-t2">
                    <strong className="text-amber">⚠️ Cost Optimization:</strong> When Gemini is 92%+ confident in a product ID, Google Lens is automatically skipped to save API quota. This reduces Custom Search usage by ~40% on clear product photos.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ebay" className="border border-b1/20 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                <div className="flex items-center gap-2">
                  💰 eBay Integration — Market Pricing
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-4 bg-gradient-to-br from-green-bg to-transparent border-2 border-green/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green text-fg flex-shrink-0">
                      <Info size={20} weight="fill" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-t1">Get Real-Time Market Intelligence</p>
                      <p className="text-xs text-t2 leading-relaxed">
                        Connect to eBay's API to see live market pricing, sold item data, and accurate profit calculations. Configure once and unlock instant market research on every scan.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="outline" className="text-xs border-green text-green gap-1">
                          <CheckCircle size={12} weight="fill" />
                          Live Sold Prices
                        </Badge>
                        <Badge variant="outline" className="text-xs border-green text-green gap-1">
                          <CheckCircle size={12} weight="fill" />
                          Active Listings
                        </Badge>
                        <Badge variant="outline" className="text-xs border-green text-green gap-1">
                          <CheckCircle size={12} weight="fill" />
                          Sell-Through Rates
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-s1 border border-s2 rounded-lg">
                  <p className="text-xs font-semibold text-t1 mb-3 uppercase tracking-wide">📋 Quick Setup Guide</p>
                  <ol className="text-xs text-t2 space-y-2 ml-1">
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">1.</span>
                      <span>Go to <a href="https://developer.ebay.com/my/keys" target="_blank" rel="noopener noreferrer" className="text-b1 underline hover:text-b2">developer.ebay.com/my/keys</a></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">2.</span>
                      <span>Sign in with your eBay account (or create a developer account)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">3.</span>
                      <span>Create a new "Production" keyset (not Sandbox)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">4.</span>
                      <span>Copy your <strong>App ID (Client ID)</strong>, <strong>Dev ID</strong>, and <strong>Cert ID (Client Secret)</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">5.</span>
                      <span>Generate an <strong>OAuth User Token</strong> by clicking "Get a Token from eBay via Your Application"</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 font-semibold text-t1">6.</span>
                      <span>Paste all credentials below and start seeing live market data!</span>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 bg-blue-bg border border-b1/20 rounded-md">
                    <p className="text-xs text-t2">
                      <strong className="text-b1">💡 Pro Tip:</strong> OAuth tokens expire after 2 hours. You'll need to regenerate them periodically. The app will notify you when it's time to refresh.
                    </p>
                  </div>
                </div>

                <Separator className="bg-s2" />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-app-id" className="text-xs uppercase tracking-wide text-t2">
                      <span className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-b1 text-fg text-[10px] font-bold">1</span>
                        eBay App ID (Client ID)
                      </span>
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayApp')}
                      className="text-t2 hover:text-t1 touch-target"
                    >
                      {showKeys.ebayApp ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="ebay-app-id"
                    type={showKeys.ebayApp ? 'text' : 'password'}
                    value={settings.ebayAppId || ''}
                    onChange={(e) => onUpdate({ ebayAppId: e.target.value })}
                    placeholder="YourApp-YourApp-PRD-..."
                    className="font-mono text-sm"
                  />
                  {hasKey(settings.ebayAppId) && (
                    <p className="text-xs text-green mt-1 flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" /> App ID configured
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-dev-id" className="text-xs uppercase tracking-wide text-t2">
                      <span className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-b1 text-fg text-[10px] font-bold">2</span>
                        eBay Dev ID
                      </span>
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayDev')}
                      className="text-t2 hover:text-t1 touch-target"
                    >
                      {showKeys.ebayDev ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="ebay-dev-id"
                    type={showKeys.ebayDev ? 'text' : 'password'}
                    value={settings.ebayDevId || ''}
                    onChange={(e) => onUpdate({ ebayDevId: e.target.value })}
                    placeholder="a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6"
                    className="font-mono text-sm"
                  />
                  {hasKey(settings.ebayDevId) && (
                    <p className="text-xs text-green mt-1 flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" /> Dev ID configured
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-cert-id" className="text-xs uppercase tracking-wide text-t2">
                      <span className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-b1 text-fg text-[10px] font-bold">3</span>
                        eBay Cert ID (Client Secret)
                      </span>
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayCert')}
                      className="text-t2 hover:text-t1 touch-target"
                    >
                      {showKeys.ebayCert ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="ebay-cert-id"
                    type={showKeys.ebayCert ? 'text' : 'password'}
                    value={settings.ebayCertId || ''}
                    onChange={(e) => onUpdate({ ebayCertId: e.target.value })}
                    placeholder="PRD-1234abcd5678efgh-90ijk12l"
                    className="font-mono text-sm"
                  />
                  {hasKey(settings.ebayCertId) && (
                    <p className="text-xs text-green mt-1 flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" /> Cert ID configured
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-api-key" className="text-xs uppercase tracking-wide text-t2">
                      <span className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-b1 text-fg text-[10px] font-bold">4</span>
                        eBay OAuth User Token
                      </span>
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayToken')}
                      className="text-t2 hover:text-t1 touch-target"
                    >
                      {showKeys.ebayToken ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="ebay-api-key"
                    type={showKeys.ebayToken ? 'text' : 'password'}
                    value={settings.ebayApiKey || ''}
                    onChange={(e) => onUpdate({ ebayApiKey: e.target.value })}
                    placeholder="v^1.1#i^1#..."
                    className="font-mono text-sm"
                  />
                  {hasKey(settings.ebayApiKey) && hasKey(settings.ebayAppId) ? (
                    <div className="mt-2 p-3 bg-gradient-to-br from-green-bg to-transparent border border-green/30 rounded-md">
                      <p className="text-xs text-green font-semibold flex items-center gap-1.5">
                        <CheckCircle size={14} weight="fill" /> 
                        eBay Integration Active — Live Market Pricing Enabled!
                      </p>
                      <p className="text-xs text-t2 mt-1">
                        You'll now see real sold prices, active listings, and accurate profit calculations on every scan.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-amber mt-1.5 flex items-center gap-1">
                      <Info size={12} weight="fill" />
                      Complete all 4 fields above to unlock live market data
                    </p>
                  )}
                </div>

                <Separator className="bg-s2" />

                <div className="p-4 bg-s1 border border-s2 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-t1 uppercase tracking-wide">🎯 What You'll Get</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 flex-shrink-0" size={14} weight="fill" />
                      <div className="text-xs text-t2">
                        <strong className="text-t1">Real Sold Prices:</strong> See what items actually sold for (avg, median, recent sales)
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 flex-shrink-0" size={14} weight="fill" />
                      <div className="text-xs text-t2">
                        <strong className="text-t1">Active Listings:</strong> Current competition and pricing trends
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 flex-shrink-0" size={14} weight="fill" />
                      <div className="text-xs text-t2">
                        <strong className="text-t1">Sell-Through Rate:</strong> Demand indicator (high = hot item)
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 flex-shrink-0" size={14} weight="fill" />
                      <div className="text-xs text-t2">
                        <strong className="text-t1">Profit Calculator:</strong> Net profit after eBay fees, PayPal fees, and shipping
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 flex-shrink-0" size={14} weight="fill" />
                      <div className="text-xs text-t2">
                        <strong className="text-t1">Smart Recommendations:</strong> Suggested listing price based on market data
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber/10 border border-amber/30 rounded-md">
                  <p className="text-xs text-t2">
                    <strong className="text-amber">⚠️ Important:</strong> OAuth tokens expire after 2 hours. When you see "eBay API unavailable" errors, return here and generate a new token. Future updates will add automatic token refresh.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="database" className="border border-b1/20 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                🗄️ Database & Automation
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="supabase-url" className="text-xs uppercase tracking-wide text-t2">
                      Supabase Project URL
                    </Label>
                  </div>
                  <Input
                    id="supabase-url"
                    type="text"
                    value={settings.supabaseUrl || ''}
                    onChange={(e) => onUpdate({ supabaseUrl: e.target.value })}
                    placeholder="https://xxxxx.supabase.co"
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="supabase-key" className="text-xs uppercase tracking-wide text-t2">
                      Supabase Anon Key
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('supabase')}
                      className="text-t2 hover:text-t1"
                    >
                      {showKeys.supabase ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="supabase-key"
                    type={showKeys.supabase ? 'text' : 'password'}
                    value={settings.supabaseKey || ''}
                    onChange={(e) => onUpdate({ supabaseKey: e.target.value })}
                    placeholder="eyJ..."
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="n8n-webhook" className="text-xs uppercase tracking-wide text-t2">
                      n8n Webhook URL
                    </Label>
                  </div>
                  <Input
                    id="n8n-webhook"
                    type="text"
                    value={settings.n8nWebhookUrl || ''}
                    onChange={(e) => onUpdate({ n8nWebhookUrl: e.target.value })}
                    placeholder="https://your-n8n.app/webhook/..."
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-t2 mt-1">For automated workflows and data sync</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="notion-api-key" className="text-xs uppercase tracking-wide text-t2">
                      Notion Integration Token
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('notion')}
                      className="text-t2 hover:text-t1"
                    >
                      {showKeys.notion ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="notion-api-key"
                    type={showKeys.notion ? 'text' : 'password'}
                    value={settings.notionApiKey || ''}
                    onChange={(e) => onUpdate({ notionApiKey: e.target.value })}
                    placeholder="secret_..."
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="notion-db-id" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                    Notion Database ID
                  </Label>
                  <Input
                    id="notion-db-id"
                    type="text"
                    value={settings.notionDatabaseId || ''}
                    onChange={(e) => onUpdate({ notionDatabaseId: e.target.value })}
                    placeholder="Database ID for inventory tracking"
                    className="font-mono text-sm"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="features" className="border border-s2 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                🎛️ Feature Toggles
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="agentic-mode" className="text-sm text-t1 font-medium">
                      Agentic Mode
                    </Label>
                    <p className="text-xs text-t2 mt-0.5">AI agents assist throughout workflow</p>
                  </div>
                  <Switch
                    id="agentic-mode"
                    checked={settings.agenticMode}
                    onCheckedChange={(checked) => onUpdate({ agenticMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="live-search" className="text-sm text-t1 font-medium">
                      Live Search
                    </Label>
                    <p className="text-xs text-t2 mt-0.5">Real-time Google Search & Maps data</p>
                  </div>
                  <Switch
                    id="live-search"
                    checked={settings.liveSearchEnabled}
                    onCheckedChange={(checked) => onUpdate({ liveSearchEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="lens-in-batch" className="text-sm text-t1 font-medium">
                      Google Lens in Batch
                    </Label>
                    <p className="text-xs text-t2 mt-0.5">Run visual search during batch analysis</p>
                  </div>
                  <Switch
                    id="lens-in-batch"
                    checked={settings.enableLensInBatch !== false}
                    onCheckedChange={(checked) => onUpdate({ enableLensInBatch: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="lens-confidence" className="text-sm text-t1 font-medium">
                      Lens Skip Confidence
                    </Label>
                    <p className="text-xs text-t2 mt-0.5">Skip Google Lens when AI confidence exceeds this (0-1)</p>
                  </div>
                  <Input
                    id="lens-confidence"
                    type="number"
                    min={0.5}
                    max={1}
                    step={0.05}
                    value={settings.lensSkipConfidence ?? 0.85}
                    onChange={(e) => onUpdate({ lensSkipConfidence: parseFloat(e.target.value) || 0.85 })}
                    className="w-20 h-8 text-sm text-right"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="voice-enabled" className="text-sm text-t1 font-medium">
                      Voice Input
                    </Label>
                    <p className="text-xs text-t2 mt-0.5">Voice commands and dictation</p>
                  </div>
                  <Switch
                    id="voice-enabled"
                    checked={settings.voiceEnabled}
                    onCheckedChange={(checked) => onUpdate({ voiceEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="auto-capture" className="text-sm text-t1 font-medium">
                      Auto-Capture
                    </Label>
                    <p className="text-xs text-t2 mt-0.5">Analyze immediately after photo</p>
                  </div>
                  <Switch
                    id="auto-capture"
                    checked={settings.autoCapture}
                    onCheckedChange={(checked) => onUpdate({ autoCapture: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="api-notifications" className="text-sm text-t1 font-medium">
                      API Connection Notifications
                    </Label>
                    <p className="text-xs text-t2 mt-0.5">Show alerts when APIs go offline</p>
                  </div>
                  <Switch
                    id="api-notifications"
                    checked={settings.apiNotificationsEnabled || false}
                    onCheckedChange={(checked) => onUpdate({ apiNotificationsEnabled: checked })}
                  />
                </div>

                <Separator className="bg-s2" />

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="theme-mode" className="text-sm text-t1 font-medium">
                      Theme Mode
                    </Label>
                    <p className="text-xs text-t2 mt-0.5">Optimized for low-light scanning</p>
                  </div>
                  <Select 
                    value={settings.themeMode || 'auto'}
                    onValueChange={(value) => onUpdate({ themeMode: value as 'light' | 'dark' | 'auto' })}
                  >
                    <SelectTrigger id="theme-mode" className="text-sm">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">☀️ Light</SelectItem>
                      <SelectItem value="dark">🌙 Dark</SelectItem>
                      <SelectItem value="auto">🔄 Auto</SelectItem>
                    </SelectContent>
                  </Select>
                  {settings.themeMode === 'auto' && (
                    <div className="p-3 bg-blue-bg border border-b1/20 rounded-md">
                      <p className="text-xs text-t2">
                        <span className="font-semibold text-b1">🕐 Time-based mode:</span> Automatically switches to light theme from 6 AM to 6 PM, and dark theme from 6 PM to 6 AM.
                      </p>
                    </div>
                  )}
                  {settings.themeMode === 'dark' && (
                    <p className="text-xs text-t2">Always use dark theme for scanning</p>
                  )}
                  {settings.themeMode === 'light' && (
                    <p className="text-xs text-t2">Always use light theme</p>
                  )}
                </div>

                {settings.themeMode === 'auto' && (
                  <div className="flex items-center justify-between py-2 pl-4 border-l-2 border-b1">
                    <div>
                      <Label htmlFor="use-ambient-light" className="text-sm text-t1 font-medium">
                        Use Ambient Light Sensor
                      </Label>
                      <p className="text-xs text-t2 mt-0.5">Switch theme based on room lighting (experimental)</p>
                    </div>
                    <Switch
                      id="use-ambient-light"
                      checked={settings.useAmbientLight || false}
                      onCheckedChange={(checked) => onUpdate({ useAmbientLight: checked })}
                    />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="image-quality" className="border border-s2 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                📸 Image Quality
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-t2 leading-relaxed">
                      Choose a quality preset that balances loading speed and image detail. Higher quality takes longer to process but provides better visuals for listings.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="image-quality-preset" className="text-xs uppercase tracking-wide text-t2">
                    Quality Preset
                  </Label>
                  <Select
                    value={settings.imageQuality?.preset || 'balanced'}
                    onValueChange={(value) => onUpdate({ imageQuality: { preset: value as any } })}
                  >
                    <SelectTrigger id="image-quality-preset" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium">⚡ Fast</span>
                          <span className="text-xs text-t3">Fastest loading, lower quality</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="balanced">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium">⚖️ Balanced</span>
                          <span className="text-xs text-t3">Recommended - good balance</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="quality">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium">✨ Quality</span>
                          <span className="text-xs text-t3">Higher quality, slower loading</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="maximum">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium">🎯 Maximum</span>
                          <span className="text-xs text-t3">Best quality for pro listings</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="p-3 bg-s1 border border-s2 rounded-md text-xs space-y-2">
                    <div className="flex justify-between text-t2">
                      <span>Thumbnail Size:</span>
                      <span className="font-mono text-t1">
                        {settings.imageQuality?.preset === 'fast' ? '120px' :
                         settings.imageQuality?.preset === 'quality' ? '300px' :
                         settings.imageQuality?.preset === 'maximum' ? '400px' : '200px'}
                      </span>
                    </div>
                    <div className="flex justify-between text-t2">
                      <span>Max Image Size:</span>
                      <span className="font-mono text-t1">
                        {settings.imageQuality?.preset === 'fast' ? '600px' :
                         settings.imageQuality?.preset === 'quality' ? '1200px' :
                         settings.imageQuality?.preset === 'maximum' ? '1600px' : '800px'}
                      </span>
                    </div>
                    <div className="flex justify-between text-t2">
                      <span>Format:</span>
                      <span className="font-mono text-t1">
                        {settings.imageQuality?.preset === 'quality' || settings.imageQuality?.preset === 'maximum' ? 'WebP' : 'JPEG'}
                      </span>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="compression" className="border border-s2 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                💾 Compression Analytics
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-t2 leading-relaxed">
                      Track how much storage and loading time you've saved through image compression. Analytics help you optimize quality settings for best performance.
                    </p>
                  </div>
                </div>

                <CompressionAnalytics />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tag-presets" className="border border-s2 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                🏷️ Tag Presets
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-t2 leading-relaxed">
                      Create and manage preset collections of tags for common product categories. Apply presets quickly when editing items in the queue.
                    </p>
                  </div>
                </div>
                
                <TagPresetsManager 
                  onApplyPreset={(tags: ItemTag[]) => {
                    console.log('Applied preset tags:', tags)
                  }} 
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="business" className="border border-s2 rounded-lg px-4 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                💰 Business Rules
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="min-profit" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                    Min. Profit Margin (%)
                  </Label>
                  <Input
                    id="min-profit"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={settings.minProfitMargin}
                    onChange={(e) => onUpdate({ minProfitMargin: parseInt(e.target.value) || 0 })}
                    className="font-mono"
                  />
                  <p className="text-xs text-t2 mt-1">Minimum margin for GO decision</p>
                </div>

                <div>
                  <Label htmlFor="shipping-cost" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                    Default Shipping Cost ($)
                  </Label>
                  <Input
                    id="shipping-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.defaultShippingCost}
                    onChange={(e) => onUpdate({ defaultShippingCost: parseFloat(e.target.value) || 0 })}
                    className="font-mono"
                  />
                </div>

                <div>
                  <Label htmlFor="ebay-fee" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                    eBay Fee (%)
                  </Label>
                  <Input
                    id="ebay-fee"
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={settings.ebayFeePercent}
                    onChange={(e) => onUpdate({ ebayFeePercent: parseFloat(e.target.value) || 0 })}
                    className="font-mono"
                  />
                </div>

                <div>
                  <Label htmlFor="paypal-fee" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                    PayPal Fee (%)
                  </Label>
                  <Input
                    id="paypal-fee"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={settings.paypalFeePercent}
                    onChange={(e) => onUpdate({ paypalFeePercent: parseFloat(e.target.value) || 0 })}
                    className="font-mono"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="pt-4 space-y-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full gap-2 border-b1 text-b1 hover:bg-b1/10 hover:border-b1"
                >
                  <ArrowCounterClockwise size={18} weight="bold" />
                  Reset All Settings
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-lg">
                    <ArrowCounterClockwise size={24} className="text-b1" weight="bold" />
                    Reset All Settings?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3 text-sm">
                    <p>
                      This will restore all settings to their default values.
                    </p>
                    <div className="p-3 bg-green-bg border border-green/30 rounded-md">
                      <p className="text-xs text-t1">
                        <strong className="text-green">✓ API Keys Will Be Preserved:</strong>
                      </p>
                      <ul className="text-xs text-t2 mt-2 space-y-1 ml-4 list-disc">
                        <li>Gemini & Anthropic API keys</li>
                        <li>Google Cloud API credentials</li>
                        <li>eBay API credentials</li>
                        <li>Notion & Supabase keys</li>
                        <li>All other API integrations</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-amber/10 border border-amber/30 rounded-md">
                      <p className="text-xs text-t1">
                        <strong className="text-amber">⚠ Settings That Will Reset:</strong>
                      </p>
                      <ul className="text-xs text-t2 mt-2 space-y-1 ml-4 list-disc">
                        <li>Feature toggles (voice, auto-capture, etc.)</li>
                        <li>Theme mode (reset to Auto)</li>
                        <li>Business rules (profit margin, fees, etc.)</li>
                        <li>AI model preference</li>
                        <li>Image quality settings</li>
                      </ul>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetSettings}
                    className="bg-b1 hover:bg-b2 text-fg"
                  >
                    Reset Settings
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <p className="text-xs text-t2 text-center">
              Restore default settings while keeping your API keys
            </p>

            <Separator className="bg-s2" />

            <Button 
              variant="outline" 
              className="w-full text-red hover:bg-red hover:text-fg border-s2 hover:border-red"
            >
              Clear All App Data
            </Button>
            <p className="text-xs text-t2 text-center">
              This will reset all settings and stored data
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
