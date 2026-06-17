import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Swords, UserPlus, ChevronRight } from "lucide-react"
import { useChug } from "../context/ChugContext"
import { getFriendsLeague, type FriendsLeague } from "../lib/engagement"

export default function FriendsLeagueCard() {
  const { user } = useChug()
  const navigate = useNavigate()
  const [lg, setLg] = useState<FriendsLeague | null>(null)

  useEffect(() => {
    if (!user) return
    getFriendsLeague(user.id).then(setLg)
  }, [user])

  if (!lg) return null

  // No friends yet → invite (this is the core loop, so make the ask strong)
  if (lg.friendsCount === 0) {
    return (
      <button
        onClick={() => navigate("/groups")}
        className="w-full flex items-center gap-3 p-4 active:scale-[0.98] transition-transform anim-stagger-2"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderLeft: "4px solid var(--amber)", borderRadius: "var(--card-radius)" }}
      >
        <div className="w-11 h-11 flex items-center justify-center shrink-0" style={{ background: "var(--amber-dim)", borderRadius: "var(--card-radius)" }}>
          <Swords size={20} style={{ color: "var(--amber)" }} />
        </div>
        <div className="text-left flex-1">
          <p className="text-sm font-black" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>Start the rivalry</p>
          <p className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>Add friends to climb the weekly leaderboard together</p>
        </div>
        <UserPlus size={16} style={{ color: "var(--amber)" }} />
      </button>
    )
  }

  const rivalLine = lg.rank === 1
    ? "👑 You're #1 among friends — defend it"
    : `🎯 ${lg.aheadGap} XP behind ${lg.aheadName} — pass them!`

  return (
    <section
      onClick={() => navigate("/rank")}
      className="anim-stagger-2 cursor-pointer active:scale-[0.99] transition-transform overflow-hidden"
      style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderLeft: "4px solid var(--amber)", borderRadius: "var(--card-radius)", backdropFilter: "blur(var(--card-blur))", WebkitBackdropFilter: "blur(var(--card-blur))", padding: 16 }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="section-label flex items-center gap-1.5"><Swords size={12} /> Friends League · this week</p>
        <ChevronRight size={16} style={{ color: "var(--text-ghost)" }} />
      </div>

      {/* Rivalry headline */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-black" style={{ fontFamily: "Syne, sans-serif", color: lg.rank === 1 ? "var(--amber)" : "var(--text-primary)" }}>
          #{lg.rank}<span className="text-xs font-bold" style={{ color: "var(--text-ghost)" }}> / {lg.total}</span>
        </span>
        <span className="text-[11px] font-bold text-right" style={{ color: lg.rank === 1 ? "var(--amber)" : "var(--coral)" }}>{rivalLine}</span>
      </div>

      {/* Top of the board */}
      <div className="space-y-1.5">
        {lg.players.slice(0, 5).map((p, i) => (
          <div key={p.user_id} className="flex items-center gap-2 px-2.5 py-1.5"
            style={{ background: p.isMe ? "var(--amber-dim)" : "transparent", borderRadius: "calc(var(--card-radius) * 0.6)" }}>
            <span className="text-xs font-black w-5 text-center" style={{ color: i < 3 ? "var(--amber)" : "var(--text-ghost)" }}>{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
            <span className="text-sm font-bold truncate flex-1" style={{ color: p.isMe ? "var(--amber)" : "var(--text-primary)" }}>{p.username}</span>
            <span className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>{p.weekly_xp} XP</span>
          </div>
        ))}
      </div>
    </section>
  )
}
