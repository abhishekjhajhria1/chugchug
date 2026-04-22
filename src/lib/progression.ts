import { supabase } from "./supabase"

// ══════════════════════════════════════════════════════════════
// ── RANK SYSTEM ──
// Maps levels to named ranks with lore, visual cues, and theme unlocks.
// ══════════════════════════════════════════════════════════════

export interface RankDef {
  title: string
  emoji: string
  lore: string
  color: string      // CSS var name
  glowColor: string  // For borders / shadows
  minLevel: number
  maxLevel: number
}

export const RANK_LADDER: RankDef[] = [
  { title: 'Wanderer',    emoji: '🚶', lore: 'Footsteps in the dust. No allegiance. No glory. Yet.',           color: 'var(--text-muted)',   glowColor: 'transparent',             minLevel: 1,  maxLevel: 3  },
  { title: 'Ronin',       emoji: '⚔️', lore: 'A masterless blade, cutting through the fog.',                   color: 'var(--coral)',        glowColor: 'rgba(209,32,32,0.2)',     minLevel: 4,  maxLevel: 6  },
  { title: 'Samurai',     emoji: '🗡️', lore: 'Steel meets purpose. The path of honor begins.',                 color: 'var(--amber)',        glowColor: 'rgba(216,162,94,0.25)',   minLevel: 7,  maxLevel: 10 },
  { title: 'War Captain', emoji: '🏴', lore: 'Commands respect. Leads the charge.',                            color: 'var(--amber)',        glowColor: 'rgba(216,162,94,0.35)',   minLevel: 11, maxLevel: 15 },
  { title: 'Daimyo',      emoji: '🏯', lore: 'Lord of a territory. Builder of legacies.',                      color: 'var(--acid)',         glowColor: 'rgba(204,255,0,0.2)',     minLevel: 16, maxLevel: 20 },
  { title: 'Shogun',      emoji: '👑', lore: 'The supreme commander. Bows to no one.',                         color: 'var(--acid)',         glowColor: 'rgba(204,255,0,0.35)',    minLevel: 21, maxLevel: 30 },
  { title: 'Myth',        emoji: '🐉', lore: 'They speak your name in taverns you\'ve never visited.',         color: 'var(--coral)',        glowColor: 'rgba(209,32,32,0.4)',     minLevel: 31, maxLevel: 50 },
  { title: 'Kami',        emoji: '⛩️', lore: 'Ascended beyond mortal achievement. A living god.',               color: 'var(--amber)',        glowColor: 'rgba(216,162,94,0.5)',    minLevel: 51, maxLevel: 999 },
]

export interface RankInfo {
  current: RankDef
  next: RankDef | null
  xpToNext: number          // XP needed to reach next rank's min level
  progressPercent: number    // 0-100 progress within current rank
}

/**
 * Get rank info for a given level and XP.
 * XP per level = level * 100 (matches existing system).
 */
export function getRankInfo(level: number, xp: number = 0): RankInfo {
  const lvl = Math.max(1, level)
  const current = RANK_LADDER.find(r => lvl >= r.minLevel && lvl <= r.maxLevel) || RANK_LADDER[0]
  const currentIdx = RANK_LADDER.indexOf(current)
  const next = currentIdx < RANK_LADDER.length - 1 ? RANK_LADDER[currentIdx + 1] : null

  let xpToNext = 0
  let progressPercent = 100
  if (next) {
    // Calculate total XP needed to reach next rank's min level
    let totalXpForNextRankLevel = 0
    for (let l = 1; l < next.minLevel; l++) totalXpForNextRankLevel += l * 100
    let totalXpForCurrentRankStart = 0
    for (let l = 1; l < current.minLevel; l++) totalXpForCurrentRankStart += l * 100
    const rankXpRange = totalXpForNextRankLevel - totalXpForCurrentRankStart
    const userXpInRank = xp - totalXpForCurrentRankStart
    xpToNext = Math.max(0, totalXpForNextRankLevel - xp)
    progressPercent = rankXpRange > 0 ? Math.min(100, Math.max(0, Math.round((userXpInRank / rankXpRange) * 100))) : 100
  }

  return { current, next, xpToNext, progressPercent }
}

// ══════════════════════════════════════════════════════════════
// ── THEME UNLOCKS ──
// Themes gated by rank level. Subtle accent changes, not full redesigns.
// ══════════════════════════════════════════════════════════════

export interface ThemeUnlock {
  themeId: string
  label: string
  desc: string
  emoji: string
  requiredLevel: number
  requiredRank: string
}

export const THEME_UNLOCKS: ThemeUnlock[] = [
  { themeId: 'dark',    label: 'Wano Arc',   desc: 'Dark · Samurai',           emoji: '🎌', requiredLevel: 1,  requiredRank: 'Wanderer' },
  { themeId: 'light',   label: 'Wano Day',   desc: 'Light · Clean',            emoji: '☀️', requiredLevel: 4,  requiredRank: 'Ronin'    },
  { themeId: 'verdant', label: 'Verdant',     desc: 'Earthy · Calm',            emoji: '🌿', requiredLevel: 7,  requiredRank: 'Samurai'  },
  { themeId: 'sakura',  label: 'Sakura',      desc: 'Cherry Blossom · Vibrant', emoji: '🌸', requiredLevel: 11, requiredRank: 'War Captain' },
]

export function isThemeUnlocked(themeId: string, level: number): boolean {
  const unlock = THEME_UNLOCKS.find(t => t.themeId === themeId)
  if (!unlock) return true // unknown themes are always unlocked
  return level >= unlock.requiredLevel
}

// ══════════════════════════════════════════════════════════════
// ── FEATURE LOCKS ──
// Certain features unlock at specific levels to create aspiration.
// ══════════════════════════════════════════════════════════════

export interface FeatureLock {
  id: string
  label: string
  emoji: string
  requiredLevel: number
  requiredRank: string
  description: string
}

export const FEATURE_LOCKS: FeatureLock[] = [
  { id: 'recipe_publish',   label: 'Publish Recipes',       emoji: '📖', requiredLevel: 4,  requiredRank: 'Ronin',       description: 'Share your recipes with the world' },
  { id: 'create_party',     label: 'Host Parties',          emoji: '🎪', requiredLevel: 7,  requiredRank: 'Samurai',     description: 'Start your own events and parties' },
  { id: 'world_tales',      label: 'Post Tales',            emoji: '📜', requiredLevel: 5,  requiredRank: 'Ronin',       description: 'Share stories in the World feed' },
  { id: 'crew_create',      label: 'Create Crews',          emoji: '🏴', requiredLevel: 3,  requiredRank: 'Wanderer',    description: 'Form your own pirate crew' },
  { id: 'photo_overlay',    label: 'Session Share Cards',   emoji: '📸', requiredLevel: 10, requiredRank: 'Samurai',     description: 'Generate branded share cards after sessions' },
]

export function isFeatureUnlocked(featureId: string, level: number): boolean {
  const lock = FEATURE_LOCKS.find(f => f.id === featureId)
  if (!lock) return true
  return level >= lock.requiredLevel
}

// ══════════════════════════════════════════════════════════════
// ── DAILY BOUNTY SYSTEM ──
// 3 rotating micro-challenges per day, seeded by date hash.
// ══════════════════════════════════════════════════════════════

export interface BountyDef {
  id: string
  title: string
  description: string
  xpReward: number
  emoji: string
  checkType: 'log_count' | 'category_variety' | 'photo_log' | 'early_log' | 'new_drink' | 'session_join' | 'weekend_log' | 'night_log' | 'reaction' | 'multi_log'
  target: number
}

export const DAILY_BOUNTY_POOL: BountyDef[] = [
  { id: 'early_bird',     title: 'Early Bird',          description: 'Log something before noon',              xpReward: 20, emoji: '🌅', checkType: 'early_log',        target: 1 },
  { id: 'new_discovery',  title: 'New Discovery',       description: 'Log a drink you\'ve never logged before', xpReward: 30, emoji: '🔍', checkType: 'new_drink',        target: 1 },
  { id: 'category_mix',   title: 'Mixed Plate',         description: 'Log in 2 different categories today',    xpReward: 25, emoji: '🎭', checkType: 'category_variety', target: 2 },
  { id: 'photo_proof',    title: 'Proof or It Didn\'t Happen', description: 'Log with a photo attached',       xpReward: 20, emoji: '📸', checkType: 'photo_log',        target: 1 },
  { id: 'triple_threat',  title: 'Triple Threat',       description: 'Log 3+ activities today',                xpReward: 35, emoji: '🔱', checkType: 'multi_log',        target: 3 },
  { id: 'night_owl',      title: 'Night Owl',           description: 'Log something after midnight',           xpReward: 25, emoji: '🦉', checkType: 'night_log',        target: 1 },
  { id: 'social_session',  title: 'Social Butterfly',   description: 'Join a drinking session with others',    xpReward: 30, emoji: '🦋', checkType: 'session_join',     target: 1 },
  { id: 'weekend_warrior', title: 'Weekend Warrior',    description: 'Log on a Saturday or Sunday',            xpReward: 15, emoji: '⚔️', checkType: 'weekend_log',      target: 1 },
  { id: 'double_down',    title: 'Double Down',         description: 'Log 2+ activities today',                xpReward: 20, emoji: '✌️', checkType: 'multi_log',        target: 2 },
  { id: 'gym_day',        title: 'Iron Temple',         description: 'Log a gym or detox session',             xpReward: 25, emoji: '💪', checkType: 'category_variety', target: 1 },
  { id: 'hydration',      title: 'Water Bearer',        description: 'Log water today',                        xpReward: 15, emoji: '💧', checkType: 'category_variety', target: 1 },
  { id: 'five_timer',     title: 'Marathon Logger',     description: 'Log 5+ activities today',                xpReward: 50, emoji: '🏅', checkType: 'multi_log',        target: 5 },
]

/**
 * Deterministic daily bounty selection.
 * Uses a date-seed hash to pick 3 bounties. Same 3 for all users each day.
 */
export function getDailyBounties(date: Date = new Date()): BountyDef[] {
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  // Simple string hash
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  hash = Math.abs(hash)

  const pool = [...DAILY_BOUNTY_POOL]
  const selected: BountyDef[] = []
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = (hash + i * 7919) % pool.length  // 7919 is a prime for distribution
    selected.push(pool[idx])
    pool.splice(idx, 1)
  }
  return selected
}

/**
 * Check bounty completion for today's logs.
 * Returns { bountyId: { completed, current, target } }
 */
export async function checkDailyBountyCompletion(userId: string): Promise<Record<string, { completed: boolean; current: number; target: number }>> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const bounties = getDailyBounties(today)

  // Fetch today's logs
  const { data: todayLogs } = await supabase
    .from('activity_logs')
    .select('id, category, item_name, photo_url, created_at')
    .eq('user_id', userId)
    .gte('created_at', `${todayStr}T00:00:00`)
    .lte('created_at', `${todayStr}T23:59:59`)

  // Fetch user's entire drink history for "new drink" check
  const { data: allDrinks } = await supabase
    .from('activity_logs')
    .select('item_name')
    .eq('user_id', userId)
    .eq('category', 'drink')
    .lt('created_at', `${todayStr}T00:00:00`)

  // Fetch today's sessions
  const { data: todaySessions } = await supabase
    .from('session_participants')
    .select('session_id')
    .eq('user_id', userId)

  const logs = todayLogs || []
  const previousDrinkNames = new Set((allDrinks || []).map(d => d.item_name?.toLowerCase().trim()))
  const sessionCount = (todaySessions || []).length

  const results: Record<string, { completed: boolean; current: number; target: number }> = {}

  for (const bounty of bounties) {
    let current = 0
    const target = bounty.target

    switch (bounty.checkType) {
      case 'log_count':
      case 'multi_log':
        current = logs.length
        break
      case 'category_variety': {
        const cats = new Set(logs.map(l => l.category))
        if (bounty.id === 'gym_day') {
          current = logs.filter(l => l.category === 'gym' || l.category === 'detox').length
        } else if (bounty.id === 'hydration') {
          current = logs.filter(l => l.category === 'water').length
        } else {
          current = cats.size
        }
        break
      }
      case 'photo_log':
        current = logs.filter(l => l.photo_url).length
        break
      case 'early_log':
        current = logs.filter(l => new Date(l.created_at).getHours() < 12).length
        break
      case 'new_drink': {
        const todayDrinks = logs.filter(l => l.category === 'drink')
        current = todayDrinks.filter(l => !previousDrinkNames.has(l.item_name?.toLowerCase().trim())).length
        break
      }
      case 'session_join':
        current = sessionCount > 0 ? 1 : 0
        break
      case 'weekend_log': {
        const day = today.getDay()
        current = (day === 0 || day === 6) && logs.length > 0 ? 1 : 0
        break
      }
      case 'night_log':
        current = logs.filter(l => {
          const h = new Date(l.created_at).getHours()
          return h >= 0 && h < 5
        }).length
        break
      case 'reaction':
        current = 0 // TODO: implement when reaction tracking is added
        break
    }

    results[bounty.id] = { completed: current >= target, current: Math.min(current, target), target }
  }

  return results
}

// ══════════════════════════════════════════════════════════════
// ── STREAK SYSTEM ──
// Tracks consecutive logging activity (any type, not just drinking).
// ══════════════════════════════════════════════════════════════

export async function updateStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; isNewDay: boolean }> {
  const today = new Date().toISOString().split('T')[0]

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_streak, longest_streak, last_activity_date')
    .eq('id', userId)
    .single()

  if (!profile) return { currentStreak: 1, longestStreak: 1, isNewDay: true }

  const lastDate = profile.last_activity_date
  let current = profile.current_streak || 0
  let longest = profile.longest_streak || 0
  let isNewDay = false

  if (lastDate === today) {
    // Already logged today — no streak change
    return { currentStreak: current, longestStreak: longest, isNewDay: false }
  }

  // Check if yesterday
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (lastDate === yesterdayStr) {
    current += 1
    isNewDay = true
  } else {
    // Streak broken — reset
    current = 1
    isNewDay = true
  }

  longest = Math.max(longest, current)

  await supabase
    .from('profiles')
    .update({ current_streak: current, longest_streak: longest, last_activity_date: today })
    .eq('id', userId)

  return { currentStreak: current, longestStreak: longest, isNewDay }
}

// ══════════════════════════════════════════════════════════════
// ── CREW STREAK SYSTEM ──
// Tracks consecutive days where ANY member of a group logged.
// ══════════════════════════════════════════════════════════════

export interface CrewStreakInfo {
  crewStreak: number
  crewLongestStreak: number
  lastLoggerUsername: string | null
}

/**
 * Update crew streaks for ALL groups the user belongs to.
 * Called whenever a user logs any activity.
 */
export async function updateCrewStreaks(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  // Get all groups the user is in
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)

  if (!memberships || memberships.length === 0) return

  const groupIds = memberships.map(m => m.group_id)

  // Fetch all groups' current streak data
  const { data: groups } = await supabase
    .from('groups')
    .select('id, crew_streak, crew_longest_streak, crew_last_activity')
    .in('id', groupIds)

  if (!groups) return

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  for (const group of groups) {
    let streak = group.crew_streak || 0
    const longest = group.crew_longest_streak || 0
    const lastDate = group.crew_last_activity

    if (lastDate === today) {
      // Already logged today by someone — just update the last logger
      await supabase
        .from('groups')
        .update({ crew_last_logger_id: userId })
        .eq('id', group.id)
      continue
    }

    if (lastDate === yesterdayStr) {
      streak += 1
    } else {
      // Streak broken or first log
      streak = 1
    }

    const newLongest = Math.max(longest, streak)

    await supabase
      .from('groups')
      .update({
        crew_streak: streak,
        crew_longest_streak: newLongest,
        crew_last_activity: today,
        crew_last_logger_id: userId,
      })
      .eq('id', group.id)
  }
}

/**
 * Get crew streak info for a specific group.
 */
export async function getCrewStreakInfo(groupId: string): Promise<CrewStreakInfo> {
  const { data } = await supabase
    .from('groups')
    .select('crew_streak, crew_longest_streak, crew_last_logger_id, profiles!groups_crew_last_logger_id_fkey(username)')
    .eq('id', groupId)
    .single()

  if (!data) return { crewStreak: 0, crewLongestStreak: 0, lastLoggerUsername: null }

  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  return {
    crewStreak: data.crew_streak || 0,
    crewLongestStreak: data.crew_longest_streak || 0,
    lastLoggerUsername: (profile as any)?.username || null,
  }
}

// ── Badge + Challenge Definitions ──
// Organized by category so they feel intentional and curated.

export interface BadgeDef {
  name: string
  icon_text: string
  description: string
  category: 'drinking' | 'wellness' | 'social' | 'milestones'
}

export const BADGE_DEFINITIONS: Record<string, BadgeDef> = {
  // ── DRINKING ──
  first_drop: {
    name: "First Drop",
    icon_text: "💧",
    description: "Log your very first drink",
    category: "drinking",
  },
  getting_warmed_up: {
    name: "Getting Warmed Up",
    icon_text: "🍺",
    description: "Log 5 drinks total",
    category: "drinking",
  },
  iron_liver: {
    name: "Iron Liver",
    icon_text: "🫀",
    description: "Reach 50 drink logs",
    category: "drinking",
  },
  centurion: {
    name: "Centurion",
    icon_text: "🏛️",
    description: "100 drinks logged — true commitment",
    category: "drinking",
  },
  sake_sommelier: {
    name: "Sake Sommelier",
    icon_text: "🍶",
    description: "Log 10 uniquely named drinks",
    category: "drinking",
  },
  night_owl: {
    name: "Night Owl",
    icon_text: "🦉",
    description: "Log 3 drinks after midnight",
    category: "drinking",
  },
  weekend_warrior: {
    name: "Weekend Warrior",
    icon_text: "⚔️",
    description: "5+ logs on weekends (Sat/Sun)",
    category: "drinking",
  },
  double_down: {
    name: "Double Down",
    icon_text: "🎰",
    description: "Log 2+ different categories in one day",
    category: "drinking",
  },

  // ── WELLNESS ──
  dry_streak_3: {
    name: "Three Day Monk",
    icon_text: "🧘",
    description: "Go 3 consecutive days without a drink",
    category: "wellness",
  },
  dry_streak_7: {
    name: "Clean Week",
    icon_text: "🌿",
    description: "7 dry days in a row",
    category: "wellness",
  },
  gym_rat: {
    name: "Gym Rat",
    icon_text: "🏋️",
    description: "Log 10 gym sessions",
    category: "wellness",
  },
  hydrated: {
    name: "Stay Hydrated",
    icon_text: "💦",
    description: "Log water 15 times",
    category: "wellness",
  },
  balanced_life: {
    name: "Balanced Life",
    icon_text: "⚖️",
    description: "Log both gym and drink in the same week",
    category: "wellness",
  },
  detox_champion: {
    name: "Detox Champion",
    icon_text: "🍃",
    description: "Complete 5 detox activities",
    category: "wellness",
  },

  // ── SOCIAL ──
  social_butterfly: {
    name: "Social Butterfly",
    icon_text: "🦋",
    description: "Join 3 different groups",
    category: "social",
  },
  session_starter: {
    name: "Session Starter",
    icon_text: "🎬",
    description: "Start your first drinking session",
    category: "social",
  },
  recipe_sharer: {
    name: "Recipe Sharer",
    icon_text: "📖",
    description: "Share 3 recipes with the community",
    category: "social",
  },
  party_host: {
    name: "Party Host",
    icon_text: "🎪",
    description: "Start 5 drinking sessions",
    category: "social",
  },

  // ── MILESTONES ──
  consistent_logger: {
    name: "Consistent Logger",
    icon_text: "📅",
    description: "Log something 7 days in a row",
    category: "milestones",
  },
  month_of_logs: {
    name: "Full Month",
    icon_text: "🗓️",
    description: "Log at least once on 20 different days in a month",
    category: "milestones",
  },
  jack_of_all: {
    name: "Jack of All",
    icon_text: "🃏",
    description: "Log in 4+ different categories",
    category: "milestones",
  },
  snapshot_collector: {
    name: "Snapshot Collector",
    icon_text: "📸",
    description: "Upload 10 photos with your logs",
    category: "milestones",
  },
  level_5: {
    name: "Rising Star",
    icon_text: "⭐",
    description: "Reach Level 5",
    category: "milestones",
  },
  level_10: {
    name: "Veteran",
    icon_text: "🎖️",
    description: "Reach Level 10",
    category: "milestones",
  },
}

// ── Challenge progress calculation ──
// Returns { earned: string[], progress: Record<badgeKey, { current, target }> }

export interface ChallengeProgress {
  current: number
  target: number
  done: boolean
}

export async function getChallengeProgress(userId: string): Promise<{
  earned: string[]
  progress: Record<string, ChallengeProgress>
}> {
  const progress: Record<string, ChallengeProgress> = {}

  // Fetch all user data we need
  const [logsRes, badgesRes, groupsRes, sessionsRes, profileRes] = await Promise.allSettled([
    supabase.from("activity_logs").select("id, category, item_name, quantity, photo_url, photo_metadata, created_at").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("user_badges").select("badges(name)").eq("user_id", userId),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
    supabase.from("drinking_sessions").select("id").eq("creator_id", userId),
    supabase.from("profiles").select("level, xp").eq("id", userId).single(),
  ])

  const logs = logsRes.status === 'fulfilled' ? (logsRes.value.data || []) : []
  const earnedBadges = badgesRes.status === 'fulfilled'
    ? (badgesRes.value.data || []).flatMap((a: any) => a.badges?.name).filter(Boolean) as string[]
    : []
  const groups = groupsRes.status === 'fulfilled' ? (groupsRes.value.data || []) : []
  const sessions = sessionsRes.status === 'fulfilled' ? (sessionsRes.value.data || []) : []
  const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null

  // Pre-compute common data
  const drinkLogs = logs.filter((l: any) => l.category === 'drink')
  const gymLogs = logs.filter((l: any) => l.category === 'gym')
  const waterLogs = logs.filter((l: any) => l.category === 'water')
  const detoxLogs = logs.filter((l: any) => l.category === 'detox')
  const recipeLogs = logs.filter((l: any) => l.photo_metadata?.is_recipe)
  const photoLogs = logs.filter((l: any) => l.photo_url)

  const uniqueDrinkNames = new Set(drinkLogs.map((l: any) => l.item_name?.toLowerCase().trim()))
  const allCategories = new Set(logs.map((l: any) => l.category))

  // Midnight logs (hour >= 0 && hour < 5)
  const midnightDrinks = drinkLogs.filter((l: any) => {
    const h = new Date(l.created_at).getHours()
    return h >= 0 && h < 5
  })

  // Weekend logs
  const weekendLogs = logs.filter((l: any) => {
    const d = new Date(l.created_at).getDay()
    return d === 0 || d === 6
  })

  // Days with logs
  const logDays = new Set(logs.map((l: any) => l.created_at?.split('T')[0]))
  const drinkDays = new Set(drinkLogs.map((l: any) => l.created_at?.split('T')[0]))

  // Consecutive day streaks (any log)
  const sortedDays = [...logDays].sort()
  let maxStreak = 0, currentStreak = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1])
    const curr = new Date(sortedDays[i])
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays === 1) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak) }
    else { currentStreak = 1 }
  }
  if (sortedDays.length === 1) maxStreak = 1
  maxStreak = Math.max(maxStreak, currentStreak)

  // Dry streak (consecutive days without drinks)
  const allDaysSorted = [...logDays, ...drinkDays].sort()
  let maxDryStreak = 0
  if (allDaysSorted.length > 0) {
    // Look at the last 60 days
    const today = new Date()
    let dryCount = 0
    for (let i = 0; i < 60; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      if (drinkDays.has(key)) { maxDryStreak = Math.max(maxDryStreak, dryCount); dryCount = 0 }
      else { dryCount++ }
    }
    maxDryStreak = Math.max(maxDryStreak, dryCount)
  }

  // Days with multiple categories
  const daysWithMultiCats = (() => {
    const dayMap = new Map<string, Set<string>>()
    logs.forEach((l: any) => {
      const day = l.created_at?.split('T')[0]
      if (!dayMap.has(day)) dayMap.set(day, new Set())
      dayMap.get(day)!.add(l.category)
    })
    return [...dayMap.values()].filter(cats => cats.size >= 2).length
  })()

  // Balanced life: gym + drink in same week
  const hasBalancedWeek = (() => {
    const weekMap = new Map<string, Set<string>>()
    logs.forEach((l: any) => {
      const d = new Date(l.created_at)
      const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}`
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Set())
      weekMap.get(weekKey)!.add(l.category)
    })
    return [...weekMap.values()].some(cats => cats.has('gym') && cats.has('drink'))
  })()

  // Month with 20+ log days
  const monthDayCounts = (() => {
    const monthMap = new Map<string, Set<string>>()
    logs.forEach((l: any) => {
      const day = l.created_at?.split('T')[0]
      const month = day?.substring(0, 7) // YYYY-MM
      if (!monthMap.has(month)) monthMap.set(month, new Set())
      monthMap.get(month)!.add(day)
    })
    let best = 0
    monthMap.forEach(days => best = Math.max(best, days.size))
    return best
  })()

  const level = profile?.level || 1

  // ── Build progress for each badge ──
  const p = (key: string, current: number, target: number) => {
    progress[key] = { current: Math.min(current, target), target, done: current >= target }
  }

  // Drinking
  p('first_drop', drinkLogs.length, 1)
  p('getting_warmed_up', drinkLogs.length, 5)
  p('iron_liver', drinkLogs.length, 50)
  p('centurion', drinkLogs.length, 100)
  p('sake_sommelier', uniqueDrinkNames.size, 10)
  p('night_owl', midnightDrinks.length, 3)
  p('weekend_warrior', weekendLogs.length, 5)
  p('double_down', daysWithMultiCats, 1)

  // Wellness
  p('dry_streak_3', maxDryStreak, 3)
  p('dry_streak_7', maxDryStreak, 7)
  p('gym_rat', gymLogs.length, 10)
  p('hydrated', waterLogs.length, 15)
  p('balanced_life', hasBalancedWeek ? 1 : 0, 1)
  p('detox_champion', detoxLogs.length, 5)

  // Social
  p('social_butterfly', groups.length, 3)
  p('session_starter', sessions.length, 1)
  p('recipe_sharer', recipeLogs.length, 3)
  p('party_host', sessions.length, 5)

  // Milestones
  p('consistent_logger', maxStreak, 7)
  p('month_of_logs', monthDayCounts, 20)
  p('jack_of_all', allCategories.size, 4)
  p('snapshot_collector', photoLogs.length, 10)
  p('level_5', level, 5)
  p('level_10', level, 10)

  return { earned: earnedBadges, progress }
}

// ── Award badges that are newly completed ──
export async function evaluateAndAwardBadges(userId: string) {
  try {
    const { earned, progress } = await getChallengeProgress(userId)

    const toAward: string[] = []
    for (const [key, prog] of Object.entries(progress)) {
      const def = BADGE_DEFINITIONS[key]
      if (prog.done && def && !earned.includes(def.name)) {
        toAward.push(key)
      }
    }

    if (toAward.length === 0) return

    for (const badgeKey of toAward) {
      const def = BADGE_DEFINITIONS[badgeKey]

      // Upsert badge definition globally
      const { data: badgeData } = await supabase
        .from("badges")
        .select("id")
        .eq("name", def.name)
        .single()

      let badgeId = badgeData?.id

      if (!badgeId) {
        const { data: newBadge } = await supabase
          .from("badges")
          .insert({ name: def.name, icon_text: def.icon_text, description: def.description })
          .select("id")
          .single()
        badgeId = newBadge?.id
      }

      if (badgeId) {
        await supabase.from("user_badges").insert({
          user_id: userId,
          badge_id: badgeId
        })
      }
    }

  } catch (err) {
    console.error("Error evaluating badges:", err)
  }
}
