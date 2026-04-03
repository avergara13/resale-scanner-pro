import { Sparkle, Tag } from '@phosphor-icons/react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { motion, AnimatePresence } from 'framer-motion'

interface SuggestedTagsProps {
  suggestions: string[]
  onApply: (tags: string[]) => void
  onApplyTag: (tag: string) => void
  appliedTags?: string[]
}

export function SuggestedTags({ suggestions, onApply, onApplyTag, appliedTags = [] }: SuggestedTagsProps) {
  if (!suggestions || suggestions.length === 0) return null

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
            <p className="text-[10px] text-[var(--t3)]">Based on product analysis</p>
          </div>
        </div>
        <Button
          onClick={() => onApply(suggestions)}
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[10px] font-bold text-[var(--b1)] hover:text-[var(--b1)] hover:bg-[var(--b1)]/10"
        >
          APPLY ALL
        </Button>
      </div>
      
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence>
          {suggestions.map((tag, index) => {
            const isApplied = appliedTags.includes(tag)
            return (
              <motion.div
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: index * 0.05 }}
              >
                <Badge
                  variant={isApplied ? 'default' : 'outline'}
                  className="cursor-pointer transition-all hover:scale-105 text-[11px] px-2 py-1"
                  style={{
                    backgroundColor: isApplied ? 'var(--b1)' : 'transparent',
                    borderColor: 'var(--b1)',
                    color: isApplied ? 'white' : 'var(--b1)',
                  }}
                  onClick={() => onApplyTag(tag)}
                >
                  <Tag size={10} weight={isApplied ? 'fill' : 'bold'} className="mr-1" />
                  {tag}
                </Badge>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
