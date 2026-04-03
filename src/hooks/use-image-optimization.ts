import { useState, useEffect, useCallback, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { createImageOptimizationService, type OptimizedImage, type ImageQualityPreset } from '@/lib/image-optimization-service'

interface ImageCache {
  [key: string]: OptimizedImage
}

export function useImageOptimization(qualityPreset: ImageQualityPreset = 'balanced') {
  const [cache, setCache] = useKV<ImageCache>('image-optimization-cache', {})
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const service = useMemo(() => createImageOptimizationService(qualityPreset), [qualityPreset])

  const getCacheKey = useCallback((imageData: string): string => {
    return imageData.substring(0, 100)
  }, [])

  const optimizeAndCache = useCallback(async (
    imageData: string,
    forceRefresh = false
  ): Promise<OptimizedImage> => {
    const cacheKey = getCacheKey(imageData)
    
    if (!forceRefresh && cache && cache[cacheKey]) {
      return cache[cacheKey]
    }

    setIsOptimizing(true)
    try {
      const optimized = await service.optimizeImage(imageData, true)
      
      setCache((prev) => ({
        ...(prev || {}),
        [cacheKey]: optimized
      }))
      
      return optimized
    } finally {
      setIsOptimizing(false)
    }
  }, [cache, getCacheKey, service, setCache])

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
          const optimized = await service.optimizeImage(imageData, true)
          results.set(id, optimized)
          newCacheEntries[cacheKey] = optimized
        }
        
        setProgress({ current: i + 1, total: images.length })
      }

      if (Object.keys(newCacheEntries).length > 0) {
        setCache((prev) => ({
          ...(prev || {}),
          ...newCacheEntries
        }))
      }
      
      return results
    } finally {
      setIsOptimizing(false)
      setProgress({ current: 0, total: 0 })
    }
  }, [cache, getCacheKey, service, setCache])

  const getThumbnail = useCallback(async (imageData: string): Promise<string> => {
    const cacheKey = getCacheKey(imageData)
    
    if (cache && cache[cacheKey]) {
      return cache[cacheKey].thumbnail
    }

    const thumbnail = await service.generateThumbnail(imageData, {
      width: 200,
      height: 200,
      quality: 0.6,
      format: 'jpeg'
    })

    return thumbnail
  }, [cache, getCacheKey, service])

  const clearCache = useCallback(() => {
    setCache({})
  }, [setCache])

  const getCacheSize = useCallback((): number => {
    if (!cache) return 0
    return Object.keys(cache).length
  }, [cache])

  const estimateCacheSizeBytes = useCallback((): number => {
    if (!cache) return 0
    return Object.values(cache).reduce((total, img) => {
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
