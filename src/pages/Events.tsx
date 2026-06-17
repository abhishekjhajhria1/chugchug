import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Sparkles, Clock, Plus, Check, Trophy } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { useToast } from "../components/Toast"
import { countdown, type LiveEvent } from "../lib/engagement"

interface EventRow extends LiveEvent {
  is_active: boolean
  participants: number
  joined: boolean
  progress: number
  completed: boolean
}

export default function Events() {
  const { user, profile } = useChug()
  const navigate = useNavigate()
  const toast = useToast()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const isAdmin = profile?.role === "super_admin"

  const load = async () => {
    if (!user) return
    try {
      const nowISO = new Date().toISOString()
      const { data: evs } = await supabase
        .from("events")
        .select("*")
        .gte("ends_at", nowISO)
        .eq("is_active", true)
        .order("starts_at", { ascending: true })
      const list = (evs ?? []) as any[]
      if (list.length === 0) { setEvents([]); setLoaded(true); return }

      const ids = list.map(e => e.id)
      const [{ data: parts }, { data: mine }] = await Promise.all([
        supabase.from("event_participants").select("event_id").in("event_id", ids),
        supabase.from("event_participants").select("event_id, progress, completed").in("event_id", ids).eq("user_id", user.id),
      ])
      const counts = new Map<string, number>()
      for (const p of parts ?? []) counts.set(p.event_id, (counts.get(p.event_id) ?? 0) + 1)
      const mineMap = new Map((mine ?? []).map((m: any) => [m.event_id, m]))

      setEvents(list.map(e => ({
        ...e,
        participants: counts.get(e.id) ?? 0,
        joined: mineMap.has(e.id),
        progress: (mineMap.get(e.id) as any)?.progress ?? 0,
        completed: (mineMap.get(e.id) as any)?.completed ?? false,
      })))
      setLoaded(true)
    } catch {
      setLoaded(true)
    }
  }
  useEffect(() => { load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const join = async (id: string) => {
    if (!user) return
    const { error } = await supabase.from("event_participants").insert({ event_id: id, user_id: user.id })
    if (error && !/duplicate|unique/i.test(error.message)) { toast.error("Couldn't join"); return }
    toast.success("You're in! 🎉")
    load()
  }

  return (
    <div className="space-y-5 pb-24 wano-fade">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2" style={{ color: "var(--text-secondary)" }}><ArrowLeft size={20} /></button>
        <h1 className="page-title flex items-center gap-2"><Sparkles size={20} style={{ color: "var(--amber)" }} /> Events</h1>
        {isAdmin && (
          <button onClick={() => setShowCreate(s => !s)} className="ml-auto glass-btn-secondary text-xs flex items-center gap-1.5" style={{ padding: "8px 14px" }}>
            <Plus size={14} /> New
          </button>
        )}
      </div>

      {isAdmin && showCreate && <CreateEventForm onCreated={() => { setShowCreate(false); load() }} />}

      {!loaded ? null : events.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
          <div className="text-5xl mb-3">🗓️</div>
          <p className="font-bold">No live events right now</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>Check back soon — happy hours & challenges drop here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(e => {
            const live = new Date(e.starts_at).getTime() <= Date.now()
            const pct = e.target ? Math.min(100, Math.round((e.progress / e.target) * 100)) : 0
            return (
              <div key={e.id} className="glass-card" style={{ borderLeft: "4px solid var(--amber)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 flex items-center justify-center text-2xl shrink-0" style={{ background: "var(--amber-dim)", borderRadius: "var(--card-radius)" }}>{e.emoji || "✨"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5" style={{ background: live ? "var(--coral)" : "var(--bg-raised)", color: live ? "#fff" : "var(--text-muted)", borderRadius: "var(--pill-radius)", border: live ? "none" : "1px solid var(--border-mid)" }}>
                        {live ? "Live" : "Soon"}
                      </span>
                      {(e.bonus_xp_multiplier ?? 1) > 1 && <span className="text-[9px] font-black" style={{ color: "var(--amber)" }}>{e.bonus_xp_multiplier}× XP</span>}
                    </div>
                    <h3 className="text-base font-black mt-1" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>{e.title}</h3>
                    {e.description && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{e.description}</p>}
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <Clock size={12} style={{ color: "var(--coral)" }} />
                    <span className="text-[11px] font-black tabular-nums" style={{ color: "var(--coral)" }}>{countdown(e.ends_at)}</span>
                  </div>
                </div>

                {e.joined && e.target ? (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                      <span style={{ color: "var(--text-muted)" }}>Your progress</span>
                      <span style={{ color: "var(--amber)" }}>{e.progress}/{e.target}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden" style={{ background: "var(--glass-fill-inset)", borderRadius: "999px" }}>
                      <div className="h-full" style={{ width: `${pct}%`, background: "var(--amber)" }} />
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] font-bold" style={{ color: "var(--text-ghost)" }}>
                    👥 {e.participants} joined {e.reward_badge ? <span style={{ color: "var(--acid)" }}>· 🏅 {e.reward_badge}</span> : null}
                  </span>
                  {e.completed ? (
                    <span className="text-[10px] font-black flex items-center gap-1" style={{ color: "var(--acid)" }}><Trophy size={12} /> Completed</span>
                  ) : e.joined ? (
                    <span className="text-[10px] font-black flex items-center gap-1" style={{ color: "var(--acid)" }}><Check size={12} /> Joined</span>
                  ) : (
                    <button onClick={() => join(e.id)} className="glass-btn text-xs" style={{ padding: "8px 18px", minHeight: 0 }}>Join</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ title: "", description: "", emoji: "✨", days: 7, multiplier: 2, target: 5, reward_badge: "" })
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!f.title.trim()) { toast.error("Title required"); return }
    setSaving(true)
    const now = new Date()
    const ends = new Date(now.getTime() + f.days * 86400000)
    const { error } = await supabase.from("events").insert({
      title: f.title.trim(), description: f.description.trim() || null, emoji: f.emoji || "✨",
      starts_at: now.toISOString(), ends_at: ends.toISOString(),
      bonus_xp_multiplier: f.multiplier, target: f.target || null, reward_badge: f.reward_badge.trim() || null,
      is_active: true,
    })
    setSaving(false)
    if (error) { toast.error("Create failed: " + error.message); return }
    toast.success("Event created")
    onCreated()
  }

  const input = "glass-input text-sm"
  return (
    <div className="glass-card space-y-2.5">
      <p className="section-label">New event</p>
      <input className={input} placeholder="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <input className={input} placeholder="Description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      <div className="grid grid-cols-3 gap-2">
        <input className={input} placeholder="Emoji" value={f.emoji} onChange={e => setF({ ...f, emoji: e.target.value })} />
        <input className={input} type="number" placeholder="Days" value={f.days} onChange={e => setF({ ...f, days: +e.target.value })} />
        <input className={input} type="number" step="0.5" placeholder="×XP" value={f.multiplier} onChange={e => setF({ ...f, multiplier: +e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={input} type="number" placeholder="Target" value={f.target} onChange={e => setF({ ...f, target: +e.target.value })} />
        <input className={input} placeholder="Reward badge" value={f.reward_badge} onChange={e => setF({ ...f, reward_badge: e.target.value })} />
      </div>
      <button onClick={create} disabled={saving} className="glass-btn w-full text-sm">{saving ? "Creating…" : "Create event"}</button>
    </div>
  )
}
