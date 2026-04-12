import { useState, useMemo, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { logActivity, ACTIVITY_LOG_KEY, type ActivityEntry } from '@/lib/activity-log'
import { cn } from '@/lib/utils'
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
import { CheckCircle, XCircle, Info, Eye, EyeClosed, ClockCounterClockwise, Target, ArrowCounterClockwise, Bug } from '@phosphor-icons/react'
import { DEBUG_LOG_KEY, type DebugEntry, type DebugLevel } from '@/lib/debug-log'
import { ApiStatusIndicator } from '../ApiStatusIndicator'
import { ConnectionHistoryPanel } from '../ConnectionHistoryPanel'
import { IncidentLogViewer } from '../IncidentLogViewer'
import { DetectionHistoryViewer } from '../DetectionHistoryViewer'
import { FalsePositiveAnalyzerPanel } from '../FalsePositiveAnalyzer'
import { TagPresetsManager } from '../TagPresetsManager'
import { CompressionAnalytics } from '../CompressionAnalytics'
import { RetryConfigPanel } from '../RetryConfigPanel'
import type { AppSettings, ItemTag } from '@/types'

interface SettingsScreenProps {
  settings: AppSettings
  onUpdate: (settings: Partial<AppSettings>) => void
  onBack?: () => void
}

export function SettingsScreen({ settings, onUpdate }: SettingsScreenProps) {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [activityLog] = useKV<ActivityEntry[]>(ACTIVITY_LOG_KEY, [])
  const recentActivity = (activityLog || []).slice(0, 50)

  // Debug console state
  const [activityTab, setActivityTab] = useState<'activity' | 'debug'>('activity')
  const [debugFilter, setDebugFilter] = useState<DebugLevel | null>(null)
  const [debugLog, setDebugLog] = useKV<DebugEntry[]>(DEBUG_LOG_KEY, [])
  const filteredDebugEntries = useMemo(() =>
    (debugLog || [])
      .filter(e => !debugFilter || e.level === debugFilter)
      .slice(0, 100),
    [debugLog, debugFilter]
  )
  const debugErrors = (debugLog || []).filter(e => e.level === 'error').length
  const clearDebugLog = useCallback(() => setDebugLog([]), [setDebugLog])

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
      ebayAdFeePercent: 3.0,
      shippingMaterialsCost: 0.75,
      paypalFeePercent: 0,
      preferredAiModel: 'gemini-2.5-flash',
      imageQuality: { preset: 'balanced' },
      ...preservedKeys,
    }

    onUpdate(defaultSettings)
    logActivity('Settings reset to defaults - API keys preserved')
  }

  const handleClearAllData = () => {
    onUpdate({
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
      imageQuality: { preset: 'balanced' },
      enableLensInBatch: true,
      lensSkipConfidence: 0.85,
      geminiApiKey: '',
      anthropicApiKey: '',
      notionApiKey: '',
      googleApiKey: '',
      googleSearchEngineId: '',
      ebayAppId: '',
      ebayDevId: '',
      ebayCertId: '',
      ebayApiKey: '',
      supabaseUrl: '',
      supabaseKey: '',
      n8nWebhookUrl: '',
      notionDatabaseId: '',
    })
    logActivity('All app data cleared — settings and API keys reset', 'info')
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

  return (
    <div
      id="scr-settings"
      className="flex flex-col h-full overflow-y-auto overflow-x-hidden"
    >
      {/* ── Status Bar ── */}
      <div className="px-4 py-2 border-b border-s2 bg-fg">
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
          {([
            ['AI', aiConfigured],
            ['Google', googleConfigured],
            ['eBay', ebayConfigured],
            ['Database', supabaseConfigured],
            ['Notion', notionConfigured],
          ] as [string, boolean][]).map(([label, ok]) => (
            <div key={label} className="flex items-center gap-1.5 flex-shrink-0">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-green' : 'bg-s3'}`} />
              <span className={`text-[11px] font-semibold ${ok ? 'text-t1' : 'text-t3'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-3 py-4">
        <div className="space-y-3 pb-24 w-full max-w-full">

          {/* ═══════════ MY PROFILE — Device operator identity ═══════════ */}
          <div className="border border-b1/20 rounded-lg px-3 py-3 bg-fg space-y-3">
            <p className="text-sm font-semibold text-t1 uppercase tracking-wide flex items-center gap-2">
              <span className="text-base">👤</span> My Profile
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-t3 uppercase tracking-wider">Name</Label>
                <Input
                  value={settings.userProfile?.operatorName || ''}
                  onChange={(e) => onUpdate({ userProfile: { ...settings.userProfile, operatorId: (settings.userProfile?.operatorId || e.target.value.toLowerCase().replace(/\s+/g, '-').slice(0, 20)), operatorName: e.target.value, operatorInitial: (settings.userProfile?.operatorInitial || e.target.value.slice(0, 1).toUpperCase()) } as any })}
                  placeholder="Angel"
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px] text-t3 uppercase tracking-wider">Initials</Label>
                <Input
                  value={settings.userProfile?.operatorInitial || ''}
                  onChange={(e) => onUpdate({ userProfile: { ...settings.userProfile, operatorInitial: e.target.value.toUpperCase().slice(0, 3) } as any })}
                  placeholder="AV"
                  maxLength={3}
                  className="h-8 text-sm mt-1 uppercase"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-t3 uppercase tracking-wider">Focus Areas</Label>
              <Input
                value={settings.userProfile?.focus || ''}
                onChange={(e) => onUpdate({ userProfile: { ...settings.userProfile, focus: e.target.value } as any })}
                placeholder="Electronics, Sneakers, Housewares"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] text-t3 uppercase tracking-wider">AI Context Notes</Label>
              <textarea
                value={settings.userProfile?.aiContext || ''}
                onChange={(e) => onUpdate({ userProfile: { ...settings.userProfile, aiContext: e.target.value } as any })}
                placeholder="I focus on electronics and sneakers. Min 35% margin. Ship within 2 days."
                rows={2}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1 resize-none"
              />
              <p className="text-[9px] text-t3 mt-1">Injected into every AI prompt — helps the agent give personalized advice</p>
            </div>
            {settings.userProfile?.operatorName && (
              <p className="text-[10px] text-t3 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-b1" />
                Active as <strong className="text-t1">{settings.userProfile.operatorName}</strong>
                {settings.userProfile.operatorInitial && <span className="text-[9px] text-b1 font-bold bg-b1/10 px-1.5 py-0.5 rounded">{settings.userProfile.operatorInitial}</span>}
              </p>
            )}
          </div>

          <Accordion type="multiple" defaultValue={[]} className="space-y-3">

            {/* ════════════════════════════════════════════════════════
                SECTION 1 — CONNECTIONS (API Keys & Integrations)
               ════════════════════════════════════════════════════════ */}
            <AccordionItem value="connections" className="border border-b1/20 rounded-lg px-3 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                🔑 Connections
              </AccordionTrigger>
              <AccordionContent className="space-y-6 pt-2 w-full max-w-full">

                {/* ── AI ── */}
                <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-t3 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${aiConfigured ? 'bg-green' : 'bg-s3'}`} />
                    AI Model
                  </p>

                  <div>
                    <Label htmlFor="ai-model" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                      Preferred AI Model
                    </Label>
                    <Select
                      value={settings.preferredAiModel || 'gemini-2.5-flash'}
                      onValueChange={(value) => onUpdate({ preferredAiModel: value as AppSettings['preferredAiModel'] })}
                    >
                      <SelectTrigger id="ai-model" className="font-mono text-sm">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</SelectItem>
                        <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                        <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet (Backup)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="gemini-api-key" className="text-xs uppercase tracking-wide text-t2">
                        Google Gemini API Key
                      </Label>
                      <button onClick={() => toggleKeyVisibility('gemini')} className="text-t2 hover:text-t1">
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
                      <button onClick={() => toggleKeyVisibility('anthropic')} className="text-t2 hover:text-t1">
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
                </div>

                <Separator className="bg-s2" />

                {/* ── Google Cloud ── */}
                <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-t3 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${googleConfigured ? 'bg-green' : 'bg-s3'}`} />
                    Google Cloud — Product Identification
                  </p>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="google-api-key" className="text-xs uppercase tracking-wide text-t2">
                        Google Cloud API Key
                      </Label>
                      <button onClick={() => toggleKeyVisibility('google')} className="text-t2 hover:text-t1">
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
                      <p className="text-xs text-green mt-1 flex items-center gap-1">
                        <CheckCircle size={14} weight="fill" /> Google Cloud Vision Active
                      </p>
                    )}
                    {!hasKey(settings.googleApiKey) && (
                      <p className="text-xs text-amber mt-1.5 flex items-center gap-1">
                        <Info size={12} weight="fill" /> Required for visual product identification
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="google-search-engine-id" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                      Custom Search Engine ID (Optional)
                    </Label>
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
                      Create at{' '}
                      <a href="https://programmablesearchengine.google.com" target="_blank" rel="noopener noreferrer" className="text-b1 underline hover:text-b2">
                        programmablesearchengine.google.com
                      </a>
                    </p>
                  </div>

                  {/* Collapsible setup guide */}
                  <details className="group rounded-lg border border-s2 bg-s1">
                    <summary className="cursor-pointer px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-t3 flex items-center gap-2 select-none">
                      <span className="transition-transform group-open:rotate-90">›</span>
                      Setup Guide
                    </summary>
                    <div className="px-3 pb-3 space-y-2">
                      <ol className="text-xs text-t2 space-y-1.5 ml-1">
                        <li className="flex gap-2"><span className="font-semibold text-t1">1.</span><span>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-b1 underline">console.cloud.google.com</a></span></li>
                        <li className="flex gap-2"><span className="font-semibold text-t1">2.</span><span>Create or select a project</span></li>
                        <li className="flex gap-2"><span className="font-semibold text-t1">3.</span><span>Enable <strong>Cloud Vision API</strong></span></li>
                        <li className="flex gap-2"><span className="font-semibold text-t1">4.</span><span>Optionally enable <strong>Custom Search API</strong></span></li>
                        <li className="flex gap-2"><span className="font-semibold text-t1">5.</span><span>Credentials → Create API Key → restrict to enabled APIs</span></li>
                      </ol>
                      <p className="text-xs text-t3 pt-1">Vision: 1,000 req/mo free · Custom Search: 100 queries/day free</p>
                    </div>
                  </details>

                  <div className="p-3 bg-amber/10 border border-amber/30 rounded-md">
                    <p className="text-xs text-t2">
                      <strong className="text-amber">⚡ Cost Tip:</strong> When Gemini is 92%+ confident, Google Lens is auto-skipped — saves ~40% API quota.
                    </p>
                  </div>
                </div>

                <Separator className="bg-s2" />

                {/* ── eBay ── */}
                <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-t3 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${ebayConfigured ? 'bg-green' : 'bg-s3'}`} />
                    eBay — Market Pricing
                  </p>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="ebay-app-id" className="text-xs uppercase tracking-wide text-t2">
                        App ID (Client ID)
                      </Label>
                      <button onClick={() => toggleKeyVisibility('ebayApp')} className="text-t2 hover:text-t1">
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
                        Dev ID
                      </Label>
                      <button onClick={() => toggleKeyVisibility('ebayDev')} className="text-t2 hover:text-t1">
                        {showKeys.ebayDev ? <EyeClosed size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <Input
                      id="ebay-dev-id"
                      type={showKeys.ebayDev ? 'text' : 'password'}
                      value={settings.ebayDevId || ''}
                      onChange={(e) => onUpdate({ ebayDevId: e.target.value })}
                      placeholder="a1b2c3d4-e5f6-..."
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
                        Cert ID (Client Secret)
                      </Label>
                      <button onClick={() => toggleKeyVisibility('ebayCert')} className="text-t2 hover:text-t1">
                        {showKeys.ebayCert ? <EyeClosed size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <Input
                      id="ebay-cert-id"
                      type={showKeys.ebayCert ? 'text' : 'password'}
                      value={settings.ebayCertId || ''}
                      onChange={(e) => onUpdate({ ebayCertId: e.target.value })}
                      placeholder="PRD-1234abcd5678efgh-..."
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
                        OAuth User Token
                      </Label>
                      <button onClick={() => toggleKeyVisibility('ebayToken')} className="text-t2 hover:text-t1">
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
                      <p className="text-xs text-green mt-1 flex items-center gap-1">
                        <CheckCircle size={14} weight="fill" /> eBay Integration Active
                      </p>
                    ) : (
                      <p className="text-xs text-amber mt-1.5 flex items-center gap-1">
                        <Info size={12} weight="fill" /> Complete all 4 fields to unlock live market data
                      </p>
                    )}
                  </div>

                  {/* Collapsible setup guide */}
                  <details className="group rounded-lg border border-s2 bg-s1">
                    <summary className="cursor-pointer px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-t3 flex items-center gap-2 select-none">
                      <span className="transition-transform group-open:rotate-90">›</span>
                      Setup Guide
                    </summary>
                    <div className="px-3 pb-3 space-y-2">
                      <ol className="text-xs text-t2 space-y-1.5 ml-1">
                        <li className="flex gap-2"><span className="font-semibold text-t1">1.</span><span>Go to <a href="https://developer.ebay.com/my/keys" target="_blank" rel="noopener noreferrer" className="text-b1 underline">developer.ebay.com/my/keys</a></span></li>
                        <li className="flex gap-2"><span className="font-semibold text-t1">2.</span><span>Sign in with your eBay account</span></li>
                        <li className="flex gap-2"><span className="font-semibold text-t1">3.</span><span>Create a <strong>Production</strong> keyset (not Sandbox)</span></li>
                        <li className="flex gap-2"><span className="font-semibold text-t1">4.</span><span>Copy App ID, Dev ID, and Cert ID</span></li>
                        <li className="flex gap-2"><span className="font-semibold text-t1">5.</span><span>Generate an OAuth User Token</span></li>
                      </ol>
                    </div>
                  </details>

                  <div className="p-3 bg-amber/10 border border-amber/30 rounded-md">
                    <p className="text-xs text-t2">
                      <strong className="text-amber">⚠️ Note:</strong> OAuth tokens expire after 2 hours. Regenerate when you see "eBay API unavailable" errors.
                    </p>
                  </div>
                </div>

                <Separator className="bg-s2" />

                {/* ── Database & Integrations ── */}
                <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-t3 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${supabaseConfigured ? 'bg-green' : 'bg-s3'}`} />
                    Database & Integrations
                  </p>

                  <div>
                    <Label htmlFor="supabase-url" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                      Supabase Project URL
                    </Label>
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
                      <button onClick={() => toggleKeyVisibility('supabase')} className="text-t2 hover:text-t1">
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

                  <Separator className="bg-s1" />

                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${notionConfigured ? 'bg-green' : 'bg-s3'}`} />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-t3">Notion</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="notion-api-key" className="text-xs uppercase tracking-wide text-t2">
                        Notion Integration Token
                      </Label>
                      <button onClick={() => toggleKeyVisibility('notion')} className="text-t2 hover:text-t1">
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

                  <Separator className="bg-s1" />

                  <p className="text-[11px] font-bold uppercase tracking-widest text-t3">Automation</p>

                  <div>
                    <Label htmlFor="n8n-webhook" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                      n8n Webhook URL
                    </Label>
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
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ════════════════════════════════════════════════════════
                SECTION 2 — BUSINESS RULES
               ════════════════════════════════════════════════════════ */}
            <AccordionItem value="business" className="border border-s2 rounded-lg px-3 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                💰 Business Rules
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2 w-full max-w-full">
                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <p className="text-xs text-t2 leading-relaxed">
                    These values drive BUY/PASS decisions and profit calculations on every scan.
                  </p>
                </div>

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
                  <p className="text-xs text-t2 mt-1">Minimum margin for BUY decision</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                    <Label htmlFor="ad-fee" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                      Ad Fee (%)
                    </Label>
                    <Input
                      id="ad-fee"
                      type="number"
                      step="0.1"
                      min="0"
                      max="15"
                      value={settings.ebayAdFeePercent ?? 3.0}
                      onChange={(e) => onUpdate({ ebayAdFeePercent: parseFloat(e.target.value) || 0 })}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="shipping-cost" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                      Shipping ($)
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
                    <Label htmlFor="materials-cost" className="text-xs uppercase tracking-wide text-t2 mb-1.5">
                      Materials ($/item)
                    </Label>
                    <Input
                      id="materials-cost"
                      type="number"
                      step="0.25"
                      min="0"
                      max="10"
                      value={settings.shippingMaterialsCost ?? 0.75}
                      onChange={(e) => onUpdate({ shippingMaterialsCost: parseFloat(e.target.value) || 0 })}
                      className="font-mono"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ════════════════════════════════════════════════════════
                SECTION 3 — PREFERENCES (Features + Theme + Image)
               ════════════════════════════════════════════════════════ */}
            <AccordionItem value="preferences" className="border border-s2 rounded-lg px-3 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                🎛️ Preferences
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2 w-full max-w-full">

                {/* Feature Toggles */}
                <p className="text-[11px] font-bold uppercase tracking-widest text-t3">Features</p>

                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <Label htmlFor="agentic-mode" className="text-sm text-t1 font-medium">Agentic Mode</Label>
                    <p className="text-xs text-t2 mt-0.5">AI agents assist throughout workflow</p>
                  </div>
                  <Switch id="agentic-mode" checked={settings.agenticMode} onCheckedChange={(checked) => onUpdate({ agenticMode: checked })} />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <Label htmlFor="live-search" className="text-sm text-t1 font-medium">Live Search</Label>
                    <p className="text-xs text-t2 mt-0.5">Real-time Google Search & Maps data</p>
                  </div>
                  <Switch id="live-search" checked={settings.liveSearchEnabled} onCheckedChange={(checked) => onUpdate({ liveSearchEnabled: checked })} />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <Label htmlFor="lens-in-batch" className="text-sm text-t1 font-medium">Google Lens in Batch</Label>
                    <p className="text-xs text-t2 mt-0.5">Run visual search during batch analysis</p>
                  </div>
                  <Switch id="lens-in-batch" checked={settings.enableLensInBatch !== false} onCheckedChange={(checked) => onUpdate({ enableLensInBatch: checked })} />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <Label htmlFor="lens-confidence" className="text-sm text-t1 font-medium">Lens Skip Confidence</Label>
                    <p className="text-xs text-t2 mt-0.5">Skip Lens when AI confidence exceeds (0–1)</p>
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

                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <Label htmlFor="voice-enabled" className="text-sm text-t1 font-medium">Voice Input</Label>
                    <p className="text-xs text-t2 mt-0.5">Voice commands and dictation</p>
                  </div>
                  <Switch id="voice-enabled" checked={settings.voiceEnabled} onCheckedChange={(checked) => onUpdate({ voiceEnabled: checked })} />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <Label htmlFor="auto-capture" className="text-sm text-t1 font-medium">Auto-Capture</Label>
                    <p className="text-xs text-t2 mt-0.5">Analyze immediately after photo</p>
                  </div>
                  <Switch id="auto-capture" checked={settings.autoCapture} onCheckedChange={(checked) => onUpdate({ autoCapture: checked })} />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <Label htmlFor="api-notifications" className="text-sm text-t1 font-medium">API Connection Alerts</Label>
                    <p className="text-xs text-t2 mt-0.5">Show alerts when APIs go offline</p>
                  </div>
                  <Switch id="api-notifications" checked={settings.apiNotificationsEnabled || false} onCheckedChange={(checked) => onUpdate({ apiNotificationsEnabled: checked })} />
                </div>

                <Separator className="bg-s2" />

                {/* Theme */}
                <p className="text-[11px] font-bold uppercase tracking-widest text-t3">Appearance</p>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="theme-mode" className="text-sm text-t1 font-medium">Theme Mode</Label>
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
                    <p className="text-xs text-t2 px-1">
                      <span className="font-semibold text-b1">🕐</span> Light 6 AM – 6 PM, dark 6 PM – 6 AM
                    </p>
                  )}
                </div>

                {settings.themeMode === 'auto' && (
                  <div className="flex items-center justify-between py-1.5 pl-4 border-l-2 border-b1">
                    <div>
                      <Label htmlFor="use-ambient-light" className="text-sm text-t1 font-medium">Ambient Light Sensor</Label>
                      <p className="text-xs text-t2 mt-0.5">Switch theme based on room lighting</p>
                    </div>
                    <Switch id="use-ambient-light" checked={settings.useAmbientLight || false} onCheckedChange={(checked) => onUpdate({ useAmbientLight: checked })} />
                  </div>
                )}

                <Separator className="bg-s2" />

                {/* Image Quality */}
                <p className="text-[11px] font-bold uppercase tracking-widest text-t3">Image Quality</p>

                <div className="space-y-3">
                  <Select
                    value={settings.imageQuality?.preset || 'balanced'}
                    onValueChange={(value) => onUpdate({ imageQuality: { preset: value as any } })}
                  >
                    <SelectTrigger id="image-quality-preset" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">⚡ Fast — Fastest loading, lower quality</SelectItem>
                      <SelectItem value="balanced">⚖️ Balanced — Recommended</SelectItem>
                      <SelectItem value="quality">✨ Quality — Higher quality, slower</SelectItem>
                      <SelectItem value="maximum">🎯 Maximum — Best for pro listings</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="p-3 bg-s1 border border-s2 rounded-md text-xs space-y-1.5">
                    <div className="flex justify-between text-t2">
                      <span>Thumbnail:</span>
                      <span className="font-mono text-t1">
                        {settings.imageQuality?.preset === 'fast' ? '120px' :
                         settings.imageQuality?.preset === 'quality' ? '300px' :
                         settings.imageQuality?.preset === 'maximum' ? '400px' : '200px'}
                      </span>
                    </div>
                    <div className="flex justify-between text-t2">
                      <span>Max Size:</span>
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

                <Separator className="bg-s2" />

                {/* Compression Analytics */}
                <p className="text-[11px] font-bold uppercase tracking-widest text-t3">Compression Analytics</p>
                <CompressionAnalytics />
              </AccordionContent>
            </AccordionItem>

            {/* ════════════════════════════════════════════════════════
                SECTION 4 — TAG PRESETS
               ════════════════════════════════════════════════════════ */}
            <AccordionItem value="tags" className="border border-s2 rounded-lg px-3 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                🏷️ Tag Presets
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2 w-full max-w-full">
                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <p className="text-xs text-t2 leading-relaxed">
                    Create preset tag collections for common product categories. Apply presets quickly when editing items in the queue.
                  </p>
                </div>

                <TagPresetsManager
                  onApplyPreset={(tags: ItemTag[]) => {
                    logActivity(`Applied tag preset (${tags.length} tags)`)
                  }}
                />
              </AccordionContent>
            </AccordionItem>

            {/* ════════════════════════════════════════════════════════
                SECTION 5 — DIAGNOSTICS (All monitoring panels)
               ════════════════════════════════════════════════════════ */}
            <AccordionItem value="diagnostics" className="border border-s2 rounded-lg px-3 bg-fg">
              <AccordionTrigger className="text-sm font-semibold text-t1 uppercase tracking-wide hover:no-underline">
                📡 Diagnostics
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2 w-full max-w-full">
                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <p className="text-xs text-t2 leading-relaxed">
                    Monitor API health, connection history, retry policies, incident logs, and detection accuracy.
                  </p>
                </div>

                <Accordion type="multiple" defaultValue={[]} className="space-y-2">

                  {/* Health */}
                  <AccordionItem value="health" className="border border-green/20 rounded-lg px-3 bg-fg">
                    <AccordionTrigger className="text-xs font-semibold text-t1 uppercase tracking-wide hover:no-underline py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                        Live API Health
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 w-full max-w-full">
                      <ApiStatusIndicator settings={settings} liveUpdates={true} checkInterval={0} />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Connection History */}
                  <AccordionItem value="history" className="border border-s2 rounded-lg px-3 bg-fg">
                    <AccordionTrigger className="text-xs font-semibold text-t1 uppercase tracking-wide hover:no-underline py-2.5">
                      📊 Connection History
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 w-full max-w-full">
                      <ConnectionHistoryPanel settings={settings} />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Retry Config */}
                  <AccordionItem value="retry" className="border border-s2 rounded-lg px-3 bg-fg">
                    <AccordionTrigger className="text-xs font-semibold text-t1 uppercase tracking-wide hover:no-underline py-2.5">
                      🔄 Retry Configuration
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 w-full max-w-full">
                      <RetryConfigPanel />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Incidents */}
                  <AccordionItem value="incidents" className="border border-s2 rounded-lg px-3 bg-fg">
                    <AccordionTrigger className="text-xs font-semibold text-t1 uppercase tracking-wide hover:no-underline py-2.5">
                      🚨 Incident Logs
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 w-full max-w-full">
                      <IncidentLogViewer settings={settings} />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Detection History */}
                  <AccordionItem value="detection" className="border border-s2 rounded-lg px-3 bg-fg">
                    <AccordionTrigger className="text-xs font-semibold text-t1 uppercase tracking-wide hover:no-underline py-2.5">
                      📸 Detection History
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 w-full max-w-full">
                      <DetectionHistoryViewer />
                    </AccordionContent>
                  </AccordionItem>

                  {/* False Positive Analysis */}
                  <AccordionItem value="false-positives" className="border border-s2 rounded-lg px-3 bg-fg">
                    <AccordionTrigger className="text-xs font-semibold text-t1 uppercase tracking-wide hover:no-underline py-2.5">
                      🎯 False Positive Analysis
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 w-full max-w-full">
                      <FalsePositiveAnalyzerPanel />
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>
              </AccordionContent>
            </AccordionItem>

          </Accordion>

          {/* ── Activity + Debug Console ── */}
          <div className="rounded-2xl border border-s2 bg-fg overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-s2">
              <button
                onClick={() => setActivityTab('activity')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors',
                  activityTab === 'activity' ? 'text-t1 border-b-2 border-b1' : 'text-t3 hover:text-t2'
                )}
              >
                <ClockCounterClockwise size={13} weight="bold" />
                Activity
              </button>
              <button
                onClick={() => setActivityTab('debug')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors',
                  activityTab === 'debug' ? 'text-t1 border-b-2 border-red' : 'text-t3 hover:text-t2'
                )}
              >
                <Bug size={13} weight="bold" />
                Debug
                {debugErrors > 0 && (
                  <span className="text-[9px] font-bold bg-red/10 text-red border border-red/20 rounded px-1">{debugErrors}</span>
                )}
              </button>
            </div>

            {/* Activity tab */}
            {activityTab === 'activity' && (
              <>
                <div className="px-4 py-3 border-b border-s2 flex items-center justify-between">
                  {recentActivity.length > 0 && (
                    <span className="text-[10px] text-t3">{recentActivity.length} events</span>
                  )}
                </div>
                {recentActivity.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-t3">No recent activity</p>
                  </div>
                ) : (
                  <div className="divide-y divide-s1">
                    {recentActivity.map(entry => {
                      const ts = new Date(entry.timestamp)
                      const timeStr = ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      const dateStr = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      return (
                        <div key={entry.id} className="px-4 py-2.5 flex items-start gap-3">
                          <span className={cn(
                            'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                            entry.type === 'error' ? 'bg-red' : entry.type === 'info' ? 'bg-b1' : 'bg-green'
                          )} />
                          <span className="flex-1 text-[12px] text-t2 leading-snug">{entry.message}</span>
                          <span className="text-[10px] text-t3 flex-shrink-0 whitespace-nowrap">
                            {dateStr} {timeStr}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* Debug Console tab */}
            {activityTab === 'debug' && (
              <div>
                {/* Toolbar */}
                <div className="px-3 py-2 border-b border-s2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {(['error', 'warn', 'info', 'debug'] as DebugLevel[]).map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setDebugFilter(f => f === lvl ? null : lvl)}
                        className={cn(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all',
                          debugFilter === lvl
                            ? lvl === 'error' ? 'bg-red/15 text-red border-red/30'
                              : lvl === 'warn' ? 'bg-amber/15 text-amber border-amber/30'
                              : 'bg-b1/15 text-b1 border-b1/30'
                            : 'bg-s1 text-t3 border-s2'
                        )}
                      >
                        {lvl.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={clearDebugLog}
                    className="text-[9px] text-t3 hover:text-red transition-colors font-bold"
                  >
                    Clear
                  </button>
                </div>

                {/* Entries */}
                {filteredDebugEntries.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bug size={28} weight="duotone" className="text-t3 mx-auto mb-2" />
                    <p className="text-xs font-bold text-t2 mb-1">Debug Console Ready</p>
                    <p className="text-[10px] text-t3 max-w-[200px] mx-auto">
                      Errors, API calls, and state events will appear here when wired up
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-s1 max-h-64 overflow-y-auto font-mono">
                    {filteredDebugEntries.map(entry => (
                      <div key={entry.id} className="px-3 py-2 flex items-start gap-2">
                        <span className={cn(
                          'text-[9px] font-bold flex-shrink-0 px-1 rounded mt-0.5',
                          entry.level === 'error' ? 'bg-red/10 text-red' :
                          entry.level === 'warn' ? 'bg-amber/10 text-amber' :
                          entry.level === 'info' ? 'bg-b1/10 text-b1' : 'text-t3'
                        )}>
                          {entry.level.toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] text-t3">[{entry.source}]</span>
                          <span className="text-[10px] text-t1 ml-1 leading-snug">{entry.message}</span>
                          {entry.data && (
                            <pre className="text-[9px] text-t3 mt-0.5 overflow-x-auto whitespace-pre-wrap break-all">{entry.data}</pre>
                          )}
                        </div>
                        <span className="text-[9px] text-t3 flex-shrink-0">
                          {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Reset / Clear — at the bottom below Activity/Debug ── */}
          <div className="space-y-3 pt-2">
            <Separator className="bg-s2" />

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
                    <p>This will restore all settings to their default values.</p>
                    <div className="p-3 bg-green-bg border border-green/30 rounded-md">
                      <p className="text-xs text-t1">
                        <strong className="text-green">✓ API Keys Will Be Preserved</strong>
                      </p>
                      <ul className="text-xs text-t2 mt-2 space-y-1 ml-4 list-disc">
                        <li>Gemini & Anthropic API keys</li>
                        <li>Google Cloud & eBay credentials</li>
                        <li>Notion, Supabase & n8n keys</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-amber/10 border border-amber/30 rounded-md">
                      <p className="text-xs text-t1">
                        <strong className="text-amber">⚠ Will Reset:</strong>
                      </p>
                      <ul className="text-xs text-t2 mt-2 space-y-1 ml-4 list-disc">
                        <li>Feature toggles, theme, image quality</li>
                        <li>Business rules (profit margins, fees)</li>
                        <li>AI model preference</li>
                      </ul>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetSettings}
                    className="bg-b1 hover:bg-b2 text-t1"
                  >
                    Reset Settings
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <p className="text-xs text-t2 text-center">
              Restore default settings while keeping your API keys
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full text-red hover:bg-red hover:text-t1 border-s2 hover:border-red"
                >
                  Clear All App Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-lg text-red">
                    ⚠️ Clear All App Data?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3 text-sm">
                    <p>This will reset <strong>everything</strong> — all settings, API keys, and stored preferences.</p>
                    <div className="p-3 bg-red/10 border border-red/30 rounded-md">
                      <p className="text-xs text-t1">
                        <strong className="text-red">This cannot be undone.</strong> You will need to re-enter all API keys and reconfigure your settings.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAllData}
                    className="bg-red hover:bg-red/80 text-t1"
                  >
                    Clear Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <p className="text-xs text-t2 text-center">
              This will reset all settings, API keys, and stored data
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
