import { Play, Stop, CheckCircle, XCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '../ThemeToggle'
import type { Session } from '@/types'

interface SessionScreenProps {
  session?: Session
  onStartSession: () => void
  onEndSession: () => void
}

export function SessionScreen({ session, onStartSession, onEndSession }: SessionScreenProps) {
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
  }

  return (
    <div id="scr-session" className="flex flex-col h-full px-4 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-t1">TODAY'S SESSION</h1>
          <p className="text-[11px] text-t3 font-medium uppercase tracking-wider">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <ThemeToggle />
      </div>

      {!session?.active ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-s1 flex items-center justify-center">
            <Play size={40} weight="fill" className="text-b1 ml-1" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-t1">No Active Session</h2>
            <p className="text-sm text-t3 max-w-xs">Start a session to track your scans and profits</p>
          </div>
          <Button onClick={onStartSession} className="bg-gradient-to-br from-b1 to-amber hover:opacity-90 text-white px-8 h-12 text-base font-bold shadow-lg active:scale-95 transition-all">
            <Play size={20} weight="bold" className="mr-2" />
            Start Session
          </Button>
        </div>
      ) : (
        <div className="flex-1 space-y-4">
          <div className="flex gap-2">
            <div className="stat-card flex-1">
              <div className="text-[22px] font-bold text-green leading-tight">
                ${session.totalPotentialProfit.toFixed(2)}
              </div>
              <div className="text-[11px] text-t3 font-medium uppercase tracking-wider">Est. Profit</div>
            </div>
            <div className="stat-card flex-1">
              <div className="text-[22px] font-bold text-t1 leading-tight">{session.itemsScanned}</div>
              <div className="text-[11px] text-t3 font-medium uppercase tracking-wider">Scans</div>
            </div>
            <div className="stat-card flex-1">
              <div className="text-[22px] font-bold text-b1 leading-tight">
                {session.itemsScanned > 0 ? Math.round((session.goCount / session.itemsScanned) * 100) : 0}%
              </div>
              <div className="text-[11px] text-t3 font-medium uppercase tracking-wider">GO Rate</div>
            </div>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="secondary" className="bg-green text-white px-3 py-1 uppercase text-xs font-bold">
                Active
              </Badge>
              <span className="text-sm mono text-t3">
                {formatDuration(Date.now() - session.startTime)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-t3 mb-1">GO</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold mono text-green">{session.goCount}</p>
                  <CheckCircle size={20} weight="fill" className="text-green" />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-t3 mb-1">PASS</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold mono text-red">{session.passCount}</p>
                  <XCircle size={20} weight="fill" className="text-red" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-t3 uppercase tracking-wide mb-3">Potential Profit</h3>
            <p className="text-4xl font-bold mono text-t1">
              ${session.totalPotentialProfit.toFixed(2)}
            </p>
            <p className="text-sm text-t3 mt-2">
              From {session.goCount} items{' '}
              {session.goCount > 0 && (
                <span className="mono">
                  (${(session.totalPotentialProfit / session.goCount).toFixed(2)} avg)
                </span>
              )}
            </p>
          </Card>

          <Button
            onClick={onEndSession}
            variant="outline"
            className="w-full h-12 border-red text-red hover:bg-red/10 font-medium"
          >
            <Stop size={20} weight="bold" className="mr-2" />
            End Session
          </Button>
        </div>
      )}
    </div>
  )
}
