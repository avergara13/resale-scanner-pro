import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Plus, Check, Trash, ListChecks } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface SharedTodo {
  id: string
  text: string
  completed: boolean
  createdBy: 'user' | 'agent'
  createdAt: number
}

export function SharedTodoList() {
  const [todos, setTodos] = useKV<SharedTodo[]>('shared-todos', [])
  const [input, setInput] = useState('')

  const handleAdd = () => {
    const text = input.trim()
    if (!text) return
    const newTodo: SharedTodo = {
      id: Date.now().toString(),
      text,
      completed: false,
      createdBy: 'user',
      createdAt: Date.now(),
    }
    setTodos(prev => [...(prev || []), newTodo])
    setInput('')
  }

  const handleToggle = (id: string) => {
    setTodos(prev =>
      (prev || []).map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    )
  }

  const handleDelete = (id: string) => {
    setTodos(prev => (prev || []).filter(t => t.id !== id))
  }

  const pending = (todos || []).filter(t => !t.completed)
  const completed = (todos || []).filter(t => t.completed)

  return (
    <div className="bg-fg rounded-xl border border-s1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-s1">
        <div className="flex items-center gap-2">
          <ListChecks size={14} weight="bold" className="text-b1" />
          <span className="text-[11px] font-bold text-t1">Shared Tasks</span>
        </div>
        {pending.length > 0 && (
          <span className="text-[9px] font-bold text-b1 bg-b1/10 px-1.5 py-0.5 rounded-md">
            {pending.length} open
          </span>
        )}
      </div>

      {/* Add input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-s1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add a task..."
          className="flex-1 bg-s1 rounded-lg px-3 py-1.5 text-[11px] text-t1 placeholder:text-t3 outline-none focus:ring-1 focus:ring-b1/30"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="p-1.5 rounded-lg bg-b1 text-white disabled:opacity-30 transition-opacity active:scale-95"
        >
          <Plus size={12} weight="bold" />
        </button>
      </div>

      {/* Todo items */}
      <div className="max-h-[200px] overflow-y-auto scrollbar-hide">
        {(todos || []).length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[10px] text-t3">No tasks yet. Add one above or let the Agent create tasks.</p>
          </div>
        ) : (
          <div className="divide-y divide-s1">
            {pending.map(todo => (
              <div key={todo.id} className="flex items-center gap-2 px-3 py-2 group">
                <button
                  onClick={() => handleToggle(todo.id)}
                  className="flex-shrink-0 w-4 h-4 rounded border border-s2 hover:border-b1 transition-colors flex items-center justify-center"
                >
                </button>
                <span className="flex-1 text-[11px] text-t1 leading-tight">{todo.text}</span>
                <span className={cn(
                  'text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded',
                  todo.createdBy === 'agent' ? 'text-b1 bg-b1/10' : 'text-t3 bg-s1'
                )}>
                  {todo.createdBy}
                </span>
                <button
                  onClick={() => handleDelete(todo.id)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-t3 hover:text-red"
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
            {completed.map(todo => (
              <div key={todo.id} className="flex items-center gap-2 px-3 py-2 group opacity-50">
                <button
                  onClick={() => handleToggle(todo.id)}
                  className="flex-shrink-0 w-4 h-4 rounded bg-green/20 border border-green/30 flex items-center justify-center"
                >
                  <Check size={10} weight="bold" className="text-green" />
                </button>
                <span className="flex-1 text-[11px] text-t2 leading-tight line-through">{todo.text}</span>
                <button
                  onClick={() => handleDelete(todo.id)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-t3 hover:text-red"
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
