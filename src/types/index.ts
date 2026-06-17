// ─── Shared Type Definitions ─────────────────────────────────────
// Single source of truth for all types used across the app.

import type { User } from "@supabase/supabase-js"

// ─── Theme ───────────────────────────────────────────────────────
// Two refined looks: clean Light (default) + Dark.
export type Theme = "light" | "dark"

// ─── Activity ────────────────────────────────────────────────────
export type ActivityCategory = 'drink' | 'cigarette' | 'snack' | 'gym' | 'detox' | 'water'

export interface ActivityLog {
  id: string
  user_id: string
  category: string
  item_name: string
  quantity: number
  xp_earned: number
  photo_url: string | null
  created_at: string
  profiles?: { username: string; level?: number }
  log_appraisals?: { vote_type: string; appraiser_id: string }[]
  photo_metadata?: PhotoMetadata | null
  photo_verifications?: { verifier_id: string; profiles?: { username: string } }[]
  // Optional fields used by some pages
  group_id?: string
  privacy?: string
  recipe_details?: string
  mood_tag?: string
}

export interface PhotoMetadata {
  timestamp?: string
  latitude?: number
  longitude?: number
  camera?: string
  make?: string
  model?: string
  [key: string]: unknown
}

// ─── Profile ─────────────────────────────────────────────────────
export interface UserProfile {
  id: string
  username: string
  xp: number
  level: number
  avatar_url: string | null
  bio: string | null
  college: string | null
  city: string | null
  country: string | null
  stealth_mode?: boolean
  privacy_settings?: PrivacySettings
  current_streak?: number
  longest_streak?: number
  last_activity_date?: string
  archetype?: string
  theme_preference?: string
  // V2 fields
  is_premium?: boolean
  premium_expires_at?: string
  role?: 'user' | 'bar_admin' | 'super_admin'
  managed_bar_id?: string
  anonymity_mode?: boolean
  loyalty_points?: number
  emergency_contacts?: string[]
}

export interface PrivacySettings {
  beer_counter: 'public' | 'group' | 'private'
  location_sharing: 'on' | 'off'
}

// ─── Rank & Badges ───────────────────────────────────────────────
export interface RankUser {
  id: string
  username: string
  xp: number
  level?: number
  city?: string
  country?: string
  top_recipe?: string
}

export interface Badge {
  id: string
  name: string
  icon_text: string
}

// ─── Recipes ─────────────────────────────────────────────────────
export interface Recipe {
  id: string
  item_name: string
  category: string
  xp_earned: number
}

// ─── Groups ──────────────────────────────────────────────────────
export interface Group {
  id: string
  name: string
  invite_code: string
  crew_streak?: number
}

export interface GroupMember {
  id: string
  username: string
}

// ─── Feed ────────────────────────────────────────────────────────
export interface FeedItem {
  type: 'log' | 'party'
  date: string
  data: ActivityLog | PartyPreview
}

// ─── Party / Session ─────────────────────────────────────────────
export interface PartyPreview {
  id: string
  title: string
  event_date: string
  address: string
  host_id: string
  profiles?: { username: string }
}

export interface DrinkingSession {
  id: string
  join_code: string
}

// ─── World ───────────────────────────────────────────────────────
export interface WorldExperience {
  id: string
  user_id: string
  title: string
  content: string
  likes_count: number
  created_at: string
  profiles: { username: string; avatar_url: string }
  reactions?: Record<string, string[]>
  comments?: WorldComment[]
}

export interface WorldComment {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { username: string; avatar_url?: string }
}

export interface WorldActivity {
  id: string
  user_id: string
  item_name: string
  category: string
  xp_earned: number
  photo_metadata?: PhotoMetadata
  created_at: string
  profiles: { username: string; avatar_url: string }
}

export interface TrendingItem {
  item_name: string
  category: string
  count: number
}

export interface Challenge {
  id: string
  title: string
  description: string
  target: number
  current: number
  icon: string
}

// ─── Friends ─────────────────────────────────────────────────────
export interface Friend {
  friend_id: string
  username: string
  avatar_url: string
  level: number
  xp: number
}

export interface PastPartier {
  suggested_id: string
  username: string
  avatar_url: string
  interaction_count: number
}

export interface FriendRequest {
  id: string
  user_1: string
  user_2: string
  status: string
  profiles: { id: string; username: string; avatar_url: string }
}

// ─── Calendar ────────────────────────────────────────────────────
export interface DayLog {
  date: string
  drinks: number
  categories: string[]
  items: { name: string; qty: number; category: string; xp: number; mood?: string }[]
  totalXp: number
}

// ─── Context ─────────────────────────────────────────────────────
export interface ChugContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  onXpGain?: (delta: number) => void
  onLevelUp?: () => void
}

// Re-export User for convenience
export type { User }
