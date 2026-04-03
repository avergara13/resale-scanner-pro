import { Play, Stop, CheckCircle, XCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fg mb-2">Session</h1>
        <p className="text-sm text-s4">Track your sourcing performance</p>
      </div>

      {!session?.active ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-s1 flex items-center justify-center">
            <Play size={40} weight="fill" className="text-b1 ml-1" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-fg">No Active Session</h2>
            <p className="text-sm text-s4 max-w-xs">Start a session to track your scans and profits</p>
          </div>
          <Button onClick={onStartSession} className="bg-b1 hover:bg-b2 text-bg px-8 h-12 text-base font-medium">
            <Play size={20} weight="bold" className="mr-2" />
            Start Session
          </Button>
        </div>
      ) : (
        <div className="flex-1 space-y-6">
          <Card className="p-6 bg-t4 border-b1">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="secondary" className="bg-b1 text-bg px-3 py-1 uppercase text-xs font-bold">
                Active
              </Badge>
              <span className="text-sm font-mono text-s4">
                {formatDuration(Date.now() - session.startTime)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-s4 mb-1">Scanned</p>
                <p className="text-2xl font-bold font-mono text-fg">{session.itemsScanned}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-s4 mb-1">GO</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold font-mono text-green">{session.goCount}</p>
                  <CheckCircle size={20} weight="fill" className="text-green" />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-s4 mb-1">PASS</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold font-mono text-red">{session.passCount}</p>
                  <XCircle size={20} weight="fill" className="text-red" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-s4 uppercase tracking-wide mb-3">Potential Profit</h3>
            <p className="text-4xl font-bold font-mono text-fg">
              ${session.totalPotentialProfit.toFixed(2)}
            </p>
            <p className="text-sm text-s4 mt-2">
              From {session.goCount} items{' '}
              {session.goCount > 0 && (
                <span className="font-mono">
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
