import { useState } from 'react'
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
import { CheckCircle, XCircle, Info, Eye, EyeClosed, ClockCounterClockwise, Target } from '@phosphor-icons/react'
import { ApiStatusIndicator } from '../ApiStatusIndicator'
import { ConnectionHistoryPanel } from '../ConnectionHistoryPanel'
import { IncidentLogViewer } from '../IncidentLogViewer'
import { DetectionHistoryViewer } from '../DetectionHistoryViewer'
import { FalsePositiveAnalyzerPanel } from '../FalsePositiveAnalyzer'
import { ThemeToggle } from '../ThemeToggle'
import type { AppSettings } from '@/types'

interface SettingsScreenProps {
  settings: AppSettings
  onUpdate: (settings: Partial<AppSettings>) => void
}

export function SettingsScreen({ settings, onUpdate }: SettingsScreenProps) {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  const toggleKeyVisibility = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))
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
    <div id="scr-settings" className="flex flex-col h-full">
      <div className="px-4 py-6 border-b border-s2 bg-s1">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-fg mb-2">Settings</h1>
            <p className="text-sm text-s4">Configure AI models, APIs, and business rules</p>
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
        <div className="space-y-6 max-w-md pb-20">
          <Accordion type="multiple" defaultValue={['health', 'detection', 'false-positives']} className="space-y-4">
            <AccordionItem value="health" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Connection Health
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Real-time monitoring of API connections. Health checks run every 30 seconds to ensure reliable service.
                    </p>
                  </div>
                </div>

                <ApiStatusIndicator settings={settings} liveUpdates={true} checkInterval={30000} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="history" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Connection History & Downtime Tracking
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Track connection events and identify downtime patterns over the last 30 days. Analyze service reliability and incident history.
                    </p>
                  </div>
                </div>

                <ConnectionHistoryPanel settings={settings} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="incidents" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Incident Logs & API Issues
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Comprehensive incident log viewer for diagnosing API connection issues. Filter by service, view detailed error messages, and track resolution times. Export logs for external analysis.
                    </p>
                  </div>
                </div>

                <IncidentLogViewer settings={settings} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="detection" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                <div className="flex items-center gap-2">
                  <ClockCounterClockwise size={18} />
                  Multi-Object Detection History
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Track multi-object detection accuracy over time. Review past scans, confirmed detections, and false positives to monitor AI performance.
                    </p>
                  </div>
                </div>

                <DetectionHistoryViewer />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="false-positives" className="border-2 border-b1 rounded-lg px-4 bg-gradient-to-br from-t4 to-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target size={20} weight="duotone" className="text-b1" />
                  False Positive Analysis & Optimization
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-4 bg-gradient-to-br from-amber/10 to-amber/5 border-2 border-amber/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber text-bg flex-shrink-0">
                      <Target size={20} weight="duotone" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-fg">Optimize Detection Accuracy</p>
                      <p className="text-xs text-s4 leading-relaxed">
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

            <AccordionItem value="ai" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                AI Configuration
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Configure your preferred AI model. Gemini 2.0 Flash is recommended for cost-efficient real-time analysis.
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="ai-model" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
                    Preferred AI Model
                  </Label>
                  <Select 
                    value={settings.preferredAiModel || 'gemini-2.0-flash-exp'}
                    onValueChange={(value) => onUpdate({ preferredAiModel: value as AppSettings['preferredAiModel'] })}
                  >
                    <SelectTrigger id="ai-model" className="font-mono text-sm">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Fastest)</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                      <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                      <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet (Backup)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="gemini-api-key" className="text-xs uppercase tracking-wide text-s4">
                      Google Gemini API Key
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('gemini')}
                      className="text-s3 hover:text-fg"
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
                    <Label htmlFor="anthropic-api-key" className="text-xs uppercase tracking-wide text-s4">
                      Anthropic API Key (Backup)
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('anthropic')}
                      className="text-s3 hover:text-fg"
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

            <AccordionItem value="google" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Google Cloud APIs
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <div className="text-xs text-s4 leading-relaxed space-y-2">
                      <p className="font-medium text-fg">Quick Setup:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-1">
                        <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-b1 underline">console.cloud.google.com</a></li>
                        <li>Create a new project or select existing</li>
                        <li>Enable these APIs: Vision API, Custom Search API, Maps API, Places API</li>
                        <li>Go to Credentials → Create API Key</li>
                        <li>Restrict key to enabled APIs only</li>
                        <li>Copy and paste the key below</li>
                      </ol>
                      <p className="text-fg font-medium pt-1">
                        Need help? See <a href="https://github.com/yourusername/resale-scanner/blob/main/GOOGLE_CLOUD_SETUP.md" target="_blank" rel="noopener noreferrer" className="text-b1 underline">detailed setup guide</a>
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="google-api-key" className="text-xs uppercase tracking-wide text-s4">
                      Google Cloud API Key
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('google')}
                      className="text-s3 hover:text-fg"
                    >
                      {showKeys.google ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="google-api-key"
                    type={showKeys.google ? 'text' : 'password'}
                    value={settings.googleApiKey || ''}
                    onChange={(e) => onUpdate({ googleApiKey: e.target.value })}
                    placeholder="AIzaSy... (for Vision, Maps, Places)"
                    className="font-mono text-sm"
                  />
                  {hasKey(settings.googleApiKey) && (
                    <p className="text-xs text-green mt-1 flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" /> Key configured - Google Lens enabled
                    </p>
                  )}
                  {!hasKey(settings.googleApiKey) && (
                    <p className="text-xs text-amber mt-1">
                      Required for real-time product matching
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="google-search-engine-id" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
                    Custom Search Engine ID (Optional)
                  </Label>
                  <Input
                    id="google-search-engine-id"
                    type="text"
                    value={settings.googleSearchEngineId || ''}
                    onChange={(e) => onUpdate({ googleSearchEngineId: e.target.value })}
                    placeholder="Your Custom Search Engine ID"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-s4 mt-1">
                    For enhanced visual search. Get it from <a href="https://programmablesearchengine.google.com" target="_blank" rel="noopener noreferrer" className="text-b1 underline">programmablesearchengine.google.com</a>
                  </p>
                </div>

                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <p className="text-xs font-medium text-fg mb-2">What you get with Google Cloud APIs:</p>
                  <ul className="text-xs text-s4 space-y-1 ml-4 list-disc">
                    <li><span className="font-medium text-fg">Vision API:</span> Product identification from photos</li>
                    <li><span className="font-medium text-fg">Custom Search:</span> Visual product matching across web</li>
                    <li><span className="font-medium text-fg">Maps API:</span> Local market intelligence & store finder</li>
                    <li><span className="font-medium text-fg">Places API:</span> Thrift store locations & ratings</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ebay" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                eBay Integration
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Get your keys from developer.ebay.com. You'll need App ID, Dev ID, Cert ID, and OAuth token.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-app-id" className="text-xs uppercase tracking-wide text-s4">
                      eBay App ID (Client ID)
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayApp')}
                      className="text-s3 hover:text-fg"
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
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-dev-id" className="text-xs uppercase tracking-wide text-s4">
                      eBay Dev ID
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayDev')}
                      className="text-s3 hover:text-fg"
                    >
                      {showKeys.ebayDev ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="ebay-dev-id"
                    type={showKeys.ebayDev ? 'text' : 'password'}
                    value={settings.ebayDevId || ''}
                    onChange={(e) => onUpdate({ ebayDevId: e.target.value })}
                    placeholder="Dev ID..."
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-cert-id" className="text-xs uppercase tracking-wide text-s4">
                      eBay Cert ID (Client Secret)
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayCert')}
                      className="text-s3 hover:text-fg"
                    >
                      {showKeys.ebayCert ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="ebay-cert-id"
                    type={showKeys.ebayCert ? 'text' : 'password'}
                    value={settings.ebayCertId || ''}
                    onChange={(e) => onUpdate({ ebayCertId: e.target.value })}
                    placeholder="PRD-..."
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-api-key" className="text-xs uppercase tracking-wide text-s4">
                      eBay OAuth Token
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayToken')}
                      className="text-s3 hover:text-fg"
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
                  {hasKey(settings.ebayApiKey) && hasKey(settings.ebayAppId) && (
                    <p className="text-xs text-green mt-1 flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" /> Integration configured
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="database" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Database & Automation
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="supabase-url" className="text-xs uppercase tracking-wide text-s4">
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
                    <Label htmlFor="supabase-key" className="text-xs uppercase tracking-wide text-s4">
                      Supabase Anon Key
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('supabase')}
                      className="text-s3 hover:text-fg"
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
                    <Label htmlFor="n8n-webhook" className="text-xs uppercase tracking-wide text-s4">
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
                  <p className="text-xs text-s4 mt-1">For automated workflows and data sync</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="notion-api-key" className="text-xs uppercase tracking-wide text-s4">
                      Notion Integration Token
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('notion')}
                      className="text-s3 hover:text-fg"
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
                  <Label htmlFor="notion-db-id" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
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

            <AccordionItem value="features" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Feature Toggles
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="agentic-mode" className="text-sm text-fg font-medium">
                      Agentic Mode
                    </Label>
                    <p className="text-xs text-s4 mt-0.5">AI agents assist throughout workflow</p>
                  </div>
                  <Switch
                    id="agentic-mode"
                    checked={settings.agenticMode}
                    onCheckedChange={(checked) => onUpdate({ agenticMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="live-search" className="text-sm text-fg font-medium">
                      Live Search
                    </Label>
                    <p className="text-xs text-s4 mt-0.5">Real-time Google Search & Maps data</p>
                  </div>
                  <Switch
                    id="live-search"
                    checked={settings.liveSearchEnabled}
                    onCheckedChange={(checked) => onUpdate({ liveSearchEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="voice-enabled" className="text-sm text-fg font-medium">
                      Voice Input
                    </Label>
                    <p className="text-xs text-s4 mt-0.5">Voice commands and dictation</p>
                  </div>
                  <Switch
                    id="voice-enabled"
                    checked={settings.voiceEnabled}
                    onCheckedChange={(checked) => onUpdate({ voiceEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="auto-capture" className="text-sm text-fg font-medium">
                      Auto-Capture
                    </Label>
                    <p className="text-xs text-s4 mt-0.5">Analyze immediately after photo</p>
                  </div>
                  <Switch
                    id="auto-capture"
                    checked={settings.autoCapture}
                    onCheckedChange={(checked) => onUpdate({ autoCapture: checked })}
                  />
                </div>

                <Separator className="bg-s2" />

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="theme-mode" className="text-sm text-fg font-medium">
                      Theme Mode
                    </Label>
                    <p className="text-xs text-s4 mt-0.5">Optimized for low-light scanning</p>
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
                    <p className="text-xs text-s4">Always use dark theme for scanning</p>
                  )}
                  {settings.themeMode === 'light' && (
                    <p className="text-xs text-s4">Always use light theme</p>
                  )}
                </div>

                {settings.themeMode === 'auto' && (
                  <div className="flex items-center justify-between py-2 pl-4 border-l-2 border-b1">
                    <div>
                      <Label htmlFor="use-ambient-light" className="text-sm text-fg font-medium">
                        Use Ambient Light Sensor
                      </Label>
                      <p className="text-xs text-s4 mt-0.5">Switch theme based on room lighting (experimental)</p>
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

              <AccordionContent className="space-y-4 pt-2">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Business Rules
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="min-profit" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
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
                  <p className="text-xs text-s4 mt-1">Minimum margin for GO decision</p>
                </div>

                <div>
                  <Label htmlFor="shipping-cost" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
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
                  <Label htmlFor="ebay-fee" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
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
                  <Label htmlFor="paypal-fee" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
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

          <div className="pt-4">
            <Button 
              variant="outline" 
              className="w-full text-red hover:bg-red hover:text-bg border-s2 hover:border-red"
            >
              Clear All App Data
            </Button>
            <p className="text-xs text-s4 text-center mt-2">
              This will reset all settings and stored data
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
import { useState } from 'react'
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
import { CheckCircle, XCircle, Info, Eye, EyeClosed, ClockCounterClockwise, Target } from '@phosphor-icons/react'
import { ApiStatusIndicator } from '../ApiStatusIndicator'
import { ConnectionHistoryPanel } from '../ConnectionHistoryPanel'
import { IncidentLogViewer } from '../IncidentLogViewer'
import { DetectionHistoryViewer } from '../DetectionHistoryViewer'
import { FalsePositiveAnalyzerPanel } from '../FalsePositiveAnalyzer'
import { ThemeToggle } from '../ThemeToggle'
import type { AppSettings } from '@/types'

interface SettingsScreenProps {
  settings: AppSettings
  onUpdate: (settings: Partial<AppSettings>) => void
}

export function SettingsScreen({ settings, onUpdate }: SettingsScreenProps) {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  const toggleKeyVisibility = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))
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
    <div id="scr-settings" className="flex flex-col h-full">
      <div className="px-4 py-6 border-b border-s2 bg-s1">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-fg mb-2">Settings</h1>
            <p className="text-sm text-s4">Configure AI models, APIs, and business rules</p>
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
        <div className="space-y-6 max-w-md pb-20">
          <Accordion type="multiple" defaultValue={['health', 'detection', 'false-positives']} className="space-y-4">
            <AccordionItem value="health" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Connection Health
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Real-time monitoring of API connections. Health checks run every 30 seconds to ensure reliable service.
                    </p>
                  </div>
                </div>

                <ApiStatusIndicator settings={settings} liveUpdates={true} checkInterval={30000} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="history" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Connection History & Downtime Tracking
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Track connection events and identify downtime patterns over the last 30 days. Analyze service reliability and incident history.
                    </p>
                  </div>
                </div>

                <ConnectionHistoryPanel settings={settings} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="incidents" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Incident Logs & API Issues
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Comprehensive incident log viewer for diagnosing API connection issues. Filter by service, view detailed error messages, and track resolution times. Export logs for external analysis.
                    </p>
                  </div>
                </div>

                <IncidentLogViewer settings={settings} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="detection" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                <div className="flex items-center gap-2">
                  <ClockCounterClockwise size={18} />
                  Multi-Object Detection History
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Track multi-object detection accuracy over time. Review past scans, confirmed detections, and false positives to monitor AI performance.
                    </p>
                  </div>
                </div>

                <DetectionHistoryViewer />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="false-positives" className="border-2 border-b1 rounded-lg px-4 bg-gradient-to-br from-t4 to-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target size={20} weight="duotone" className="text-b1" />
                  False Positive Analysis & Optimization
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-4 bg-gradient-to-br from-amber/10 to-amber/5 border-2 border-amber/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber text-bg flex-shrink-0">
                      <Target size={20} weight="duotone" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-fg">Optimize Detection Accuracy</p>
                      <p className="text-xs text-s4 leading-relaxed">
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

            <AccordionItem value="ai" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                AI Configuration
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Configure your preferred AI model. Gemini 2.0 Flash is recommended for cost-efficient real-time analysis.
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="ai-model" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
                    Preferred AI Model
                  </Label>
                  <Select 
                    value={settings.preferredAiModel || 'gemini-2.0-flash-exp'}
                    onValueChange={(value) => onUpdate({ preferredAiModel: value as AppSettings['preferredAiModel'] })}
                  >
                    <SelectTrigger id="ai-model" className="font-mono text-sm">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Fastest)</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                      <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                      <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet (Backup)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="gemini-api-key" className="text-xs uppercase tracking-wide text-s4">
                      Google Gemini API Key
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('gemini')}
                      className="text-s3 hover:text-fg"
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
                    <Label htmlFor="anthropic-api-key" className="text-xs uppercase tracking-wide text-s4">
                      Anthropic API Key (Backup)
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('anthropic')}
                      className="text-s3 hover:text-fg"
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

            <AccordionItem value="google" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Google Cloud APIs
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <div className="text-xs text-s4 leading-relaxed space-y-2">
                      <p className="font-medium text-fg">Quick Setup:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-1">
                        <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-b1 underline">console.cloud.google.com</a></li>
                        <li>Create a new project or select existing</li>
                        <li>Enable these APIs: Vision API, Custom Search API, Maps API, Places API</li>
                        <li>Go to Credentials → Create API Key</li>
                        <li>Restrict key to enabled APIs only</li>
                        <li>Copy and paste the key below</li>
                      </ol>
                      <p className="text-fg font-medium pt-1">
                        Need help? See <a href="https://github.com/yourusername/resale-scanner/blob/main/GOOGLE_CLOUD_SETUP.md" target="_blank" rel="noopener noreferrer" className="text-b1 underline">detailed setup guide</a>
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="google-api-key" className="text-xs uppercase tracking-wide text-s4">
                      Google Cloud API Key
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('google')}
                      className="text-s3 hover:text-fg"
                    >
                      {showKeys.google ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="google-api-key"
                    type={showKeys.google ? 'text' : 'password'}
                    value={settings.googleApiKey || ''}
                    onChange={(e) => onUpdate({ googleApiKey: e.target.value })}
                    placeholder="AIzaSy... (for Vision, Maps, Places)"
                    className="font-mono text-sm"
                  />
                  {hasKey(settings.googleApiKey) && (
                    <p className="text-xs text-green mt-1 flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" /> Key configured - Google Lens enabled
                    </p>
                  )}
                  {!hasKey(settings.googleApiKey) && (
                    <p className="text-xs text-amber mt-1">
                      Required for real-time product matching
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="google-search-engine-id" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
                    Custom Search Engine ID (Optional)
                  </Label>
                  <Input
                    id="google-search-engine-id"
                    type="text"
                    value={settings.googleSearchEngineId || ''}
                    onChange={(e) => onUpdate({ googleSearchEngineId: e.target.value })}
                    placeholder="Your Custom Search Engine ID"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-s4 mt-1">
                    For enhanced visual search. Get it from <a href="https://programmablesearchengine.google.com" target="_blank" rel="noopener noreferrer" className="text-b1 underline">programmablesearchengine.google.com</a>
                  </p>
                </div>

                <div className="p-3 bg-s1 border border-s2 rounded-md">
                  <p className="text-xs font-medium text-fg mb-2">What you get with Google Cloud APIs:</p>
                  <ul className="text-xs text-s4 space-y-1 ml-4 list-disc">
                    <li><span className="font-medium text-fg">Vision API:</span> Product identification from photos</li>
                    <li><span className="font-medium text-fg">Custom Search:</span> Visual product matching across web</li>
                    <li><span className="font-medium text-fg">Maps API:</span> Local market intelligence & store finder</li>
                    <li><span className="font-medium text-fg">Places API:</span> Thrift store locations & ratings</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ebay" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                eBay Integration
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 bg-t4 border border-t3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="text-b1 mt-0.5" size={16} />
                    <p className="text-xs text-s4 leading-relaxed">
                      Get your keys from developer.ebay.com. You'll need App ID, Dev ID, Cert ID, and OAuth token.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-app-id" className="text-xs uppercase tracking-wide text-s4">
                      eBay App ID (Client ID)
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayApp')}
                      className="text-s3 hover:text-fg"
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
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-dev-id" className="text-xs uppercase tracking-wide text-s4">
                      eBay Dev ID
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayDev')}
                      className="text-s3 hover:text-fg"
                    >
                      {showKeys.ebayDev ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="ebay-dev-id"
                    type={showKeys.ebayDev ? 'text' : 'password'}
                    value={settings.ebayDevId || ''}
                    onChange={(e) => onUpdate({ ebayDevId: e.target.value })}
                    placeholder="Dev ID..."
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-cert-id" className="text-xs uppercase tracking-wide text-s4">
                      eBay Cert ID (Client Secret)
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayCert')}
                      className="text-s3 hover:text-fg"
                    >
                      {showKeys.ebayCert ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    id="ebay-cert-id"
                    type={showKeys.ebayCert ? 'text' : 'password'}
                    value={settings.ebayCertId || ''}
                    onChange={(e) => onUpdate({ ebayCertId: e.target.value })}
                    placeholder="PRD-..."
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-api-key" className="text-xs uppercase tracking-wide text-s4">
                      eBay OAuth Token
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('ebayToken')}
                      className="text-s3 hover:text-fg"
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
                  {hasKey(settings.ebayApiKey) && hasKey(settings.ebayAppId) && (
                    <p className="text-xs text-green mt-1 flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" /> Integration configured
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="database" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Database & Automation
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="supabase-url" className="text-xs uppercase tracking-wide text-s4">
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
                    <Label htmlFor="supabase-key" className="text-xs uppercase tracking-wide text-s4">
                      Supabase Anon Key
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('supabase')}
                      className="text-s3 hover:text-fg"
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
                    <Label htmlFor="n8n-webhook" className="text-xs uppercase tracking-wide text-s4">
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
                  <p className="text-xs text-s4 mt-1">For automated workflows and data sync</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="notion-api-key" className="text-xs uppercase tracking-wide text-s4">
                      Notion Integration Token
                    </Label>
                    <button
                      onClick={() => toggleKeyVisibility('notion')}
                      className="text-s3 hover:text-fg"
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
                  <Label htmlFor="notion-db-id" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
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

            <AccordionItem value="features" className="border border-s2 rounded-lg px-4 bg-s1">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Feature Toggles
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="agentic-mode" className="text-sm text-fg font-medium">
                      Agentic Mode
                    </Label>
                    <p className="text-xs text-s4 mt-0.5">AI agents assist throughout workflow</p>
                  </div>
                  <Switch
                    id="agentic-mode"
                    checked={settings.agenticMode}
                    onCheckedChange={(checked) => onUpdate({ agenticMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="live-search" className="text-sm text-fg font-medium">
                      Live Search
                    </Label>
                    <p className="text-xs text-s4 mt-0.5">Real-time Google Search & Maps data</p>
                  </div>
                  <Switch
                    id="live-search"
                    checked={settings.liveSearchEnabled}
                    onCheckedChange={(checked) => onUpdate({ liveSearchEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="voice-enabled" className="text-sm text-fg font-medium">
                      Voice Input
                    </Label>
                    <p className="text-xs text-s4 mt-0.5">Voice commands and dictation</p>
                  </div>
                  <Switch
                    id="voice-enabled"
                    checked={settings.voiceEnabled}
                    onCheckedChange={(checked) => onUpdate({ voiceEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="auto-capture" className="text-sm text-fg font-medium">
                      Auto-Capture
                    </Label>
                    <p className="text-xs text-s4 mt-0.5">Analyze immediately after photo</p>
                  </div>
                  <Switch
                    id="auto-capture"
                    checked={settings.autoCapture}
                    onCheckedChange={(checked) => onUpdate({ autoCapture: checked })}
                  />
                </div>

                <Separator className="bg-s2" />

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="theme-mode" className="text-sm text-fg font-medium">
                      Theme Mode
                    </Label>
                    <p className="text-xs text-s4 mt-0.5">Optimized for low-light scanning</p>
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
                    <p className="text-xs text-s4">Always use dark theme for scanning</p>
                  )}
                  {settings.themeMode === 'light' && (
                    <p className="text-xs text-s4">Always use light theme</p>
                  )}
                </div>

                {settings.themeMode === 'auto' && (
                  <div className="flex items-center justify-between py-2 pl-4 border-l-2 border-b1">
                    <div>
                      <Label htmlFor="use-ambient-light" className="text-sm text-fg font-medium">
                        Use Ambient Light Sensor
                      </Label>
                      <p className="text-xs text-s4 mt-0.5">Switch theme based on room lighting (experimental)</p>
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

              <AccordionContent className="space-y-4 pt-2">
              <AccordionTrigger className="text-sm font-semibold text-fg uppercase tracking-wide hover:no-underline">
                Business Rules
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="min-profit" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
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
                  <p className="text-xs text-s4 mt-1">Minimum margin for GO decision</p>
                </div>

                <div>
                  <Label htmlFor="shipping-cost" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
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
                  <Label htmlFor="ebay-fee" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
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
                  <Label htmlFor="paypal-fee" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
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

          <div className="pt-4">
            <Button 
              variant="outline" 
              className="w-full text-red hover:bg-red hover:text-bg border-s2 hover:border-red"
            >
              Clear All App Data
            </Button>
            <p className="text-xs text-s4 text-center mt-2">
              This will reset all settings and stored data
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
