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
    const unsubscribe = onValue(counterRef, (snapshot) => {
      const data = snapshot.val()
      if (data) setCounters(data)
      else setCounters({})
    })

    return () => {
      unsubscribe()
      off(counterRef)
    }
  }, [partyId, groupId])

  const entries = Object.entries(counters)
    .map(([userId, entry]) => ({ userId, ...entry }))
    .sort((a, b) => b.count - a.count)

  const activeEntries = entries.filter(e => e.count > 0)
  const totalCount = activeEntries.reduce((sum, e) => sum + e.count, 0)

  // Hide the entire tile if no one is currently drinking
  if (activeEntries.length === 0 && !compact) {
    return null
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Beer size={14} className="accent-gold" />
        <span className="font-bold text-sm accent-gold">{totalCount}</span>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-ghost)' }}>
          · {activeEntries.length} {activeEntries.length === 1 ? 'person' : 'people'}
        </span>
      </div>
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Beer size={18} className="accent-gold" />
          <h3 className="font-bold">Live Counter</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>
            {totalCount}
          </span>
          <span className="text-xs font-medium" style={{ color: 'var(--text-ghost)' }}>total</span>
        </div>
      </div>

      {showLeaderboard && activeEntries.length > 0 && (
        <div className="space-y-3 mt-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} style={{ color: 'var(--acid)' }} />
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
              Live Leaderboard
            </span>
          </div>
          {activeEntries.map((entry, i) => (
            <div key={entry.userId} className="relative flex items-center justify-between p-3 rounded-2xl anim-slide overflow-hidden group border border-white/5"
              style={{
                background: i === 0 ? 'linear-gradient(90deg, rgba(251,191,36,0.15) 0%, rgba(0,0,0,0.4) 100%)' : 'var(--glass-fill-inset)',
                animationDelay: `${i * 0.05}s`,
              }}>
              {/* Highlight bar for #1 */}
              {i === 0 && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'var(--amber)', boxShadow: 'var(--amber-glow)' }}></div>}

              <div className="flex items-center gap-3 relative z-10">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black" style={{ background: i === 0 ? 'var(--amber)' : 'var(--bg-surface)', color: i === 0 ? '#050505' : 'var(--text-secondary)', border: i !== 0 ? '1px solid var(--border)' : 'none' }}>
                  #{i + 1}
                </span>
                <span className="font-black text-base" style={{ color: i === 0 ? 'var(--amber)' : 'var(--text-primary)' }}>{entry.username}</span>
              </div>
              <div className="flex items-center gap-1 bg-black/40 px-3 py-1 rounded-full border border-white/5 relative z-10">
                <span className="font-black text-lg" style={{ color: 'var(--amber)' }}>{entry.count}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>🍺</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
