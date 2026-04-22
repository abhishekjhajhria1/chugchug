import { useEffect, useState, useMemo } from "react"
import { useChug } from "../context/ChugContext"
import { BADGE_DEFINITIONS, getChallengeProgress, RANK_LADDER, getRankInfo } from "../lib/progression"
import type { ChallengeProgress } from "../lib/progression"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react"

type CatFilter = 'all' | 'drinking' | 'wellness' | 'social' | 'milestones'

const CAT_META: Record<CatFilter, { label: string; emoji: string; color: string; bg: string }> = {
  all:        { label: 'All',        emoji: '🎯', color: 'var(--amber)',  bg: 'var(--amber-dim)' },
  drinking:   { label: 'Drinking',   emoji: '🍻', color: 'var(--amber)',  bg: 'var(--amber-dim)' },
  wellness:   { label: 'Wellness',   emoji: '🌿', color: 'var(--acid)',   bg: 'var(--acid-dim)'  },
  social:     { label: 'Social',     emoji: '👥', color: 'var(--coral)',  bg: 'var(--coral-dim)' },
  milestones: { label: 'Milestones', emoji: '🏅', color: 'var(--blue)',   bg: 'var(--indigo-dim)' },
}

export default function Challenges() {
  const { user, profile } = useChug()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<Record<string, ChallengeProgress>>({})
  const [earned, setEarned] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CatFilter>('all')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      const data = await getChallengeProgress(user.id)
      setProgress(data.progress)
      setEarned(data.earned)
      setLoading(false)
    }
    load()
  }, [user])

  const badgeEntries = useMemo(() => {
    return Object.entries(BADGE_DEFINITIONS)
      .filter(([, def]) => filter === 'all' || def.category === filter)
      .sort((a, b) => {
        const aDone = earned.includes(a[1].name)
        const bDone = earned.includes(b[1].name)
        if (aDone !== bDone) return aDone ? 1 : -1 // uncompleted first
        const aP = progress[a[0]]
        const bP = progress[b[0]]
        const aRatio = aP ? aP.current / aP.target : 0
        const bRatio = bP ? bP.current / bP.target : 0
        return bRatio - aRatio // closest to completion first
      })
  }, [filter, progress, earned])

  const stats = useMemo(() => {
    const total = Object.keys(BADGE_DEFINITIONS).length
    const completed = Object.entries(progress).filter(([, p]) => p.done).length
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [progress])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="text-5xl">🎯</div>
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Loading challenges...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 active:scale-90 transition-transform" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title">Challenges</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Complete challenges. Earn badges. Prove yourself.
          </p>
        </div>
      </div>

      {/* Progress overview card */}
      <div
        className="p-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--amber-dim), rgba(124,154,116,0.06))',
          border: '1px solid var(--border)',
          borderLeft: '5px solid var(--amber)',
          borderRadius: 'var(--card-radius)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Your Progress</p>
            <p className="text-3xl font-black mt-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
              {stats.completed}<span className="text-base font-bold" style={{ color: 'var(--text-ghost)' }}> / {stats.total}</span>
            </p>
          </div>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center relative"
            style={{ border: '3px solid var(--amber)', background: 'var(--amber-dim)' }}
          >
            <span className="text-lg font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>
              {stats.percentage}%
            </span>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="h-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '1px' }}>
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${stats.percentage}%`,
              background: 'linear-gradient(90deg, var(--amber), var(--acid))',
            }}
          />
        </div>
      </div>

      {/* Rank Journey Ladder */}
      <div className="rounded-sm p-5 text-left bg-glass overflow-hidden" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>🗡️ Rank Journey</p>
        <div className="space-y-2.5">
          {RANK_LADDER.map((rank) => {
            const userLevel = profile?.level ?? 1;
            const isCurrentRank = userLevel >= rank.minLevel && userLevel <= rank.maxLevel;
            const isUnlocked = userLevel >= rank.minLevel;
            const ri = getRankInfo(userLevel, profile?.xp ?? 0);
            return (
              <div
                key={rank.title}
                className="flex items-center gap-3 p-2.5 transition-all"
                style={{
                  background: isCurrentRank ? `${rank.color}15` : 'transparent',
                  border: isCurrentRank ? `1px solid ${rank.color}40` : '1px solid transparent',
                  borderRadius: 'var(--card-radius)',
                  opacity: isUnlocked ? 1 : 0.4,
                }}
              >
                <span className="text-xl w-8 text-center">{rank.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: isCurrentRank ? rank.color : isUnlocked ? 'var(--text-primary)' : 'var(--text-ghost)' }}>
                      {rank.title}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-ghost)' }}>
                      Lv. {rank.minLevel}{rank.maxLevel < 999 ? `-${rank.maxLevel}` : '+'}
                    </span>
                  </div>
                  {isCurrentRank && ri.next && (
                    <div className="h-1 mt-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}>
                      <div className="h-full transition-all duration-500" style={{ width: `${ri.progressPercent}%`, background: rank.color }} />
                    </div>
                  )}
                </div>
                {isCurrentRank && (
                  <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 ml-2" style={{ background: `${rank.color}20`, color: rank.color, borderRadius: '2px' }}>YOU</span>
                )}
                {!isUnlocked && (
                  <Lock size={14} className="ml-2" style={{ color: 'var(--text-ghost)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {(Object.keys(CAT_META) as CatFilter[]).map(cat => {
          const meta = CAT_META[cat]
          const isActive = filter === cat
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
              style={{
                background: isActive ? meta.bg : 'var(--bg-surface)',
                border: isActive ? `2px solid ${meta.color}` : '1px solid var(--border)',
                color: isActive ? meta.color : 'var(--text-muted)',
                borderRadius: 'var(--card-radius)',
              }}
            >
              <span>{meta.emoji}</span>
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Earned badges showcase (compact strip) */}
      {earned.length > 0 && (
        <div>
          <p className="section-label mb-2 border-l-2 pl-2" style={{ borderColor: 'var(--acid)' }}>
            Earned Badges ({earned.length})
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
            {Object.entries(BADGE_DEFINITIONS)
              .filter(([, def]) => earned.includes(def.name))
              .map(([key, def]) => (
                <div
                  key={key}
                  className="shrink-0 flex flex-col items-center gap-1 p-2.5 min-w-[68px]"
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-mid)',
                    borderRadius: 'var(--card-radius)',
                  }}
                  title={def.description}
                >
                  <span className="text-2xl">{def.icon_text}</span>
                  <span className="text-[7px] font-black uppercase tracking-wider text-center leading-tight" style={{ color: 'var(--text-secondary)' }}>
                    {def.name}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Challenge cards */}
      <div className="space-y-2.5">
        {badgeEntries.map(([key, def]) => {
          const prog = progress[key]
          const isEarned = earned.includes(def.name)
          const catMeta = CAT_META[def.category]
          const pct = prog ? Math.round((prog.current / prog.target) * 100) : 0

          return (
            <div
              key={key}
              className="p-4 transition-all"
              style={{
                background: isEarned ? `${catMeta.bg}` : 'var(--card-bg)',
                border: `1px solid ${isEarned ? catMeta.color + '40' : 'var(--border)'}`,
                borderRadius: 'var(--card-radius)',
                opacity: isEarned ? 0.7 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className="w-11 h-11 shrink-0 flex items-center justify-center text-xl"
                  style={{
                    background: isEarned ? catMeta.bg : 'var(--bg-raised)',
                    border: `1px solid ${isEarned ? catMeta.color + '30' : 'var(--border-mid)'}`,
                    borderRadius: 'var(--card-radius)',
                  }}
                >
                  {isEarned ? def.icon_text : <span style={{ opacity: 0.8 }}>{def.icon_text}</span>}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-sm font-bold truncate"
                      style={{ color: isEarned ? catMeta.color : 'var(--text-primary)' }}
                    >
                      {def.name}
                    </span>
                    {isEarned && (
                      <CheckCircle2 size={14} style={{ color: catMeta.color }} />
                    )}
                  </div>
                  <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
                    {def.description}
                  </p>

                  {/* Progress */}
                  {prog && !isEarned && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold" style={{ color: catMeta.color }}>
                          {prog.current} / {prog.target}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-ghost)' }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}>
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: catMeta.color,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {isEarned && (
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: catMeta.color }}>
                      Completed ✓
                    </span>
                  )}
                </div>

                {/* Category dot */}
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 shrink-0" style={{ background: catMeta.bg, color: catMeta.color, border: `1px solid ${catMeta.color}30`, borderRadius: '2px' }}>
                  {catMeta.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom CTA */}
      <button
        onClick={() => navigate('/log')}
        className="glass-btn w-full"
      >
        Log Activity to Progress 📝
      </button>
    </div>
  )
}
