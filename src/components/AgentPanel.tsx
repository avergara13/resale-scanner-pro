import { useState, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { PaperPlaneRight, Robot, User, CircleNotch, ListChecks, ChatCircle, Plus, Check, Trash, CaretDown, CaretUp } from '@phosphor-icons/react'
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

export interface SharedTodo {
  id: string
  text: string
  completed: boolean
  createdBy: 'user' | 'agent'
  createdAt: number
}

type PanelTab = 'chat' | 'tasks'

interface AgentPanelProps {
  onSendMessage?: (text: string) => void
  isProcessing?: boolean
}

export function AgentPanel({ onSendMessage, isProcessing = false }: AgentPanelProps) {
  const [chatSessions] = useKV<ChatSession[]>('chat-sessions', [])
  const [activeSessionId] = useKV<string | null>('active-chat-session', null)
  const [todos, setTodos] = useKV<SharedTodo[]>('shared-todos', [])
  const [collapsed, setCollapsed] = useState(true)
  const [tab, setTab] = useState<PanelTab>('chat')
  const [input, setInput] = useState('')
  const [taskInput, setTaskInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeSession = chatSessions?.find(s => s.id === activeSessionId)
  const messages = activeSession?.messages || []
  const pendingTasks = (todos || []).filter(t => !t.completed)
  const completedTasks = (todos || []).filter(t => t.completed)

  const prevMsgCount = useRef(messages.length)
  const hasMounted = useRef(false)
  useEffect(() => {
    if (!hasMounted.current) {
      // Skip the initial load (KV hydration) — don't scroll
      hasMounted.current = true
      prevMsgCount.current = messages.length
      return
    }
    if (tab === 'chat' && messages.length > prevMsgCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMsgCount.current = messages.length
  }, [messages.length, tab])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isProcessing) return
    onSendMessage?.(text)
    setInput('')
  }

  const handleAddTask = () => {
    const text = taskInput.trim()
    if (!text) return
    setTodos(prev => [...(prev || []), {
      id: Date.now().toString(),
      text,
      completed: false,
      createdBy: 'user' as const,
      createdAt: Date.now(),
    }])
    setTaskInput('')
  }

  const handleToggleTask = (id: string) => {
    setTodos(prev => (prev || []).map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const handleDeleteTask = (id: string) => {
    setTodos(prev => (prev || []).filter(t => t.id !== id))
  }

  return (
    <div className="flex flex-col bg-fg rounded-xl border border-s1 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="flex items-center justify-between px-3 py-2.5 bg-fg active:bg-s1/50 transition-colors flex-shrink-0"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 bg-gradient-to-br from-b1 to-b2 rounded-lg">
            <Robot size={12} weight="bold" className="text-white" />
          </div>
          <span className="text-[11px] font-bold text-t1">Agent</span>
          {isProcessing && <CircleNotch size={10} className="text-b1 animate-spin" />}
          {pendingTasks.length > 0 && (
            <span className="text-[8px] bg-b1/15 text-b1 px-1.5 py-0.5 rounded-md font-bold">{pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {collapsed ? <CaretDown size={14} className="text-t3" /> : <CaretUp size={14} className="text-t3" />}
      </button>

      {!collapsed && (
        <>
          {/* Tab bar */}
          <div className="flex border-t border-b border-s1 bg-fg flex-shrink-0">
            <button
              onClick={() => setTab('chat')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wide transition-all border-b-2',
                tab === 'chat' ? 'text-b1 border-b1' : 'text-t3 border-transparent'
              )}
            >
              <Robot size={13} weight={tab === 'chat' ? 'fill' : 'regular'} />
              Chat
            </button>
            <button
              onClick={() => setTab('tasks')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wide transition-all border-b-2',
                tab === 'tasks' ? 'text-b1 border-b1' : 'text-t3 border-transparent'
              )}
            >
              <ListChecks size={13} weight={tab === 'tasks' ? 'fill' : 'regular'} />
              Tasks
              {pendingTasks.length > 0 && (
                <span className="text-[8px] bg-b1/15 text-b1 px-1 py-0.5 rounded-md font-bold">{pendingTasks.length}</span>
              )}
            </button>
          </div>

          <div style={{ height: 320 }} className="flex flex-col">
      {/* Chat tab */}
      {tab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-hide">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Robot size={28} weight="duotone" className="text-t3 opacity-30 mb-2" />
                <p className="text-[10px] text-t3 leading-relaxed">
                  Ask me anything — research items, create sessions, manage listings, or get help with your resale workflow.
                </p>
              </div>
            ) : (
              messages.slice(-25).map((msg: ChatMessage) => (
                <div
                  key={msg.id}
                  className={cn('flex gap-2 items-start', msg.role === 'user' ? 'flex-row-reverse' : '')}
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

          {/* Pinned tasks summary above input */}
          {pendingTasks.length > 0 && (
            <button
              onClick={() => setTab('tasks')}
              className="mx-3 mb-1 flex items-center gap-2 px-2.5 py-1.5 bg-s1 rounded-lg text-[10px] text-t2 active:opacity-70 transition-opacity"
            >
              <ListChecks size={12} className="text-b1" />
              <span className="font-bold text-t1">{pendingTasks.length} open task{pendingTasks.length !== 1 ? 's' : ''}</span>
              <span className="text-t3 truncate flex-1 text-left">— {pendingTasks[0].text}</span>
            </button>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-s1 bg-fg flex-shrink-0">
            <input
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
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-b1 text-white disabled:opacity-30 transition-opacity active:scale-95"
            >
              <PaperPlaneRight size={16} weight="bold" />
            </button>
          </div>
        </>
      )}

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {(todos || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <ListChecks size={28} weight="duotone" className="text-t3 opacity-30 mb-2" />
                <p className="text-[10px] text-t3 leading-relaxed">
                  No tasks yet. Add one below or ask the Agent to create tasks for you.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-s1">
                {pendingTasks.map(todo => (
                  <div key={todo.id} className="flex items-center gap-2 px-3 py-2.5 group">
                    <button
                      onClick={() => handleToggleTask(todo.id)}
                      className="flex-shrink-0 w-5 h-5 rounded-md border border-s2 hover:border-b1 transition-colors flex items-center justify-center"
                    />
                    <span className="flex-1 text-[11px] text-t1 leading-tight">{todo.text}</span>
                    <span className={cn(
                      'text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded',
                      todo.createdBy === 'agent' ? 'text-b1 bg-b1/10' : 'text-t3 bg-s1'
                    )}>
                      {todo.createdBy}
                    </span>
                    <button
                      onClick={() => handleDeleteTask(todo.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-t3 hover:text-red p-1"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
                {completedTasks.length > 0 && (
                  <div className="px-3 py-2 text-[9px] text-t3 font-bold uppercase tracking-wide">
                    Completed ({completedTasks.length})
                  </div>
                )}
                {completedTasks.map(todo => (
                  <div key={todo.id} className="flex items-center gap-2 px-3 py-2 group opacity-40">
                    <button
                      onClick={() => handleToggleTask(todo.id)}
                      className="flex-shrink-0 w-5 h-5 rounded-md bg-green/20 border border-green/30 flex items-center justify-center"
                    >
                      <Check size={11} weight="bold" className="text-green" />
                    </button>
                    <span className="flex-1 text-[11px] text-t2 leading-tight line-through">{todo.text}</span>
                    <button
                      onClick={() => handleDeleteTask(todo.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-t3 hover:text-red p-1"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add task input */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-s1 bg-fg flex-shrink-0">
            <input
              value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              placeholder="Add a task..."
              className="flex-1 bg-s1 rounded-lg px-3 py-2 text-[11px] text-t1 placeholder:text-t3 outline-none focus:ring-1 focus:ring-b1/30"
            />
            <button
              onClick={handleAddTask}
              disabled={!taskInput.trim()}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-b1 text-white disabled:opacity-30 transition-opacity active:scale-95"
            >
              <Plus size={16} weight="bold" />
            </button>
          </div>
        </>
      )}
          </div>
        </>
      )}
    </div>
  )
}
