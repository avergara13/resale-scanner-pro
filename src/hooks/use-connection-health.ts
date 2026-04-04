import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '@/types'

export type ConnectionStatus = 'healthy' | 'degraded' | 'offline' | 'checking'

export interface ServiceHealth {
  name: string
  status: ConnectionStatus
  latency?: number
  lastChecked?: number
  error?: string
  configured: boolean
  critical: boolean
}

export interface ConnectionHealth {
  gemini: ServiceHealth
  googleLens: ServiceHealth
  ebay: ServiceHealth
  anthropic: ServiceHealth
  overall: ConnectionStatus
  lastUpdate: number
}

interface UseConnectionHealthOptions {
  settings?: AppSettings
  checkInterval?: number
  enabled?: boolean
}

const DEFAULT_CHECK_INTERVAL = 30000

async function checkGeminiHealth(apiKey?: string): Promise<Omit<ServiceHealth, 'name' | 'configured' | 'critical'>> {
  if (!apiKey) {
    return { status: 'offline', error: 'API key not configured' }
  }

  const startTime = Date.now()
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )
    
    const latency = Date.now() - startTime
    
    if (response.ok) {
      return {
        status: latency < 1000 ? 'healthy' : 'degraded',
        latency,
        lastChecked: Date.now(),
      }
    }
    
    return {
      status: 'offline',
      error: `HTTP ${response.status}`,
      latency,
      lastChecked: Date.now(),
    }
  } catch (error) {
    return {
      status: 'offline',
      error: error instanceof Error ? error.message : 'Network error',
      latency: Date.now() - startTime,
      lastChecked: Date.now(),
    }
  }
}

async function checkGoogleLensHealth(
  apiKey?: string,
): Promise<Omit<ServiceHealth, 'name' | 'configured' | 'critical'>> {
  if (!apiKey) {
    return { status: 'offline', error: 'API key not configured' }
  }

  const startTime = Date.now()

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [] }),
      }
    )

    const latency = Date.now() - startTime

    if (response.ok) {
      return {
        status: latency < 2000 ? 'healthy' : 'degraded',
        latency,
        lastChecked: Date.now(),
      }
    }

    return {
      status: 'offline',
      error: `HTTP ${response.status}`,
      latency,
      lastChecked: Date.now(),
    }
  } catch (error) {
    return {
      status: 'offline',
      error: error instanceof Error ? error.message : 'Network error',
      latency: Date.now() - startTime,
      lastChecked: Date.now(),
    }
  }
}

async function checkAnthropicHealth(apiKey?: string): Promise<Omit<ServiceHealth, 'name' | 'configured' | 'critical'>> {
  if (!apiKey) {
    return { status: 'offline', error: 'API key not configured' }
  }

  const startTime = Date.now()

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })

    const latency = Date.now() - startTime

    if (response.ok) {
      return {
        status: latency < 1000 ? 'healthy' : 'degraded',
        latency,
        lastChecked: Date.now(),
      }
    }

    return {
      status: 'offline',
      error: `HTTP ${response.status}`,
      latency,
      lastChecked: Date.now(),
    }
  } catch (error) {
    return {
      status: 'offline',
      error: error instanceof Error ? error.message : 'Network error',
      latency: Date.now() - startTime,
      lastChecked: Date.now(),
    }
  }
}

async function checkEbayHealth(
  apiKey?: string,
  appId?: string
): Promise<Omit<ServiceHealth, 'name' | 'configured' | 'critical'>> {
  if (!apiKey || !appId) {
    return { status: 'offline', error: 'API credentials not configured' }
  }

  const startTime = Date.now()
  
  try {
    const response = await fetch(
      `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${appId}&RESPONSE-DATA-FORMAT=JSON&keywords=test&paginationInput.entriesPerPage=1`,
      {
        method: 'GET',
      }
    )
    
    const latency = Date.now() - startTime
    
    if (response.ok) {
      const data = await response.json()
      const hasError = data.findItemsByKeywordsResponse?.[0]?.ack?.[0] === 'Failure'
      
      if (hasError) {
        return {
          status: 'offline',
          error: 'Invalid credentials',
          latency,
          lastChecked: Date.now(),
        }
      }
      
      return {
        status: latency < 2000 ? 'healthy' : 'degraded',
        latency,
        lastChecked: Date.now(),
      }
    }
    
    return {
      status: 'offline',
      error: `HTTP ${response.status}`,
      latency,
      lastChecked: Date.now(),
    }
  } catch (error) {
    return {
      status: 'offline',
      error: error instanceof Error ? error.message : 'Network error',
      latency: Date.now() - startTime,
      lastChecked: Date.now(),
    }
  }
}

function calculateOverallStatus(services: ServiceHealth[]): ConnectionStatus {
  const criticalServices = services.filter(s => s.critical)
  const configuredServices = services.filter(s => s.configured)
  
  if (configuredServices.length === 0) {
    return 'offline'
  }
  
  const criticalOffline = criticalServices.some(s => s.status === 'offline')
  if (criticalOffline) {
    return 'offline'
  }
  
  const anyChecking = configuredServices.some(s => s.status === 'checking')
  if (anyChecking) {
    return 'checking'
  }
  
  const anyDegraded = configuredServices.some(s => s.status === 'degraded')
  if (anyDegraded) {
    return 'degraded'
  }
  
  const allHealthy = configuredServices.every(s => s.status === 'healthy')
  if (allHealthy) {
    return 'healthy'
  }
  
  return 'degraded'
}

export function useConnectionHealth({
  settings,
  checkInterval = DEFAULT_CHECK_INTERVAL,
  enabled = true,
}: UseConnectionHealthOptions = {}) {
  const [health, setHealth] = useState<ConnectionHealth>({
    gemini: {
      name: 'Gemini AI',
      status: 'checking',
      configured: false,
      critical: true,
    },
    googleLens: {
      name: 'Google Vision',
      status: 'checking',
      configured: false,
      critical: false,
    },
    ebay: {
      name: 'eBay API',
      status: 'checking',
      configured: false,
      critical: false,
    },
    anthropic: {
      name: 'Anthropic (Claude)',
      status: 'checking',
      configured: false,
      critical: false,
    },
    overall: 'checking',
    lastUpdate: Date.now(),
  })

  const checkHealth = useCallback(async () => {
    if (!enabled) return

    const geminiConfigured = !!settings?.geminiApiKey
    const googleLensConfigured = !!settings?.googleApiKey
    const ebayConfigured = !!(settings?.ebayApiKey && settings?.ebayAppId)
    const anthropicConfigured = !!settings?.anthropicApiKey

    setHealth(prev => ({
      ...prev,
      gemini: { ...prev.gemini, status: 'checking', configured: geminiConfigured },
      googleLens: { ...prev.googleLens, status: 'checking', configured: googleLensConfigured },
      ebay: { ...prev.ebay, status: 'checking', configured: ebayConfigured },
      anthropic: { ...prev.anthropic, status: 'checking', configured: anthropicConfigured },
      overall: 'checking',
    }))

    const [geminiHealth, googleLensHealth, ebayHealth, anthropicHealth] = await Promise.all([
      checkGeminiHealth(settings?.geminiApiKey),
      checkGoogleLensHealth(settings?.googleApiKey),
      checkEbayHealth(settings?.ebayApiKey, settings?.ebayAppId),
      checkAnthropicHealth(settings?.anthropicApiKey),
    ])

    const newHealth: ConnectionHealth = {
      gemini: {
        name: 'Gemini AI',
        ...geminiHealth,
        configured: geminiConfigured,
        critical: true,
      },
      googleLens: {
        name: 'Google Vision',
        ...googleLensHealth,
        configured: googleLensConfigured,
        critical: false,
      },
      ebay: {
        name: 'eBay API',
        ...ebayHealth,
        configured: ebayConfigured,
        critical: false,
      },
      anthropic: {
        name: 'Anthropic (Claude)',
        ...anthropicHealth,
        configured: anthropicConfigured,
        critical: false,
      },
      overall: 'checking',
      lastUpdate: Date.now(),
    }

    newHealth.overall = calculateOverallStatus([
      newHealth.gemini,
      newHealth.googleLens,
      newHealth.ebay,
      newHealth.anthropic,
    ])

    setHealth(newHealth)
  }, [settings, enabled])

  useEffect(() => {
    if (!enabled) return

    checkHealth()

    const interval = setInterval(checkHealth, checkInterval)

    return () => clearInterval(interval)
  }, [checkHealth, checkInterval, enabled])

  return {
    health,
    checkHealth,
    isHealthy: health.overall === 'healthy',
    isDegraded: health.overall === 'degraded',
    isOffline: health.overall === 'offline',
    isChecking: health.overall === 'checking',
  }
}
