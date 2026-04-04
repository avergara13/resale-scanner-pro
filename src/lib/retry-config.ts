import { RetryOptions } from './retry-service'

export type APIEndpoint = 
  | 'gemini-vision'
  | 'gemini-chat'
  | 'google-lens'
  | 'ebay-search'
  | 'ebay-category'
  | 'ebay-listing'
  | 'notion-create'
  | 'notion-update'
  | 'image-optimization'
  | 'object-detection'
  | 'listing-optimization'
  | 'market-analysis'

export interface EndpointRetryConfig extends RetryOptions {
  priority: 'critical' | 'high' | 'medium' | 'low'
  cacheable: boolean
  cacheTimeout?: number
  description: string
}

export const ENDPOINT_RETRY_CONFIGS: Record<APIEndpoint, EndpointRetryConfig> = {
  'gemini-vision': {
    maxRetries: 3,
    initialDelay: 1500,
    maxDelay: 12000,
    backoffMultiplier: 2.5,
    timeout: 45000,
    priority: 'critical',
    cacheable: true,
    cacheTimeout: 300000,
    retryableStatuses: [429, 500, 502, 503, 504],
    description: 'Gemini AI vision analysis for product identification',
  },
  
  'gemini-chat': {
    maxRetries: 2,
    initialDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    timeout: 30000,
    priority: 'high',
    cacheable: false,
    retryableStatuses: [429, 500, 502, 503, 504],
    description: 'Gemini AI chat and conversational queries',
  },
  
  'google-lens': {
    maxRetries: 4,
    initialDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2.5,
    timeout: 40000,
    priority: 'high',
    cacheable: true,
    cacheTimeout: 600000,
    retryableStatuses: [429, 500, 502, 503, 504],
    description: 'Google Lens visual search for product matching',
  },
  
  'ebay-search': {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 20000,
    backoffMultiplier: 3,
    timeout: 50000,
    priority: 'critical',
    cacheable: true,
    cacheTimeout: 900000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    description: 'eBay marketplace search and completed listings',
  },
  
  'ebay-category': {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    timeout: 15000,
    priority: 'medium',
    cacheable: true,
    cacheTimeout: 86400000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    description: 'eBay category lookup for product classification',
  },
  
  'ebay-listing': {
    maxRetries: 4,
    initialDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2.5,
    timeout: 60000,
    priority: 'critical',
    cacheable: false,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    description: 'eBay listing creation and updates',
  },
  
  'notion-create': {
    maxRetries: 4,
    initialDelay: 1500,
    maxDelay: 12000,
    backoffMultiplier: 2.5,
    timeout: 45000,
    priority: 'critical',
    cacheable: false,
    retryableStatuses: [409, 429, 500, 502, 503, 504],
    description: 'Notion page creation for inventory tracking',
  },
  
  'notion-update': {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    timeout: 30000,
    priority: 'high',
    cacheable: false,
    retryableStatuses: [409, 429, 500, 502, 503, 504],
    description: 'Notion page updates for inventory modifications',
  },
  
  'image-optimization': {
    maxRetries: 2,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    timeout: 20000,
    priority: 'medium',
    cacheable: true,
    cacheTimeout: 3600000,
    retryableStatuses: [500, 502, 503, 504],
    description: 'Image compression and optimization processing',
  },
  
  'object-detection': {
    maxRetries: 3,
    initialDelay: 1500,
    maxDelay: 10000,
    backoffMultiplier: 2,
    timeout: 40000,
    priority: 'high',
    cacheable: true,
    cacheTimeout: 300000,
    retryableStatuses: [429, 500, 502, 503, 504],
    description: 'Multi-object detection in product images',
  },
  
  'listing-optimization': {
    maxRetries: 3,
    initialDelay: 1500,
    maxDelay: 12000,
    backoffMultiplier: 2.5,
    timeout: 40000,
    priority: 'high',
    cacheable: true,
    cacheTimeout: 600000,
    retryableStatuses: [429, 500, 502, 503, 504],
    description: 'AI-powered listing title and description optimization',
  },
  
  'market-analysis': {
    maxRetries: 4,
    initialDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2.5,
    timeout: 50000,
    priority: 'high',
    cacheable: true,
    cacheTimeout: 1800000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    description: 'Comprehensive market research and profit analysis',
  },
}

export function getRetryConfig(endpoint: APIEndpoint): EndpointRetryConfig {
  return ENDPOINT_RETRY_CONFIGS[endpoint]
}

export function getRetryOptions(endpoint: APIEndpoint): RetryOptions {
  const config = ENDPOINT_RETRY_CONFIGS[endpoint]
  return {
    maxRetries: config.maxRetries,
    initialDelay: config.initialDelay,
    maxDelay: config.maxDelay,
    backoffMultiplier: config.backoffMultiplier,
    timeout: config.timeout,
    retryableStatuses: config.retryableStatuses,
  }
}

export function shouldCacheResponse(endpoint: APIEndpoint): boolean {
  return ENDPOINT_RETRY_CONFIGS[endpoint].cacheable
}

export function getCacheTimeout(endpoint: APIEndpoint): number | undefined {
  return ENDPOINT_RETRY_CONFIGS[endpoint].cacheTimeout
}

export function getEndpointPriority(endpoint: APIEndpoint): 'critical' | 'high' | 'medium' | 'low' {
  return ENDPOINT_RETRY_CONFIGS[endpoint].priority
}

export function getEndpointDescription(endpoint: APIEndpoint): string {
  return ENDPOINT_RETRY_CONFIGS[endpoint].description
}

export const PRIORITY_MULTIPLIERS = {
  critical: 1.5,
  high: 1.2,
  medium: 1.0,
  low: 0.8,
}

export function adjustRetryConfigByPriority(
  endpoint: APIEndpoint,
  systemLoad: 'low' | 'medium' | 'high' = 'medium'
): RetryOptions {
  const baseConfig = getRetryOptions(endpoint)
  const priority = getEndpointPriority(endpoint)
  const multiplier = PRIORITY_MULTIPLIERS[priority]
  
  const loadMultiplier = {
    low: 1.0,
    medium: 0.85,
    high: 0.6,
  }[systemLoad]
  
  return {
    ...baseConfig,
    maxRetries: Math.max(1, Math.floor((baseConfig.maxRetries || 3) * multiplier * loadMultiplier)),
    initialDelay: (baseConfig.initialDelay || 1000) / multiplier,
    maxDelay: (baseConfig.maxDelay || 10000) * multiplier,
  }
}

export function getEndpointsByPriority(priority: 'critical' | 'high' | 'medium' | 'low'): APIEndpoint[] {
  return Object.entries(ENDPOINT_RETRY_CONFIGS)
    .filter(([_, config]) => config.priority === priority)
    .map(([endpoint, _]) => endpoint as APIEndpoint)
}

export function getAllEndpoints(): APIEndpoint[] {
  return Object.keys(ENDPOINT_RETRY_CONFIGS) as APIEndpoint[]
}

export function formatRetryConfig(endpoint: APIEndpoint): string {
  const config = ENDPOINT_RETRY_CONFIGS[endpoint]
  return `
${endpoint.toUpperCase()}
Priority: ${config.priority.toUpperCase()}
Max Retries: ${config.maxRetries}
Initial Delay: ${config.initialDelay}ms
Max Delay: ${config.maxDelay}ms
Timeout: ${config.timeout}ms
Cacheable: ${config.cacheable ? 'Yes' : 'No'}
${config.cacheTimeout ? `Cache Timeout: ${config.cacheTimeout}ms` : ''}
Description: ${config.description}
  `.trim()
}
