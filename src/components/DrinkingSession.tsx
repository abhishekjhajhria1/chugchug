import { useState, useEffect, useRef, useCallback } from "react"
import { useChug } from "../context/ChugContext"
import { supabase } from "../lib/supabase"
import { firebaseDb } from "../lib/firebase"
import { ref, set, onValue, off } from "firebase/database"
import { Beer, Minus, Zap, Clock, Timer, Copy, Share2, X } from "lucide-react"

interface Participant {
  userId: string
  username: string
  count: number
  updatedAt: number
}

interface DrinkingSessionProps {
  sessionId: string
  joinCode: string
  groupId?: string | null
  onEnd: () => void
}

export default function DrinkingSession({ sessionId, joinCode, groupId, onEnd }: DrinkingSessionProps) {
  const { user, profile } = useChug()
  const [count, setCount] = useState(0)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [elapsed, setElapsed] = useState("0:00")
  const [animating, setAnimating] = useState(false)

  const countRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef(Date.now())
  const groupsRef = useRef<string[]>([])

  // Haptic feedback
  const vibrate = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(30)
  }, [])

  // Load user's groups for syncing
  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
      if (data) groupsRef.current = data.map(d => d.group_id)
    }
    load()
  }, [user])

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const m = Math.floor(seconds / 60)
      const s = seconds % 60
      setElapsed(`${m}:${s.toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Listen to Firebase for all participants
  useEffect(() => {
    const participantsRef = ref(firebaseDb, `sessions/${sessionId}/participants`)
    const unsubscribe = onValue(participantsRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) return setParticipants([])
      const list: Participant[] = Object.entries(data).map(([userId, val]: any) => ({
        userId,
        username: val.username,
        count: val.count || 0,
        updatedAt: val.updatedAt || 0,
      }))
      list.sort((a, b) => b.count - a.count)
      setParticipants(list)

      // Update own count from Firebase if different (sync from another device)
      if (user) {
        const me = list.find(p => p.userId === user.id)
        if (me && me.count !== countRef.current) {
          countRef.current = me.count
          setCount(me.count)
        }
      }
    })
    return () => { off(participantsRef); unsubscribe() }
  }, [sessionId, user])

  // Debounced sync to Firebase + Supabase
  const syncCount = useCallback((newCount: number) => {
    if (!user || !profile) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      // Firebase — session participants
      set(ref(firebaseDb, `sessions/${sessionId}/participants/${user.id}`), {
        count: newCount,
        username: profile.username,
        updatedAt: Date.now(),
      })

      // Firebase — group live counters (so group cards show activity)
      if (groupId) {
        set(ref(firebaseDb, `live_counters/groups/${groupId}/${user.id}`), {
          count: newCount, username: profile.username, updatedAt: Date.now(),
        })
      }

      // Supabase — persist count
      const today = new Date().toISOString().split('T')[0]
      supabase.from("beer_counts").upsert({
        user_id: user.id, date: today, count: newCount, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,date' })

      // Supabase — update session participant count
      supabase.from("session_participants").upsert({
        session_id: sessionId, user_id: user.id, drink_count: newCount
      }, { onConflict: 'session_id,user_id' })
    }, 400)
  }, [user, profile, sessionId, groupId])

  const updateCount = (delta: number) => {
    vibrate()
    const newCount = Math.max(0, countRef.current + delta)
    countRef.current = newCount
    setCount(newCount)
    setAnimating(true)
    setTimeout(() => setAnimating(false), 200)

    // Immediate Firebase write (no debounce for responsiveness)
    if (user && profile) {
      set(ref(firebaseDb, `sessions/${sessionId}/participants/${user.id}`), {
        count: newCount, username: profile.username, updatedAt: Date.now(),
      })
    }

    // Debounced Supabase write
    syncCount(newCount)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(joinCode)
    // Brief visual feedback via haptic
    vibrate()
  }

  const shareSession = async () => {
    const url = `${window.location.origin}/session/${sessionId}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my drinking session!', text: `Code: ${joinCode}`, url })
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(url)
    }
  }

  const pace = count > 0
    ? (() => {
        const mins = (Date.now() - startTimeRef.current) / 60000
        const minsPerDrink = mins / count
        return minsPerDrink < 1 ? "< 1 min/drink" : `${minsPerDrink.toFixed(1)} min/drink`
      })()
    : "—"

  const totalDrinks = participants.reduce((sum, p) => sum + p.count, 0)
  const activeCount = participants.filter(p => p.count > 0).length

  return (
    <div className="space-y-5">
      {/* Session Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--coral)', boxShadow: '0 0 12px rgba(209,32,32,0.5)' }} />
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Live Session</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{activeCount} drinking · {totalDrinks} total</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[4px]" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)' }}>
          <Clock size={14} style={{ color: 'var(--amber)' }} />
          <span className="text-xs font-black font-mono" style={{ color: 'var(--amber)' }}>{elapsed}</span>
        </div>
      </div>

      {/* Join Code Bar */}
      <div className="flex items-center gap-2 p-3 rounded-[4px]" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)' }}>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Join Code</p>
          <p className="text-xl font-black tracking-[0.2em]" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>{joinCode}</p>
        </div>
        <button onClick={copyCode} className="p-2.5 rounded-[4px] active:scale-95 transition-transform" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(216,162,94,0.3)', color: 'var(--amber)' }} title="Copy code">
          <Copy size={16} />
        </button>
        <button onClick={shareSession} className="p-2.5 rounded-[4px] active:scale-95 transition-transform" style={{ background: 'var(--acid-dim)', border: '1px solid rgba(204,255,0,0.3)', color: 'var(--acid)' }} title="Share session">
          <Share2 size={16} />
        </button>
      </div>

      {/* Counter */}
      <div className="flex flex-col items-center py-6">
        <div
          className="relative w-48 h-48 rounded-full flex flex-col items-center justify-center cursor-pointer select-none"
          onClick={() => updateCount(1)}
          style={{
            border: count > 0 ? '5px solid var(--amber)' : '5px solid var(--border-mid)',
            background: count > 0 ? 'var(--amber-dim)' : 'var(--bg-deep)',
            boxShadow: count > 0 ? '0 0 40px rgba(216,162,94,0.15), inset 0 0 30px rgba(216,162,94,0.05)' : 'none',
            transition: 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
            transform: animating ? 'scale(0.92)' : 'scale(1)',
          }}
        >
          <span className="text-[72px] font-black tracking-tighter leading-none" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            {count}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>TAP TO CHUG</span>
        </div>

        {count > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); updateCount(-1) }}
            className="mt-6 px-5 py-2 rounded-[4px] flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-widest active:scale-95"
            style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)' }}
          >
            <Minus size={14} /> Remove One
          </button>
        )}

        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          <Timer size={12} /> Pace: {pace}
        </div>
      </div>

      {/* Live Leaderboard */}
      {participants.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 px-1" style={{ color: 'var(--text-muted)' }}>
            <Beer size={12} style={{ color: 'var(--amber)' }} /> Live Leaderboard
          </h3>
          {participants.map((p, i) => {
            const isMe = p.userId === user?.id
            return (
              <div
                key={p.userId}
                className="flex items-center justify-between p-3 rounded-[4px] relative overflow-hidden"
                style={{
                  background: i === 0 ? 'linear-gradient(90deg, rgba(216,162,94,0.15), var(--bg-deep))' : 'var(--bg-deep)',
                  border: `1px solid ${i === 0 ? 'rgba(216,162,94,0.3)' : 'var(--border-mid)'}`,
                }}
              >
                {i === 0 && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'var(--amber)' }} />}
                <div className="flex items-center gap-3 relative z-10">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                    style={{
                      background: i === 0 ? 'var(--amber)' : 'var(--bg-surface)',
                      color: i === 0 ? '#050505' : 'var(--text-secondary)',
                      border: i !== 0 ? '1px solid var(--border-mid)' : 'none',
                    }}>
                    #{i + 1}
                  </span>
                  <span className="font-black text-sm" style={{ color: isMe ? 'var(--amber)' : 'var(--text-primary)' }}>
                    {isMe ? 'You' : p.username}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 rounded-[4px] relative z-10" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-mid)' }}>
                  <span className="font-black text-lg" style={{ color: 'var(--amber)' }}>{p.count}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>🍺</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onEnd}
          className="flex-1 py-4 rounded-[4px] text-xs uppercase font-black tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, var(--coral), #D94242)', color: '#fff', boxShadow: '0 4px 20px rgba(209,32,32,0.3)' }}
        >
          <X size={16} /> End Session
        </button>
      </div>
    </div>
  )
}
