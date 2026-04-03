export interface FalsePositivePattern {
  id: string
  patternType: 'misidentified_object' | 'background_noise' | 'reflection' | 'shadow' | 'text_label' | 'partial_view' | 'similar_object' | 'low_confidence'
  description: string
  frequency: number
  exampleProductNames: string[]
  exampleImages: string[]
  confidenceRange: { min: number; max: number }
  suggestedThreshold: number
  lastOccurrence: number
}

export interface FalsePositiveReport {
  totalFalsePositives: number
  falsePositiveRate: number
  patternsByType: Map<string, FalsePositivePattern>
  commonMisidentifications: Array<{ wrong: string; correct: string; count: number }>
  confidenceDistribution: { low: number; medium: number; high: number }
  improvementRecommendations: string[]
  optimalThresholds: {
    globalConfidence: number
    perCategory: Map<string, number>
  }
}

export interface DetectionCorrection {
  id: string
  timestamp: number
  originalProductName: string
  correctedProductName: string | null
  wasAccepted: boolean
  confidence: number
  imageData: string
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  category?: string
  rejectionReason?: 'misidentified' | 'background' | 'duplicate' | 'irrelevant' | 'low_quality' | 'other'
}

export class FalsePositiveAnalyzer {
  private corrections: DetectionCorrection[] = []
  private patterns: Map<string, FalsePositivePattern> = new Map()

  addCorrection(correction: DetectionCorrection): void {
    this.corrections.push(correction)
    this.analyzeNewCorrection(correction)
  }

  loadCorrections(corrections: DetectionCorrection[]): void {
    this.corrections = corrections
    this.reanalyzeAllPatterns()
  }

  private analyzeNewCorrection(correction: DetectionCorrection): void {
    if (!correction.wasAccepted && correction.rejectionReason) {
      const patternKey = this.generatePatternKey(correction)
      const existingPattern = this.patterns.get(patternKey)

      if (existingPattern) {
        existingPattern.frequency++
        existingPattern.lastOccurrence = correction.timestamp
        
        if (!existingPattern.exampleProductNames.includes(correction.originalProductName)) {
          existingPattern.exampleProductNames.push(correction.originalProductName)
          if (existingPattern.exampleProductNames.length > 10) {
            existingPattern.exampleProductNames.shift()
          }
        }

        if (!existingPattern.exampleImages.includes(correction.imageData)) {
          existingPattern.exampleImages.push(correction.imageData)
          if (existingPattern.exampleImages.length > 5) {
            existingPattern.exampleImages.shift()
          }
        }

        existingPattern.confidenceRange.min = Math.min(
          existingPattern.confidenceRange.min,
          correction.confidence
        )
        existingPattern.confidenceRange.max = Math.max(
          existingPattern.confidenceRange.max,
          correction.confidence
        )
      } else {
        const newPattern: FalsePositivePattern = {
          id: patternKey,
          patternType: this.mapRejectionToPatternType(correction.rejectionReason),
          description: this.generatePatternDescription(correction),
          frequency: 1,
          exampleProductNames: [correction.originalProductName],
          exampleImages: [correction.imageData],
          confidenceRange: {
            min: correction.confidence,
            max: correction.confidence,
          },
          suggestedThreshold: this.calculateSuggestedThreshold(correction),
          lastOccurrence: correction.timestamp,
        }
        this.patterns.set(patternKey, newPattern)
      }
    }
  }

  private reanalyzeAllPatterns(): void {
    this.patterns.clear()
    this.corrections.forEach(correction => {
      this.analyzeNewCorrection(correction)
    })
  }

  private generatePatternKey(correction: DetectionCorrection): string {
    const reason = correction.rejectionReason || 'unknown'
    const confidenceBucket = this.getConfidenceBucket(correction.confidence)
    const category = correction.category || 'general'
    return `${reason}-${confidenceBucket}-${category}`
  }

  private getConfidenceBucket(confidence: number): string {
    if (confidence < 0.4) return 'low'
    if (confidence < 0.7) return 'medium'
    return 'high'
  }

  private mapRejectionToPatternType(reason: string): FalsePositivePattern['patternType'] {
    const mapping: Record<string, FalsePositivePattern['patternType']> = {
      misidentified: 'misidentified_object',
      background: 'background_noise',
      duplicate: 'similar_object',
      irrelevant: 'partial_view',
      low_quality: 'low_confidence',
      other: 'misidentified_object',
    }
    return mapping[reason] || 'misidentified_object'
  }

  private generatePatternDescription(correction: DetectionCorrection): string {
    const descriptions: Record<string, string> = {
      misidentified: `Incorrect product identification (e.g., "${correction.originalProductName}")`,
      background: 'Background objects detected as products',
      duplicate: 'Same product detected multiple times',
      irrelevant: 'Non-product items detected (hands, shelves, tags)',
      low_quality: 'Low confidence detections that are incorrect',
      other: 'Miscellaneous false positive detections',
    }
    return descriptions[correction.rejectionReason || 'other'] || 'Unknown pattern'
  }

  private calculateSuggestedThreshold(correction: DetectionCorrection): number {
    const confidenceBucket = this.getConfidenceBucket(correction.confidence)
    
    if (confidenceBucket === 'low') return 0.5
    if (confidenceBucket === 'medium') return 0.75
    return 0.85
  }

  generateReport(): FalsePositiveReport {
    const totalDetections = this.corrections.length
    const totalFalsePositives = this.corrections.filter(c => !c.wasAccepted).length
    const falsePositiveRate = totalDetections > 0 ? totalFalsePositives / totalDetections : 0

    const patternsByType = new Map<string, FalsePositivePattern>()
    this.patterns.forEach(pattern => {
      const existing = patternsByType.get(pattern.patternType)
      if (existing) {
        existing.frequency += pattern.frequency
        existing.exampleProductNames.push(...pattern.exampleProductNames)
        existing.exampleImages.push(...pattern.exampleImages)
      } else {
        patternsByType.set(pattern.patternType, { ...pattern })
      }
    })

    const misidentifications = this.findCommonMisidentifications()

    const confidenceDistribution = this.calculateConfidenceDistribution()

    const recommendations = this.generateRecommendations(
      falsePositiveRate,
      patternsByType,
      confidenceDistribution
    )

    const optimalThresholds = this.calculateOptimalThresholds()

    return {
      totalFalsePositives,
      falsePositiveRate,
      patternsByType,
      commonMisidentifications: misidentifications,
      confidenceDistribution,
      improvementRecommendations: recommendations,
      optimalThresholds,
    }
  }

  private findCommonMisidentifications(): Array<{ wrong: string; correct: string; count: number }> {
    const pairs = new Map<string, { correct: string; count: number }>()

    this.corrections.forEach(correction => {
      if (!correction.wasAccepted && correction.correctedProductName) {
        const key = `${correction.originalProductName}→${correction.correctedProductName}`
        const existing = pairs.get(key)
        if (existing) {
          existing.count++
        } else {
          pairs.set(key, {
            correct: correction.correctedProductName,
            count: 1,
          })
        }
      }
    })

    return Array.from(pairs.entries())
      .map(([key, value]) => ({
        wrong: key.split('→')[0],
        correct: value.correct,
        count: value.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  private calculateConfidenceDistribution(): { low: number; medium: number; high: number } {
    const falsePositives = this.corrections.filter(c => !c.wasAccepted)
    
    const distribution = {
      low: falsePositives.filter(c => c.confidence < 0.4).length,
      medium: falsePositives.filter(c => c.confidence >= 0.4 && c.confidence < 0.7).length,
      high: falsePositives.filter(c => c.confidence >= 0.7).length,
    }

    return distribution
  }

  private generateRecommendations(
    falsePositiveRate: number,
    patterns: Map<string, FalsePositivePattern>,
    distribution: { low: number; medium: number; high: number }
  ): string[] {
    const recommendations: string[] = []

    if (falsePositiveRate > 0.3) {
      recommendations.push('High false positive rate detected. Consider increasing confidence thresholds.')
    }

    if (distribution.low > distribution.medium + distribution.high) {
      recommendations.push('Most false positives have low confidence. Filter detections below 50% confidence.')
    }

    if (distribution.high > 0) {
      recommendations.push(`${distribution.high} high-confidence false positives detected. Review detection prompts for accuracy.`)
    }

    const backgroundPattern = patterns.get('background_noise')
    if (backgroundPattern && backgroundPattern.frequency > 5) {
      recommendations.push('Frequent background noise detections. Improve product isolation in prompts.')
    }

    const misidentifiedPattern = patterns.get('misidentified_object')
    if (misidentifiedPattern && misidentifiedPattern.frequency > 5) {
      recommendations.push('Frequent misidentifications. Add category-specific validation rules.')
    }

    const partialPattern = patterns.get('partial_view')
    if (partialPattern && partialPattern.frequency > 3) {
      recommendations.push('Partial views causing false positives. Require minimum bounding box size.')
    }

    const duplicatePattern = patterns.get('similar_object')
    if (duplicatePattern && duplicatePattern.frequency > 3) {
      recommendations.push('Duplicate detections found. Implement non-maximum suppression with higher IoU threshold.')
    }

    if (recommendations.length === 0) {
      recommendations.push('Detection accuracy is good. Continue monitoring for new patterns.')
    }

    return recommendations
  }

  private calculateOptimalThresholds(): {
    globalConfidence: number
    perCategory: Map<string, number>
  } {
    const acceptedConfidences = this.corrections
      .filter(c => c.wasAccepted)
      .map(c => c.confidence)
    
    const rejectedConfidences = this.corrections
      .filter(c => !c.wasAccepted)
      .map(c => c.confidence)

    let globalThreshold = 0.5

    if (acceptedConfidences.length > 0 && rejectedConfidences.length > 0) {
      const avgAccepted = acceptedConfidences.reduce((a, b) => a + b, 0) / acceptedConfidences.length
      const avgRejected = rejectedConfidences.reduce((a, b) => a + b, 0) / rejectedConfidences.length
      globalThreshold = (avgAccepted + avgRejected) / 2
    }

    const perCategory = new Map<string, number>()
    const categoriesSet = new Set(this.corrections.map(c => c.category).filter(Boolean))

    categoriesSet.forEach(category => {
      const categoryCorrections = this.corrections.filter(c => c.category === category)
      const accepted = categoryCorrections.filter(c => c.wasAccepted).map(c => c.confidence)
      const rejected = categoryCorrections.filter(c => !c.wasAccepted).map(c => c.confidence)

      if (accepted.length > 0 && rejected.length > 0) {
        const avgAccepted = accepted.reduce((a, b) => a + b, 0) / accepted.length
        const avgRejected = rejected.reduce((a, b) => a + b, 0) / rejected.length
        perCategory.set(category!, (avgAccepted + avgRejected) / 2)
      } else if (accepted.length > 0) {
        const minAccepted = Math.min(...accepted)
        perCategory.set(category!, Math.max(0.5, minAccepted - 0.1))
      }
    })

    return {
      globalConfidence: Math.max(0.3, Math.min(0.9, globalThreshold)),
      perCategory,
    }
  }

  getPatternsByFrequency(): FalsePositivePattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
  }

  getRecentFalsePositives(limit: number = 10): DetectionCorrection[] {
    return this.corrections
      .filter(c => !c.wasAccepted)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  exportAnalysisData(): string {
    const report = this.generateReport()
    return JSON.stringify({
      report,
      corrections: this.corrections,
      patterns: Array.from(this.patterns.values()),
      timestamp: Date.now(),
    }, null, 2)
  }

  importAnalysisData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData)
      if (data.corrections) {
        this.loadCorrections(data.corrections)
      }
    } catch (error) {
      console.error('Failed to import analysis data:', error)
      throw new Error('Invalid analysis data format')
    }
  }
}

export function createFalsePositiveAnalyzer(): FalsePositiveAnalyzer {
  return new FalsePositiveAnalyzer()
}
