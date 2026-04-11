import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { useNavigate } from "react-router-dom"
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon,
  Target, TrendingUp, Share2, X, PenLine, ArrowLeft, Zap
} from "lucide-react"

interface DayLog {
  date: string
  drinks: number
  categories: string[]
  items: { name: string; qty: number; category: string; xp: number; mood?: string }[]
  totalXp: number
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]
const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

const DRINK_CALORIES: Record<string, number> = {
  beer: 150, lager: 150, ale: 160, ipa: 200, stout: 210,
  wine: 120, champagne: 110, prosecco: 80,
  vodka: 100, whiskey: 110, rum: 100, tequila: 100, gin: 110,
  cocktail: 180, margarita: 200, mojito: 175, "long island": 250,
  shot: 100, sake: 130, soju: 65,
  default: 130
}

function estimateCalories(itemName: string, qty: number): number {
  const lower = itemName.toLowerCase()
  for (const [key, cal] of Object.entries(DRINK_CALORIES)) {
    if (lower.includes(key)) return cal * qty
  }
  return DRINK_CALORIES.default * qty
}

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getStartDayOfMonth(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Monday = 0
}

const CAT_EMOJI: Record<string, string> = {
  drink: "🍻", snack: "🍟", cigarette: "🚬", gym: "💪", detox: "🧘", water: "💧"
}

export default function Calendar() {
  const { user, profile } = useChug()
  const navigate = useNavigate()

  const [logs, setLogs] = useState<DayLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<DayLog | null>(null)
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [viewYear, setViewYear] = useState(new Date().getFullYear())

  // Weekly goal
  const [weeklyGoal, setWeeklyGoal] = useState(() => {
    const saved = localStorage.getItem("chugchug_weekly_goal")
    return saved ? parseInt(saved) : 7
  })
  const [graceDayEnabled, setGraceDayEnabled] = useState(() =>
    localStorage.getItem("chugchug_grace_day") === "true"
  )

  // Wrapped visibility
  const [showWrapped, setShowWrapped] = useState(false)
  const wrappedRef = useRef<HTMLDivElement>(null)

  // Load weekly goal from Supabase on mount
  useEffect(() => {
    if (!user) return
    const loadGoal = async () => {
      const { data } = await supabase
        .from("user_goals")
        .select("target, grace_days")
        .eq("user_id", user.id)
        .eq("goal_type", "weekly_drink_limit")
        .single()
      if (data) {
        setWeeklyGoal(data.target)
        setGraceDayEnabled(data.grace_days > 0)
      }
    }
    loadGoal().catch(() => {}) // silently fail if table doesn't exist yet
  }, [user])

  // Fetch all logs for the year
  useEffect(() => {
    if (!user) return
    const fetchLogs = async () => {
      setLoading(true)
      const yearStart = `${viewYear}-01-01`
      const yearEnd = `${viewYear}-12-31`
      const { data } = await supabase
        .from("activity_logs")
        .select("id, item_name, category, quantity, xp_earned, created_at, photo_metadata")
        .eq("user_id", user.id)
        .gte("created_at", yearStart)
        .lte("created_at", yearEnd + "T23:59:59")
        .order("created_at", { ascending: true })

      if (data) {
        const map = new Map<string, DayLog>()
        for (const row of data) {
          const date = row.created_at.split("T")[0]
          if (!map.has(date)) {
            map.set(date, { date, drinks: 0, categories: [], items: [], totalXp: 0 })
          }
          const day = map.get(date)!
          const mood = row.photo_metadata?.mood_tag || undefined
          day.items.push({ name: row.item_name, qty: row.quantity, category: row.category, xp: row.xp_earned, mood })
          day.totalXp += row.xp_earned
          if (!day.categories.includes(row.category)) day.categories.push(row.category)
          if (row.category === "drink") day.drinks += row.quantity
        }
        setLogs(Array.from(map.values()))
      }
      setLoading(false)
    }
    fetchLogs()
  }, [user, viewYear])

  // Save weekly goal to localStorage + Supabase
  useEffect(() => {
    localStorage.setItem("chugchug_weekly_goal", weeklyGoal.toString())
    localStorage.setItem("chugchug_grace_day", graceDayEnabled.toString())

    // Sync to Supabase (fire and forget)
    if (user) {
      supabase
        .from("user_goals")
        .upsert({
          user_id: user.id,
          goal_type: "weekly_drink_limit",
          target: weeklyGoal,
          grace_days: graceDayEnabled ? 1 : 0,
        }, { onConflict: "user_id,goal_type" })
        .then() // non-blocking
    }
  }, [weeklyGoal, graceDayEnabled, user])

  const logMap = useMemo(() => {
    const m = new Map<string, DayLog>()
    logs.forEach(l => m.set(l.date, l))
    return m
  }, [logs])

  // ──── COMPUTED STATS ────
  const today = new Date()
  const thisMonthLogs = useMemo(() =>
    logs.filter(l => {
      const d = new Date(l.date)
      return d.getMonth() === viewMonth && d.getFullYear() === viewYear
    }),
    [logs, viewMonth, viewYear]
  )

  const monthDrinks = thisMonthLogs.reduce((s, l) => s + l.drinks, 0)
  const monthDays = getDaysInMonth(viewYear, viewMonth)
  const daysPassed = viewYear === today.getFullYear() && viewMonth === today.getMonth()
    ? today.getDate()
    : monthDays
  const dryDays = daysPassed - thisMonthLogs.filter(l => l.drinks > 0).length

  const monthCalories = thisMonthLogs.reduce((s, l) =>
    s + l.items.filter(i => i.category === "drink").reduce((cs, i) => cs + estimateCalories(i.name, i.qty), 0)
    , 0)

  // Streak calculation
  const { currentDryStreak, longestDryStreak } = useMemo(() => {
    let curDry = 0, maxDry = 0, curDrink = 0
    const t = new Date()
    const d = new Date(t.getFullYear(), 0, 1)
    while (d <= t) {
      const key = formatDate(d)
      const log = logMap.get(key)
      if (!log || log.drinks === 0) {
        curDry++
        curDrink = 0
        if (curDry > maxDry) maxDry = curDry
      } else {
        curDrink++
        curDry = 0
      }
      d.setDate(d.getDate() + 1)
    }
    return { currentDryStreak: curDry, longestDryStreak: maxDry, currentDrinkStreak: curDrink }
  }, [logMap])

  // This week drink count
  const thisWeekDrinks = useMemo(() => {
    const mon = getMonday(new Date())
    let total = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon)
      d.setDate(d.getDate() + i)
      const log = logMap.get(formatDate(d))
      if (log) total += log.drinks
    }
    return total
  }, [logMap])

  const avgDrinkCost = 250 // ₹ estimate
  const moneySaved = dryDays * avgDrinkCost

  // ──── HEATMAP ────
  const heatmapData = useMemo(() => {
    const cells: { date: string; drinks: number; hasDetox: boolean; hasGym: boolean }[] = []
    const start = new Date(viewYear, 0, 1)
    const end = new Date(viewYear, 11, 31)
    const d = new Date(start)
    while (d <= end) {
      const key = formatDate(d)
      const log = logMap.get(key)
      cells.push({
        date: key,
        drinks: log?.drinks || 0,
        hasDetox: log?.categories.includes("detox") || false,
        hasGym: log?.categories.includes("gym") || false,
      })
      d.setDate(d.getDate() + 1)
    }
    return cells
  }, [logMap, viewYear])

  const heatmapColor = (drinks: number, hasDetox: boolean, hasGym: boolean) => {
    if (hasDetox) return "var(--acid)"
    if (hasGym) return "var(--blue)"
    if (drinks === 0) return "var(--border)"
    if (drinks <= 2) return "var(--amber-dim)"
    if (drinks <= 5) return "var(--amber)"
    return "var(--coral)"
  }

  const heatmapOpacity = (drinks: number, hasDetox: boolean) => {
    if (hasDetox) return 0.7
    if (drinks === 0) return 0.3
    if (drinks <= 2) return 0.5
    return 1
  }

  // ──── MONTHLY GRID ────
  const monthGrid = useMemo(() => {
    const startDay = getStartDayOfMonth(viewYear, viewMonth)
    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const cells: (number | null)[] = []
    for (let i = 0; i < startDay; i++) cells.push(null)
    for (let i = 1; i <= daysInMonth; i++) cells.push(i)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [viewYear, viewMonth])

  // ──── ACHIEVEMENTS ────
  const achievements = useMemo(() => [
    { icon: "🌿", label: "Dry Streak", value: `${currentDryStreak} days`, color: "var(--acid)" },
    { icon: "🔥", label: "Longest Dry", value: `${longestDryStreak} days`, color: "var(--amber)" },
    { icon: "📅", label: "Dry This Month", value: `${dryDays} days`, color: "var(--acid)" },
    { icon: "🏆", label: "Month XP", value: `${thisMonthLogs.reduce((s, l) => s + l.totalXp, 0)}`, color: "var(--amber)" },
    { icon: "🧮", label: "Total Logs", value: `${logs.length}`, color: "var(--coral)" },
  ], [currentDryStreak, longestDryStreak, dryDays, thisMonthLogs, logs])

  // ──── WRAPPED ────
  const wrappedStats = useMemo(() => ({
    username: profile?.username || "Traveler",
    level: profile?.level || 1,
    totalDrinks: logs.reduce((s, l) => s + l.drinks, 0),
    totalDryDays: (() => {
      const allDates = new Set(logs.filter(l => l.drinks > 0).map(l => l.date))
      const start = new Date(viewYear, 0, 1)
      const end = viewYear === today.getFullYear() ? today : new Date(viewYear, 11, 31)
      let dry = 0
      const d = new Date(start)
      while (d <= end) {
        if (!allDates.has(formatDate(d))) dry++
        d.setDate(d.getDate() + 1)
      }
      return dry
    })(),
    bestStreak: longestDryStreak,
    moneySaved: (() => {
      const allDates = new Set(logs.filter(l => l.drinks > 0).map(l => l.date))
      const start = new Date(viewYear, 0, 1)
      const end = viewYear === today.getFullYear() ? today : new Date(viewYear, 11, 31)
      let dry = 0
      const d = new Date(start)
      while (d <= end) {
        if (!allDates.has(formatDate(d))) dry++
        d.setDate(d.getDate() + 1)
      }
      return dry * avgDrinkCost
    })(),
    rank: profile?.level && profile.level >= 25 ? "Shogun" : profile?.level && profile.level >= 10 ? "Samurai" : "Ronin",
    month: MONTH_NAMES[viewMonth],
    year: viewYear,
  }), [logs, profile, viewMonth, viewYear, longestDryStreak])

  const handleShareWrapped = async () => {
    // Simple approach: prompt user to screenshot — no heavy dependency needed
    if (wrappedRef.current) {
      try {
        // Try native share API first (mobile)
        if (navigator.share) {
          await navigator.share({
            title: `ChugChug Wrapped - ${wrappedStats.month} ${wrappedStats.year}`,
            text: `🍻 ${wrappedStats.totalDrinks} drinks | 🌿 ${wrappedStats.totalDryDays} dry days | 🔥 ${wrappedStats.bestStreak}d best streak | 💰 ₹${wrappedStats.moneySaved} saved | Rank: ${wrappedStats.rank}`,
          })
        } else {
          // Copy to clipboard as text
          const text = `🍻 ChugChug Wrapped - ${wrappedStats.month} ${wrappedStats.year}\n@${wrappedStats.username}\n\n🍻 ${wrappedStats.totalDrinks} drinks\n🌿 ${wrappedStats.totalDryDays} dry days\n🔥 ${wrappedStats.bestStreak}d best streak\n💰 ₹${wrappedStats.moneySaved} saved\n🏆 Rank: ${wrappedStats.rank} · Level ${wrappedStats.level}`
          await navigator.clipboard.writeText(text)
          alert("Wrapped stats copied to clipboard! 📋 Screenshot the card to share the visual.")
        }
      } catch {
        alert("Screenshot this card and share it! 📸")
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <div className="text-4xl mb-2 anim-float">📅</div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Loading your calendar...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-24">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1 as any)}
            className="p-2 active:scale-90 transition-transform"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">Drinking Calendar</h1>
            <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--text-muted)" }}>
              Your journey, one day at a time
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowWrapped(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform"
          style={{
            background: "var(--amber-dim)", border: "1px solid rgba(216,162,94,0.3)",
            color: "var(--amber)", borderRadius: "var(--card-radius)"
          }}
        >
          <Share2 size={12} /> Wrapped
        </button>
      </div>

      {/* ─── 0. TODAY'S SNAPSHOT ─── */}
      {(() => {
        const todayLog = logMap.get(formatDate(today));
        const todayDrinks = todayLog?.drinks || 0;
        const todayXp = todayLog?.totalXp || 0;
        const todayCategories = todayLog?.categories || [];
        return (
          <div
            className="p-4 flex items-center justify-between"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderLeft: todayDrinks > 0 ? '4px solid var(--amber)' : '4px solid var(--acid)',
              borderRadius: 'var(--card-radius)',
            }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-ghost)' }}>Today</p>
              <div className="flex items-center gap-3">
                <span className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: todayDrinks > 0 ? 'var(--amber)' : 'var(--acid)' }}>
                  {todayDrinks > 0 ? `${todayDrinks} drinks` : 'Dry day 🌿'}
                </span>
                {todayXp > 0 && (
                  <span className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: 'var(--acid)' }}>
                    <Zap size={10} /> +{todayXp} XP
                  </span>
                )}
              </div>
              {todayCategories.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {todayCategories.map(c => (
                    <span key={c} className="text-xs">{CAT_EMOJI[c] || '📝'}</span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => navigate('/log')}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform"
              style={{ background: 'var(--amber)', color: 'var(--bg-deep)', borderRadius: 'var(--card-radius)' }}
            >
              <PenLine size={12} className="inline mr-1" /> Log
            </button>
          </div>
        );
      })()}

      {/* ─── 1. SUMMARY STRIP ─── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: "🍻", label: "Drinks", value: monthDrinks, color: "var(--amber)" },
          { icon: "🌿", label: "Dry Days", value: dryDays, color: "var(--acid)" },
          { icon: "🔥", label: "Streak", value: `${currentDryStreak}d`, color: "var(--coral)" },
          { icon: "💰", label: "Saved", value: `₹${moneySaved}`, color: "var(--amber)" },
        ].map(s => (
          <div
            key={s.label}
            className="text-center py-3 px-1"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--card-radius)" }}
          >
            <div className="text-lg mb-0.5">{s.icon}</div>
            <p className="text-sm font-black" style={{ color: s.color, fontFamily: "Syne, sans-serif" }}>{s.value}</p>
            <p className="text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "var(--text-ghost)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ─── 2. MONTHLY CALENDAR ─── */}
      <section
        className="overflow-hidden"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--card-radius)" }}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            onClick={() => {
              if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
              else setViewMonth(m => m - 1)
            }}
            className="p-1.5 active:scale-90 transition-transform"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-sm font-black uppercase tracking-widest" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <button
            onClick={() => {
              if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
              else setViewMonth(m => m + 1)
            }}
            className="p-1.5 active:scale-90 transition-transform"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-3">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-ghost)" }}>
                {d}
              </span>
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-1 px-3 pb-4">
          {monthGrid.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            const log = logMap.get(dateStr)
            const isToday = dateStr === formatDate(today)
            const hasDrinks = log && log.drinks > 0
            const hasDetox = log?.categories.includes("detox")
            const hasGym = log?.categories.includes("gym")

            let cellBg = "transparent"
            let cellBorder = "1px solid transparent"
            if (hasDetox) { cellBg = "var(--acid-dim)"; cellBorder = "1px solid rgba(124,154,116,0.3)" }
            else if (hasGym) { cellBg = "var(--indigo-dim)"; cellBorder = `1px solid rgba(59,130,246,0.3)` }
            else if (hasDrinks && log.drinks >= 6) { cellBg = "var(--coral-dim)"; cellBorder = "1px solid rgba(209,32,32,0.3)" }
            else if (hasDrinks) { cellBg = "var(--amber-dim)"; cellBorder = "1px solid rgba(216,162,94,0.3)" }

            return (
              <button
                key={dateStr}
                onClick={() => log && setSelectedDay(log)}
                className="flex flex-col items-center justify-center py-2 rounded-sm active:scale-90 transition-all relative"
                style={{ background: cellBg, border: cellBorder }}
              >
                {isToday && (
                  <div
                    className="absolute inset-0 rounded-sm pointer-events-none"
                    style={{ border: "2px solid var(--amber)", opacity: 0.6 }}
                  />
                )}
                <span className="text-xs font-bold" style={{ color: isToday ? "var(--amber)" : "var(--text-primary)" }}>
                  {day}
                </span>
                {log && (
                  <div className="flex gap-0.5 mt-0.5">
                    {log.categories.slice(0, 2).map(c => (
                      <span key={c} className="text-[8px]">{CAT_EMOJI[c] || "📝"}</span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* ─── 3. ANNUAL HEATMAP ─── */}
      <section style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--card-radius)", padding: 16 }}>
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <CalIcon size={12} /> {viewYear} Heatmap
        </h3>
        <div className="overflow-x-auto scrollbar-none">
          <div style={{ display: "grid", gridTemplateRows: "repeat(7, 1fr)", gridAutoFlow: "column", gap: 2, minWidth: 700 }}>
            {heatmapData.map((cell) => (
              <button
                key={cell.date}
                onClick={() => {
                  const log = logMap.get(cell.date)
                  if (log) setSelectedDay(log)
                }}
                className="transition-all hover:scale-125"
                style={{
                  width: 12, height: 12,
                  borderRadius: 2,
                  background: heatmapColor(cell.drinks, cell.hasDetox, cell.hasGym),
                  opacity: heatmapOpacity(cell.drinks, cell.hasDetox),
                }}
                title={`${cell.date}: ${cell.drinks} drinks`}
              />
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-3">
          {[
            { label: "None", color: "var(--border)", opacity: 0.3 },
            { label: "1-2", color: "var(--amber-dim)", opacity: 0.5 },
            { label: "3-5", color: "var(--amber)", opacity: 1 },
            { label: "6+", color: "var(--coral)", opacity: 1 },
            { label: "Detox", color: "var(--acid)", opacity: 0.7 },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, opacity: l.opacity }} />
              <span className="text-[8px] font-bold" style={{ color: "var(--text-ghost)" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 4. ACHIEVEMENTS RIBBON ─── */}
      <section>
        <h3 className="section-label mb-2 border-l-2 pl-2" style={{ borderColor: "var(--amber)" }}>
          🏅 Achievements
        </h3>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {achievements.map(a => (
            <div
              key={a.label}
              className="flex-shrink-0 text-center px-4 py-3"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--card-radius)", minWidth: 100 }}
            >
              <div className="text-xl mb-1">{a.icon}</div>
              <p className="text-sm font-black" style={{ color: a.color, fontFamily: "Syne, sans-serif" }}>{a.value}</p>
              <p className="text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "var(--text-ghost)" }}>{a.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 5. WEEKLY GOAL ─── */}
      <section
        className="p-4 space-y-4"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--card-radius)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <Target size={12} /> Weekly Drink Limit
          </h3>
          <span className="text-xs font-black" style={{ color: thisWeekDrinks <= weeklyGoal ? "var(--acid)" : "var(--coral)" }}>
            {thisWeekDrinks}/{weeklyGoal}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-deep)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min((thisWeekDrinks / Math.max(weeklyGoal, 1)) * 100, 100)}%`,
              background: thisWeekDrinks <= weeklyGoal
                ? "linear-gradient(90deg, var(--acid), var(--acid-light))"
                : "linear-gradient(90deg, var(--coral), var(--coral-light))",
            }}
          />
        </div>

        {/* Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Goal: {weeklyGoal} drinks/week</span>
          </div>
          <input
            type="range" min={0} max={21} value={weeklyGoal}
            onChange={e => setWeeklyGoal(parseInt(e.target.value))}
            className="w-full accent-amber"
            style={{ accentColor: "var(--amber)" }}
          />
        </div>

        {/* Grace day */}
        <label className="flex items-center gap-3 cursor-pointer pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <input
            type="checkbox" checked={graceDayEnabled}
            onChange={e => setGraceDayEnabled(e.target.checked)}
            className="w-4 h-4" style={{ accentColor: "var(--acid)" }}
          />
          <div>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Grace Day</span>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Allow 1 day over limit without breaking streak</p>
          </div>
        </label>
      </section>

      {/* ─── 6. CALORIE ESTIMATE ─── */}
      <section className="p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--card-radius)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <TrendingUp size={12} /> Calorie Estimate
          </h3>
          <span className="text-[10px] font-bold" style={{ color: "var(--text-ghost)" }}>{MONTH_NAMES[viewMonth]}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-2xl font-black" style={{ fontFamily: "Syne, sans-serif", color: "var(--coral)" }}>
            {monthCalories.toLocaleString()}
          </span>
          <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>calories from drinks</span>
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-ghost)" }}>
          ≈ {Math.round(monthCalories / 7700 * 10) / 10} kg body weight equivalent
        </p>
      </section>

      {/* ─── DAY DETAIL SHEET ─── */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="w-full max-w-lg p-5 space-y-4 anim-pop"
            style={{
              background: "var(--bg-surface)",
              borderTop: "3px solid var(--amber)",
              borderRadius: "16px 16px 0 0",
              maxHeight: "70vh",
              overflowY: "auto",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>
                {new Date(selectedDay.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="p-1" style={{ color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-3">
              <div className="text-center px-3 py-2" style={{ background: "var(--amber-dim)", borderRadius: "var(--card-radius)" }}>
                <p className="text-lg font-black" style={{ color: "var(--amber)" }}>{selectedDay.drinks}</p>
                <p className="text-[8px] font-bold uppercase" style={{ color: "var(--text-ghost)" }}>Drinks</p>
              </div>
              <div className="text-center px-3 py-2" style={{ background: "var(--acid-dim)", borderRadius: "var(--card-radius)" }}>
                <p className="text-lg font-black" style={{ color: "var(--acid)" }}>+{selectedDay.totalXp}</p>
                <p className="text-[8px] font-bold uppercase" style={{ color: "var(--text-ghost)" }}>XP</p>
              </div>
            </div>

            <div className="space-y-2">
              {selectedDay.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3" style={{ background: "var(--bg-raised)", borderRadius: "var(--card-radius)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{CAT_EMOJI[item.category] || "📝"}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {item.category} × {item.qty}
                        {item.mood && <span> · {item.mood}</span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black" style={{ color: "var(--acid)" }}>+{item.xp}</span>
                </div>
              ))}
            </div>

            {/* Log for this day button */}
            <button
              onClick={() => navigate('/log', { state: { prefillDate: selectedDay.date } })}
              className="glass-btn w-full py-3 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest mt-2"
            >
              <PenLine size={14} /> Log for {new Date(selectedDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </button>
          </div>
        </div>
      )}

      {/* ─── WRAPPED MODAL ─── */}
      {showWrapped && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowWrapped(false)}
        >
          <div className="w-full max-w-sm space-y-4 anim-pop" onClick={e => e.stopPropagation()}>
            <div
              ref={wrappedRef}
              className="p-6 space-y-4 text-center"
              style={{
                background: "linear-gradient(145deg, #0B111F, #1E2C45)",
                border: "2px solid var(--amber)",
                borderRadius: 16,
              }}
            >
              <div className="text-4xl mb-1">🍻</div>
              <h2 className="text-lg font-black tracking-wider" style={{ fontFamily: "Syne, sans-serif", color: "var(--amber)" }}>
                ChugChug Wrapped
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                {wrappedStats.month} {wrappedStats.year} · @{wrappedStats.username}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { icon: "🍻", label: "Drinks", value: wrappedStats.totalDrinks, color: "var(--amber)" },
                  { icon: "🌿", label: "Dry Days", value: wrappedStats.totalDryDays, color: "var(--acid)" },
                  { icon: "🔥", label: "Best Streak", value: `${wrappedStats.bestStreak}d`, color: "var(--coral)" },
                  { icon: "💰", label: "Saved", value: `₹${wrappedStats.moneySaved}`, color: "var(--amber)" },
                ].map(s => (
                  <div key={s.label} className="py-3 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="text-lg">{s.icon}</div>
                    <p className="text-xl font-black mt-1" style={{ color: s.color, fontFamily: "Syne, sans-serif" }}>{s.value}</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "#847C69" }}>{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="pt-3 mt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-xs font-black" style={{ color: "#F5F0E6" }}>
                  Rank: <span style={{ color: "var(--amber)" }}>{wrappedStats.rank}</span> · Level {wrappedStats.level}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowWrapped(false)}
                className="flex-1 py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
                style={{ background: "var(--bg-raised)", color: "var(--text-muted)", borderRadius: "var(--card-radius)", border: "1px solid var(--border)" }}
              >
                Close
              </button>
              <button
                onClick={handleShareWrapped}
                className="flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ background: "var(--amber)", color: "#050505", borderRadius: "var(--card-radius)" }}
              >
                <Share2 size={14} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
