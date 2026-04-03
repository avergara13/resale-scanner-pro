import { useState, useEffect, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChartBar,
  Warning,
  CheckCircle,
  XCircle,
  TrendUp,
  Lightbulb,
  Download,
  Upload,
  Target,
  Package,
} from '@phosphor-icons/react'
import {
  createFalsePositiveAnalyzer,
  type DetectionCorrection,
  type FalsePositiveReport,
  type FalsePositivePattern,
} from '@/lib/false-positive-analyzer'
import { toast } from 'sonner'

export function FalsePositiveAnalyzerPanel() {
  const [corrections, setCorrections] = useKV<DetectionCorrection[]>('detection-corrections', [])
  const [activeTab, setActiveTab] = useState('overview')
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null)

  const analyzer = useMemo(() => {
    const instance = createFalsePositiveAnalyzer()
    if (corrections && corrections.length > 0) {
      instance.loadCorrections(corrections)
    }
    return instance
  }, [corrections])

  const report = useMemo(() => {
    return analyzer.generateReport()
  }, [analyzer])

  const patternsByFrequency = useMemo(() => {
    return analyzer.getPatternsByFrequency()
  }, [analyzer])

  const recentFalsePositives = useMemo(() => {
    return analyzer.getRecentFalsePositives(10)
  }, [analyzer])

  const handleExport = () => {
    const data = analyzer.exportAnalysisData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `false-positive-analysis-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Analysis data exported')
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        analyzer.importAnalysisData(text)
        const data = JSON.parse(text)
        if (data.corrections) {
          setCorrections(data.corrections)
        }
        toast.success('Analysis data imported')
      } catch (error) {
        toast.error('Failed to import data')
      }
    }
    input.click()
  }

  const getPatternIcon = (patternType: FalsePositivePattern['patternType']) => {
    const icons = {
      misidentified_object: Package,
      background_noise: Warning,
      reflection: Warning,
      shadow: Warning,
      text_label: Warning,
      partial_view: Package,
      similar_object: Package,
      low_confidence: Target,
    }
    return icons[patternType] || Warning
  }

  const getPatternColor = (frequency: number) => {
    if (frequency >= 10) return 'text-red'
    if (frequency >= 5) return 'text-amber'
    return 'text-s4'
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
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-semibold text-fg">Detection Analysis</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="border-s2 h-8 px-2"
            >
              <Download size={16} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              className="border-s2 h-8 px-2"
            >
              <Upload size={16} />
            </Button>
          </div>
        </div>
        <p className="text-sm text-s4">Identify and fix false positive patterns</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-s2 px-4">
          <TabsList className="bg-transparent h-10">
            <TabsTrigger value="overview" className="text-xs">
              Overview
            </TabsTrigger>
            <TabsTrigger value="patterns" className="text-xs">
              Patterns
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs">
              Fixes
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-s2">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs text-s4 font-medium flex items-center gap-1.5">
                      <Target size={14} />
                      Total Detections
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className="text-2xl font-bold text-fg">
                      {corrections?.length || 0}
                    </div>
                    <div className="text-xs text-s3 mt-0.5">All time</div>
                  </CardContent>
                </Card>

                <Card className="border-s2">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs text-s4 font-medium flex items-center gap-1.5">
                      <XCircle size={14} />
                      False Positives
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className="text-2xl font-bold text-red">
                      {report.totalFalsePositives}
                    </div>
                    <div className="text-xs text-s3 mt-0.5">
                      {(report.falsePositiveRate * 100).toFixed(1)}% rate
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-s2">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm text-fg font-semibold">
                    Confidence Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-s4">Low (&lt;40%)</span>
                      <Badge variant="outline" className="text-xs font-mono border-red text-red">
                        {report.confidenceDistribution.low}
                      </Badge>
                    </div>
                    <Progress
                      value={
                        (report.confidenceDistribution.low / report.totalFalsePositives) * 100 || 0
                      }
                      className="h-2 bg-s2"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-s4">Medium (40-70%)</span>
                      <Badge variant="outline" className="text-xs font-mono border-amber text-amber">
                        {report.confidenceDistribution.medium}
                      </Badge>
                    </div>
                    <Progress
                      value={
                        (report.confidenceDistribution.medium / report.totalFalsePositives) * 100 ||
                        0
                      }
                      className="h-2 bg-s2"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-s4">High (&gt;70%)</span>
                      <Badge variant="outline" className="text-xs font-mono border-green text-green">
                        {report.confidenceDistribution.high}
                      </Badge>
                    </div>
                    <Progress
                      value={
                        (report.confidenceDistribution.high / report.totalFalsePositives) * 100 || 0
                      }
                      className="h-2 bg-s2"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-s2">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm text-fg font-semibold">
                    Optimal Thresholds
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  <div className="flex items-center justify-between p-2 bg-t4 rounded">
                    <span className="text-xs text-fg font-medium">Global Confidence</span>
                    <Badge className="bg-b1 text-white font-mono">
                      {(report.optimalThresholds.globalConfidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  {Array.from(report.optimalThresholds.perCategory.entries())
                    .slice(0, 5)
                    .map(([category, threshold]) => (
                      <div key={category} className="flex items-center justify-between p-2 bg-s1 rounded">
                        <span className="text-xs text-s4">{category}</span>
                        <Badge variant="outline" className="font-mono text-xs border-s3">
                          {(threshold * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                </CardContent>
              </Card>

              {report.commonMisidentifications.length > 0 && (
                <Card className="border-s2">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-sm text-fg font-semibold">
                      Common Misidentifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    {report.commonMisidentifications.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="p-2 bg-s1 rounded border border-s2">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-xs font-mono border-red text-red mt-0.5">
                            {item.count}×
                          </Badge>
                          <div className="flex-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="line-through text-s4">{item.wrong}</span>
                              <span className="text-s3">→</span>
                              <span className="text-fg font-medium">{item.correct}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="patterns" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {patternsByFrequency.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle size={48} className="mx-auto text-green mb-3" />
                  <p className="text-sm text-s4">No false positive patterns detected</p>
                  <p className="text-xs text-s3 mt-1">Keep monitoring for issues</p>
                </div>
              ) : (
                patternsByFrequency.map((pattern) => {
                  const isExpanded = expandedPattern === pattern.id
                  const Icon = getPatternIcon(pattern.patternType)
                  const colorClass = getPatternColor(pattern.frequency)

                  return (
                    <Card key={pattern.id} className="border-s2">
                      <button
                        onClick={() => setExpandedPattern(isExpanded ? null : pattern.id)}
                        className="w-full text-left"
                      >
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2 flex-1">
                              <Icon size={20} className={colorClass} weight="duotone" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-semibold text-fg">
                                    {pattern.patternType
                                      .split('_')
                                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                      .join(' ')}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs font-mono ${
                                      pattern.frequency >= 10
                                        ? 'border-red text-red'
                                        : pattern.frequency >= 5
                                        ? 'border-amber text-amber'
                                        : 'border-s3 text-s4'
                                    }`}
                                  >
                                    {pattern.frequency}× occurrences
                                  </Badge>
                                </div>
                                <p className="text-xs text-s4">{pattern.description}</p>
                                <div className="flex items-center gap-3 text-xs text-s3 mt-1">
                                  <span>Last: {formatTimestamp(pattern.lastOccurrence)}</span>
                                  <span>•</span>
                                  <span className="font-mono">
                                    {(pattern.confidenceRange.min * 100).toFixed(0)}-
                                    {(pattern.confidenceRange.max * 100).toFixed(0)}% confidence
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                      </button>

                      {isExpanded && (
                        <CardContent className="px-3 pb-3 pt-1 space-y-3">
                          <div className="p-2 bg-t4 rounded border border-t3">
                            <div className="text-xs text-t1 font-medium mb-1">
                              Suggested Fix
                            </div>
                            <div className="text-xs text-fg">
                              Set minimum confidence threshold to{' '}
                              <span className="font-mono font-bold">
                                {(pattern.suggestedThreshold * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-medium text-fg mb-2">
                              Example Products ({pattern.exampleProductNames.length})
                            </div>
                            <div className="space-y-1">
                              {pattern.exampleProductNames.slice(0, 5).map((name, idx) => (
                                <div key={idx} className="p-2 bg-s1 rounded border border-s2">
                                  <p className="text-xs text-fg">{name}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {pattern.exampleImages.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-fg mb-2">
                                Example Images ({pattern.exampleImages.length})
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {pattern.exampleImages.slice(0, 3).map((img, idx) => (
                                  <div
                                    key={idx}
                                    className="aspect-square rounded border border-s2 overflow-hidden"
                                  >
                                    <img
                                      src={img}
                                      alt={`Example ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="recommendations" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              <Card className="border-s2 bg-gradient-to-br from-t4 to-bg">
                <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="text-sm text-fg font-semibold flex items-center gap-2">
                    <Lightbulb size={18} weight="duotone" className="text-amber" />
                    Improvement Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {report.improvementRecommendations.map((recommendation, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 bg-bg rounded border border-s2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-b1 text-white text-xs font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-fg flex-1">{recommendation}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-s2">
                <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="text-sm text-fg font-semibold flex items-center gap-2">
                    <TrendUp size={18} weight="duotone" className="text-green" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-s2 text-left h-auto py-3"
                    onClick={() => {
                      toast.info('Apply recommended threshold: ' + (report.optimalThresholds.globalConfidence * 100).toFixed(0) + '%')
                    }}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-fg">
                        Apply Optimal Threshold
                      </div>
                      <div className="text-xs text-s4 mt-0.5">
                        Set global confidence to {(report.optimalThresholds.globalConfidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start border-s2 text-left h-auto py-3"
                    onClick={() => {
                      toast.info('Filtering low confidence detections')
                    }}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-fg">
                        Filter Low Confidence
                      </div>
                      <div className="text-xs text-s4 mt-0.5">
                        Remove detections below 50% confidence
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start border-s2 text-left h-auto py-3"
                    onClick={() => {
                      toast.info('Configuring category-specific thresholds')
                    }}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-fg">
                        Apply Category Thresholds
                      </div>
                      <div className="text-xs text-s4 mt-0.5">
                        Use optimized thresholds per category
                      </div>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {recentFalsePositives.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle size={48} className="mx-auto text-green mb-3" />
                  <p className="text-sm text-s4">No false positives recorded</p>
                  <p className="text-xs text-s3 mt-1">System is performing well</p>
                </div>
              ) : (
                recentFalsePositives.map((correction) => (
                  <Card key={correction.id} className="border-s2">
                    <CardHeader className="pb-2 pt-3 px-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded border border-s2 overflow-hidden w-16 h-16 flex-shrink-0">
                          <img
                            src={correction.imageData}
                            alt="Detection"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs border-red text-red">
                              False Positive
                            </Badge>
                            <Badge variant="outline" className="text-xs font-mono border-s3">
                              {(correction.confidence * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-fg line-through">
                            {correction.originalProductName}
                          </p>
                          {correction.correctedProductName && (
                            <p className="text-sm text-green mt-1">
                              → {correction.correctedProductName}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-s4 mt-1">
                            <span>{formatTimestamp(correction.timestamp)}</span>
                            {correction.rejectionReason && (
                              <>
                                <span>•</span>
                                <span className="capitalize">
                                  {correction.rejectionReason.replace('_', ' ')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
