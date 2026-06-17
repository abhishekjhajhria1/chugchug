import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Sparkles, Clock } from "lucide-react"
import { getActiveEvent, countdown, type LiveEvent } from "../lib/engagement"

export default function EventBanner() {
  const navigate = useNavigate()
  const [event, setEvent] = useState<LiveEvent | null>(null)
  const [, force] = useState(0)

  useEffect(() => {
    getActiveEvent().then(setEvent)
  }, [])

  // tick the countdown every minute
  useEffect(() => {
    if (!event) return
    const t = setInterval(() => force(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [event])

  if (!event) return null

  const mult = event.bonus_xp_multiplier ?? 1
  const left = countdown(event.ends_at)

  return (
    <div
      onClick={() => navigate("/events")}
      className="relative overflow-hidden anim-stagger-1 p-4 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
      style={{
        background: "linear-gradient(120deg, var(--amber-dim), color-mix(in srgb, var(--coral) 8%, transparent))",
        border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
        borderRadius: "var(--card-radius)",
      }}
    >
      <div className="absolute -right-3 -top-3 opacity-10 pointer-events-none">
        <Sparkles size={84} style={{ color: "var(--amber)" }} />
      </div>
      <div className="w-12 h-12 flex items-center justify-center text-2xl shrink-0 anim-float"
        style={{ background: "var(--amber-dim)", border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)", borderRadius: "var(--card-radius)" }}>
        {event.emoji || "✨"}
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5" style={{ background: "var(--coral)", color: "#fff", borderRadius: "var(--pill-radius)" }}>
            Live Event
          </span>
          {mult > 1 && (
            <span className="text-[9px] font-black" style={{ color: "var(--amber)" }}>{mult}× XP</span>
          )}
        </div>
        <p className="text-sm font-black truncate mt-0.5" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>{event.title}</p>
        {event.description && (
          <p className="text-[10px] font-bold truncate" style={{ color: "var(--text-muted)" }}>{event.description}</p>
        )}
      </div>
      <div className="flex flex-col items-center shrink-0 relative z-10">
        <Clock size={12} style={{ color: "var(--coral)" }} />
        <span className="text-[11px] font-black tabular-nums" style={{ color: "var(--coral)" }}>{left}</span>
        <span className="text-[7px] font-bold uppercase" style={{ color: "var(--text-ghost)" }}>left</span>
      </div>
    </div>
  )
}
