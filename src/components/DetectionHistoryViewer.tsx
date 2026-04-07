import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartBar, Target, Clock, CheckCircle, XCircle, Trash } from '@phosphor-icons/react'
import type { DetectionHistoryEntry, DetectionHistoryStats } from '@/types'

export function DetectionHistoryViewer() {
  const [history, setHistory] = useKV<DetectionHistoryEntry[]>('detection-history', [])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const calculateStats = (): DetectionHistoryStats => {
    if (!history || history.length === 0) {
      return {
        totalScans: 0,
        totalDetections: 0,
        averageDetectionsPerScan: 0,
        averageAccuracy: 0,
        averageProcessingTime: 0,
        mostCommonProductCount: 0,
        fastestScan: 0,
        slowestScan: 0,
        totalUserCorrections: 0,
      }
    }

    const totalScans = history.length
    const totalDetections = history.reduce((sum, entry) => sum + entry.detectedCount, 0)
    const totalProcessingTime = history.reduce((sum, entry) => sum + entry.processingTimeMs, 0)
    const accurateScans = history.filter(entry => entry.accuracy !== undefined)
    const totalAccuracy = accurateScans.reduce((sum, entry) => sum + (entry.accuracy || 0), 0)
    const totalCorrections = history.reduce((sum, entry) => {
      const rejected = entry.rejectedProducts?.length || 0
      return sum + rejected
    }, 0)

    const productCounts = history.map(e => e.detectedCount)
    const countFrequency = productCounts.reduce((acc, count) => {
      acc[count] = (acc[count] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    const mostCommonProductCount = parseInt(
      Object.entries(countFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || '0'
    )

    return {
      totalScans,
      totalDetections,
      averageDetectionsPerScan: totalDetections / totalScans,
      averageAccuracy: accurateScans.length > 0 ? totalAccuracy / accurateScans.length : 0,
      averageProcessingTime: totalProcessingTime / totalScans,
      mostCommonProductCount,
      fastestScan: Math.min(...history.map(e => e.processingTimeMs)),
      slowestScan: Math.max(...history.map(e => e.processingTimeMs)),
      totalUserCorrections: totalCorrections,
    }
  }

  const stats = calculateStats()

  const handleClearHistory = () => {
    if (confirm('Clear all detection history? This cannot be undone.')) {
      setHistory([])
    }
  }

  const handleDeleteEntry = (id: string) => {
    setHistory((prev) => (prev || []).filter(entry => entry.id !== id))
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="px-4 py-3 border-b border-s2">
        <h1 className="text-lg font-semibold text-t1">Detection History</h1>
        <p className="text-sm text-s4 mt-0.5">Multi-object scan accuracy tracking</p>
      </div>

      {history && history.length > 0 && (
        <div className="px-4 py-4 border-b border-s2 bg-s1">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-s2">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs text-s4 font-medium flex items-center gap-1.5">
                  <ChartBar size={14} />
                  Total Scans
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-t1">{stats.totalScans}</div>
                <div className="text-xs text-s3 mt-0.5">
                  {stats.totalDetections} products detected
                </div>
              </CardContent>
            </Card>

            <Card className="border-s2">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs text-s4 font-medium flex items-center gap-1.5">
                  <Target size={14} />
                  Avg Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-t1">
                  {stats.averageAccuracy > 0 ? `${stats.averageAccuracy.toFixed(0)}%` : 'N/A'}
                </div>
                <div className="text-xs text-s3 mt-0.5">
                  {stats.totalUserCorrections} corrections
                </div>
              </CardContent>
            </Card>

            <Card className="border-s2">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs text-s4 font-medium flex items-center gap-1.5">
                  <Clock size={14} />
                  Avg Speed
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-t1">
                  {formatDuration(stats.averageProcessingTime)}
                </div>
                <div className="text-xs text-s3 mt-0.5">
                  {formatDuration(stats.fastestScan)} fastest
                </div>
              </CardContent>
            </Card>

            <Card className="border-s2">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs text-s4 font-medium flex items-center gap-1.5">
                  <Target size={14} />
                  Avg Count
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-t1">
                  {stats.averageDetectionsPerScan.toFixed(1)}
                </div>
                <div className="text-xs text-s3 mt-0.5">
                  {stats.mostCommonProductCount} most common
                </div>
              </CardContent>
            </Card>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            className="w-full mt-3 border-s2 text-red hover:bg-red/10"
          >
            <Trash size={16} className="mr-2" />
            Clear All History
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-3">
          {(!history || history.length === 0) && (
            <div className="text-center py-12">
              <Target size={48} className="mx-auto text-s3 mb-3" />
              <p className="text-sm text-s4">No detection history yet</p>
              <p className="text-xs text-s3 mt-1">
                Multi-object scans will appear here
              </p>
            </div>
          )}

          {history &&
            [...history]
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((entry) => {
                const isExpanded = expandedId === entry.id
                const accuracy = entry.accuracy !== undefined ? entry.accuracy : null

                return (
                  <Card key={entry.id} className="border-s2 overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="w-full text-left"
                    >
                      <CardHeader className="pb-2 pt-3 px-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="secondary"
                                className="text-xs font-mono bg-b1 text-white"
                              >
                                {entry.detectedCount} detected
                              </Badge>
                              {accuracy !== null && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-mono ${
                                    accuracy >= 90
                                      ? 'border-green text-green'
                                      : accuracy >= 70
                                      ? 'border-amber text-amber'
                                      : 'border-red text-red'
                                  }`}
                                >
                                  {accuracy.toFixed(0)}% accurate
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-s4">
                              <span>{formatTimestamp(entry.timestamp)}</span>
                              <span>•</span>
                              <span>{formatDuration(entry.processingTimeMs)}</span>
                              <span>•</span>
                              <span className="font-mono">{entry.modelUsed}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteEntry(entry.id)
                            }}
                            className="h-7 w-7 p-0 text-s4 hover:text-red"
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </CardHeader>
                    </button>

                    {isExpanded && (
                      <CardContent className="px-3 pb-3 pt-1 space-y-3">
                        <div className="rounded border border-s2 overflow-hidden">
                          <img
                            src={entry.imageData}
                            alt="Scan"
                            className="w-full h-auto"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-medium text-t1">
                            Detected Products ({entry.detectedProducts.length})
                          </div>
                          {entry.detectedProducts.map((product, idx) => {
                            const isAccepted = entry.acceptedProducts?.includes(product.id)
                            const isRejected = entry.rejectedProducts?.includes(product.id)

                            return (
                              <div
                                key={product.id}
                                className="flex items-start gap-2 p-2 rounded bg-s1 border border-s2"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-t1">
                                      {product.name}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-mono border-s3"
                                    >
                                      {(product.confidence * 100).toFixed(0)}%
                                    </Badge>
                                  </div>
                                  <div className="text-[10px] text-s4 font-mono">
                                    {product.boundingBox.width.toFixed(0)}×
                                    {product.boundingBox.height.toFixed(0)}px
                                  </div>
                                </div>
                                {isAccepted && (
                                  <CheckCircle
                                    size={16}
                                    weight="fill"
                                    className="text-green"
                                  />
                                )}
                                {isRejected && (
                                  <XCircle
                                    size={16}
                                    weight="fill"
                                    className="text-red"
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {entry.userConfirmedCount !== undefined && (
                          <div className="p-2 rounded bg-t4 border border-t3">
                            <div className="text-xs text-t1">
                              <span className="font-medium">User Confirmed:</span>{' '}
                              {entry.userConfirmedCount} of {entry.detectedCount} products
                            </div>
                            {entry.rejectedProducts && entry.rejectedProducts.length > 0 && (
                              <div className="text-xs text-red mt-1">
                                {entry.rejectedProducts.length} false positive
                                {entry.rejectedProducts.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )
              })}
        </div>
      </ScrollArea>
    </div>
  )
}
