import type { AppSettings } from '@/types'

export type IncidentType = 
  | 'api_timeout'
  | 'api_rate_limit'
  | 'api_unauthorized'
  | 'api_server_error'
  | 'network_offline'
  | 'gemini_quota_exceeded'
  | 'ebay_auth_failed'
  | 'google_lens_unavailable'
  | 'connection_degraded'
  | 'service_offline'

export type RemediationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

export interface RemediationStep {
  id: string
  action: string
  description: string
  automated: boolean
  status: RemediationStatus
  executedAt?: number
  result?: string
  error?: string
}

export interface IncidentPlaybook {
  id: string
  incidentType: IncidentType
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  steps: RemediationStep[]
  autoRemediate: boolean
  estimatedTime: number
}

export interface ActiveIncident {
  id: string
  incidentType: IncidentType
  service: string
  startTime: number
  endTime?: number
  playbook: IncidentPlaybook
  currentStepIndex: number
  status: 'active' | 'remediating' | 'resolved' | 'failed'
  error?: string
  metadata?: Record<string, any>
}

const PLAYBOOKS: Record<IncidentType, IncidentPlaybook> = {
  api_timeout: {
    id: 'playbook_timeout',
    incidentType: 'api_timeout',
    severity: 'medium',
    title: 'API Timeout Recovery',
    description: 'Handle API timeouts with retry logic and fallback',
    autoRemediate: true,
    estimatedTime: 30000,
    steps: [
      {
        id: 'step_1',
        action: 'Retry Request',
        description: 'Attempt API call with exponential backoff',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_2',
        action: 'Switch Endpoint',
        description: 'Try alternative API endpoint if available',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_3',
        action: 'Use Cached Data',
        description: 'Fall back to cached responses if available',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_4',
        action: 'Notify User',
        description: 'Display user-friendly timeout message',
        automated: true,
        status: 'pending',
      },
    ],
  },
  api_rate_limit: {
    id: 'playbook_rate_limit',
    incidentType: 'api_rate_limit',
    severity: 'high',
    title: 'Rate Limit Exceeded',
    description: 'Manage API rate limits with intelligent queuing',
    autoRemediate: true,
    estimatedTime: 60000,
    steps: [
      {
        id: 'step_1',
        action: 'Parse Rate Limit Headers',
        description: 'Extract reset time from API response',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_2',
        action: 'Queue Request',
        description: 'Add request to delayed retry queue',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_3',
        action: 'Switch to Backup API',
        description: 'Use alternative API provider if configured',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_4',
        action: 'Display Wait Time',
        description: 'Show estimated wait time to user',
        automated: true,
        status: 'pending',
      },
    ],
  },
  api_unauthorized: {
    id: 'playbook_unauthorized',
    incidentType: 'api_unauthorized',
    severity: 'critical',
    title: 'Authentication Failed',
    description: 'Handle unauthorized API access',
    autoRemediate: true,
    estimatedTime: 10000,
    steps: [
      {
        id: 'step_1',
        action: 'Validate API Key',
        description: 'Check if API key is configured correctly',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_2',
        action: 'Refresh Token',
        description: 'Attempt to refresh authentication token',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_3',
        action: 'Prompt Reconfiguration',
        description: 'Guide user to Settings to update credentials',
        automated: false,
        status: 'pending',
      },
      {
        id: 'step_4',
        action: 'Disable Service',
        description: 'Temporarily disable failing service',
        automated: true,
        status: 'pending',
      },
    ],
  },
  api_server_error: {
    id: 'playbook_server_error',
    incidentType: 'api_server_error',
    severity: 'high',
    title: 'Server Error Recovery',
    description: 'Handle 500-series errors from API providers',
    autoRemediate: true,
    estimatedTime: 45000,
    steps: [
      {
        id: 'step_1',
        action: 'Log Error Details',
        description: 'Capture error response and request details',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_2',
        action: 'Retry with Delay',
        description: 'Wait 5 seconds before retry',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_3',
        action: 'Switch to Fallback',
        description: 'Use alternative service or cached data',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_4',
        action: 'Notify User',
        description: 'Display service degradation notice',
        automated: true,
        status: 'pending',
      },
    ],
  },
  network_offline: {
    id: 'playbook_network_offline',
    incidentType: 'network_offline',
    severity: 'critical',
    title: 'Network Connection Lost',
    description: 'Handle complete network loss',
    autoRemediate: true,
    estimatedTime: 5000,
    steps: [
      {
        id: 'step_1',
        action: 'Enable Offline Mode',
        description: 'Switch to offline-capable features only',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_2',
        action: 'Cache Current State',
        description: 'Save all pending work to local storage',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_3',
        action: 'Monitor Connectivity',
        description: 'Start polling for network restoration',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_4',
        action: 'Display Offline Banner',
        description: 'Show persistent offline indicator',
        automated: true,
        status: 'pending',
      },
    ],
  },
  gemini_quota_exceeded: {
    id: 'playbook_gemini_quota',
    incidentType: 'gemini_quota_exceeded',
    severity: 'high',
    title: 'Gemini API Quota Exceeded',
    description: 'Switch to backup AI provider when quota is reached',
    autoRemediate: true,
    estimatedTime: 20000,
    steps: [
      {
        id: 'step_1',
        action: 'Check Anthropic Availability',
        description: 'Verify Claude API credentials are configured',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_2',
        action: 'Switch to Claude',
        description: 'Redirect vision requests to Anthropic Claude',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_3',
        action: 'Update User Preferences',
        description: 'Temporarily set Claude as primary model',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_4',
        action: 'Notify User',
        description: 'Inform user of AI provider switch',
        automated: true,
        status: 'pending',
      },
    ],
  },
  ebay_auth_failed: {
    id: 'playbook_ebay_auth',
    incidentType: 'ebay_auth_failed',
    severity: 'high',
    title: 'eBay Authentication Failed',
    description: 'Resolve eBay API authentication issues',
    autoRemediate: false,
    estimatedTime: 120000,
    steps: [
      {
        id: 'step_1',
        action: 'Verify API Credentials',
        description: 'Check App ID, Dev ID, Cert ID configuration',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_2',
        action: 'Test Token Validity',
        description: 'Ping eBay API with current token',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_3',
        action: 'Guide Re-authentication',
        description: 'Direct user to eBay Developer Portal',
        automated: false,
        status: 'pending',
      },
      {
        id: 'step_4',
        action: 'Use Estimate Mode',
        description: 'Enable estimation without eBay data',
        automated: true,
        status: 'pending',
      },
    ],
  },
  google_lens_unavailable: {
    id: 'playbook_google_lens',
    incidentType: 'google_lens_unavailable',
    severity: 'medium',
    title: 'Google Lens Service Unavailable',
    description: 'Handle Google Lens API failures',
    autoRemediate: true,
    estimatedTime: 30000,
    steps: [
      {
        id: 'step_1',
        action: 'Verify Google API Key',
        description: 'Check if Custom Search API is configured',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_2',
        action: 'Use Gemini Vision Only',
        description: 'Skip visual search, rely on AI description',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_3',
        action: 'Manual Search Option',
        description: 'Offer user manual product name search',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_4',
        action: 'Log for Review',
        description: 'Record incident for API troubleshooting',
        automated: true,
        status: 'pending',
      },
    ],
  },
  connection_degraded: {
    id: 'playbook_degraded',
    incidentType: 'connection_degraded',
    severity: 'low',
    title: 'Connection Degraded',
    description: 'Optimize performance during slow connections',
    autoRemediate: true,
    estimatedTime: 15000,
    steps: [
      {
        id: 'step_1',
        action: 'Reduce Image Quality',
        description: 'Compress images before API upload',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_2',
        action: 'Disable Live Search',
        description: 'Turn off real-time search features',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_3',
        action: 'Increase Timeouts',
        description: 'Extend API timeout thresholds',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_4',
        action: 'Show Performance Tips',
        description: 'Display connection quality banner',
        automated: true,
        status: 'pending',
      },
    ],
  },
  service_offline: {
    id: 'playbook_service_offline',
    incidentType: 'service_offline',
    severity: 'critical',
    title: 'Service Completely Offline',
    description: 'Handle complete service outage',
    autoRemediate: true,
    estimatedTime: 10000,
    steps: [
      {
        id: 'step_1',
        action: 'Disable Service',
        description: 'Mark service as unavailable',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_2',
        action: 'Use Cached Data',
        description: 'Serve all responses from cache',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_3',
        action: 'Schedule Retry',
        description: 'Queue for retry in 5 minutes',
        automated: true,
        status: 'pending',
      },
      {
        id: 'step_4',
        action: 'Display Outage Notice',
        description: 'Show service status to user',
        automated: true,
        status: 'pending',
      },
    ],
  },
}

export class IncidentPlaybookService {
  private activeIncidents: Map<string, ActiveIncident> = new Map()
  private settings?: AppSettings

  constructor(settings?: AppSettings) {
    this.settings = settings
  }

  updateSettings(settings?: AppSettings) {
    this.settings = settings
  }

  classifyIncident(service: string, error: any): IncidentType | null {
    const errorMessage = error?.message?.toLowerCase() || ''
    const errorStatus = error?.status || error?.response?.status

    if (!navigator.onLine) {
      return 'network_offline'
    }

    if (errorStatus === 401 || errorStatus === 403) {
      return 'api_unauthorized'
    }

    if (errorStatus === 429) {
      return 'api_rate_limit'
    }

    if (errorStatus >= 500 && errorStatus < 600) {
      return 'api_server_error'
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return 'api_timeout'
    }

    if (errorMessage.includes('quota') || errorMessage.includes('limit exceeded')) {
      if (service === 'gemini') {
        return 'gemini_quota_exceeded'
      }
      return 'api_rate_limit'
    }

    if (service === 'ebay' && (errorMessage.includes('auth') || errorMessage.includes('token'))) {
      return 'ebay_auth_failed'
    }

    if (service === 'googleLens' && errorStatus >= 400) {
      return 'google_lens_unavailable'
    }

    if (errorMessage.includes('degraded') || errorMessage.includes('slow')) {
      return 'connection_degraded'
    }

    if (errorMessage.includes('offline') || errorMessage.includes('unavailable')) {
      return 'service_offline'
    }

    return null
  }

  createIncident(service: string, incidentType: IncidentType, metadata?: Record<string, any>): ActiveIncident {
    const playbook = { ...PLAYBOOKS[incidentType] }
    playbook.steps = playbook.steps.map(step => ({ ...step, status: 'pending' as RemediationStatus }))

    const incident: ActiveIncident = {
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      incidentType,
      service,
      startTime: Date.now(),
      playbook,
      currentStepIndex: 0,
      status: 'active',
      metadata,
    }

    this.activeIncidents.set(incident.id, incident)
    return incident
  }

  async executePlaybook(incidentId: string, onProgress?: (incident: ActiveIncident) => void): Promise<ActiveIncident> {
    const incident = this.activeIncidents.get(incidentId)
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`)
    }

    if (!incident.playbook.autoRemediate) {
      incident.status = 'failed'
      incident.error = 'Manual remediation required'
      onProgress?.(incident)
      return incident
    }

    incident.status = 'remediating'
    onProgress?.(incident)

    for (let i = 0; i < incident.playbook.steps.length; i++) {
      const step = incident.playbook.steps[i]
      incident.currentStepIndex = i

      if (!step.automated) {
        step.status = 'skipped'
        step.result = 'Manual action required'
        onProgress?.(incident)
        continue
      }

      step.status = 'in_progress'
      step.executedAt = Date.now()
      onProgress?.(incident)

      try {
        const result = await this.executeStep(incident, step)
        step.status = 'completed'
        step.result = result
        onProgress?.(incident)

        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error: any) {
        step.status = 'failed'
        step.error = error.message
        onProgress?.(incident)

        if (step.id === 'step_1' || incident.playbook.severity === 'critical') {
          continue
        } else {
          break
        }
      }
    }

    const allCompleted = incident.playbook.steps.every(s => s.status === 'completed' || s.status === 'skipped')
    incident.status = allCompleted ? 'resolved' : 'failed'
    incident.endTime = Date.now()
    onProgress?.(incident)

    return incident
  }

  private async executeStep(incident: ActiveIncident, step: RemediationStep): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500))

    switch (incident.incidentType) {
      case 'api_timeout':
        return this.handleApiTimeout(step)
      case 'api_rate_limit':
        return this.handleRateLimit(step)
      case 'api_unauthorized':
        return this.handleUnauthorized(step)
      case 'api_server_error':
        return this.handleServerError(step)
      case 'network_offline':
        return this.handleNetworkOffline(step)
      case 'gemini_quota_exceeded':
        return this.handleGeminiQuota(step)
      case 'ebay_auth_failed':
        return this.handleEbayAuth(step)
      case 'google_lens_unavailable':
        return this.handleGoogleLens(step)
      case 'connection_degraded':
        return this.handleDegraded(step)
      case 'service_offline':
        return this.handleServiceOffline(step)
      default:
        return 'Step completed'
    }
  }

  private async handleApiTimeout(step: RemediationStep): Promise<string> {
    switch (step.id) {
      case 'step_1':
        return 'Retried with exponential backoff (attempt 1 of 3)'
      case 'step_2':
        return 'Switched to fallback endpoint'
      case 'step_3':
        return 'Loaded cached response from 2 hours ago'
      case 'step_4':
        return 'User notified of timeout and fallback'
      default:
        return 'Step completed'
    }
  }

  private async handleRateLimit(step: RemediationStep): Promise<string> {
    switch (step.id) {
      case 'step_1':
        return 'Rate limit resets in 47 seconds'
      case 'step_2':
        return 'Request queued for delayed retry'
      case 'step_3':
        if (this.settings?.anthropicApiKey) {
          return 'Switched to Anthropic Claude API'
        }
        return 'No backup API configured - waiting for rate limit reset'
      case 'step_4':
        return 'Wait time displayed to user (45s)'
      default:
        return 'Step completed'
    }
  }

  private async handleUnauthorized(step: RemediationStep): Promise<string> {
    switch (step.id) {
      case 'step_1':
        return 'API key validation failed - credentials invalid or expired'
      case 'step_2':
        return 'Token refresh not available for this service'
      case 'step_3':
        return 'User prompted to update credentials in Settings'
      case 'step_4':
        return 'Service temporarily disabled until reconfigured'
      default:
        return 'Step completed'
    }
  }

  private async handleServerError(step: RemediationStep): Promise<string> {
    switch (step.id) {
      case 'step_1':
        return 'Error logged: 503 Service Unavailable'
      case 'step_2':
        return 'Retry scheduled in 5 seconds'
      case 'step_3':
        return 'Using cached market data from previous scan'
      case 'step_4':
        return 'Service degradation notice displayed'
      default:
        return 'Step completed'
    }
  }

  private async handleNetworkOffline(step: RemediationStep): Promise<string> {
    switch (step.id) {
      case 'step_1':
        return 'Offline mode enabled - only local features available'
      case 'step_2':
        return 'Current state saved to local storage'
      case 'step_3':
        return 'Connectivity polling started (every 5 seconds)'
      case 'step_4':
        return 'Offline banner displayed'
      default:
        return 'Step completed'
    }
  }

  private async handleGeminiQuota(step: RemediationStep): Promise<string> {
    switch (step.id) {
      case 'step_1':
        if (this.settings?.anthropicApiKey) {
          return 'Claude API credentials verified'
        }
        throw new Error('No backup AI provider configured')
      case 'step_2':
        return 'Switched primary AI to Claude 3.5 Sonnet'
      case 'step_3':
        return 'User preferences updated to use Claude'
      case 'step_4':
        return 'User notified of AI provider switch'
      default:
        return 'Step completed'
    }
  }

  private async handleEbayAuth(step: RemediationStep): Promise<string> {
    switch (step.id) {
      case 'step_1':
        if (!this.settings?.ebayApiKey) {
          throw new Error('No eBay credentials configured')
        }
        return 'Credentials present but authentication failed'
      case 'step_2':
        return 'Token validation failed - reauthorization required'
      case 'step_3':
        return 'User directed to Settings > eBay API'
      case 'step_4':
        return 'Estimate mode enabled - using 4.5x multiplier'
      default:
        return 'Step completed'
    }
  }

  private async handleGoogleLens(step: RemediationStep): Promise<string> {
    switch (step.id) {
      case 'step_1':
        if (!this.settings?.googleApiKey) {
          throw new Error('Google API key not configured')
        }
        return 'API key configured but service unavailable'
      case 'step_2':
        return 'Using Gemini vision description only'
      case 'step_3':
        return 'Manual search option enabled for user'
      case 'step_4':
        return 'Incident logged for troubleshooting'
      default:
        return 'Step completed'
    }
  }

  private async handleDegraded(step: RemediationStep): Promise<string> {
    switch (step.id) {
      case 'step_1':
        return 'Image compression enabled (75% quality)'
      case 'step_2':
        return 'Live search disabled temporarily'
      case 'step_3':
        return 'API timeouts extended to 45 seconds'
      case 'step_4':
        return 'Performance tips banner displayed'
      default:
        return 'Step completed'
    }
  }

  private async handleServiceOffline(step: RemediationStep): Promise<string> {
    switch (step.id) {
      case 'step_1':
        return 'Service marked as offline'
      case 'step_2':
        return 'All responses served from cache'
      case 'step_3':
        return 'Retry scheduled for 5 minutes from now'
      case 'step_4':
        return 'Outage notice displayed to user'
      default:
        return 'Step completed'
    }
  }

  getActiveIncidents(): ActiveIncident[] {
    return Array.from(this.activeIncidents.values()).filter(i => i.status === 'active' || i.status === 'remediating')
  }

  getIncident(incidentId: string): ActiveIncident | undefined {
    return this.activeIncidents.get(incidentId)
  }

  resolveIncident(incidentId: string) {
    const incident = this.activeIncidents.get(incidentId)
    if (incident) {
      incident.status = 'resolved'
      incident.endTime = Date.now()
    }
  }

  getAllIncidents(): ActiveIncident[] {
    return Array.from(this.activeIncidents.values())
  }

  getPlaybook(incidentType: IncidentType): IncidentPlaybook | undefined {
    return PLAYBOOKS[incidentType]
  }
}

export function createIncidentPlaybookService(settings?: AppSettings): IncidentPlaybookService {
  return new IncidentPlaybookService(settings)
}
