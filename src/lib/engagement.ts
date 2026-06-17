// ══════════════════════════════════════════════════════════════
// ENGAGEMENT LAYER — the hooks that keep people coming back.
// Daily login rewards + streaks, weekly leagues, limited-time events.
// All calls are defensive: if a table/RPC isn't there yet (DB not
// applied), they return safe empty/default values instead of throwing.
// ══════════════════════════════════════════════════════════════
import { supabase } from "./supabase"
import { getWeekKey } from "./progression"

const todayStr = () => new Date().toISOString().split("T")[0]
const dateStr = (d: Date) => d.toISOString().split("T")[0]
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)

// ── DAILY REWARD CYCLE (7-day escalating loop) ──────────────────
export interface DailyReward {
  day: number
  xp: number
  emoji: string
  label: string
  freeze?: boolean
  jackpot?: boolean
}

export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, xp: 10,  emoji: "🍶", label: "+10" },
  { day: 2, xp: 15,  emoji: "🍶", label: "+15" },
  { day: 3, xp: 25,  emoji: "🍺", label: "+25" },
  { day: 4, xp: 40,  emoji: "🍺", label: "+40" },
  { day: 5, xp: 60,  emoji: "🍸", label: "+60" },
  { day: 6, xp: 90,  emoji: "🍾", label: "+90" },
  { day: 7, xp: 150, emoji: "🎁", label: "+150 & ❄️", freeze: true, jackpot: true },
]

export const cycleDayFor = (streak: number) => ((Math.max(1, streak) - 1) % 7) + 1

export interface RewardState {
  loginStreak: number
  longestLoginStreak: number
  canClaim: boolean
  /** position in the 7-day cycle the NEXT claim will land on */
  nextCycleDay: number
  nextReward: DailyReward
  streakFreezes: number
  /** streak is alive but today isn't claimed yet → "claim or lose it" */
  atRisk: boolean
  /** streak already lapsed (will reset to 1 on next claim) */
  lapsed: boolean
}

export async function getRewardState(userId: string): Promise<RewardState> {
  const fallback: RewardState = {
    loginStreak: 0, longestLoginStreak: 0, canClaim: true, nextCycleDay: 1,
    nextReward: DAILY_REWARDS[0], streakFreezes: 0, atRisk: false, lapsed: false,
  }
  try {
    const { data } = await supabase
      .from("profiles")
      .select("login_streak, longest_login_streak, last_login_date, streak_freezes")
      .eq("id", userId)
      .single()
    if (!data) return fallback

    const streak = data.login_streak ?? 0
    const last = data.last_login_date as string | null
    const freezes = data.streak_freezes ?? 0
    const today = todayStr()
    const gap = last ? daysBetween(last, today) : Infinity

    const claimedToday = last === today
    const canClaim = !claimedToday
    // projected streak after the next claim
    let projected: number
    if (gap === 1) projected = streak + 1
    else if (gap === 2 && freezes > 0) projected = streak + 1 // freeze bridges a missed day
    else if (claimedToday) projected = streak
    else projected = 1
    const nextCycleDay = cycleDayFor(claimedToday ? streak : projected)

    return {
      loginStreak: streak,
      longestLoginStreak: data.longest_login_streak ?? streak,
      canClaim,
      nextCycleDay,
      nextReward: DAILY_REWARDS[nextCycleDay - 1],
      streakFreezes: freezes,
      atRisk: canClaim && gap === 1 && streak > 0,
      lapsed: canClaim && gap > 1 && streak > 0,
    }
  } catch {
    return fallback
  }
}

export interface ClaimResult {
  ok: boolean
  alreadyClaimed?: boolean
  reward?: DailyReward
  newStreak?: number
  usedFreeze?: boolean
  error?: string
}

export async function claimDailyReward(userId: string): Promise<ClaimResult> {
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("login_streak, longest_login_streak, last_login_date, streak_freezes")
      .eq("id", userId)
      .single()
    if (!prof) return { ok: false, error: "no profile" }

    const today = todayStr()
    if (prof.last_login_date === today) return { ok: false, alreadyClaimed: true }

    const streak = prof.login_streak ?? 0
    let freezes = prof.streak_freezes ?? 0
    const gap = prof.last_login_date ? daysBetween(prof.last_login_date, today) : Infinity

    let newStreak: number
    let usedFreeze = false
    if (gap === 1) newStreak = streak + 1
    else if (gap === 2 && freezes > 0) { newStreak = streak + 1; freezes -= 1; usedFreeze = true }
    else newStreak = 1

    const reward = DAILY_REWARDS[cycleDayFor(newStreak) - 1]
    if (reward.freeze) freezes += 1

    const { error: claimErr } = await supabase.from("reward_claims").insert({
      user_id: userId, claim_date: today, day_index: cycleDayFor(newStreak),
      xp_awarded: reward.xp, reward_type: reward.jackpot ? "jackpot" : "daily",
    })
    if (claimErr && !/duplicate|unique/i.test(claimErr.message)) {
      return { ok: false, error: claimErr.message }
    }

    await supabase.from("profiles").update({
      login_streak: newStreak,
      longest_login_streak: Math.max(prof.longest_login_streak ?? 0, newStreak),
      last_login_date: today,
      streak_freezes: freezes,
    }).eq("id", userId)

    await supabase.rpc("add_xp", { user_id_param: userId, xp_to_add: reward.xp })

    return { ok: true, reward, newStreak, usedFreeze }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "claim failed" }
  }
}

// ── WEEKLY LEAGUE (competition) ─────────────────────────────────
export interface LeagueTier { name: string; emoji: string; min: number; color: string }

// Tiers by this-week XP. Promotion = climb a tier; falling behind = drop.
export const LEAGUE_TIERS: LeagueTier[] = [
  { name: "Bronze",  emoji: "🥉", min: 0,    color: "#CD7F32" },
  { name: "Silver",  emoji: "🥈", min: 100,  color: "#9CA3AF" },
  { name: "Gold",    emoji: "🥇", min: 300,  color: "#F59E0B" },
  { name: "Diamond", emoji: "💎", min: 700,  color: "#22D3EE" },
  { name: "Legend",  emoji: "🐉", min: 1500, color: "#A855F7" },
]

export const tierFor = (weeklyXp: number): LeagueTier =>
  [...LEAGUE_TIERS].reverse().find(t => weeklyXp >= t.min) ?? LEAGUE_TIERS[0]

export interface LeaguePlayer { user_id: string; username: string; weekly_xp: number }
export interface LeagueState {
  weeklyXp: number
  rank: number | null
  totalPlayers: number
  tier: LeagueTier
  nextTier: LeagueTier | null
  xpToPromote: number
  top: LeaguePlayer[]
}

export async function getWeeklyLeague(userId: string): Promise<LeagueState> {
  const tier0 = LEAGUE_TIERS[0]
  const empty: LeagueState = {
    weeklyXp: 0, rank: null, totalPlayers: 0, tier: tier0,
    nextTier: LEAGUE_TIERS[1], xpToPromote: LEAGUE_TIERS[1].min, top: [],
  }
  try {
    // ISO week start (Monday)
    const now = new Date()
    const dow = now.getDay() || 7
    const monday = new Date(now); monday.setDate(now.getDate() - (dow - 1)); monday.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from("activity_logs")
      .select("user_id, xp_earned, profiles(username)")
      .gte("created_at", monday.toISOString())
    if (error || !data) return empty

    const totals = new Map<string, LeaguePlayer>()
    for (const row of data as any[]) {
      const uname = Array.isArray(row.profiles) ? row.profiles[0]?.username : row.profiles?.username
      const cur = totals.get(row.user_id) ?? { user_id: row.user_id, username: uname ?? "?", weekly_xp: 0 }
      cur.weekly_xp += row.xp_earned ?? 0
      totals.set(row.user_id, cur)
    }
    const ranked = [...totals.values()].sort((a, b) => b.weekly_xp - a.weekly_xp)
    const meIdx = ranked.findIndex(p => p.user_id === userId)
    const weeklyXp = meIdx >= 0 ? ranked[meIdx].weekly_xp : 0
    const tier = tierFor(weeklyXp)
    const nextTier = LEAGUE_TIERS[LEAGUE_TIERS.indexOf(tier) + 1] ?? null

    return {
      weeklyXp,
      rank: meIdx >= 0 ? meIdx + 1 : null,
      totalPlayers: ranked.length,
      tier,
      nextTier,
      xpToPromote: nextTier ? Math.max(0, nextTier.min - weeklyXp) : 0,
      top: ranked.slice(0, 3),
    }
  } catch {
    return empty
  }
}

export { getWeekKey }

// ── FRIENDS LEAGUE (competition among friends — the core loop) ───
export interface FriendsLeaguePlayer { user_id: string; username: string; weekly_xp: number; isMe: boolean }
export interface FriendsLeague {
  friendsCount: number
  players: FriendsLeaguePlayer[]
  rank: number
  total: number
  myXp: number
  leader: FriendsLeaguePlayer | null
  aheadGap: number       // XP to overtake the friend just above you (0 if you lead)
  aheadName: string | null
}

export async function getFriendsLeague(userId: string): Promise<FriendsLeague> {
  const empty: FriendsLeague = { friendsCount: 0, players: [], rank: 0, total: 0, myXp: 0, leader: null, aheadGap: 0, aheadName: null }
  try {
    const { data: friends } = await supabase.rpc("get_friends", { user_uuid: userId })
    const friendIds: string[] = (friends ?? []).map((f: any) => f.friend_id)
    const ids = [userId, ...friendIds]

    const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids)
    const nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.username]))

    const now = new Date()
    const dow = now.getDay() || 7
    const monday = new Date(now); monday.setDate(now.getDate() - (dow - 1)); monday.setHours(0, 0, 0, 0)
    const { data: logs } = await supabase
      .from("activity_logs").select("user_id, xp_earned")
      .in("user_id", ids).gte("created_at", monday.toISOString())

    const xp = new Map<string, number>(); ids.forEach(i => xp.set(i, 0))
    for (const l of logs ?? []) xp.set(l.user_id, (xp.get(l.user_id) ?? 0) + ((l as any).xp_earned ?? 0))

    const players: FriendsLeaguePlayer[] = ids
      .map(i => ({ user_id: i, username: i === userId ? "You" : (nameMap.get(i) ?? "?"), weekly_xp: xp.get(i) ?? 0, isMe: i === userId }))
      .sort((a, b) => b.weekly_xp - a.weekly_xp)

    const rank = players.findIndex(p => p.isMe) + 1
    const myXp = xp.get(userId) ?? 0
    const ahead = rank > 1 ? players[rank - 2] : null

    return {
      friendsCount: friendIds.length, players, rank, total: players.length, myXp,
      leader: players[0] ?? null,
      aheadGap: ahead ? ahead.weekly_xp - myXp : 0,
      aheadName: ahead ? ahead.username : null,
    }
  } catch { return empty }
}

// ── CREW BATTLES (crew-vs-crew weekly XP) ───────────────────────
export interface CrewStanding { group_id: string; name: string; xp: number; rank: number; members: number }
export interface CrewBattle {
  myCrew: CrewStanding | null
  rival: CrewStanding | null      // the crew just ahead of yours
  chasing: CrewStanding | null    // the crew just behind yours
  totalCrews: number
  top: CrewStanding[]
}

export async function getCrewBattle(userId: string): Promise<CrewBattle> {
  const empty: CrewBattle = { myCrew: null, rival: null, chasing: null, totalCrews: 0, top: [] }
  try {
    const now = new Date()
    const dow = now.getDay() || 7
    const monday = new Date(now); monday.setDate(now.getDate() - (dow - 1)); monday.setHours(0, 0, 0, 0)

    const [membersRes, logsRes, myRes] = await Promise.all([
      supabase.from("group_members").select("group_id, user_id, groups(name)"),
      supabase.from("activity_logs").select("user_id, xp_earned").gte("created_at", monday.toISOString()),
      supabase.from("group_members").select("group_id").eq("user_id", userId),
    ])
    const members = (membersRes.data ?? []) as any[]
    const logs = (logsRes.data ?? []) as any[]
    if (members.length === 0) return empty

    // per-user weekly xp
    const userXp = new Map<string, number>()
    for (const l of logs) userXp.set(l.user_id, (userXp.get(l.user_id) ?? 0) + (l.xp_earned ?? 0))

    // aggregate per crew
    const crews = new Map<string, CrewStanding>()
    for (const m of members) {
      const name = Array.isArray(m.groups) ? m.groups[0]?.name : m.groups?.name
      const c = crews.get(m.group_id) ?? { group_id: m.group_id, name: name ?? "Crew", xp: 0, rank: 0, members: 0 }
      c.xp += userXp.get(m.user_id) ?? 0
      c.members += 1
      crews.set(m.group_id, c)
    }
    const ranked = [...crews.values()].sort((a, b) => b.xp - a.xp)
    ranked.forEach((c, i) => { c.rank = i + 1 })

    const myIds = new Set((myRes.data ?? []).map((r: any) => r.group_id))
    const mine = ranked.filter(c => myIds.has(c.group_id))
    const myCrew = mine.length ? mine.sort((a, b) => a.rank - b.rank)[0] : null

    return {
      myCrew,
      rival: myCrew && myCrew.rank > 1 ? ranked[myCrew.rank - 2] : null,
      chasing: myCrew && myCrew.rank < ranked.length ? ranked[myCrew.rank] : null,
      totalCrews: ranked.length,
      top: ranked.slice(0, 3),
    }
  } catch {
    return empty
  }
}

// ── LIMITED-TIME EVENTS (FOMO) ──────────────────────────────────
export interface LiveEvent {
  id: string
  title: string
  description: string | null
  emoji: string | null
  starts_at: string
  ends_at: string
  bonus_xp_multiplier: number | null
  reward_badge: string | null
  target: number | null
}

export async function getActiveEvent(): Promise<LiveEvent | null> {
  try {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from("events")
      .select("id, title, description, emoji, starts_at, ends_at, bonus_xp_multiplier, reward_badge, target")
      .lte("starts_at", now)
      .gte("ends_at", now)
      .eq("is_active", true)
      .order("ends_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    return (data as LiveEvent) ?? null
  } catch {
    return null
  }
}

/**
 * Advance the user's progress on any active event a new log qualifies for.
 * Auto-joins the event on first qualifying log. Awards bonus XP on completion.
 * Fire-and-forget — call after a successful activity log.
 */
export async function bumpEventProgress(userId: string, category: string): Promise<string[]> {
  const completedTitles: string[] = []
  try {
    const now = new Date().toISOString()
    const { data: evs } = await supabase
      .from("events")
      .select("id, title, target, challenge_type, reward_badge")
      .lte("starts_at", now).gte("ends_at", now)
      .eq("is_active", true)
      .not("target", "is", null)
    if (!evs || evs.length === 0) return completedTitles

    for (const e of evs as any[]) {
      // null/'log' challenge_type → any log counts; otherwise match the category
      if (e.challenge_type && e.challenge_type !== "log" && e.challenge_type !== category) continue

      const { data: p } = await supabase
        .from("event_participants")
        .select("id, progress, completed")
        .eq("event_id", e.id).eq("user_id", userId)
        .maybeSingle()
      if (p?.completed) continue

      const newProgress = (p?.progress ?? 0) + 1
      const completed = e.target ? newProgress >= e.target : false
      if (p) {
        await supabase.from("event_participants")
          .update({ progress: newProgress, completed, completed_at: completed ? now : null })
          .eq("id", p.id)
      } else {
        await supabase.from("event_participants")
          .insert({ event_id: e.id, user_id: userId, progress: newProgress, completed, completed_at: completed ? now : null })
      }
      if (completed) {
        await supabase.rpc("add_xp", { user_id_param: userId, xp_to_add: (e.target ?? 5) * 10 })
        completedTitles.push(e.title)
      }
    }
  } catch { /* non-blocking */ }
  return completedTitles
}

/** "2d 4h", "3h 12m", "8m" — compact countdown until an ISO timestamp. */
export function countdown(toISO: string): string {
  const ms = new Date(toISO).getTime() - Date.now()
  if (ms <= 0) return "ended"
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
