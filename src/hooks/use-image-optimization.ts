import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createImageOptimizationService, type OptimizedImage, type ImageQualityPreset } from '@/lib/image-optimization-service'
import { useCompressionAnalytics } from './use-compression-analytics'

interface ImageCache {
  [key: string]: OptimizedImage & { lastAccessed: number }
}

const MAX_CACHE_SIZE = 20
const MAX_CACHE_AGE_MS = 30 * 60 * 1000 // 30 minutes — in-memory only

export function useImageOptimization(qualityPreset: ImageQualityPreset = 'balanced') {
  // Use in-memory cache only — localStorage can't hold base64 images without quota issues
  const cacheRef = useRef<ImageCache>({})
  const [, forceUpdate] = useState(0)
  const cache = cacheRef.current
  const setCache = useCallback((updater: ImageCache | ((prev: ImageCache) => ImageCache)) => {
    cacheRef.current = typeof updater === 'function' ? updater(cacheRef.current) : updater
    forceUpdate(n => n + 1)
  }, [])
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const optimizationQueueRef = useRef<Map<string, Promise<OptimizedImage>>>(new Map())
  const { trackCompression } = useCompressionAnalytics()

  // Stabilize KV setter via ref to prevent useEffect dependency loops
  const setCacheRef = useRef(setCache)
  setCacheRef.current = setCache

  const service = useMemo(() => createImageOptimizationService(qualityPreset), [qualityPreset])

  const getCacheKey = useCallback((imageData: string): string => {
    const hashString = (str: string): string => {
      let hash = 0
      for (let i = 0; i < Math.min(str.length, 200); i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
      return hash.toString(36)
    }
    return `${hashString(imageData)}-${qualityPreset}`
  }, [qualityPreset])

  useEffect(() => {
    const cleanOldCache = () => {
      const now = Date.now()
      setCacheRef.current((prev) => {
        if (!prev) return {}

        const entries = Object.entries(prev)
        if (entries.length <= MAX_CACHE_SIZE) return prev

        const validEntries = entries
          .filter(([_, img]) => now - img.lastAccessed < MAX_CACHE_AGE_MS)
          .sort((a, b) => b[1].lastAccessed - a[1].lastAccessed)
          .slice(0, MAX_CACHE_SIZE)

        return Object.fromEntries(validEntries)
      })
    }

    const interval = setInterval(cleanOldCache, 60000)
    return () => clearInterval(interval)
  }, [])

  const optimizeAndCache = useCallback(async (
    imageData: string,
    forceRefresh = false
  ): Promise<OptimizedImage> => {
    const cacheKey = getCacheKey(imageData)
    
    if (!forceRefresh && cache && cache[cacheKey]) {
      const cached = cache[cacheKey]
      setCacheRef.current((prev) => {
        if (!prev) return {}
        return {
          ...prev,
          [cacheKey]: { ...prev[cacheKey], lastAccessed: Date.now() }
        }
      })
      return cached
    }

    if (optimizationQueueRef.current.has(cacheKey)) {
      return optimizationQueueRef.current.get(cacheKey)!
    }

    const optimizationPromise = (async () => {
      setIsOptimizing(true)
      const startTime = performance.now()
      try {
        const optimized = await service.optimizeImage(imageData, true)
        const endTime = performance.now()
        
        trackCompression({
          originalSize: optimized.originalSize || 0,
          optimizedSize: optimized.size,
          thumbnailSize: optimized.thumbnailSize,
          compressionRatio: optimized.compressionRatio || 1,
          timeSavedMs: endTime - startTime,
          qualityPreset,
        })
        
        setCacheRef.current((prev) => ({
          ...(prev || {}),
          [cacheKey]: { ...optimized, lastAccessed: Date.now() }
        }))
        
        return optimized
      } finally {
        setIsOptimizing(false)
        optimizationQueueRef.current.delete(cacheKey)
      }
    })()

    optimizationQueueRef.current.set(cacheKey, optimizationPromise)
    return optimizationPromise
  }, [cache, getCacheKey, service, trackCompression, qualityPreset])

  const batchOptimize = useCallback(async (
    images: Array<{ id: string; imageData: string }>,
    forceRefresh = false
  ): Promise<Map<string, OptimizedImage>> => {
    setIsOptimizing(true)
    setProgress({ current: 0, total: images.length })
    
    const results = new Map<string, OptimizedImage>()
    const newCacheEntries: ImageCache = {}

    try {
      for (let i = 0; i < images.length; i++) {
        const { id, imageData } = images[i]
        const cacheKey = getCacheKey(imageData)
        
        if (!forceRefresh && cache && cache[cacheKey]) {
          results.set(id, cache[cacheKey])
        } else {
          const startTime = performance.now()
          const optimized = await service.optimizeImage(imageData, true)
          const endTime = performance.now()
          
          trackCompression({
            originalSize: optimized.originalSize || 0,
            optimizedSize: optimized.size,
            thumbnailSize: optimized.thumbnailSize,
            compressionRatio: optimized.compressionRatio || 1,
            timeSavedMs: endTime - startTime,
            qualityPreset,
          })
          
          results.set(id, optimized)
          newCacheEntries[cacheKey] = { ...optimized, lastAccessed: Date.now() }
        }
        
        setProgress({ current: i + 1, total: images.length })
      }

      if (Object.keys(newCacheEntries).length > 0) {
        setCacheRef.current((prev) => ({
          ...(prev || {}),
          ...newCacheEntries
        }))
      }
      
      return results
    } finally {
      setIsOptimizing(false)
      setProgress({ current: 0, total: 0 })
    }
  }, [cache, getCacheKey, service, trackCompression, qualityPreset])

  const getThumbnail = useCallback(async (imageData: string): Promise<string> => {
    const cacheKey = getCacheKey(imageData)
    
    if (cache && cache[cacheKey]) {
      return cache[cacheKey].thumbnail
    }

    const thumbnail = await service.generateThumbnail(imageData, {
      width: 150,
      height: 150,
      quality: 0.65,
      format: 'jpeg'
    })

    return thumbnail
  }, [cache, getCacheKey, service])

  const clearCache = useCallback(() => {
    setCacheRef.current({})
  }, [])

  const getCacheSize = useCallback((): number => {
    if (!cache) return 0
    return Object.keys(cache).length
  }, [cache])

  const estimateCacheSizeBytes = useCallback((): number => {
    if (!cache) return 0
    return Object.values(cache).reduce((total, img: OptimizedImage & { lastAccessed: number }) => {
      return total + img.size + img.thumbnailSize
    }, 0)
  }, [cache])

  return {
    optimizeAndCache,
    batchOptimize,
    getThumbnail,
    clearCache,
    getCacheSize,
    estimateCacheSizeBytes,
    isOptimizing,
    progress,
    service
  }
}
