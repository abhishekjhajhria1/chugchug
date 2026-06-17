import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { UserPlus } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"

const CAT_EMOJI: Record<string, string> = {
  drink: "🍻", snack: "🍟", cigarette: "🚬", gym: "💪", detox: "🧘", water: "💧",
}

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return "now"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

interface LiveItem {
  id: string
  user_id: string
  item_name: string
  category: string
  created_at: string
  username: string
}

export default function LiveActivityFeed() {
  const { user } = useChug()
  const navigate = useNavigate()
  const [items, setItems] = useState<LiveItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      try {
        const { data: friends } = await supabase.rpc("get_friends", { user_uuid: user.id })
        const ids = (friends ?? []).map((f: any) => f.friend_id)
        if (ids.length === 0) { if (!cancelled) { setItems([]); setLoaded(true) } return }

        const since = new Date(Date.now() - 6 * 3600_000).toISOString()
        const { data } = await supabase
          .from("activity_logs")
          .select("id, user_id, item_name, category, created_at, profiles(username)")
          .in("user_id", ids)
          .neq("privacy_level", "private")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10)

        if (cancelled) return
        const mapped = (data ?? []).map((r: any) => ({
          id: r.id, user_id: r.user_id, item_name: r.item_name, category: r.category,
          created_at: r.created_at,
          username: Array.isArray(r.profiles) ? r.profiles[0]?.username : r.profiles?.username,
        }))
        setItems(mapped)
        setLoaded(true)
      } catch {
        if (!cancelled) setLoaded(true)
      }
    }
    load()
    const t = setInterval(load, 45000) // keep it feeling alive
    return () => { cancelled = true; clearInterval(t) }
  }, [user])

  if (!loaded) return null

  return (
    <section className="anim-stagger-2">
      <div className="flex items-center justify-between mb-2">
        <p className="section-label flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "var(--coral)" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--coral)" }} />
          </span>
          Happening Now
        </p>
        <button onClick={() => navigate("/world")} className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--amber)" }}>
          See all
        </button>
      </div>

      {items.length === 0 ? (
        <button
          onClick={() => navigate("/groups")}
          className="w-full flex items-center gap-3 p-3.5 active:scale-[0.98] transition-transform"
          style={{ background: "var(--card-bg)", border: "1px dashed var(--border-mid)", borderRadius: "var(--card-radius)" }}
        >
          <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: "var(--amber-dim)", borderRadius: "var(--card-radius)" }}>
            <UserPlus size={16} style={{ color: "var(--amber)" }} />
          </div>
          <div className="text-left">
            <p className="text-xs font-black" style={{ color: "var(--text-primary)" }}>It's quiet… add your crew</p>
            <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>See friends' drinks live the moment they log</p>
          </div>
        </button>
      ) : (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
          {items.map(it => (
            <button
              key={it.id}
              onClick={() => navigate(`/profile/${it.user_id}`)}
              className="shrink-0 flex flex-col items-center gap-1.5 p-2.5 active:scale-95 transition-transform"
              style={{ width: 84, background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--card-radius)" }}
            >
              <div className="w-10 h-10 flex items-center justify-center text-lg shrink-0" style={{ background: "var(--glass-fill-inset)", borderRadius: "999px", border: "1px solid var(--border-mid)" }}>
                {CAT_EMOJI[it.category] || "📝"}
              </div>
              <span className="text-[10px] font-black truncate w-full text-center" style={{ color: "var(--text-primary)" }}>{it.username || "?"}</span>
              <span className="text-[8px] font-bold truncate w-full text-center" style={{ color: "var(--text-ghost)" }}>{it.item_name}</span>
              <span className="text-[8px] font-black" style={{ color: "var(--coral)" }}>{ago(it.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
