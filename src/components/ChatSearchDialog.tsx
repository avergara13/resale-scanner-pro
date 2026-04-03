import { useState, useMemo, useCallback } from 'react'
import { MagnifyingGlass, X, ChatCircle, Clock, User, Robot } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatSession, ChatMessage } from '@/types'

interface SearchResult {
  sessionId: string
  sessionName: string
  messageId: string
  message: ChatMessage
  matchedText: string
  contextBefore?: string
  contextAfter?: string
}

interface ChatSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  chatSessions: ChatSession[]
  onSelectMessage: (sessionId: string, messageId: string) => void
}

function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="bg-amber/30 text-t1 font-semibold px-0.5 rounded">$1</mark>')
}

function truncateContext(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function ChatSearchDialog({ isOpen, onClose, chatSessions, onSelectMessage }: ChatSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const results: SearchResult[] = []
    const query = searchQuery.toLowerCase()

    chatSessions.forEach((session) => {
      session.messages.forEach((message, index) => {
        const content = message.content.toLowerCase()
        
        if (content.includes(query)) {
          const matchIndex = content.indexOf(query)
          const contextStart = Math.max(0, matchIndex - 50)
          const contextEnd = Math.min(message.content.length, matchIndex + query.length + 50)
          
          const contextBefore = contextStart > 0 
            ? '...' + message.content.substring(contextStart, matchIndex)
            : message.content.substring(0, matchIndex)
          
          const matchedText = message.content.substring(matchIndex, matchIndex + query.length)
          
          const contextAfter = contextEnd < message.content.length
            ? message.content.substring(matchIndex + query.length, contextEnd) + '...'
            : message.content.substring(matchIndex + query.length)

          results.push({
            sessionId: session.id,
            sessionName: session.name,
            messageId: message.id,
            message,
            matchedText,
            contextBefore: truncateContext(contextBefore, 50),
            contextAfter: truncateContext(contextAfter, 50),
          })
        }
      })
    })

    return results.sort((a, b) => b.message.timestamp - a.message.timestamp)
  }, [searchQuery, chatSessions])

  const handleSelectResult = useCallback((result: SearchResult) => {
    onSelectMessage(result.sessionId, result.messageId)
    onClose()
    setSearchQuery('')
  }, [onSelectMessage, onClose])

  const handleClose = useCallback(() => {
    onClose()
    setSearchQuery('')
  }, [onClose])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-fg border-s2 max-w-[95vw] w-full sm:max-w-[550px] p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-s2">
          <DialogTitle className="text-t1 flex items-center gap-2">
            <MagnifyingGlass size={20} weight="bold" className="text-b1" />
            Search Messages
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 border-b border-s2">
          <div className="relative">
            <MagnifyingGlass 
              size={18} 
              weight="bold" 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-t3 pointer-events-none" 
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all chat sessions..."
              className="pl-10 pr-10 h-11 bg-bg border-s2 text-t1 placeholder:text-t3"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-t3 hover:text-t1 transition-colors"
              >
                <X size={16} weight="bold" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-4 py-3">
            {!searchQuery.trim() ? (
              <div className="text-center py-12 px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-s1 mb-3">
                  <MagnifyingGlass size={32} weight="duotone" className="text-t3" />
                </div>
                <p className="text-sm text-t2 font-medium">Search across all your chat sessions</p>
                <p className="text-xs text-t3 mt-1">Type keywords to find specific messages</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-s1 mb-3">
                  <MagnifyingGlass size={32} weight="duotone" className="text-t3" />
                </div>
                <p className="text-sm text-t2 font-medium">No results found</p>
                <p className="text-xs text-t3 mt-1">Try different keywords</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-t2">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                  </p>
                </div>
                
                {searchResults.map((result, index) => (
                  <button
                    key={`${result.sessionId}-${result.messageId}-${index}`}
                    onClick={() => handleSelectResult(result)}
                    className="w-full text-left p-3 bg-bg border border-s2 rounded-xl hover:border-b1 hover:bg-blue-bg transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        result.message.role === 'user' 
                          ? "bg-gradient-to-br from-b1 to-b2 text-white" 
                          : "bg-s1 text-b1"
                      )}>
                        {result.message.role === 'user' ? (
                          <User size={16} weight="bold" />
                        ) : (
                          <Robot size={16} weight="fill" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="outline" 
                            className="text-[10px] font-bold uppercase tracking-wider border-s2 text-t3 bg-fg"
                          >
                            <ChatCircle size={10} weight="fill" className="mr-1" />
                            {result.sessionName}
                          </Badge>
                          <span className="text-[10px] text-t3 flex items-center gap-1">
                            <Clock size={10} weight="bold" />
                            {new Date(result.message.timestamp).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        
                        <div 
                          className="text-sm text-t1 leading-relaxed line-clamp-3"
                          dangerouslySetInnerHTML={{ 
                            __html: highlightMatch(
                              `${result.contextBefore}${result.matchedText}${result.contextAfter}`,
                              searchQuery
                            )
                          }}
                        />
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-b1 text-white flex items-center justify-center">
                          <MagnifyingGlass size={12} weight="bold" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-4 py-3 border-t border-s2 bg-s1/30">
          <div className="flex items-center justify-between text-xs text-t3">
            <span>💡 Tip: Search is case-insensitive</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClose}
              className="h-7 text-t2 hover:text-t1"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
