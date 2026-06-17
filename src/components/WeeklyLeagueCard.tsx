import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Trophy, ChevronRight, TrendingUp } from "lucide-react"
import { useChug } from "../context/ChugContext"
import { getWeeklyLeague, type LeagueState } from "../lib/engagement"

export default function WeeklyLeagueCard() {
  const { user } = useChug()
  const navigate = useNavigate()
  const [lg, setLg] = useState<LeagueState | null>(null)

  useEffect(() => {
    if (!user) return
    getWeeklyLeague(user.id).then(setLg)
  }, [user])

  if (!lg) return null

  const pct = lg.nextTier
    ? Math.min(100, Math.round(((lg.weeklyXp - lg.tier.min) / (lg.nextTier.min - lg.tier.min)) * 100))
    : 100

  return (
    <section
      onClick={() => navigate("/rank")}
      className="anim-stagger-3 cursor-pointer active:scale-[0.99] transition-transform overflow-hidden"
      style={{
        background: "var(--card-bg)", border: "1px solid var(--border)",
        borderRadius: "var(--card-radius)", backdropFilter: "blur(var(--card-blur))",
        WebkitBackdropFilter: "blur(var(--card-blur))", padding: 16,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="section-label flex items-center gap-1.5"><Trophy size={12} /> Weekly League</p>
        <ChevronRight size={16} style={{ color: "var(--text-ghost)" }} />
      </div>

      <div className="flex items-center gap-3">
        <div className="w-14 h-14 flex items-center justify-center text-3xl shrink-0"
          style={{ background: `color-mix(in srgb, ${lg.tier.color} 15%, transparent)`, border: `1.5px solid ${lg.tier.color}`, borderRadius: "var(--card-radius)" }}>
          {lg.tier.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-base font-black" style={{ fontFamily: "Syne, sans-serif", color: lg.tier.color }}>{lg.tier.name} League</span>
            {lg.rank && (
              <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>
                #{lg.rank}<span className="font-bold" style={{ color: "var(--text-ghost)" }}>/{lg.totalPlayers}</span>
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>{lg.weeklyXp} XP this week</p>
          {/* promotion progress */}
          <div className="h-1.5 overflow-hidden" style={{ background: "var(--glass-fill-inset)", borderRadius: "999px" }}>
            <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: lg.nextTier?.color ?? lg.tier.color }} />
          </div>
          {lg.nextTier ? (
            <p className="text-[9px] font-bold mt-1 flex items-center gap-1" style={{ color: "var(--acid)" }}>
              <TrendingUp size={10} /> {lg.xpToPromote} XP to {lg.nextTier.emoji} {lg.nextTier.name}
            </p>
          ) : (
            <p className="text-[9px] font-black mt-1" style={{ color: lg.tier.color }}>👑 Top tier — defend your throne</p>
          )}
        </div>
      </div>

      {lg.top.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          {lg.top.map((p, i) => (
            <div key={p.user_id} className="flex items-center gap-1 text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>
              <span>{["🥇", "🥈", "🥉"][i]}</span>
              <span className="truncate max-w-[64px]">{p.username}</span>
              <span style={{ color: "var(--text-ghost)" }}>{p.weekly_xp}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
