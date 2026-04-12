import { Sparkle, Tag, CheckCircle, Info } from '@phosphor-icons/react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { motion, AnimatePresence } from 'framer-motion'
import { logActivity } from '@/lib/activity-log'
import type { TagSuggestion } from '@/lib/tag-suggestion-service'

interface SuggestedTagsProps {
  suggestions: TagSuggestion[]
  onApply: (tagIds: string[]) => void
  onApplyTag: (tagId: string) => void
  appliedTags?: string[]
}

export function SuggestedTags({ suggestions, onApply, onApplyTag, appliedTags = [] }: SuggestedTagsProps) {
  if (!suggestions || suggestions.length === 0) return null

  const unappliedSuggestions = suggestions.filter(s => !appliedTags.includes(s.tag.id))
  const allApplied = unappliedSuggestions.length === 0

  const handleApplyAll = () => {
    if (allApplied) {
      logActivity('All tags already applied', 'info')
      return
    }
    onApply(unappliedSuggestions.map(s => s.tag.id))
    logActivity(`Applied ${unappliedSuggestions.length} tag${unappliedSuggestions.length !== 1 ? 's' : ''}`)
  }

  const handleApplyTag = (suggestion: TagSuggestion) => {
    const isApplied = appliedTags.includes(suggestion.tag.id)
    onApplyTag(suggestion.tag.id)

    if (!isApplied) {
      logActivity(`Applied "${suggestion.tag.name}"`)
    }
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'High'
    if (confidence >= 0.8) return 'Med'
    return 'Low'
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'var(--green)'
    if (confidence >= 0.8) return 'var(--amber)'
    return 'var(--t4)'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-3 bg-gradient-to-br from-[var(--blue-bg)] to-transparent border border-[var(--b1)]/20 rounded-xl"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[var(--b1)] rounded-lg flex items-center justify-center">
            <Sparkle size={14} weight="fill" className="text-white" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--t1)]">AI Suggested Tags</h4>
            <p className="text-[10px] text-[var(--t3)]">
              {allApplied ? 'All tags applied' : `${unappliedSuggestions.length} suggestion${unappliedSuggestions.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <Button
          onClick={handleApplyAll}
          size="sm"
          variant="ghost"
          disabled={allApplied}
          className="h-7 px-2 text-[10px] font-bold text-[var(--b1)] hover:text-[var(--b1)] hover:bg-[var(--b1)]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {allApplied ? (
            <>
              <CheckCircle size={12} weight="fill" className="mr-1" />
              ALL APPLIED
            </>
          ) : (
            <>
              <Tag size={12} weight="bold" className="mr-1" />
              APPLY ALL
            </>
          )}
        </Button>
      </div>
      
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence>
            {suggestions.map((suggestion, index) => {
              const isApplied = appliedTags.includes(suggestion.tag.id)
              return (
                <motion.div
                  key={suggestion.tag.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={isApplied ? 'default' : 'outline'}
                        className="cursor-pointer transition-all hover:scale-105 active:scale-95 text-[11px] px-2.5 py-1.5 select-none relative group"
                        style={{
                          backgroundColor: isApplied ? suggestion.tag.color : 'transparent',
                          borderColor: suggestion.tag.color,
                          color: isApplied ? 'white' : suggestion.tag.color,
                        }}
                        onClick={() => handleApplyTag(suggestion)}
                      >
                        {isApplied ? (
                          <CheckCircle size={10} weight="fill" className="mr-1" />
                        ) : (
                          <span className="mr-1">{suggestion.tag.icon}</span>
                        )}
                        {suggestion.tag.name}
                        <span 
                          className="ml-1 opacity-60 text-[9px] font-bold"
                          style={{ color: isApplied ? 'white' : getConfidenceColor(suggestion.confidence) }}
                        >
                          {Math.round(suggestion.confidence * 100)}%
                        </span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="top" 
                      className="max-w-[220px] text-xs"
                    >
                      <div className="font-bold mb-1 flex items-center gap-1">
                        {suggestion.tag.icon} {suggestion.tag.name}
                      </div>
                      <div className="text-[11px] text-[var(--t3)] mb-1">{suggestion.reason}</div>
                      <div className="text-[10px] text-[var(--t4)] flex items-center gap-1">
                        <Info size={10} weight="fill" />
                        Confidence: {getConfidenceLabel(suggestion.confidence)} ({Math.round(suggestion.confidence * 100)}%)
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </TooltipProvider>
    </motion.div>
  )
}
