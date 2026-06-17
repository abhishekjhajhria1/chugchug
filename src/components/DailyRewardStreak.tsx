import { useEffect, useState } from "react"
import { Flame, Gift, Snowflake, AlertTriangle, Check, Share2 } from "lucide-react"
import { useChug } from "../context/ChugContext"
import { useToast } from "./Toast"
import {
  getRewardState, claimDailyReward, DAILY_REWARDS,
  type RewardState, type DailyReward,
} from "../lib/engagement"

export default function DailyRewardStreak() {
  const { user, refreshProfile } = useChug()
  const toast = useToast()
  const [state, setState] = useState<RewardState | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [popReward, setPopReward] = useState<DailyReward | null>(null)

  const load = async () => {
    if (!user) return
    setState(await getRewardState(user.id))
  }
  useEffect(() => { load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClaim = async () => {
    if (!user || claiming) return
    setClaiming(true)
    const res = await claimDailyReward(user.id)
    setClaiming(false)
    if (res.ok && res.reward) {
      setPopReward(res.reward)
      setTimeout(() => setPopReward(null), 1800)
      toast.success(`Day ${res.newStreak} claimed · +${res.reward.xp} XP${res.usedFreeze ? " · ❄️ freeze saved your streak!" : ""}`)
      refreshProfile().catch(() => {})
      load()
    } else if (res.alreadyClaimed) {
      toast.error("Already claimed today — come back tomorrow!")
      load()
    } else {
      toast.error("Couldn't claim reward")
    }
  }

  const shareStreak = async () => {
    const text = `I'm on a ${state?.loginStreak}-day streak on ChugChug 🔥 think you can keep up?`
    const url = window.location.origin
    try {
      if (navigator.share) await navigator.share({ title: "ChugChug", text, url })
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast.success("Copied — go flex 💪") }
    } catch { /* user dismissed */ }
  }

  if (!state) return null

  const streak = state.loginStreak
  const accent = state.lapsed ? "var(--coral)" : "var(--amber)"

  return (
    <section
      className="relative overflow-hidden anim-stagger-1"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${accent}`,
        borderRadius: "var(--card-radius)",
        backdropFilter: "blur(var(--card-blur))",
        WebkitBackdropFilter: "blur(var(--card-blur))",
        padding: 16,
      }}
    >
      {/* claim burst */}
      {popReward && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ background: "color-mix(in srgb, var(--bg-deep) 70%, transparent)" }}>
          <div className="text-center anim-burst">
            <div className="text-6xl mb-1">{popReward.emoji}</div>
            <div className="text-lg font-black" style={{ fontFamily: "Syne, sans-serif", color: "var(--amber)" }}>+{popReward.xp} XP</div>
          </div>
        </div>
      )}

      {/* header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Flame size={34} style={{ color: accent, filter: `drop-shadow(0 0 8px ${accent})` }} />
          </div>
          <div>
            <p className="leading-none">
              <span className="text-2xl font-black" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>{streak}</span>
              <span className="text-xs font-bold ml-1.5" style={{ color: "var(--text-muted)" }}>day streak</span>
            </p>
            <p className="text-[10px] font-bold mt-0.5" style={{ color: "var(--text-ghost)" }}>
              Best: {state.longestLoginStreak} {state.streakFreezes > 0 && <span style={{ color: "var(--blue)" }}>· ❄️ {state.streakFreezes} freeze{state.streakFreezes > 1 ? "s" : ""}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {state.atRisk && (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1" style={{ background: "var(--amber-dim)", color: "var(--amber)", borderRadius: "var(--pill-radius)" }}>
              <AlertTriangle size={10} /> Don't lose it
            </span>
          )}
          {state.lapsed && (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1" style={{ background: "var(--coral-dim)", color: "var(--coral)", borderRadius: "var(--pill-radius)" }}>
              Streak reset
            </span>
          )}
          {streak >= 3 && (
            <button onClick={shareStreak} aria-label="Share streak" className="w-7 h-7 flex items-center justify-center active:scale-90 transition-transform" style={{ background: "var(--glass-fill-inset)", border: "1px solid var(--border-mid)", borderRadius: "999px", color: "var(--text-secondary)" }}>
              <Share2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 7-day reward track */}
      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {DAILY_REWARDS.map(r => {
          const isNext = state.canClaim && r.day === state.nextCycleDay
          const isDone = !state.canClaim ? r.day <= state.nextCycleDay : r.day < state.nextCycleDay
          return (
            <div key={r.day}
              className={`flex flex-col items-center justify-center py-2 ${isNext ? "anim-float" : ""}`}
              style={{
                background: isNext ? "var(--amber-dim)" : isDone ? "var(--glass-fill-inset)" : "var(--bg-raised)",
                border: isNext ? `1.5px solid ${accent}` : "1px solid var(--border)",
                borderRadius: "calc(var(--card-radius) * 0.7)",
                opacity: isDone ? 0.55 : 1,
              }}
            >
              <span className="text-base leading-none">{isDone ? "✓" : r.emoji}</span>
              <span className="text-[7px] font-black mt-1" style={{ color: isNext ? "var(--amber)" : "var(--text-ghost)" }}>
                {r.day === 7 ? "🎁" : `D${r.day}`}
              </span>
            </div>
          )
        })}
      </div>

      {/* CTA */}
      {state.canClaim ? (
        <button onClick={handleClaim} disabled={claiming} className="glass-btn w-full flex items-center justify-center gap-2">
          {claiming ? "Claiming…" : (
            <>
              {state.nextReward.jackpot ? <Gift size={16} /> : <Flame size={16} />}
              Claim Day {state.nextCycleDay} · {state.nextReward.label} XP
              {state.nextReward.freeze && <Snowflake size={14} />}
            </>
          )}
        </button>
      ) : (
        <div className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold" style={{ color: "var(--text-muted)", background: "var(--glass-fill-inset)", borderRadius: "var(--btn-radius)" }}>
          <Check size={14} style={{ color: "var(--acid)" }} /> Claimed today — back tomorrow to keep the streak
        </div>
      )}
    </section>
  )
}
