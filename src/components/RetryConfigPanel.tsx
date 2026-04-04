import { useState } from 'react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { 
  ArrowsClockwise, 
  Clock, 
  Lightning, 
  ShieldCheck, 
  Warning,
  CheckCircle,
  Info
} from '@phosphor-icons/react'
import { 
  APIEndpoint, 
  ENDPOINT_RETRY_CONFIGS,
  getEndpointDescription,
  getEndpointPriority,
  formatRetryConfig 
} from '@/lib/retry-config'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { cn } from '@/lib/utils'

interface RetryConfigPanelProps {
  onConfigChange?: (endpoint: APIEndpoint, config: Partial<typeof ENDPOINT_RETRY_CONFIGS[APIEndpoint]>) => void
}

const PRIORITY_ICONS = {
  critical: ShieldCheck,
  high: Lightning,
  medium: Clock,
  low: Info,
}

const PRIORITY_COLORS = {
  critical: 'text-red',
  high: 'text-amber',
  medium: 'text-blue-600',
  low: 'text-t3',
}

const PRIORITY_BG = {
  critical: 'bg-red-bg',
  high: 'bg-amber/10',
  medium: 'bg-blue-bg',
  low: 'bg-s1',
}

export function RetryConfigPanel({ onConfigChange }: RetryConfigPanelProps) {
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set())
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')

  const toggleEndpoint = (endpoint: string) => {
    setExpandedEndpoints((prev) => {
      const next = new Set(prev)
      if (next.has(endpoint)) {
        next.delete(endpoint)
      } else {
        next.add(endpoint)
      }
      return next
    })
  }

  const endpoints = Object.entries(ENDPOINT_RETRY_CONFIGS).filter(([_, config]) => {
    if (selectedPriority === 'all') return true
    return config.priority === selectedPriority
  })

  const groupedEndpoints = endpoints.reduce((acc, [endpoint, config]) => {
    const priority = config.priority
    if (!acc[priority]) acc[priority] = []
    acc[priority].push([endpoint, config] as const)
    return acc
  }, {} as Record<string, Array<readonly [string, typeof ENDPOINT_RETRY_CONFIGS[APIEndpoint]]>>)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ArrowsClockwise size={20} weight="duotone" className="text-b1" />
          <h3 className="text-base font-bold text-t1">🔄 Retry Configuration</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {endpoints.length} Endpoint{endpoints.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2">
        <Button
          size="sm"
          variant={selectedPriority === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedPriority('all')}
          className="text-xs whitespace-nowrap"
        >
          All
        </Button>
        {(['critical', 'high', 'medium', 'low'] as const).map((priority) => {
          const Icon = PRIORITY_ICONS[priority]
          const count = Object.values(ENDPOINT_RETRY_CONFIGS).filter(c => c.priority === priority).length
          return (
            <Button
              key={priority}
              size="sm"
              variant={selectedPriority === priority ? 'default' : 'outline'}
              onClick={() => setSelectedPriority(priority)}
              className="text-xs whitespace-nowrap"
            >
              <Icon size={14} weight="duotone" className={cn(PRIORITY_COLORS[priority])} />
              {priority.charAt(0).toUpperCase() + priority.slice(1)} ({count})
            </Button>
          )
        })}
      </div>

      <div className="space-y-3">
        {Object.entries(groupedEndpoints).map(([priority, endpoints]) => (
          <div key={priority} className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-1">
              {(() => {
                const Icon = PRIORITY_ICONS[priority as keyof typeof PRIORITY_ICONS]
                return <Icon size={16} weight="duotone" className={cn(PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS])} />
              })()}
              <span className="text-xs font-bold text-t2 uppercase tracking-wider">
                {priority} Priority
              </span>
            </div>
            {endpoints.map(([endpoint, config]) => {
              const isExpanded = expandedEndpoints.has(endpoint)
              const Icon = PRIORITY_ICONS[config.priority]
              
              return (
                <Card
                  key={endpoint}
                  className={cn(
                    'overflow-hidden transition-all',
                    PRIORITY_BG[config.priority]
                  )}
                >
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleEndpoint(endpoint)}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-s1/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Icon size={18} weight="duotone" className={cn(PRIORITY_COLORS[config.priority])} />
                          <div className="text-left">
                            <div className="font-mono text-sm font-semibold text-t1">
                              {endpoint}
                            </div>
                            <div className="text-xs text-t3 line-clamp-1">
                              {config.description}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {config.cacheable && (
                            <Badge variant="outline" className="text-xs">
                              📦 Cached
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs font-mono">
                            {config.maxRetries}x
                          </Badge>
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-2 space-y-4 border-t border-s2">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="text-t3 font-medium">Max Retries</div>
                            <div className="font-mono text-sm text-t1 font-bold">{config.maxRetries}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-t3 font-medium">Timeout</div>
                            <div className="font-mono text-sm text-t1 font-bold">{(config.timeout! / 1000).toFixed(0)}s</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-t3 font-medium">Initial Delay</div>
                            <div className="font-mono text-sm text-t1 font-bold">{config.initialDelay}ms</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-t3 font-medium">Max Delay</div>
                            <div className="font-mono text-sm text-t1 font-bold">{config.maxDelay}ms</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-t3 font-medium">Backoff</div>
                            <div className="font-mono text-sm text-t1 font-bold">{config.backoffMultiplier}x</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-t3 font-medium">Priority</div>
                            <Badge variant="outline" className={cn('text-xs w-fit', PRIORITY_COLORS[config.priority])}>
                              {config.priority}
                            </Badge>
                          </div>
                        </div>

                        {config.cacheable && (
                          <div className="p-3 rounded-lg bg-s1 border border-s2">
                            <div className="flex items-start gap-2">
                              <CheckCircle size={16} weight="duotone" className="text-green mt-0.5" />
                              <div className="flex-1 space-y-1">
                                <div className="text-xs font-semibold text-t1">Response Caching Enabled</div>
                                <div className="text-xs text-t3">
                                  Cache timeout: {config.cacheTimeout ? `${(config.cacheTimeout / 60000).toFixed(0)} minutes` : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="p-3 rounded-lg bg-s1 border border-s2">
                          <div className="flex items-start gap-2">
                            <Warning size={16} weight="duotone" className="text-amber mt-0.5" />
                            <div className="flex-1 space-y-1">
                              <div className="text-xs font-semibold text-t1">Retryable HTTP Status Codes</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {config.retryableStatuses?.map((status) => (
                                  <Badge key={status} variant="outline" className="text-xs font-mono">
                                    {status}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )
            })}
          </div>
        ))}
      </div>

      <div className="p-4 rounded-lg bg-blue-bg border border-b1/20">
        <div className="flex items-start gap-3">
          <Info size={20} weight="duotone" className="text-b1 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-t1">About Retry Configuration</div>
            <div className="text-xs text-t2 leading-relaxed space-y-1">
              <p>
                Each API endpoint has customized retry behavior based on its criticality and typical failure patterns.
              </p>
              <p className="pt-1">
                <span className="font-semibold text-t1">Critical</span> endpoints get more retries and longer timeouts.
                <span className="font-semibold text-t1 ml-2">Cacheable</span> endpoints store responses to reduce API calls.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
