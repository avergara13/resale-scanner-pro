import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import type { AppSettings } from '@/types'

interface SettingsScreenProps {
  settings: AppSettings
  onUpdate: (settings: Partial<AppSettings>) => void
}

export function SettingsScreen({ settings, onUpdate }: SettingsScreenProps) {
  return (
    <div id="scr-settings" className="flex flex-col h-full">
      <div className="px-4 py-6 border-b border-s2">
        <h1 className="text-2xl font-semibold text-fg mb-2">Settings</h1>
        <p className="text-sm text-s4">Configure your app and API integrations</p>
      </div>

      <ScrollArea className="flex-1 px-4 py-6">
        <div className="space-y-6 max-w-md">
          <div>
            <h2 className="text-sm font-semibold text-fg uppercase tracking-wide mb-4">API Keys</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="gemini-api-key" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
                  Google Gemini API Key
                </Label>
                <Input
                  id="gemini-api-key"
                  type="password"
                  value={settings.geminiApiKey || ''}
                  onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
                  placeholder="Enter Gemini API key"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="google-api-key" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
                  Google Cloud API Key
                </Label>
                <Input
                  id="google-api-key"
                  type="password"
                  value={settings.googleApiKey || ''}
                  onChange={(e) => onUpdate({ googleApiKey: e.target.value })}
                  placeholder="For Lens, Maps, Search"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="ebay-api-key" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
                  eBay API Key
                </Label>
                <Input
                  id="ebay-api-key"
                  type="password"
                  value={settings.ebayApiKey || ''}
                  onChange={(e) => onUpdate({ ebayApiKey: e.target.value })}
                  placeholder="Enter eBay API key"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h2 className="text-sm font-semibold text-fg uppercase tracking-wide mb-4">App Preferences</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="voice-enabled" className="text-sm text-fg">
                    Voice Input
                  </Label>
                  <p className="text-xs text-s4 mt-0.5">Enable voice commands and dictation</p>
                </div>
                <Switch
                  id="voice-enabled"
                  checked={settings.voiceEnabled}
                  onCheckedChange={(checked) => onUpdate({ voiceEnabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-capture" className="text-sm text-fg">
                    Auto-Capture
                  </Label>
                  <p className="text-xs text-s4 mt-0.5">Automatically analyze after photo</p>
                </div>
                <Switch
                  id="auto-capture"
                  checked={settings.autoCapture}
                  onCheckedChange={(checked) => onUpdate({ autoCapture: checked })}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h2 className="text-sm font-semibold text-fg uppercase tracking-wide mb-4">Business Settings</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="min-profit" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
                  Min. Profit Margin (%)
                </Label>
                <Input
                  id="min-profit"
                  type="number"
                  step="1"
                  value={settings.minProfitMargin}
                  onChange={(e) => onUpdate({ minProfitMargin: parseInt(e.target.value) || 0 })}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="shipping-cost" className="text-xs uppercase tracking-wide text-s4 mb-1.5">
                  Default Shipping Cost ($)
                </Label>
                <Input
                  id="shipping-cost"
                  type="number"
                  step="0.01"
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
                  value={settings.ebayFeePercent}
                  onChange={(e) => onUpdate({ ebayFeePercent: parseFloat(e.target.value) || 0 })}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <Button variant="outline" className="w-full text-s4 hover:text-red hover:border-red">
              Clear All Data
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
