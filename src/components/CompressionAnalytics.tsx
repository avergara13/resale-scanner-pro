import { useCompressionAnalytics } from '@/hooks/use-compression-analytics'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Image, Lightning, HardDrive, TrendDown, Clock, Gauge } from '@phosphor-icons/react'

export function CompressionAnalytics() {
  const { analytics, summary, resetAnalytics, formatBytes } = useCompressionAnalytics()

  if (!summary || analytics.totalImagesProcessed === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Image className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No compression data yet</p>
          <p className="text-xs text-muted-foreground">
            Start capturing images to see compression savings
          </p>
        </div>
      </div>
    )
  }

  const savingsPercent = Number(summary.savingsPercentage)
  const progressColor = savingsPercent > 70 ? 'bg-green' : savingsPercent > 50 ? 'bg-amber' : 'bg-blue-bg'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-fg border border-s1">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-bg">
              <TrendDown weight="duotone" className="w-5 h-5 text-b1" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-t1">{summary.savingsPercentage}%</p>
            <p className="text-xs text-t3">Total Savings</p>
          </div>
        </Card>

        <Card className="p-4 bg-fg border border-s1">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-bg">
              <Image weight="duotone" className="w-5 h-5 text-b1" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-t1">{analytics.totalImagesProcessed}</p>
            <p className="text-xs text-t3">Images Compressed</p>
          </div>
        </Card>
      </div>

      <Card className="p-4 bg-fg border border-s1">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-t1">Compression Progress</span>
            <span className="text-xs text-t3">{summary.savingsPercentage}% saved</span>
          </div>
          <Progress value={savingsPercent} className="h-2" />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 bg-fg border border-s1">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive weight="duotone" className="w-4 h-4 text-b1" />
            <span className="text-xs font-medium text-t2">Space Saved</span>
          </div>
          <p className="text-lg font-bold text-t1">{summary.totalSavings}</p>
        </Card>

        <Card className="p-3 bg-fg border border-s1">
          <div className="flex items-center gap-2 mb-2">
            <Gauge weight="duotone" className="w-4 h-4 text-b1" />
            <span className="text-xs font-medium text-t2">Avg Ratio</span>
          </div>
          <p className="text-lg font-bold text-t1">{summary.avgCompressionRatio}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 bg-fg border border-s1">
          <div className="flex items-center gap-2 mb-2">
            <Lightning weight="duotone" className="w-4 h-4 text-amber" />
            <span className="text-xs font-medium text-t2">Load Time Saved</span>
          </div>
          <p className="text-lg font-bold text-t1">{summary.loadTimeSaved}</p>
        </Card>

        <Card className="p-3 bg-fg border border-s1">
          <div className="flex items-center gap-2 mb-2">
            <Clock weight="duotone" className="w-4 h-4 text-green" />
            <span className="text-xs font-medium text-t2">Processing Time</span>
          </div>
          <p className="text-lg font-bold text-t1">{summary.processingTimeSaved}</p>
        </Card>
      </div>

      <Card className="p-4 bg-fg border border-s1">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-t1">Storage Impact</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-t3">Original Size</span>
              <span className="font-medium text-t1">{summary.totalOriginal}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-t3">Optimized Size</span>
              <span className="font-medium text-green">{summary.totalOptimized}</span>
            </div>
            <div className="flex justify-between text-xs pt-2 border-t border-s1">
              <span className="font-medium text-t2">Total Saved</span>
              <span className="font-bold text-b1">{summary.totalSavings}</span>
            </div>
          </div>
        </div>
      </Card>

      {Object.keys(analytics.byPreset).length > 0 && (
        <Card className="p-4 bg-fg border border-s1">
          <div className="space-y-3">
            <span className="text-sm font-medium text-t1">By Quality Preset</span>
            <div className="space-y-2">
              {Object.entries(analytics.byPreset).map(([preset, stats]) => (
                <div key={preset} className="flex items-center justify-between p-2 rounded-lg bg-s1">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-t1 capitalize">{preset}</p>
                    <p className="text-xs text-t3">
                      {stats.count} {stats.count === 1 ? 'image' : 'images'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-t1">{formatBytes(stats.totalSaved)}</p>
                    <p className="text-xs text-t3">{(stats.avgCompressionRatio * 100).toFixed(0)}% ratio</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Button
        onClick={resetAnalytics}
        variant="outline"
        size="sm"
        className="w-full"
      >
        Reset Analytics
      </Button>
    </div>
  )
}
