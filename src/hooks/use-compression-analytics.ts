import { useCallback, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'

export interface CompressionStat {
  id: string
  timestamp: number
  originalSize: number
  optimizedSize: number
  thumbnailSize: number
  compressionRatio: number
  timeSavedMs: number
  qualityPreset: string
}

export interface CompressionAnalytics {
  totalOriginalBytes: number
  totalOptimizedBytes: number
  totalThumbnailBytes: number
  totalBytesSaved: number
  totalCompressionRatio: number
  averageCompressionRatio: number
  totalImagesProcessed: number
  totalTimeSavedMs: number
  byPreset: {
    [preset: string]: {
      count: number
      totalSaved: number
      avgCompressionRatio: number
    }
  }
  recentCompressions: CompressionStat[]
  lastUpdated: number
}

const DEFAULT_ANALYTICS: CompressionAnalytics = {
  totalOriginalBytes: 0,
  totalOptimizedBytes: 0,
  totalThumbnailBytes: 0,
  totalBytesSaved: 0,
  totalCompressionRatio: 0,
  averageCompressionRatio: 0,
  totalImagesProcessed: 0,
  totalTimeSavedMs: 0,
  byPreset: {},
  recentCompressions: [],
  lastUpdated: Date.now(),
}

export function useCompressionAnalytics() {
  const [analytics, setAnalytics] = useKV<CompressionAnalytics>('compression-analytics', DEFAULT_ANALYTICS)

  const trackCompression = useCallback((stat: Omit<CompressionStat, 'id' | 'timestamp'>) => {
    const newStat: CompressionStat = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      ...stat,
    }

    setAnalytics((prev) => {
      const current = prev || DEFAULT_ANALYTICS
      const bytesSaved = stat.originalSize - stat.optimizedSize - stat.thumbnailSize

      const updatedByPreset = { ...current.byPreset }
      if (!updatedByPreset[stat.qualityPreset]) {
        updatedByPreset[stat.qualityPreset] = {
          count: 0,
          totalSaved: 0,
          avgCompressionRatio: 0,
        }
      }

      const presetStats = updatedByPreset[stat.qualityPreset]
      presetStats.count += 1
      presetStats.totalSaved += bytesSaved
      presetStats.avgCompressionRatio = 
        (presetStats.avgCompressionRatio * (presetStats.count - 1) + stat.compressionRatio) / presetStats.count

      const totalOriginal = current.totalOriginalBytes + stat.originalSize
      const totalOptimized = current.totalOptimizedBytes + stat.optimizedSize
      const totalThumbnail = current.totalThumbnailBytes + stat.thumbnailSize
      const totalSaved = current.totalBytesSaved + bytesSaved
      const totalProcessed = current.totalImagesProcessed + 1

      const recentCompressions = [newStat, ...current.recentCompressions].slice(0, 100)

      return {
        totalOriginalBytes: totalOriginal,
        totalOptimizedBytes: totalOptimized,
        totalThumbnailBytes: totalThumbnail,
        totalBytesSaved: totalSaved,
        totalCompressionRatio: totalOriginal > 0 ? (totalOptimized + totalThumbnail) / totalOriginal : 0,
        averageCompressionRatio: 
          (current.averageCompressionRatio * current.totalImagesProcessed + stat.compressionRatio) / totalProcessed,
        totalImagesProcessed: totalProcessed,
        totalTimeSavedMs: current.totalTimeSavedMs + stat.timeSavedMs,
        byPreset: updatedByPreset,
        recentCompressions,
        lastUpdated: Date.now(),
      }
    })
  }, [setAnalytics])

  const resetAnalytics = useCallback(() => {
    setAnalytics(DEFAULT_ANALYTICS)
  }, [setAnalytics])

  const getPresetStats = useCallback((preset: string) => {
    if (!analytics) return null
    return analytics.byPreset[preset] || null
  }, [analytics])

  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }, [])

  const formatTimeSaved = useCallback((ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
    return `${(ms / 3600000).toFixed(1)}h`
  }, [])

  const getSavingsPercentage = useCallback((): number => {
    if (!analytics || analytics.totalOriginalBytes === 0) return 0
    return ((analytics.totalBytesSaved / analytics.totalOriginalBytes) * 100)
  }, [analytics])

  const getEstimatedLoadTimeSaved = useCallback((): number => {
    if (!analytics) return 0
    const avgMobileSpeed = 5 * 1024 * 1024 / 8
    return (analytics.totalBytesSaved / avgMobileSpeed) * 1000
  }, [analytics])

  const summary = useMemo(() => {
    if (!analytics) return null

    return {
      totalSavings: formatBytes(analytics.totalBytesSaved),
      savingsPercentage: getSavingsPercentage().toFixed(1),
      imagesProcessed: analytics.totalImagesProcessed,
      avgCompressionRatio: `${(analytics.averageCompressionRatio * 100).toFixed(1)}%`,
      processingTimeSaved: formatTimeSaved(analytics.totalTimeSavedMs),
      loadTimeSaved: formatTimeSaved(getEstimatedLoadTimeSaved()),
      totalOriginal: formatBytes(analytics.totalOriginalBytes),
      totalOptimized: formatBytes(analytics.totalOptimizedBytes + analytics.totalThumbnailBytes),
    }
  }, [analytics, formatBytes, formatTimeSaved, getSavingsPercentage, getEstimatedLoadTimeSaved])

  return {
    analytics: analytics || DEFAULT_ANALYTICS,
    trackCompression,
    resetAnalytics,
    getPresetStats,
    formatBytes,
    formatTimeSaved,
    getSavingsPercentage,
    getEstimatedLoadTimeSaved,
    summary,
  }
}
