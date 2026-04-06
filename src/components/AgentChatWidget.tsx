import { useState, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { PaperPlaneRight, Robot, User, CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { ChatSession, ChatMessage } from '@/types'

function formatMsg(text: string): string {
  let f = text
  f = f.replace(/^#{1,3}\s+(.+)$/gm, '<h3 class="font-bold text-t1 mt-3 mb-1 first:mt-0 text-xs">$1</h3>')
  f = f.replace(/^\*\*(.+?)\*\*:?\s*(.*)$/gm, '<div class="mb-1"><span class="font-bold text-t1">$1:</span> <span class="text-t2">$2</span></div>')
  f = f.replace(/^[-•]\s+(.+)$/gm, '<li class="ml-3 mb-1 text-t1 leading-relaxed">$1</li>')
  f = f.replace(/(<li.*<\/li>\s*)+/g, (m) => `<ul class="space-y-0.5 my-2">${m}</ul>`)
  f = f.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-s1 text-t1 rounded text-[10px] font-mono">$1</code>')
  f = f.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-t1">$1</strong>')
  f = f.replace(/\$(\d+(?:\.\d{2})?)/g, '<span class="font-bold text-green">$$$1</span>')
  return f
}

interface AgentChatWidgetProps {
  /** Called when user sends a message — parent routes it through the full AgentScreen handler */
  onSendMessage?: (text: string) => void
  isProcessing?: boolean
  compact?: boolean
}

export function AgentChatWidget({ onSendMessage, isProcessing = false, compact = false }: AgentChatWidgetProps) {
  const [chatSessions] = useKV<ChatSession[]>('chat-sessions', [])
  const [activeSessionId] = useKV<string | null>('active-chat-session', null)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeSession = chatSessions?.find(s => s.id === activeSessionId)
  const messages = activeSession?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isProcessing) return
    onSendMessage?.(text)
    setInput('')
  }

  return (
    <div className={cn('flex flex-col bg-fg rounded-xl border border-s1 overflow-hidden', compact ? 'h-[320px]' : 'h-[400px]')}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-s1 bg-fg">
        <div className="p-1.5 bg-gradient-to-br from-b1 to-b2 rounded-lg">
          <Robot size={14} weight="bold" className="text-white" />
        </div>
        <span className="text-[11px] font-bold text-t1">Agent</span>
        {isProcessing && (
          <CircleNotch size={12} className="text-b1 animate-spin ml-auto" />
        )}
        {!activeSession && (
          <span className="text-[9px] text-t3 ml-auto">No active chat — send a message to start</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Robot size={32} weight="duotone" className="text-t3 opacity-30 mb-2" />
            <p className="text-[10px] text-t3">
              Ask me anything — I can create sessions, manage listings, research items, and help with your resale workflow.
            </p>
          </div>
        ) : (
          messages.slice(-20).map((msg: ChatMessage) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-2 items-start',
                msg.role === 'user' ? 'flex-row-reverse' : ''
              )}
            >
              <div className={cn(
                'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5',
                msg.role === 'user' ? 'bg-b1' : 'bg-s2'
              )}>
                {msg.role === 'user'
                  ? <User size={10} weight="bold" className="text-white" />
                  : <Robot size={10} weight="bold" className="text-t2" />
                }
              </div>
              <div
                className={cn(
                  'rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed max-w-[85%]',
                  msg.role === 'user'
                    ? 'bg-b1 text-white rounded-tr-sm'
                    : 'bg-s1 text-t1 rounded-tl-sm'
                )}
                dangerouslySetInnerHTML={{
                  __html: msg.role === 'assistant' ? formatMsg(msg.content) : msg.content
                }}
              />
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-s1 bg-fg">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask the agent..."
          disabled={isProcessing}
          className="flex-1 bg-s1 rounded-lg px-3 py-2 text-[11px] text-t1 placeholder:text-t3 outline-none focus:ring-1 focus:ring-b1/30 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isProcessing}
          className="p-2 rounded-lg bg-b1 text-white disabled:opacity-30 transition-opacity active:scale-95"
        >
          <PaperPlaneRight size={14} weight="bold" />
        </button>
      </div>
    </div>
  )
}
