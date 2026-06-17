import { useEffect, useState, useMemo } from "react"
import { useChug } from "../context/ChugContext"
import { BADGE_DEFINITIONS, getChallengeProgress, RANK_LADDER, getRankInfo, getDailyBounties, checkDailyBountyCompletion, getWeeklyChallenges, getMonthlyChallenges } from "../lib/progression"
import type { ChallengeProgress, BountyDef, WeeklyChallenge, MonthlyChallenge } from "../lib/progression"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Lock, Clock, Calendar, Target, Flame } from "lucide-react"

type TimeTab = 'daily' | 'weekly' | 'monthly' | 'badges'
type CatFilter = 'all' | 'drinking' | 'wellness' | 'social' | 'milestones'

const TIME_TABS = [
  { id: 'daily' as const,   label: 'Daily',   emoji: '⚡', color: 'var(--amber)', bg: 'var(--amber-dim)' },
  { id: 'weekly' as const,  label: 'Weekly',  emoji: '📅', color: 'var(--acid)',  bg: 'var(--acid-dim)' },
  { id: 'monthly' as const, label: 'Monthly', emoji: '🏆', color: 'var(--coral)', bg: 'var(--coral-dim)' },
  { id: 'badges' as const,  label: 'Badges',  emoji: '🎖️', color: 'var(--blue)',  bg: 'var(--indigo-dim)' },
]

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
  const [timeTab, setTimeTab] = useState<TimeTab>('daily')
  const [progress, setProgress] = useState<Record<string, ChallengeProgress>>({})
  const [earned, setEarned] = useState<string[]>([])
  const [bountyProgress, setBountyProgress] = useState<Record<string, { completed: boolean; current: number; target: number }>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CatFilter>('all')

  const dailyBounties = useMemo(() => getDailyBounties(), [])
  const weeklyChallenges = useMemo(() => getWeeklyChallenges(), [])
  const monthlyChallenges = useMemo(() => getMonthlyChallenges(), [])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      const [challengeData, bountyData] = await Promise.all([
        getChallengeProgress(user.id),
        checkDailyBountyCompletion(user.id),
      ])
      setProgress(challengeData.progress)
      setEarned(challengeData.earned)
      setBountyProgress(bountyData)
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
        if (aDone !== bDone) return aDone ? 1 : -1
        const aP = progress[a[0]]
        const bP = progress[b[0]]
        const aRatio = aP ? aP.current / aP.target : 0
        const bRatio = bP ? bP.current / bP.target : 0
        return bRatio - aRatio
      })
  }, [filter, progress, earned])

  const stats = useMemo(() => {
    const total = Object.keys(BADGE_DEFINITIONS).length
    const completed = Object.entries(progress).filter(([, p]) => p.done).length
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [progress])

  const dailyCompleted = Object.values(bountyProgress).filter(b => b.completed).length

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
          <h1 className="page-title">⚔️ Challenges</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Daily bounties · Weekly missions · Monthly epics
          </p>
        </div>
      </div>

      {/* Time tabs */}
      <div className="flex gap-1.5">
        {TIME_TABS.map(({ id, label, emoji, color, bg }) => (
          <button
            key={id}
            onClick={() => setTimeTab(id)}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95"
            style={{
              background: timeTab === id ? bg : 'var(--bg-surface)',
              border: timeTab === id ? `2px solid ${color}` : '1px solid var(--border)',
              color: timeTab === id ? color : 'var(--text-muted)',
              borderRadius: 'var(--card-radius)',
            }}
          >
            <span>{emoji}</span> {label}
          </button>
        ))}
      </div>

      {/* ── DAILY BOUNTIES ── */}
      {timeTab === 'daily' && (
        <div className="space-y-3">
          {/* Daily summary */}
          <div className="p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, var(--amber-dim), color-mix(in srgb, var(--amber) 3%, transparent))', border: '1px solid var(--border)', borderLeft: '4px solid var(--amber)', borderRadius: 'var(--card-radius)' }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Today's Bounties</p>
              <p className="text-2xl font-black mt-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>
                {dailyCompleted}<span className="text-sm" style={{ color: 'var(--text-ghost)' }}> / {dailyBounties.length}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--card-radius)' }}>
              <Clock size={12} style={{ color: 'var(--text-ghost)' }} />
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-ghost)' }}>Resets at midnight</span>
            </div>
          </div>

          {dailyBounties.map(bounty => {
            const bp = bountyProgress[bounty.id]
            const pct = bp ? Math.round((bp.current / bp.target) * 100) : 0
            return (
              <BountyCard
                key={bounty.id}
                emoji={bounty.emoji}
                title={bounty.title}
                description={bounty.description}
                xpReward={bounty.xpReward}
                current={bp?.current || 0}
                target={bp?.target || bounty.target}
                completed={bp?.completed || false}
                pct={pct}
                color="var(--amber)"
                bg="var(--amber-dim)"
              />
            )
          })}
        </div>
      )}

      {/* ── WEEKLY CHALLENGES ── */}
      {timeTab === 'weekly' && (
        <div className="space-y-3">
          <div className="p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, var(--acid-dim), color-mix(in srgb, var(--acid) 3%, transparent))', border: '1px solid var(--border)', borderLeft: '4px solid var(--acid)', borderRadius: 'var(--card-radius)' }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>This Week's Missions</p>
              <p className="text-sm font-bold mt-1" style={{ color: 'var(--acid)' }}>
                Harder challenges, bigger rewards
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--card-radius)' }}>
              <Calendar size={12} style={{ color: 'var(--text-ghost)' }} />
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-ghost)' }}>Resets Monday</span>
            </div>
          </div>

          {weeklyChallenges.map(challenge => (
            <BountyCard
              key={challenge.id}
              emoji={challenge.emoji}
              title={challenge.title}
              description={challenge.description}
              xpReward={challenge.xpReward}
              current={0} // TODO: wire to challenge_progress table
              target={challenge.target}
              completed={false}
              pct={0}
              color="var(--acid)"
              bg="var(--acid-dim)"
              category={challenge.category}
            />
          ))}
        </div>
      )}

      {/* ── MONTHLY CHALLENGES ── */}
      {timeTab === 'monthly' && (
        <div className="space-y-3">
          <div className="p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, var(--coral-dim), color-mix(in srgb, var(--coral) 3%, transparent))', border: '1px solid var(--border)', borderLeft: '4px solid var(--coral)', borderRadius: 'var(--card-radius)' }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Monthly Epics</p>
              <p className="text-sm font-bold mt-1" style={{ color: 'var(--coral)' }}>
                Epic scale, legendary XP
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--card-radius)' }}>
              <Flame size={12} style={{ color: 'var(--text-ghost)' }} />
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-ghost)' }}>Resets 1st</span>
            </div>
          </div>

          {monthlyChallenges.map(challenge => (
            <BountyCard
              key={challenge.id}
              emoji={challenge.emoji}
              title={challenge.title}
              description={challenge.description}
              xpReward={challenge.xpReward}
              current={0} // TODO: wire to challenge_progress table
              target={challenge.target}
              completed={false}
              pct={0}
              color="var(--coral)"
              bg="var(--coral-dim)"
              category={challenge.category}
            />
          ))}
        </div>
      )}

      {/* ── BADGES (existing system) ── */}
      {timeTab === 'badges' && (
        <div className="space-y-4">
          {/* Progress overview card */}
          <div
            className="p-5 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--amber-dim), color-mix(in srgb, var(--acid) 6%, transparent))',
              border: '1px solid var(--border)',
              borderLeft: '5px solid var(--amber)',
              borderRadius: 'var(--card-radius)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Badge Progress</p>
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
            <div className="h-2 overflow-hidden" style={{ background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', borderRadius: '1px' }}>
              <div
                className="h-full transition-all duration-700"
                style={{ width: `${stats.percentage}%`, background: 'linear-gradient(90deg, var(--amber), var(--acid))' }}
              />
            </div>
          </div>

          {/* Rank Journey Ladder */}
          <div className="rounded-lg p-5 text-left bg-glass overflow-hidden" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
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
                        <div className="h-1 mt-1.5 overflow-hidden" style={{ background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)', borderRadius: '1px' }}>
                          <div className="h-full transition-all duration-500" style={{ width: `${ri.progressPercent}%`, background: rank.color }} />
                        </div>
                      )}
                    </div>
                    {isCurrentRank && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 ml-2" style={{ background: `${rank.color}20`, color: rank.color, borderRadius: '10px' }}>YOU</span>
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

          {/* Earned badges showcase */}
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
                      style={{ background: 'var(--card-bg)', border: '1px solid var(--border-mid)', borderRadius: 'var(--card-radius)' }}
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

          {/* Badge challenge cards */}
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold truncate" style={{ color: isEarned ? catMeta.color : 'var(--text-primary)' }}>
                          {def.name}
                        </span>
                        {isEarned && <CheckCircle2 size={14} style={{ color: catMeta.color }} />}
                      </div>
                      <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>{def.description}</p>
                      {prog && !isEarned && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold" style={{ color: catMeta.color }}>{prog.current} / {prog.target}</span>
                            <span className="text-[10px] font-bold" style={{ color: 'var(--text-ghost)' }}>{pct}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden" style={{ background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)', borderRadius: '1px' }}>
                            <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: catMeta.color }} />
                          </div>
                        </div>
                      )}
                      {isEarned && (
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: catMeta.color }}>Completed ✓</span>
                      )}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 shrink-0" style={{ background: catMeta.bg, color: catMeta.color, border: `1px solid ${catMeta.color}30`, borderRadius: '10px' }}>
                      {catMeta.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <button onClick={() => navigate('/log')} className="glass-btn w-full">
        Log Activity to Progress 📝
      </button>
    </div>
  )
}

// ─── Reusable Bounty/Challenge Card ──────────────────────────
function BountyCard({ emoji, title, description, xpReward, current, target, completed, pct, color, bg, category }: {
  emoji: string; title: string; description: string; xpReward: number
  current: number; target: number; completed: boolean; pct: number
  color: string; bg: string; category?: string
}) {
  return (
    <div
      className="p-4 transition-all"
      style={{
        background: completed ? bg : 'var(--card-bg)',
        border: `1px solid ${completed ? color + '40' : 'var(--border)'}`,
        borderRadius: 'var(--card-radius)',
        opacity: completed ? 0.7 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 shrink-0 flex items-center justify-center text-xl"
          style={{
            background: completed ? bg : 'var(--bg-raised)',
            border: `1px solid ${completed ? color + '30' : 'var(--border-mid)'}`,
            borderRadius: 'var(--card-radius)',
          }}
        >
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold truncate" style={{ color: completed ? color : 'var(--text-primary)' }}>
              {title}
            </span>
            {completed && <CheckCircle2 size={14} style={{ color }} />}
          </div>
          <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>{description}</p>
          {!completed && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold" style={{ color }}>{current} / {target}</span>
                <span className="text-[10px] font-bold" style={{ color: 'var(--text-ghost)' }}>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden" style={{ background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)', borderRadius: '1px' }}>
                <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          )}
          {completed && (
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>Completed ✓</span>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-[9px] font-black px-1.5 py-0.5" style={{ background: bg, color, border: `1px solid ${color}30`, borderRadius: '10px' }}>
            +{xpReward} XP
          </span>
          {category && (
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>{category}</span>
          )}
        </div>
      </div>
    </div>
  )
}
