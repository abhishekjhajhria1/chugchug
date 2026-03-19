import { useState, useEffect } from "react"
import { firebaseDb } from "../lib/firebase"
import { ref, onValue, off } from "firebase/database"
import { Beer, TrendingUp } from "lucide-react"

interface CounterEntry {
  count: number
  username: string
  updatedAt: number
}

interface LiveCounterProps {
  partyId?: string
  groupId?: string
  showLeaderboard?: boolean
  compact?: boolean
}

export default function LiveCounter({ partyId, groupId, showLeaderboard, compact }: LiveCounterProps) {
  const [counters, setCounters] = useState<Record<string, CounterEntry>>({})

  useEffect(() => {
    const path = partyId
      ? `parties/${partyId}/counters`
      : groupId
        ? `live_counters/groups/${groupId}`
        : null

    if (!path) return

    const counterRef = ref(firebaseDb, path)
    onValue(counterRef, (snapshot) => {
      const data = snapshot.val()
      if (data) setCounters(data)
      else setCounters({})
    })

    return () => off(counterRef)
  }, [partyId, groupId])

  const entries = Object.entries(counters)
    .map(([userId, entry]) => ({ userId, ...entry }))
    .sort((a, b) => b.count - a.count)

  const totalCount = entries.reduce((sum, e) => sum + e.count, 0)

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Beer size={14} className="accent-gold" />
        <span className="font-bold text-sm accent-gold">{totalCount}</span>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-ghost)' }}>
          · {entries.length} {entries.length === 1 ? 'person' : 'people'}
        </span>
      </div>
    )
  }

  return (
    <div className="glass-card glow-gold">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Beer size={18} className="accent-gold" />
          <h3 className="font-bold">Live Counter</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black accent-gold" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {totalCount}
          </span>
          <span className="text-xs font-medium" style={{ color: 'var(--text-ghost)' }}>total</span>
        </div>
      </div>

      {showLeaderboard && entries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1 mb-2">
            <TrendingUp size={12} className="accent-mint" />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
              Live Leaderboard
            </span>
          </div>
          {entries.map((entry, i) => (
            <div key={entry.userId} className="flex items-center justify-between p-2 rounded-lg anim-slide"
              style={{
                background: 'var(--glass-fill)',
                border: '1px solid var(--glass-edge)',
                animationDelay: `${i * 0.04}s`,
              }}>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: i === 0 ? 'rgba(251,191,36,0.25)' : 'var(--glass-fill)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                  {i + 1}
                </span>
                <span className="font-semibold text-sm">{entry.username}</span>
              </div>
              <span className="font-bold text-sm accent-gold">{entry.count} 🍺</span>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-center text-sm font-medium py-4" style={{ color: 'var(--text-ghost)' }}>
          No one is counting yet. Be the first! 🍺
        </p>
      )}
    </div>
  )
}
