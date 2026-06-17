import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Swords, ChevronRight } from "lucide-react"
import { useChug } from "../context/ChugContext"
import { getCrewBattle, type CrewBattle } from "../lib/engagement"

export default function CrewBattleCard() {
  const { user } = useChug()
  const navigate = useNavigate()
  const [b, setB] = useState<CrewBattle | null>(null)

  useEffect(() => {
    if (!user) return
    getCrewBattle(user.id).then(setB)
  }, [user])

  // Only show once the user actually has a crew in the running.
  if (!b || !b.myCrew) return null

  const me = b.myCrew
  const gap = b.rival ? b.rival.xp - me.xp : 0

  return (
    <section
      onClick={() => navigate("/groups")}
      className="anim-stagger-3 cursor-pointer active:scale-[0.99] transition-transform overflow-hidden"
      style={{
        background: "var(--card-bg)", border: "1px solid var(--border)",
        borderRadius: "var(--card-radius)", backdropFilter: "blur(var(--card-blur))",
        WebkitBackdropFilter: "blur(var(--card-blur))", padding: 16,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="section-label flex items-center gap-1.5"><Swords size={12} /> Crew Battle · this week</p>
        <ChevronRight size={16} style={{ color: "var(--text-ghost)" }} />
      </div>

      {/* My crew standing */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 flex items-center justify-center font-black text-sm shrink-0"
          style={{ background: "var(--amber-dim)", border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)", borderRadius: "var(--card-radius)", color: "var(--amber)", fontFamily: "Syne, sans-serif" }}>
          #{me.rank}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black truncate" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>{me.name}</p>
          <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{me.xp} XP · {me.members} member{me.members > 1 ? "s" : ""} · of {b.totalCrews} crews</p>
        </div>
      </div>

      {/* Rival framing — loss aversion / chase */}
      {b.rival ? (
        <div className="flex items-center gap-2 p-2.5" style={{ background: "var(--glass-fill-inset)", borderRadius: "calc(var(--card-radius) * 0.7)" }}>
          <span className="text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>
            🎯 <span style={{ color: "var(--coral)" }}>{gap} XP</span> behind <strong style={{ color: "var(--text-primary)" }}>{b.rival.name}</strong> — overtake them!
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5" style={{ background: "color-mix(in srgb, var(--amber) 10%, transparent)", borderRadius: "calc(var(--card-radius) * 0.7)" }}>
          <span className="text-[10px] font-black" style={{ color: "var(--amber)" }}>
            👑 Your crew leads the board{b.chasing ? ` — ${b.chasing.name} is ${me.xp - b.chasing.xp} XP behind` : ""}
          </span>
        </div>
      )}
    </section>
  )
}
